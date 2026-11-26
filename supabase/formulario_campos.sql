-- ============================================================
-- Formulario de registro: campos que se pueden quitar
--
-- El panel guarda en la config qué datos pide cada formulario:
--   pantalla_inicial.boton_foto.formulario.campos
--   pantalla_inicial.boton_registro.formulario.campos
--   { "nombre": true, "correo": false, "celular": true }
-- Sin "campos" (proyectos de antes) se piden los tres, como siempre.
--
-- registrar_contacto valida solo los campos que pide el proyecto y guarda ''
-- en los que no pide (las columnas siguen siendo not null: no cambia la tabla).
-- primer_registro no cambia: sin nombre devuelve '' (no null), el robot lo
-- toma como "ya se registró" y usa la despedida sin nombre. La APK no cambia.
--
-- ORDEN: correr ESTE SQL antes de publicar el panel. El formulario nuevo manda
-- '' en los campos quitados y la función anterior los rechazaría.
-- Es compatible con el panel actual (si no hay "campos", pide los tres).
--
-- Reversión: formulario_campos_revertir.sql
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
  v_campos jsonb;
  v_pide_nombre boolean;
  v_pide_correo boolean;
  v_pide_celular boolean;
begin
  if coalesce(p_autoriza, false) is not true then
    return json_build_object('ok', false, 'error', 'Debes aceptar la autorización de datos.');
  end if;

  -- Primero el proyecto: de su config sale qué campos pide
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

  select config #> case v_origen
           when 'foto' then '{pantalla_inicial,boton_foto,formulario,campos}'::text[]
           else '{pantalla_inicial,boton_registro,formulario,campos}'::text[]
         end
    into v_campos
    from public.projects where id = v_project;

  -- Lo que no diga false se pide; si quedaran los tres apagados, se piden todos
  v_pide_nombre := coalesce(v_campos->>'nombre', 'true') <> 'false';
  v_pide_correo := coalesce(v_campos->>'correo', 'true') <> 'false';
  v_pide_celular := coalesce(v_campos->>'celular', 'true') <> 'false';
  if not (v_pide_nombre or v_pide_correo or v_pide_celular) then
    v_pide_nombre := true;
    v_pide_correo := true;
    v_pide_celular := true;
  end if;

  -- Lo que el formulario no pide se guarda vacío, aunque llegue algo
  if not v_pide_nombre then v_nombre := ''; end if;
  if not v_pide_correo then v_correo := ''; end if;
  if not v_pide_celular then v_celular := ''; end if;

  if v_pide_nombre and (char_length(v_nombre) < 2 or char_length(v_nombre) > 60) then
    return json_build_object('ok', false, 'error', 'Escribe tu nombre.');
  end if;
  if v_pide_correo and (char_length(v_correo) > 120 or v_correo !~ '^[^@\s]+@[^@\s]+\.[a-z]{2,}$') then
    return json_build_object('ok', false, 'error', 'Revisa el correo.');
  end if;
  if v_pide_celular and v_celular !~ '^3\d{9}$' then
    return json_build_object('ok', false, 'error', 'El celular debe tener 10 dígitos y empezar por 3.');
  end if;

  -- Doble toque o reintento de la red: los mismos datos en la misma sesión
  -- hace poco = ya quedó guardado, se responde ok sin duplicar
  if exists (
    select 1 from public.contactos
    where sesion = v_sesion
      and nombre = v_nombre and correo = v_correo and celular = v_celular
      and creado_at > now() - interval '10 minutes'
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

-- create or replace conserva los permisos; se repiten por si acaso
revoke all on function public.registrar_contacto(text, text, text, text, boolean) from public;
grant execute on function public.registrar_contacto(text, text, text, text, boolean) to anon, authenticated;
