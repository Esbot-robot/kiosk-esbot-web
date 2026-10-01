-- ───────────────────────────────────────────────────────────────────────────
-- Órdenes del panel al robot: "actualizar" (buscar la config ya) y
-- "reiniciar" (cerrar y reabrir la app).
--
-- Viajan por el latido que ya existe (≤3 s), igual que el modo quieto y la
-- ruta, sin tablas nuevas:
--   comando          qué hacer: 'actualizar' | 'reiniciar'
--   comando_id       número de la orden (milisegundos del servidor). El robot
--                    ejecuta una orden solo si su número es mayor que el de la
--                    última que hizo, así nunca se repite.
--   comando_hecho_id lo escribe el robot: número de la última orden ejecutada.
--                    Con eso el panel muestra "Reiniciando…" hasta que se hizo.
--
-- Correr una sola vez en el SQL Editor de Supabase, ANTES de instalar en los
-- robots la versión de la app que envía comando_hecho_id: si la columna no
-- existe, PostgREST rechaza el latido completo y el robot aparece desconectado.
-- ───────────────────────────────────────────────────────────────────────────

alter table public.robot_status
  add column if not exists comando text,
  add column if not exists comando_id bigint,
  add column if not exists comando_hecho_id bigint;


-- El panel solo puede dejar una orden, nada más de la fila (mismo criterio
-- que fijar_quieto y fijar_ruta). El número lo pone el servidor.
create or replace function public.enviar_comando(p_serial text, p_comando text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  if p_comando not in ('actualizar', 'reiniciar') then
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
