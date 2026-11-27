-- ───────────────────────────────────────────────────────────────────────────
-- Aviso por correo de batería baja (todos los robots)
--
-- Cada minuto una tarea llama a la Edge Function "alerta-bateria": si un robot
-- con latido reciente baja a 15 % sin cargar manda un correo, y otro urgente
-- al 5 %. Se reinicia cuando el robot carga (o pasa del 25 %). No cambia la app:
-- el robot ya manda la batería en cada latido.
--
-- ANTES de correr esto:
--   1. Desplegar la función "alerta-bateria" con "Verify JWT" desactivado.
--   2. En Edge Functions -> Secrets: BREVO_API_KEY y ALERTA_CORREOS
--      (y ALERTA_REMITENTE si el remitente no es alertas@esbot.co).
--
-- Para deshacerlo: alerta_bateria_revertir.sql.
-- ───────────────────────────────────────────────────────────────────────────

-- Lo que ya se avisó en la descarga actual. Aparte de robot_status porque
-- escribir ahí con la clave de servicio cuenta como un latido del robot.
create table if not exists public.alertas_bateria (
  serial text primary key,
  -- 15 = primer aviso, 5 = aviso urgente
  nivel int not null,
  bateria int,
  enviada_at timestamptz not null default now()
);

-- Solo la función (clave de servicio) la usa: sin políticas, nadie más la lee ni la escribe
alter table public.alertas_bateria enable row level security;

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Cada minuto. La URL y la clave publicable ya son públicas (van en la app).
select cron.schedule(
  'alerta-bateria',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://bdemkisbaxuusxljrdbl.supabase.co/functions/v1/alerta-bateria',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_TfVfgMsvkJrMDV6qU3ssrg_ljZFApnY'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- Brevo da de baja la clave tras 90 días sin uso: una lectura diaria la mantiene
-- viva (no envía correos). 0 13 * * * = 8:00 a. m. en Colombia.
select cron.schedule(
  'alerta-bateria-mantener-clave',
  '0 13 * * *',
  $$
  select net.http_post(
    url := 'https://bdemkisbaxuusxljrdbl.supabase.co/functions/v1/alerta-bateria',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_TfVfgMsvkJrMDV6qU3ssrg_ljZFApnY'
    ),
    body := '{"mantener": true}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- ───────────────────────────────────────────────────────────────────────────
-- Consultas útiles (a mano)
-- ───────────────────────────────────────────────────────────────────────────
-- Avisos vigentes:            select * from public.alertas_bateria;
-- Qué respondió la función:   select created, status_code, content
--                             from net._http_response order by created desc limit 5;
-- Pausar los avisos:          select cron.unschedule('alerta-bateria');
--                             select cron.unschedule('alerta-bateria-mantener-clave');
