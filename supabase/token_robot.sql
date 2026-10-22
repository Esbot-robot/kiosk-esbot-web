-- ───────────────────────────────────────────────────────────────────────────
-- Token por robot — PASO A (aditivo: no cierra nada, los robots siguen igual)
--
-- Hoy cualquiera con la clave pública y el serial de un robot puede escribir
-- en robot_status (ruta, modo quieto, órdenes) y leer el enlace de su
-- videollamada, y puede insertar eventos falsos de analítica.
--
-- Este archivo agrega, sin tocar lo existente:
--   robot_tokens              huella (hash) del token de cada robot y su código
--                             de vinculación temporal. Nadie la lee por la API.
--   crear_codigo_vinculacion  el panel genera un código de 8 caracteres (15 min,
--                             un solo uso) que se escribe en el robot.
--   reclamar_robot            el robot cambia ese código por su token largo.
--   latido                    el latido con token: valida y escribe SOLO los
--                             campos del robot; responde la misma fila de hoy.
--   registrar_evento          lo mismo para los eventos de analítica.
--   revocar_vinculo           el panel invalida el token de un robot.
--   listar_vinculos           el panel ve qué robots están vinculados.
--
-- Mientras no se corra token_robot_cerrar.sql (PASO C), los robots que aún no
-- tienen token siguen entrando por el camino anterior sin ningún error.
--
-- Correr una sola vez en el SQL Editor, ANTES de instalar la app 1.15.
-- Para deshacer: token_robot_revertir.sql.
-- ───────────────────────────────────────────────────────────────────────────

-- ── 1. Tabla de tokens (solo huellas; el token real vive en el robot) ──
create table if not exists public.robot_tokens (
  serial text primary key,
  token_hash text,
  vinculado_at timestamptz,
  codigo_hash text,
  codigo_expira timestamptz,
  codigo_intentos int not null default 0
);

alter table public.robot_tokens enable row level security;
-- Sin políticas a propósito: nadie entra por la API; solo las funciones de abajo.
revoke all on public.robot_tokens from anon, authenticated;

-- ── 2. Apoyo interno (no se puede llamar desde afuera) ──
create or replace function public.hash_secreto(p text)
returns text language sql immutable as $$
  select encode(sha256(convert_to(p, 'UTF8')), 'hex')
$$;
revoke all on function public.hash_secreto(text) from public, anon, authenticated;

create or replace function public.robot_token_valido(p_serial text, p_token text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.robot_tokens
     where serial = p_serial
       and token_hash is not null
       and token_hash = public.hash_secreto(coalesce(p_token, ''))
  )
$$;
revoke all on function public.robot_token_valido(text, text) from public, anon, authenticated;

-- ── 3. Panel: generar el código de vinculación (solo administradores) ──
create or replace function public.crear_codigo_vinculacion(p_serial text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  -- sin 0/O ni 1/I para que no se confundan al escribirlo en el robot
  v_alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_posiciones constant int[] := array[0, 1, 2, 3, 4, 5, 9, 10]; -- bytes completamente aleatorios del uuid
  v_bytes bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  v_codigo text := '';
  i int;
begin
  if not public.es_admin() then
    raise exception 'No tienes permiso para vincular robots';
  end if;
  if not exists (select 1 from public.robot_status where serial = p_serial) then
    raise exception 'El robot % todavía no ha enviado ningún latido', p_serial;
  end if;
  foreach i in array v_posiciones loop
    v_codigo := v_codigo || substr(v_alfabeto, (get_byte(v_bytes, i) % 32) + 1, 1);
  end loop;
  insert into public.robot_tokens (serial, codigo_hash, codigo_expira, codigo_intentos)
  values (p_serial, public.hash_secreto(v_codigo), now() + interval '15 minutes', 0)
  on conflict (serial) do update
     set codigo_hash = excluded.codigo_hash,
         codigo_expira = excluded.codigo_expira,
         codigo_intentos = 0;
  return v_codigo;
end $$;
revoke all on function public.crear_codigo_vinculacion(text) from public, anon;
grant execute on function public.crear_codigo_vinculacion(text) to authenticated;

-- ── 4. Robot: cambiar el código por su token ──
-- Devuelve null si el código no sirve (en vez de lanzar un error, para que el
-- conteo de intentos fallidos no se deshaga con la transacción).
create or replace function public.reclamar_robot(p_serial text, p_codigo text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v public.robot_tokens;
  v_token text;
begin
  select * into v from public.robot_tokens where serial = p_serial for update;
  if not found or v.codigo_hash is null or v.codigo_expira < now() or v.codigo_intentos >= 5 then
    return null;
  end if;
  if v.codigo_hash <> public.hash_secreto(upper(btrim(coalesce(p_codigo, '')))) then
    update public.robot_tokens set codigo_intentos = codigo_intentos + 1 where serial = p_serial;
    return null;
  end if;
  -- dos uuid aleatorios seguidos: 64 caracteres hexadecimales
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  update public.robot_tokens
     set token_hash = public.hash_secreto(v_token),
         vinculado_at = now(),
         codigo_hash = null,
         codigo_expira = null,
         codigo_intentos = 0
   where serial = p_serial;
  return v_token;
end $$;
revoke all on function public.reclamar_robot(text, text) from public;
grant execute on function public.reclamar_robot(text, text) to anon, authenticated;

-- ── 5. Panel: revocar el vínculo y ver el estado ──
create or replace function public.revocar_vinculo(p_serial text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then
    raise exception 'No tienes permiso para vincular robots';
  end if;
  update public.robot_tokens
     set token_hash = null, vinculado_at = null,
         codigo_hash = null, codigo_expira = null, codigo_intentos = 0
   where serial = p_serial;
end $$;
revoke all on function public.revocar_vinculo(text) from public, anon;
grant execute on function public.revocar_vinculo(text) to authenticated;

create or replace function public.listar_vinculos()
returns table (serial text, vinculado boolean, vinculado_at timestamptz, codigo_vigente boolean)
language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then
    raise exception 'No tienes permiso para ver los vínculos de los robots';
  end if;
  return query
    select s.serial,
           coalesce(t.token_hash is not null, false),
           t.vinculado_at,
           coalesce(t.codigo_hash is not null and t.codigo_expira > now() and t.codigo_intentos < 5, false)
      from public.robot_status s
      left join public.robot_tokens t on t.serial = s.serial;
end $$;
revoke all on function public.listar_vinculos() from public, anon;
grant execute on function public.listar_vinculos() to authenticated;

-- ── 6. Robot: el latido con token ──
-- Reemplaza el upsert directo. Solo se escriben los campos que el robot puede
-- cambiar y solo si vienen en p_datos (igual que el upsert anterior, que dejaba
-- intacto lo que no se enviaba). Responde la fila completa en el mismo formato.
-- Con token inválido responde HTTP 401 (PT401).
create or replace function public.latido(p_serial text, p_token text, p_datos jsonb)
returns setof public.robot_status
language plpgsql security definer set search_path = public as $$
begin
  if not public.robot_token_valido(p_serial, p_token) then
    raise exception 'token_invalido' using errcode = 'PT401';
  end if;

  insert into public.robot_status (serial) values (p_serial) on conflict (serial) do nothing;

  update public.robot_status set
    nombre = case when p_datos ? 'nombre' then p_datos ->> 'nombre' else nombre end,
    bateria = case when p_datos ? 'bateria' then (p_datos ->> 'bateria')::int else bateria end,
    cargando = case when p_datos ? 'cargando' then (p_datos ->> 'cargando')::boolean else cargando end,
    quieto_confirmado = case when p_datos ? 'quieto_confirmado'
      then coalesce((p_datos ->> 'quieto_confirmado')::boolean, quieto_confirmado) else quieto_confirmado end,
    quieto_orden_hecha = case when p_datos ? 'quieto_orden_hecha'
      then coalesce((p_datos ->> 'quieto_orden_hecha')::bigint, quieto_orden_hecha) else quieto_orden_hecha end,
    version_config = case when p_datos ? 'version_config' then (p_datos ->> 'version_config')::int else version_config end,
    quieto = case when p_datos ? 'quieto' then coalesce((p_datos ->> 'quieto')::boolean, quieto) else quieto end,
    ubicaciones_mapa = case when p_datos ? 'ubicaciones_mapa' then p_datos -> 'ubicaciones_mapa' else ubicaciones_mapa end,
    comando_hecho_id = case when p_datos ? 'comando_hecho_id' then (p_datos ->> 'comando_hecho_id')::bigint else comando_hecho_id end,
    videollamada_id = case when p_datos ? 'videollamada_id' then (p_datos ->> 'videollamada_id')::bigint else videollamada_id end,
    videollamada_url = case when p_datos ? 'videollamada_url' then p_datos ->> 'videollamada_url' else videollamada_url end,
    videollamada_error = case when p_datos ? 'videollamada_error' then p_datos ->> 'videollamada_error' else videollamada_error end,
    ruta = case when p_datos ? 'ruta' then p_datos -> 'ruta' else ruta end,
    ruta_actualizada_ms = case when p_datos ? 'ruta_actualizada_ms' then (p_datos ->> 'ruta_actualizada_ms')::bigint else ruta_actualizada_ms end
  where serial = p_serial;

  return query select * from public.robot_status where serial = p_serial;
end $$;
revoke all on function public.latido(text, text, jsonb) from public;
grant execute on function public.latido(text, text, jsonb) to anon, authenticated;

-- ── 7. Robot: un evento de analítica con token ──
-- La hora llega como texto (hora local del robot, sin zona) y se interpreta como
-- siempre; el proyecto es el que el robot envía si existe, o el que tiene fijado.
create or replace function public.registrar_evento(
  p_serial text,
  p_token text,
  p_tipo text,
  p_video_seg double precision default null,
  p_pregunta text default null,
  p_respuesta text default null,
  p_creado_at text default null,
  p_project_id uuid default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_proyecto uuid;
begin
  if not public.robot_token_valido(p_serial, p_token) then
    raise exception 'token_invalido' using errcode = 'PT401';
  end if;
  if p_tipo !~ '^[a-z_]{1,40}$' then
    raise exception 'tipo de evento no válido';
  end if;

  select id into v_proyecto from public.projects where id = p_project_id;
  if v_proyecto is null then
    select project_id into v_proyecto from public.robots where serial = p_serial;
  end if;

  insert into public.events (serial, tipo, video_seg, pregunta, respuesta, creado_at, project_id)
  values (
    p_serial, p_tipo, p_video_seg, left(p_pregunta, 500), left(p_respuesta, 500),
    coalesce(nullif(p_creado_at, '')::timestamptz, now()),
    v_proyecto
  );
end $$;
revoke all on function public.registrar_evento(text, text, text, double precision, text, text, text, uuid) from public;
grant execute on function public.registrar_evento(text, text, text, double precision, text, text, text, uuid) to anon, authenticated;
