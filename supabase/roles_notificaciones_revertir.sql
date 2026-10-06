-- Deshace roles_notificaciones.sql: las notificaciones ocultas vuelven a
-- aparecer en la campana. Quita antes el panel que usa la columna.
alter table public.actividad drop column if exists oculta;
