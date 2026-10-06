-- ============================================================
-- Asigna a SmartBooks los eventos de sus robots desde el 25 de septiembre
-- (00125190031: 39 eventos desde el 28; 00125190060: 132 desde el 25,
-- según la consulta del 2026-10-06).
--
-- Ejecutar DESPUÉS de roles.sql y de reinstalar la app nueva en esos
-- robots: así también quedan cubiertos los eventos que lleguen sin
-- proyecto hasta la reinstalación.
-- ============================================================
update public.events e
   set project_id = r.project_id
  from public.robots r
  join public.projects p on p.id = r.project_id
 where p.nombre = 'SmartBooks'
   and e.serial = r.serial
   and e.creado_at >= '2026-09-25'
   and e.project_id is null;

-- Para deshacer solo esta asignación:
-- update public.events e set project_id = null
--   from public.projects p
--  where p.id = e.project_id and p.nombre = 'SmartBooks' and e.creado_at >= '2026-09-25';
