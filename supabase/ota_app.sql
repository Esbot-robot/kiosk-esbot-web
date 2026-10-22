-- ───────────────────────────────────────────────────────────────────────────
-- Actualización remota de la app del robot (OTA)
--
-- El super administrador sube una versión de la APK desde el panel y ordena la
-- actualización robot por robot (nunca a todos a la vez). El robot descarga la
-- APK, verifica su huella y su firma, y Android pide confirmar la instalación en
-- la pantalla del robot. Después reporta la versión que quedó instalada.
--
-- Este archivo agrega, sin tocar lo que ya funciona:
--   bucket "apks"                 privado; solo el super administrador sube y borra.
--                                 Los robots descargan con un enlace temporal que
--                                 entrega la Edge Function "apk-descarga".
--   app_versiones                 versiones subidas (código, nombre, huella, ruta).
--   robot_status                  3 columnas: versión instalada y estado de la
--                                 actualización en curso.
--   registrar_version_app         guarda una versión ya subida al bucket.
--   eliminar_version_app          borra la fila y devuelve la ruta del archivo.
--   latido                        ahora también escribe la versión instalada.
--   enviar_comando                nueva orden 'actualizar_app:<código>' (solo super
--                                 administrador; la versión debe existir).
--   actividad_robot_status        la campana anota "pidió actualizar la app de …".
--
-- Correr una sola vez en el SQL Editor, después de token_robot.sql y de decir.sql,
-- y ANTES de publicar el panel y de instalar la app que envía la versión.
-- Para deshacer: ota_app_revertir.sql
-- ───────────────────────────────────────────────────────────────────────────

-- ── 1. Bucket privado para las APK (50 MB por archivo, el máximo del plan gratuito) ──
insert into storage.buckets (id, name, public, file_size_limit)
values ('apks', 'apks', false, 52428800)
on conflict (id) do nothing;

create policy "superadmin sube apks" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'apks' and public.es_superadmin());

create policy "superadmin reemplaza apks" on storage.objects
  for update to authenticated
  using (bucket_id = 'apks' and public.es_superadmin())
  with check (bucket_id = 'apks' and public.es_superadmin());

create policy "superadmin lee apks" on storage.objects
  for select to authenticated
  using (bucket_id = 'apks' and public.es_superadmin());

create policy "superadmin borra apks" on storage.objects
  for delete to authenticated
  using (bucket_id = 'apks' and public.es_superadmin());

-- ── 2. Versiones subidas ──
create table public.app_versiones (
  version_code int primary key,
  version_name text not null,
  apk_path text not null,
  sha256 text not null,
  tamano_bytes bigint not null,
  notas text,
  subida_por text,
  creado_at timestamptz not null default now()
);

alter table public.app_versiones enable row level security;
revoke all on public.app_versiones from anon;

-- Los administradores la leen (el panel muestra la versión más reciente); nadie
-- escribe directo: se hace con las funciones de abajo.
create policy "admin lee versiones" on public.app_versiones
  for select to authenticated using (public.es_admin());

-- ── 3. Versión instalada en cada robot y estado de la actualización ──
alter table public.robot_status
  add column if not exists app_version_code int,
  add column if not exists app_version_name text,
  add column if not exists app_actualizacion text;

-- ── 4. Panel (solo super administrador): registrar y eliminar versiones ──
create or replace function public.registrar_version_app(
  p_version_code int,
  p_version_name text,
  p_apk_path text,
  p_sha256 text,
  p_tamano_bytes bigint,
  p_notas text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_nombre text;
begin
  if not public.es_superadmin() then
    raise exception 'Solo el super administrador puede subir versiones de la app';
  end if;
  if p_version_code is null or p_version_code < 1 then
    raise exception 'El código de versión debe ser un número positivo';
  end if;
  if p_version_name !~ '^[0-9]+(\.[0-9]+){1,3}$' then
    raise exception 'El nombre de la versión debe parecerse a 1.17';
  end if;
  if p_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'La huella SHA-256 no es válida';
  end if;
  if p_tamano_bytes is null or p_tamano_bytes < 1 then
    raise exception 'El tamaño del archivo no es válido';
  end if;
  -- el archivo debe estar ya en el bucket: no se registra una versión sin APK
  if not exists (select 1 from storage.objects where bucket_id = 'apks' and name = p_apk_path) then
    raise exception 'El archivo de la APK todavía no está en el almacenamiento';
  end if;
  select nombre into v_nombre from public.perfiles where user_id = auth.uid();
  insert into public.app_versiones (version_code, version_name, apk_path, sha256, tamano_bytes, notas, subida_por)
  values (p_version_code, p_version_name, p_apk_path, p_sha256, p_tamano_bytes, nullif(btrim(p_notas), ''), v_nombre);
end $$;
revoke all on function public.registrar_version_app(int, text, text, text, bigint, text) from public, anon;
grant execute on function public.registrar_version_app(int, text, text, text, bigint, text) to authenticated;

-- Borra la fila y devuelve la ruta del archivo: SQL no puede borrar el archivo físico
-- del bucket; el panel lo hace con la API de Storage.
create or replace function public.eliminar_version_app(p_version_code int)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_ruta text;
begin
  if not public.es_superadmin() then
    raise exception 'Solo el super administrador puede eliminar versiones de la app';
  end if;
  delete from public.app_versiones where version_code = p_version_code returning apk_path into v_ruta;
  if v_ruta is null then
    raise exception 'Esa versión no existe';
  end if;
  return v_ruta;
end $$;
revoke all on function public.eliminar_version_app(int) from public, anon;
grant execute on function public.eliminar_version_app(int) to authenticated;

-- ── 5. Robot: el latido ahora también escribe la versión instalada ──
-- Igual a la versión de token_robot.sql, con tres campos más. Una app anterior que no
-- los envía sigue funcionando: los campos que no vienen no se tocan.
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
    ruta_actualizada_ms = case when p_datos ? 'ruta_actualizada_ms' then (p_datos ->> 'ruta_actualizada_ms')::bigint else ruta_actualizada_ms end,
    app_version_code = case when p_datos ? 'app_version_code' then (p_datos ->> 'app_version_code')::int else app_version_code end,
    app_version_name = case when p_datos ? 'app_version_name' then left(p_datos ->> 'app_version_name', 20) else app_version_name end,
    app_actualizacion = case when p_datos ? 'app_actualizacion' then left(p_datos ->> 'app_actualizacion', 200) else app_actualizacion end
  where serial = p_serial;

  return query select * from public.robot_status where serial = p_serial;
end $$;
revoke all on function public.latido(text, text, jsonb) from public;
grant execute on function public.latido(text, text, jsonb) to anon, authenticated;

-- ── 6. Órdenes: 'actualizar_app:<código>' (solo super administrador) ──
-- Igual a la versión de decir.sql (mantiene actualizar, reiniciar, videollamada,
-- carita, quitar_carita y decir) con la orden nueva.
create or replace function public.enviar_comando(p_serial text, p_comando text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  if not (
    p_comando in ('actualizar', 'reiniciar', 'videollamada', 'quitar_carita')
    -- 'carita:' + nombre de la secuencia (1 a 80 caracteres)
    or (p_comando like 'carita:%' and char_length(p_comando) between 8 and 87)
    -- 'decir:' + JSON con la frase (hasta 300 caracteres) y sus opciones
    or (p_comando like 'decir:{%}' and char_length(p_comando) between 10 and 900)
    -- 'actualizar_app:' + código de la versión (solo números)
    or p_comando ~ '^actualizar_app:[0-9]{1,6}$'
  ) then
    raise exception 'Orden no válida: %', left(p_comando, 40);
  end if;

  if p_comando like 'actualizar_app:%' then
    if not public.es_superadmin() then
      raise exception 'Solo el super administrador puede actualizar la app de un robot';
    end if;
    if not exists (
      select 1 from public.app_versiones
       where version_code = substr(p_comando, char_length('actualizar_app:') + 1)::int
    ) then
      raise exception 'Esa versión de la app no existe';
    end if;
  end if;

  update public.robot_status
     set comando = p_comando,
         comando_id = v_id
   where serial = p_serial;
  if not found then
    raise exception 'El robot % todavía no ha enviado ningún latido', p_serial;
  end if;
  return v_id;
end $$;

revoke all on function public.enviar_comando(text, text) from public, anon;
grant execute on function public.enviar_comando(text, text) to authenticated;

-- ── 7. Campana: texto de la orden nueva (el resto, igual que en decir.sql) ──
create or replace function public.actividad_robot_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_robot text := coalesce(nullif(new.nombre, ''), new.serial);
begin
  if auth.uid() is null then return null; end if;
  if new.quieto is distinct from old.quieto then
    perform public.registrar_actividad(
      'recorrido',
      case when new.quieto then 'detuvo el recorrido de ' else 'reanudó el recorrido de ' end || v_robot,
      v_robot);
  end if;
  if new.ruta is distinct from old.ruta then
    perform public.registrar_actividad('ruta', 'cambió la ruta de ' || v_robot, v_robot,
      jsonb_build_object('ruta', new.ruta));
  end if;
  if new.comando_id is distinct from old.comando_id then
    perform public.registrar_actividad(
      'orden',
      case
        when new.comando = 'actualizar' then 'pidió actualizar la config de '
        when new.comando = 'reiniciar' then 'reinició la app de '
        when new.comando = 'videollamada' then 'abrió una videollamada con '
        when new.comando like 'carita:%' then 'mostró la carita en '
        when new.comando = 'quitar_carita' then 'quitó la carita de '
        when new.comando like 'decir:%' then 'hizo hablar a '
        when new.comando like 'actualizar_app:%' then 'pidió actualizar la app de '
        else 'envió una orden a '
      end || v_robot,
      v_robot);
  end if;
  return null;
end $$;
