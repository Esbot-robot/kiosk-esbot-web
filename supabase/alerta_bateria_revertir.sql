-- Revierte alerta_bateria.sql: deja de revisar la batería y borra lo avisado.
-- La función "alerta-bateria" se borra aparte (Edge Functions o
-- `npx supabase functions delete alerta-bateria`).
select cron.unschedule('alerta-bateria')
where exists (select 1 from cron.job where jobname = 'alerta-bateria');

select cron.unschedule('alerta-bateria-mantener-clave')
where exists (select 1 from cron.job where jobname = 'alerta-bateria-mantener-clave');

drop table if exists public.alertas_bateria;
