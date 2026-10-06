-- ============================================================
-- Deshace roles.sql. El panel vuelve a "cualquier usuario con sesión
-- puede todo", como antes.
-- OJO: borra los perfiles, la actividad y el proyecto de cada evento
-- (incluida la asignación de SmartBooks). Los usuarios de Supabase
-- (auth) no se borran: solo pierden su perfil.
-- Quita antes el panel y la Edge Function "usuarios" que lo usan.
-- ============================================================

-- Lista de usuarios y presencia (roles_presencia.sql)
drop function if exists public.listar_usuarios();
drop function if exists public.marcar_visto();

-- Campana en vivo
alter publication supabase_realtime drop table public.actividad;

-- Registro de actividad
drop trigger if exists actividad_contactos on public.contactos;
drop trigger if exists actividad_robots on public.robots;
drop trigger if exists actividad_projects on public.projects;
drop trigger if exists actividad_robot_status on public.robot_status;
drop function if exists public.actividad_contactos();
drop function if exists public.actividad_robots();
drop function if exists public.actividad_projects();
drop function if exists public.actividad_robot_status();
drop function if exists public.registrar_actividad(text, text, text, jsonb);

-- Control de órdenes a robots
drop trigger if exists robot_status_solo_admin on public.robot_status;
drop function if exists public.robot_status_solo_admin();

-- Reglas restrictivas (las reglas de antes quedan como estaban)
drop policy if exists "rol: ver proyectos" on public.projects;
drop policy if exists "rol: crear proyectos" on public.projects;
drop policy if exists "rol: editar proyectos" on public.projects;
drop policy if exists "rol: borrar proyectos" on public.projects;
drop policy if exists "rol: ver robots" on public.robots;
drop policy if exists "rol: fijar robots" on public.robots;
drop policy if exists "rol: cambiar robots" on public.robots;
drop policy if exists "rol: quitar robots" on public.robots;
drop policy if exists "rol: estado de robots" on public.robot_status;
drop policy if exists "rol: ver eventos" on public.events;
drop policy if exists "rol: registrar eventos" on public.events;
drop policy if exists "rol: fotos" on public.fotos;
drop policy if exists "rol: ver contactos" on public.contactos;
drop policy if exists "rol: borrar contactos" on public.contactos;
drop policy if exists "rol: subir archivos" on storage.objects;
drop policy if exists "rol: reemplazar archivos" on storage.objects;
drop policy if exists "rol: borrar archivos" on storage.objects;
drop policy if exists "rol: listar archivos" on storage.objects;

-- Tablas nuevas (sus reglas y el disparador del superadmin se van con ellas)
drop table if exists public.actividad;
drop table if exists public.perfil_proyectos;
drop table if exists public.perfiles;
drop function if exists public.proteger_superadmin();

-- Funciones de apoyo
drop function if exists public.puede_ver_proyecto(uuid);
drop function if exists public.es_superadmin();
drop function if exists public.es_admin();
drop function if exists public.mi_rol();

-- Proyecto de cada evento (la app nueva lo sigue enviando: quita también
-- esa versión de la app, o los latidos de eventos fallarán al no existir
-- la columna)
drop index if exists public.events_project_creado_idx;
alter table public.events drop column if exists project_id;
