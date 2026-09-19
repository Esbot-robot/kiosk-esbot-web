-- ───────────────────────────────────────────────────────────────────────────
-- Limpieza diaria de fotos vencidas
--
-- Cada foto nace con expira_at = creado_at + 7 días (ver fotos.sql) y la
-- galería ya deja de mostrarla ese día. Esta tarea la borra de verdad:
-- todos los días a las 3:00 a. m. hora Colombia llama a la Edge Function
-- "limpiar-fotos", que borra los archivos del bucket y después las filas.
--
-- ANTES de correr esto: la Edge Function "limpiar-fotos" debe estar
-- desplegada y con "Verify JWT" desactivado.
--
-- Correr una sola vez en el SQL Editor. Volver a correrlo no duplica la
-- tarea: cron.schedule reemplaza la que tenga el mismo nombre.
-- ───────────────────────────────────────────────────────────────────────────

-- pg_cron programa la tarea y pg_net hace la llamada HTTP desde la base.
-- (En el plan gratis están disponibles; también se activan en
--  Database -> Extensions.)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 0 8 * * *  =  8:00 UTC  =  3:00 a. m. en Colombia (UTC-5, sin horario de verano)
-- La URL y la clave publicable ya son públicas (van dentro de la app del
-- robot), así que pueden ir aquí escritas. La clave de servicio NO aparece:
-- la función la toma de su propio entorno en Supabase.
select cron.schedule(
  'limpiar-fotos-vencidas',
  '0 8 * * *',
  $$
  select net.http_post(
    url := 'https://bdemkisbaxuusxljrdbl.supabase.co/functions/v1/limpiar-fotos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_TfVfgMsvkJrMDV6qU3ssrg_ljZFApnY'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);


-- ───────────────────────────────────────────────────────────────────────────
-- Consultas útiles (correr a mano cuando haga falta, no son parte del setup)
-- ───────────────────────────────────────────────────────────────────────────

-- Ver la tarea programada:
--   select jobid, jobname, schedule, active from cron.job;

-- Ver las últimas ejecuciones de la tarea:
--   select start_time, status, return_message
--   from cron.job_run_details order by start_time desc limit 5;

-- Ver qué respondió la función en las últimas llamadas (status 200 y
-- {"borradas": N} es lo esperado):
--   select created, status_code, content
--   from net._http_response order by created desc limit 5;

-- Cuántas fotos vencidas esperan ser borradas:
--   select count(*) from public.fotos where expira_at < now();

-- Desactivar la limpieza (por ejemplo, si un cliente pide las fotos más días):
--   select cron.unschedule('limpiar-fotos-vencidas');
