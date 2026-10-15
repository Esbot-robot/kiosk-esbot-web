-- Deshace carita.sql: enviar_comando vuelve a aceptar solo actualizar,
-- reiniciar y videollamada, y la campana vuelve a su texto anterior.
-- Quita antes el botón del panel y la app que usan la carita.

create or replace function public.enviar_comando(p_serial text, p_comando text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  if p_comando not in ('actualizar', 'reiniciar', 'videollamada') then
    raise exception 'Orden no válida: %', p_comando;
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
      case new.comando
        when 'actualizar' then 'pidió actualizar la config de '
        when 'reiniciar' then 'reinició la app de '
        when 'videollamada' then 'abrió una videollamada con '
        else 'envió una orden a '
      end || v_robot,
      v_robot);
  end if;
  return null;
end $$;
