-- ───────────────────────────────────────────────────────────────────────────
-- Deshace catalogo_conexion.sql: borra las conexiones de catálogo, sus claves
-- del Vault y las funciones. Los catálogos ya guardados en los proyectos NO se
-- tocan (siguen con los últimos productos sincronizados).
-- Antes, borrar la Edge Function catalogo-odoo (o dejarla: sin la tabla falla).
-- ───────────────────────────────────────────────────────────────────────────

delete from vault.secrets
 where id in (select clave_id from public.catalogo_conexiones where clave_id is not null);

drop function if exists public.catalogo_guardar_clave(uuid, text);
drop function if exists public.catalogo_leer_clave(uuid);
drop function if exists public.catalogo_borrar_conexion(uuid);
drop table if exists public.catalogo_conexiones;
