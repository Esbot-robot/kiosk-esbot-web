-- ============================================================
-- Kiosk Esbot — registro de contactos (formulario por QR)
-- Ejecutar UNA VEZ en: Dashboard de Supabase -> SQL Editor -> New query
-- (fotos.sql ya debe estar aplicado). Para deshacerlo: contactos_revertir.sql
--
-- Dos entradas al mismo formulario:
--   foto      -> QR de la pantalla de resultado: /registro#f.<id de la foto>
--   registro  -> botón de registro del robot:     /registro#r.<registro_token>.<sesión>
-- La sesión del botón la genera el robot (UUID) cada vez que muestra el QR,
-- sin consultar al servidor: así el QR sale aunque el robot esté sin internet.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Token del formulario, uno por proyecto
--    Aparte de galeria_token: ese abre la galería y debe quedar privado.
--    Este solo sirve para enviar el formulario, así que puede ir en la
--    config pública del robot (configs/{serial}.json).
-- ------------------------------------------------------------
alter table public.projects
  add column if not exists registro_token text
  default replace(gen_random_uuid()::text, '-', '');

update public.projects
set registro_token = replace(gen_random_uuid()::text, '-', '')
where registro_token is null;

alter table public.projects alter column registro_token set not null;

create unique index if not exists projects_registro_token_idx
  on public.projects (registro_token);

-- ------------------------------------------------------------
-- 2. Contactos
--    foto_id sin llave foránea: cuando la limpieza borra una foto vencida,
--    el contacto se conserva con su número.
-- ------------------------------------------------------------
create table public.contactos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  origen text not null check (origen in ('foto', 'registro')),
  foto_id uuid,
  foto_numero int,
  -- en la foto es el mismo foto_id; en el botón, la sesión del QR
  sesion uuid not null,
  -- robot que tomó la foto (en el botón no se conoce: la sesión es local)
  serial text,
  nombre text not null,
  correo text not null,
  celular text not null,
  -- el formulario no deja enviar sin la casilla: queda la constancia
  autoriza boolean not null,
  creado_at timestamptz not null default now()
);

create index contactos_project_idx on public.contactos (project_id, creado_at desc);
create index contactos_sesion_idx on public.contactos (sesion, creado_at);

-- ------------------------------------------------------------
-- 3. Seguridad
--    El público nunca toca la tabla: todo pasa por las funciones de abajo.
--    El panel (usuario con sesión) la lee y la borra.
-- ------------------------------------------------------------
alter table public.contactos enable row level security;

create policy "panel lee contactos" on public.contactos
  for select to authenticated using (true);
create policy "panel borra contactos" on public.contactos
  for delete to authenticated using (true);

-- ------------------------------------------------------------
-- 4. Lo que necesita la página del formulario
--    La clave es lo que va después del # en el QR. Devuelve null si la
--    clave no existe o la foto ya venció (la página muestra "ya no está
--    disponible").
-- ------------------------------------------------------------
create or replace function public.formulario_info(p_clave text)
returns json
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_partes text[] := string_to_array(coalesce(p_clave, ''), '.');
  v_foto public.fotos%rowtype;
  v_config jsonb;
  v_form jsonb;
begin
  if v_partes[1] = 'f' and array_length(v_partes, 1) = 2 then
    begin
      select * into v_foto from public.fotos where id = v_partes[2]::uuid and expira_at > now();
    exception when invalid_text_representation then
      return null;
    end;
    if v_foto.id is null then return null; end if;
    select config into v_config from public.projects where id = v_foto.project_id;
    v_form := coalesce(v_config #> '{pantalla_inicial,boton_foto,formulario}', '{}'::jsonb);
    return json_build_object(
      'origen', 'foto',
      'formulario', v_form,
      'foto_id', v_foto.id,
      'foto_numero', v_foto.numero,
      'foto_estado', v_foto.estado
    );
  elsif v_partes[1] = 'r' and array_length(v_partes, 1) = 3 then
    select config into v_config from public.projects where registro_token = v_partes[2];
    if v_config is null then return null; end if;
    v_form := coalesce(v_config #> '{pantalla_inicial,boton_registro,formulario}', '{}'::jsonb);
    return json_build_object('origen', 'registro', 'formulario', v_form);
  end if;
  return null;
end;
$$;

-- ------------------------------------------------------------
-- 5. Guardar un contacto
--    Repite las validaciones de la página por si alguien la salta.
--    Devuelve {ok:true} o {ok:false, error:'...'} con un texto que la
--    página muestra tal cual.
-- ------------------------------------------------------------
create or replace function public.registrar_contacto(
  p_clave text,
  p_nombre text,
  p_correo text,
  p_celular text,
  p_autoriza boolean
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partes text[] := string_to_array(coalesce(p_clave, ''), '.');
  v_nombre text := regexp_replace(trim(coalesce(p_nombre, '')), '\s+', ' ', 'g');
  v_correo text := lower(trim(coalesce(p_correo, '')));
  v_celular text := regexp_replace(coalesce(p_celular, ''), '\D', '', 'g');
  v_project uuid;
  v_origen text;
  v_sesion uuid;
  v_foto public.fotos%rowtype;
begin
  if coalesce(p_autoriza, false) is not true then
    return json_build_object('ok', false, 'error', 'Debes aceptar la autorización de datos.');
  end if;
  if char_length(v_nombre) < 2 or char_length(v_nombre) > 60 then
    return json_build_object('ok', false, 'error', 'Escribe tu nombre.');
  end if;
  if char_length(v_correo) > 120 or v_correo !~ '^[^@\s]+@[^@\s]+\.[a-z]{2,}$' then
    return json_build_object('ok', false, 'error', 'Revisa el correo.');
  end if;
  if v_celular !~ '^3\d{9}$' then
    return json_build_object('ok', false, 'error', 'El celular debe tener 10 dígitos y empezar por 3.');
  end if;

  begin
    if v_partes[1] = 'f' and array_length(v_partes, 1) = 2 then
      select * into v_foto from public.fotos where id = v_partes[2]::uuid and expira_at > now();
      v_project := v_foto.project_id;
      v_origen := 'foto';
      v_sesion := v_foto.id;
    elsif v_partes[1] = 'r' and array_length(v_partes, 1) = 3 then
      select id into v_project from public.projects where registro_token = v_partes[2];
      v_origen := 'registro';
      v_sesion := v_partes[3]::uuid;
    end if;
  exception when invalid_text_representation then
    v_project := null;
  end;

  if v_project is null then
    return json_build_object('ok', false, 'error', 'Este enlace ya no está disponible.');
  end if;

  -- Doble toque o reintento de la red: mismo correo en la misma sesión hace
  -- poco = ya quedó guardado, se responde ok sin duplicar
  if exists (
    select 1 from public.contactos
    where sesion = v_sesion and correo = v_correo and creado_at > now() - interval '10 minutes'
  ) then
    return json_build_object('ok', true);
  end if;

  -- Freno a registros falsos con un enlace copiado
  if (select count(*) from public.contactos where sesion = v_sesion) >= 20 then
    return json_build_object('ok', false, 'error', 'Este código ya recibió demasiados registros.');
  end if;

  insert into public.contactos
    (project_id, origen, foto_id, foto_numero, sesion, serial, nombre, correo, celular, autoriza)
  values
    (v_project, v_origen, v_foto.id, v_foto.numero, v_sesion, v_foto.serial,
     v_nombre, v_correo, v_celular, true);

  return json_build_object('ok', true);
end;
$$;

-- ------------------------------------------------------------
-- 6. El robot pregunta si ya se registró alguien en su sesión
--    Solo la primera palabra del nombre del primer registro: nada de
--    correo ni celular. Null si todavía no hay nadie.
-- ------------------------------------------------------------
create or replace function public.primer_registro(p_sesion uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select split_part(c.nombre, ' ', 1)
  from public.contactos c
  where c.sesion = p_sesion
  order by c.creado_at
  limit 1;
$$;

-- ------------------------------------------------------------
-- 7. Permisos de ejecución
--    anon = el celular del visitante y el robot.
-- ------------------------------------------------------------
revoke all on function public.formulario_info(text) from public;
revoke all on function public.registrar_contacto(text, text, text, text, boolean) from public;
revoke all on function public.primer_registro(uuid) from public;

grant execute on function public.formulario_info(text) to anon, authenticated;
grant execute on function public.registrar_contacto(text, text, text, text, boolean) to anon, authenticated;
grant execute on function public.primer_registro(uuid) to anon, authenticated;
