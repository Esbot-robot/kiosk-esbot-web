-- ───────────────────────────────────────────────────────────────────────────
-- «Detectar personas» (eventos, app 1.30)
--
-- Interruptor en la tarjeta del robot: con el recorrido (o quieto con video), al
-- detectar a una persona el robot hace lo mismo que si le tocaran la pantalla
-- (se detiene, gira hacia ella, caen los botones y dice la frase de siempre).
-- Va por robot, como el modo quieto, y viaja por el latido (select * de
-- robot_status): sin tablas nuevas. Las apps anteriores a la 1.30 lo ignoran.
--
-- Orden: este SQL puede ir antes que la app y que el panel (no cambia nada para
-- quien no lo use). Para deshacerlo: detectar_personas_revertir.sql.
-- ───────────────────────────────────────────────────────────────────────────

alter table public.robot_status
  add column if not exists detectar_personas boolean not null default false,
  -- metros, el rango que admite temi
  add column if not exists detectar_distancia real not null default 1.5
    check (detectar_distancia between 0.5 and 2.0);


-- El panel solo cambia estos dos datos (los permisos los revisa el disparador
-- robot_status_solo_admin: los lectores no pueden dar órdenes a los robots)
create or replace function public.fijar_deteccion(
  p_serial text,
  p_activo boolean,
  p_distancia real default 1.5
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.robot_status
     set detectar_personas = coalesce(p_activo, false),
         detectar_distancia = round(least(2.0, greatest(0.5, coalesce(p_distancia, 1.5)))::numeric, 1)::real
   where serial = p_serial;
  if not found then
    raise exception 'El robot % todavía no ha enviado ningún latido', p_serial;
  end if;
end $$;

revoke all on function public.fijar_deteccion(text, boolean, real) from public, anon;
grant execute on function public.fijar_deteccion(text, boolean, real) to authenticated;


-- Actividad: también queda quién encendió o apagó la detección (resto igual)
CREATE OR REPLACE FUNCTION public.actividad_robot_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  if new.detectar_personas is distinct from old.detectar_personas
     or (new.detectar_personas and new.detectar_distancia is distinct from old.detectar_distancia) then
    perform public.registrar_actividad(
      'recorrido',
      case when new.detectar_personas
        then 'activó «Detectar personas» (' || replace(to_char(new.detectar_distancia, 'FM0.0'), '.', ',') || ' m) en '
        else 'desactivó «Detectar personas» en ' end || v_robot,
      v_robot);
  end if;
  return null;
end $function$;

