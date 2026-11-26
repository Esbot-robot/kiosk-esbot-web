-- ============================================================
-- Revierte formulario_campos.sql: registrar_contacto vuelve a pedir
-- siempre nombre, correo y celular (la versión de contactos.sql).
-- Antes de correrlo, volver a poner los tres campos en los formularios
-- que se hayan quitado (o revertir el panel): si no, el formulario
-- mandaría campos vacíos y la función los rechazaría.
-- ============================================================

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

revoke all on function public.registrar_contacto(text, text, text, text, boolean) from public;
grant execute on function public.registrar_contacto(text, text, text, text, boolean) to anon, authenticated;
