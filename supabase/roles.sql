-- ============================================================
-- Kiosk Esbot — perfiles de usuario y actividad de administradores
-- Ejecutar UNA VEZ en: Dashboard de Supabase -> SQL Editor -> New query
-- Para deshacerlo: roles_revertir.sql
--
-- Perfiles:
--   superadmin  uno solo; no se puede eliminar ni cambiar de rol
--   admin       todo el panel; crea clientes lectores, elimina admins y lectores
--   lector      solo sus proyectos, en lectura: proyecto, analítica, contactos
--
-- Cómo se protege sin tocar lo que ya existe: las reglas de hoy dicen
-- "usuario con sesión puede todo". Aquí se agregan reglas RESTRICTIVAS, que
-- PostgreSQL combina con AND: un permiso solo vale si además pasa la regla
-- del rol. Revertir es quitar estas reglas; las de antes quedan intactas.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tablas
-- ------------------------------------------------------------
create table public.perfiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  rol text not null check (rol in ('superadmin', 'admin', 'lector')),
  creado_at timestamptz not null default now(),
  creado_por uuid
);

-- Un solo super administrador
create unique index perfiles_un_superadmin on public.perfiles (rol) where rol = 'superadmin';

-- Proyectos que puede ver cada cliente lector
create table public.perfil_proyectos (
  user_id uuid not null references public.perfiles(user_id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  primary key (user_id, project_id)
);

-- Lo que hacen los administradores (lo ve solo el super administrador).
-- actor_nombre va como texto: si el admin se elimina, su historial queda.
create table public.actividad (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_nombre text not null,
  accion text not null,
  texto text not null,
  objetivo text,
  detalle jsonb not null default '{}'::jsonb,
  creado_at timestamptz not null default now(),
  leida boolean not null default false
);
create index actividad_creado_idx on public.actividad (creado_at desc);

-- Cada evento de analítica sabrá de qué proyecto es (la app nueva lo envía).
-- Los eventos viejos quedan sin proyecto: solo los ven los administradores.
alter table public.events
  add column if not exists project_id uuid references public.projects(id) on delete set null;
create index if not exists events_project_creado_idx on public.events (project_id, creado_at);

-- ------------------------------------------------------------
-- 2. Funciones de apoyo para las reglas
--    security definer: leen perfiles sin depender de sus propias reglas
-- ------------------------------------------------------------
create or replace function public.mi_rol()
returns text language sql stable security definer set search_path = public as $$
  select rol from public.perfiles where user_id = auth.uid()
$$;

create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.mi_rol() in ('admin', 'superadmin'), false)
$$;

create or replace function public.es_superadmin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.mi_rol() = 'superadmin', false)
$$;

create or replace function public.puede_ver_proyecto(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.es_admin()
      or exists (
        select 1 from public.perfil_proyectos
        where user_id = auth.uid() and project_id = p_project
      )
$$;

-- ------------------------------------------------------------
-- 3. Usuarios que ya existen: todos administradores, y el super
--    administrador por su correo. Así el panel sigue igual para todos.
-- ------------------------------------------------------------
insert into public.perfiles (user_id, nombre, rol)
select u.id,
       coalesce(nullif(u.raw_user_meta_data->>'nombre', ''), split_part(u.email, '@', 1)),
       case when lower(u.email) = 'andrespabonrodriguez02@gmail.com' then 'superadmin' else 'admin' end
from auth.users u
on conflict (user_id) do nothing;

do $$
begin
  if not exists (select 1 from public.perfiles where rol = 'superadmin') then
    raise warning 'No se encontró el usuario andrespabonrodriguez02@gmail.com: no quedó ningún super administrador';
  end if;
end $$;

-- El super administrador no se puede eliminar ni cambiar de rol (tampoco
-- borrando su cuenta: el borrado en cascada pasa por aquí y se cancela)
create or replace function public.proteger_superadmin()
returns trigger language plpgsql as $$
begin
  if old.rol = 'superadmin' and (tg_op = 'DELETE' or new.rol <> 'superadmin') then
    raise exception 'El super administrador no se puede eliminar ni cambiar de rol';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

create trigger perfiles_proteger_superadmin
  before update or delete on public.perfiles
  for each row execute function public.proteger_superadmin();

-- ------------------------------------------------------------
-- 4. Reglas de acceso de las tablas nuevas
--    Sin reglas de escritura: crear, editar y borrar usuarios pasa por la
--    Edge Function "usuarios", que usa la clave de servicio.
-- ------------------------------------------------------------
alter table public.perfiles enable row level security;
alter table public.perfil_proyectos enable row level security;
alter table public.actividad enable row level security;

create policy "ve su perfil o es admin" on public.perfiles
  for select to authenticated using (user_id = auth.uid() or public.es_admin());

create policy "ve sus proyectos o es admin" on public.perfil_proyectos
  for select to authenticated using (user_id = auth.uid() or public.es_admin());

create policy "superadmin lee actividad" on public.actividad
  for select to authenticated using (public.es_superadmin());
create policy "superadmin marca leida" on public.actividad
  for update to authenticated using (public.es_superadmin()) with check (public.es_superadmin());

-- ------------------------------------------------------------
-- 5. Reglas restrictivas sobre lo que ya existe (solo usuarios con sesión;
--    el robot entra como anónimo y no le afectan)
-- ------------------------------------------------------------

-- Proyectos: el lector solo lee los suyos
create policy "rol: ver proyectos" on public.projects as restrictive
  for select to authenticated using (public.puede_ver_proyecto(id));
create policy "rol: crear proyectos" on public.projects as restrictive
  for insert to authenticated with check (public.es_admin());
create policy "rol: editar proyectos" on public.projects as restrictive
  for update to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "rol: borrar proyectos" on public.projects as restrictive
  for delete to authenticated using (public.es_admin());

-- Robots fijados: el lector ve los de sus proyectos (filtro de Analítica)
create policy "rol: ver robots" on public.robots as restrictive
  for select to authenticated using (public.es_admin() or public.puede_ver_proyecto(project_id));
create policy "rol: fijar robots" on public.robots as restrictive
  for insert to authenticated with check (public.es_admin());
create policy "rol: cambiar robots" on public.robots as restrictive
  for update to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "rol: quitar robots" on public.robots as restrictive
  for delete to authenticated using (public.es_admin());

-- Estado en vivo de los robots: solo administradores
create policy "rol: estado de robots" on public.robot_status as restrictive
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- Analítica: el lector ve los eventos de sus proyectos
create policy "rol: ver eventos" on public.events as restrictive
  for select to authenticated
  using (public.es_admin() or (project_id is not null and public.puede_ver_proyecto(project_id)));
create policy "rol: registrar eventos" on public.events as restrictive
  for insert to authenticated with check (public.es_admin());

-- Fotos de evento: solo administradores (la galería entra por su enlace)
create policy "rol: fotos" on public.fotos as restrictive
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- Contactos: el lector ve y exporta los suyos; borrar, solo administradores
create policy "rol: ver contactos" on public.contactos as restrictive
  for select to authenticated using (public.puede_ver_proyecto(project_id));
create policy "rol: borrar contactos" on public.contactos as restrictive
  for delete to authenticated using (public.es_admin());

-- Archivos (media, configs, fotos): solo administradores
create policy "rol: subir archivos" on storage.objects as restrictive
  for insert to authenticated with check (public.es_admin());
create policy "rol: reemplazar archivos" on storage.objects as restrictive
  for update to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "rol: borrar archivos" on storage.objects as restrictive
  for delete to authenticated using (public.es_admin());
create policy "rol: listar archivos" on storage.objects as restrictive
  for select to authenticated using (public.es_admin());

-- Órdenes a los robots (ruta, detener, actualizar, reiniciar, videollamada):
-- las funciones del panel corren con permisos de su creador y no pasan por
-- las reglas, así que el control va en un disparador. El robot no tiene
-- sesión (auth.uid() nulo): sus latidos pasan sin revisión.
create or replace function public.robot_status_solo_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.es_admin() then
    raise exception 'No tienes permiso para dar órdenes a los robots';
  end if;
  return new;
end $$;

create trigger robot_status_solo_admin
  before update on public.robot_status
  for each row execute function public.robot_status_solo_admin();

-- ------------------------------------------------------------
-- 6. Registro de actividad (solo acciones de administradores)
-- ------------------------------------------------------------
create or replace function public.registrar_actividad(
  p_accion text, p_texto text, p_objetivo text, p_detalle jsonb default '{}'::jsonb
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_rol text;
  v_nombre text;
begin
  select rol, nombre into v_rol, v_nombre from public.perfiles where user_id = auth.uid();
  -- Lo del super administrador no se le notifica a él mismo; el robot
  -- (sin sesión) y los lectores no generan actividad
  if v_rol is distinct from 'admin' then return; end if;
  insert into public.actividad (actor_id, actor_nombre, accion, texto, objetivo, detalle)
  values (auth.uid(), v_nombre, p_accion, p_texto, p_objetivo, coalesce(p_detalle, '{}'::jsonb));
end $$;

-- Nadie la llama desde afuera: solo los disparadores de abajo
revoke all on function public.registrar_actividad(text, text, text, jsonb) from public, anon, authenticated;

-- Órdenes a robots
create or replace function public.actividad_robot_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_robot text := coalesce(nullif(new.nombre, ''), new.serial);
begin
  if auth.uid() is null then return null; end if;
  if new.quieto is distinct from old.quieto then
    perform public.registrar_actividad(
      'recorrido',
      case when new.quieto then 'detuvo el recorrido de ' else 'reanudó el recorrido de ' end || v_robot,
      v_robot);
  end if;
  if new.ruta is distinct from old.ruta then
    perform public.registrar_actividad('ruta', 'cambió la ruta de ' || v_robot, v_robot,
      jsonb_build_object('ruta', new.ruta));
  end if;
  if new.comando_id is distinct from old.comando_id then
    perform public.registrar_actividad(
      'orden',
      case new.comando
        when 'actualizar' then 'pidió actualizar la config de '
        when 'reiniciar' then 'reinició la app de '
        when 'videollamada' then 'abrió una videollamada con '
        else 'envió una orden a '
      end || v_robot,
      v_robot);
  end if;
  return null;
end $$;

create trigger actividad_robot_status
  after update on public.robot_status
  for each row execute function public.actividad_robot_status();

-- Proyectos: creado, guardado (con qué partes cambiaron) y eliminado
create or replace function public.actividad_projects()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_secciones text[];
begin
  if auth.uid() is null then return null; end if;
  if tg_op = 'INSERT' then
    perform public.registrar_actividad('proyecto', 'creó el proyecto ' || new.nombre, new.nombre);
  elsif tg_op = 'DELETE' then
    perform public.registrar_actividad('proyecto', 'eliminó el proyecto ' || old.nombre, old.nombre);
  elsif new.config is distinct from old.config or new.nombre is distinct from old.nombre then
    -- Partes de la config que cambiaron, con su sección delante
    select array_agg(x.seccion || '.' || d.clave order by x.seccion, d.clave) into v_secciones
    from (values ('inicial', 'pantalla_inicial'), ('ruleta', 'pantalla_ruleta'), ('tiempos', 'tiempos')) x(seccion, campo)
    cross join lateral (
      select coalesce(n.key, o.key) as clave, n.value as nuevo, o.value as viejo
      from jsonb_each(coalesce(new.config -> x.campo, '{}'::jsonb)) n
      full join jsonb_each(coalesce(old.config -> x.campo, '{}'::jsonb)) o on o.key = n.key
    ) d
    where d.nuevo is distinct from d.viejo;
    perform public.registrar_actividad(
      'proyecto',
      'guardó el proyecto ' || new.nombre
        || coalesce(' (v' || (old.config ->> 'version') || ' → v' || (new.config ->> 'version') || ')', ''),
      new.nombre,
      jsonb_build_object(
        'secciones', coalesce(to_jsonb(v_secciones), '[]'::jsonb),
        'nombre_anterior', case when new.nombre is distinct from old.nombre then old.nombre end
      ));
  end if;
  return null;
end $$;

create trigger actividad_projects
  after insert or update or delete on public.projects
  for each row execute function public.actividad_projects();

-- Robots fijados o quitados de un proyecto
create or replace function public.actividad_robots()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_serial text := coalesce(new.serial, old.serial);
  v_robot text;
  v_proyecto text;
begin
  if auth.uid() is null then return null; end if;
  select coalesce(nullif(nombre, ''), serial) into v_robot from public.robot_status where serial = v_serial;
  v_robot := coalesce(v_robot, v_serial);
  if tg_op = 'DELETE' then
    select nombre into v_proyecto from public.projects where id = old.project_id;
    if v_proyecto is null then return null; end if; -- se borró con su proyecto
    perform public.registrar_actividad('robot', 'quitó el robot ' || v_robot || ' del proyecto ' || v_proyecto, v_robot);
  elsif new.project_id is not null and new.project_id is distinct from (case when tg_op = 'UPDATE' then old.project_id end) then
    select nombre into v_proyecto from public.projects where id = new.project_id;
    perform public.registrar_actividad('robot', 'fijó el robot ' || v_robot || ' al proyecto ' || coalesce(v_proyecto, ''), v_robot);
  end if;
  return null;
end $$;

create trigger actividad_robots
  after insert or update or delete on public.robots
  for each row execute function public.actividad_robots();

-- Contactos eliminados: un solo aviso por proyecto con la cantidad
create or replace function public.actividad_contactos()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  if auth.uid() is null then return null; end if;
  for r in
    select b.project_id, count(*) as cantidad, p.nombre
    from borrados b
    join public.projects p on p.id = b.project_id -- si se borró el proyecto, no se avisa aparte
    group by b.project_id, p.nombre
  loop
    perform public.registrar_actividad(
      'contactos',
      'eliminó ' || r.cantidad || case when r.cantidad = 1 then ' contacto de ' else ' contactos de ' end || r.nombre,
      r.nombre);
  end loop;
  return null;
end $$;

create trigger actividad_contactos
  after delete on public.contactos
  referencing old table as borrados
  for each statement execute function public.actividad_contactos();

-- La campana se actualiza en vivo
alter publication supabase_realtime add table public.actividad;

-- ------------------------------------------------------------
-- 7. Lista de usuarios para la página Usuarios
--    El correo y el último ingreso están en auth.users, que el navegador
--    no puede leer; esta función los entrega solo a administradores.
-- ------------------------------------------------------------
create or replace function public.listar_usuarios()
returns table (
  user_id uuid,
  nombre text,
  correo text,
  rol text,
  ultimo_ingreso timestamptz,
  creado_at timestamptz,
  proyectos uuid[]
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.es_admin() then
    raise exception 'No tienes permiso para ver los usuarios';
  end if;
  return query
    select p.user_id, p.nombre, u.email::text, p.rol, u.last_sign_in_at, p.creado_at,
           coalesce(array_agg(pp.project_id) filter (where pp.project_id is not null), '{}'::uuid[])
    from public.perfiles p
    join auth.users u on u.id = p.user_id
    left join public.perfil_proyectos pp on pp.user_id = p.user_id
    group by p.user_id, p.nombre, u.email, p.rol, u.last_sign_in_at, p.creado_at
    order by case p.rol when 'superadmin' then 0 when 'admin' then 1 else 2 end, p.nombre;
end $$;

revoke all on function public.listar_usuarios() from public, anon;
grant execute on function public.listar_usuarios() to authenticated;
