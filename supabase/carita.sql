-- ───────────────────────────────────────────────────────────────────────────
-- Carita del robot desde el panel (Robots → "Mostrar carita").
--
-- Agrega dos órdenes a enviar_comando:
--   'carita:<nombre de la secuencia>'  el robot reproduce en bucle esa
--                                      secuencia de temi Center (la carita)
--   'quitar_carita'                    la detiene y el robot vuelve a lo normal
-- El nombre viaja dentro de la orden: si la secuencia se borra o se renombra
-- en temi Center, basta escribir otro nombre en el panel.
--
-- También ajusta el texto de la campana para estas dos órdenes.
-- No crea tablas ni columnas. Deshacer: carita_revertir.sql
-- ───────────────────────────────────────────────────────────────────────────

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
  ) then
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

-- Campana: mismo disparador de roles.sql, con texto para la carita
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
        else 'envió una orden a '
      end || v_robot,
      v_robot);
  end if;
  return null;
end $$;
