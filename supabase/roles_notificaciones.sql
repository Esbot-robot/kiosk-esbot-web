-- ============================================================
-- Kiosk Esbot — quitar notificaciones de la campana
-- Ejecutar DESPUÉS de roles.sql. Para deshacerlo: roles_notificaciones_revertir.sql
--
-- La ✕ de cada notificación no borra la acción: la oculta del popup. El
-- registro de lo que hizo cada administrador se conserva en la tabla.
-- El super administrador ya puede actualizar la actividad (regla
-- "superadmin marca leida" de roles.sql), así que no hace falta otra regla.
-- ============================================================

alter table public.actividad add column if not exists oculta boolean not null default false;
