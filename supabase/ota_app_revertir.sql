-- Deshace ota_app.sql: vuelve latido, enviar_comando y el disparador de la campana a
-- sus versiones anteriores y quita lo agregado.
--
-- ANTES: vaciar el bucket "apks" (Dashboard → Storage → apks, seleccionar todo, Delete).
-- Este archivo borra el bucket, y Supabase no deja borrar uno que tenga archivos.
-- Se pierden las versiones registradas y las columnas de versión de los robots.

drop function if exists public.eliminar_version_app(int);
drop function if exists public.registrar_version_app(int, text, text, text, bigint, text);
drop table if exists public.app_versiones;

drop policy if exists "superadmin sube apks" on storage.objects;
drop policy if exists "superadmin reemplaza apks" on storage.objects;
drop policy if exists "superadmin lee apks" on storage.objects;
drop policy if exists "superadmin borra apks" on storage.objects;
delete from storage.buckets where id = 'apks';

-- latido: la versión de token_robot.sql (sin los campos de versión de la app)
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

-- Las columnas se quitan después de volver al latido anterior (que ya no las usa)
alter table public.robot_status
  drop column if exists app_version_code,
  drop column if exists app_version_name,
  drop column if exists app_actualizacion;

-- enviar_comando: la versión de decir.sql
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
    or (p_comando like 'carita:%' and char_length(p_comando) between 8 and 87)
    or (p_comando like 'decir:{%}' and char_length(p_comando) between 10 and 900)
  ) then
    raise exception 'Orden no válida: %', left(p_comando, 40);
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

-- Campana: la versión de decir.sql
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
        else 'envió una orden a '
      end || v_robot,
      v_robot);
  end if;
  return null;
end $$;
