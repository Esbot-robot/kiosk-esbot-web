-- ───────────────────────────────────────────────────────────────────────────
-- PRUEBA: videollamada al robot desde la página Robots.
--
-- El panel deja la orden 'videollamada' (mismo camino que 'actualizar' y
-- 'reiniciar'). El robot crea una reunión de temi con enlace y lo devuelve
-- en su latido:
--   videollamada_id     número de la orden a la que responde
--   videollamada_url    enlace de la reunión (center.robotemi.com/meetings/…)
--   videollamada_error  motivo si no se pudo crear (falta permiso, etc.)
--
-- Correr ANTES de instalar la app que los envía: si las columnas no existen,
-- PostgREST rechaza ese latido. Para deshacer: videollamada_prueba_revertir.sql
-- ───────────────────────────────────────────────────────────────────────────

alter table public.robot_status
  add column if not exists videollamada_id bigint,
  add column if not exists videollamada_url text,
  add column if not exists videollamada_error text;

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
