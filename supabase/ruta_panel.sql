-- ───────────────────────────────────────────────────────────────────────────
-- Ruta de patrullaje desde el panel
--
-- La ruta se puede armar en el panel (tarjeta del robot → Ruta) o en el admin
-- del robot, y cada lado ve lo que guardó el otro. Viaja por el latido que ya
-- existe (≤3 s), igual que el modo quieto, sin tablas nuevas.
--
--   ubicaciones_mapa    lo que el robot tiene en su mapa. Lo manda al arrancar
--                       y cuando cambia el mapa, no en cada latido.
--   ruta                ubicaciones elegidas, en orden (arreglo de textos).
--   ruta_actualizada_ms cuándo se guardó la ruta (milisegundos). Decide qué
--                       cambio gana si se editó en los dos lados sin internet.
--
-- Correr una sola vez en el SQL Editor de Supabase, ANTES de instalar en los
-- robots la versión de la app que envía estos campos: si las columnas no
-- existen, PostgREST rechaza el latido completo y el robot aparece
-- desconectado.
-- ───────────────────────────────────────────────────────────────────────────

alter table public.robot_status
  add column if not exists ubicaciones_mapa jsonb,
  add column if not exists ruta jsonb,
  add column if not exists ruta_actualizada_ms bigint;


-- Gana el último que guardó. Si el robot estuvo sin internet con una ruta
-- guardada en su admin, la sube al volver la red; si mientras tanto alguien
-- guardó otra más nueva en el panel, esa se conserva y el robot la recibe en
-- la respuesta del mismo latido.
create or replace function public.robot_status_ruta_ultima()
returns trigger language plpgsql as $$
begin
  if (new.ruta is distinct from old.ruta or new.ruta_actualizada_ms is distinct from old.ruta_actualizada_ms)
     and coalesce(new.ruta_actualizada_ms, -1) < coalesce(old.ruta_actualizada_ms, -1) then
    new.ruta := old.ruta;
    new.ruta_actualizada_ms := old.ruta_actualizada_ms;
  end if;
  return new;
end $$;

drop trigger if exists robot_status_ruta_ultima on public.robot_status;
create trigger robot_status_ruta_ultima before update on public.robot_status
  for each row execute function public.robot_status_ruta_ultima();


-- El panel solo puede cambiar la ruta, nada más de la fila (mismo criterio
-- que fijar_quieto). La hora la pone el servidor, no el navegador.
create or replace function public.fijar_ruta(p_serial text, p_ruta jsonb)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  if jsonb_typeof(p_ruta) is distinct from 'array' or jsonb_array_length(p_ruta) = 0 then
    raise exception 'La ruta necesita al menos una ubicación';
  end if;
  update public.robot_status
     set ruta = p_ruta,
         ruta_actualizada_ms = v_ms
   where serial = p_serial;
  if not found then
    raise exception 'El robot % todavía no ha enviado ningún latido', p_serial;
  end if;
  return v_ms;
end $$;

revoke all on function public.fijar_ruta(text, jsonb) from public, anon;
grant execute on function public.fijar_ruta(text, jsonb) to authenticated;
