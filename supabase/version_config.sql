-- ───────────────────────────────────────────────────────────────────────────
-- Versión de la config en el latido
--
-- El robot reporta en cada latido la versión de la config que tiene aplicada.
-- La sección Robots del panel la compara con la versión del proyecto fijado:
-- así se ve si el robot ya tomó el último guardado o sigue con uno viejo
-- (sin internet al arrancar, descarga fallida o app sin reiniciar).
--
-- Correr una sola vez en el SQL Editor de Supabase, ANTES de instalar en los
-- robots la versión de la app que envía "version_config": si la columna no
-- existe, PostgREST rechaza el latido completo y el robot aparece desconectado.
-- ───────────────────────────────────────────────────────────────────────────

alter table public.robot_status
  add column if not exists version_config integer;
