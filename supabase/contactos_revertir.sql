-- ============================================================
-- Kiosk Esbot — deshace contactos.sql
-- OJO: borra todos los contactos guardados. Exporta el CSV antes.
-- Quita primero el código del panel y de la app que usa estas funciones.
-- ============================================================

drop function if exists public.primer_registro(uuid);
drop function if exists public.registrar_contacto(text, text, text, text, boolean);
drop function if exists public.formulario_info(text);

-- Al borrar la tabla se van con ella sus políticas e índices
drop table if exists public.contactos;

drop index if exists public.projects_registro_token_idx;
alter table public.projects drop column if exists registro_token;
