-- ───────────────────────────────────────────────────────────────────────────
-- Cierra la lectura anónima de projects y robots (auditoría de seguridad,
-- 12 oct 2026, hallazgo H2 / inconsistencia I1).
--
-- fotos.sql ya las quitaba, pero seguían activas en producción porque se
-- volvió a correr schema.sql después. Con ellas, cualquiera con la clave
-- publicable podía leer galeria_token y registro_token de todos los
-- proyectos y abrir las galerías con fotos de visitantes.
--
-- No afecta al robot (no lee estas tablas: baja su config del bucket
-- configs) ni a la galería o el registro (entran por funciones security
-- definer). El panel usa sus propias reglas para usuarios con sesión.
--
-- Deshacer: cerrar_lectura_publica_revertir.sql
-- ───────────────────────────────────────────────────────────────────────────
drop policy if exists "lectura publica projects" on public.projects;
drop policy if exists "lectura publica robots" on public.robots;
