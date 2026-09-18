-- ============================================================
-- Kiosk Esbot — botón "Tomar foto" y galería del evento
-- Ejecutar UNA VEZ en: Dashboard de Supabase -> SQL Editor -> New query
-- (el schema.sql original ya debe estar aplicado)
-- ============================================================

-- ------------------------------------------------------------
-- 1. Token del enlace de galería, uno por proyecto
--    Va como columna aparte y NO dentro de config, porque config se
--    publica en configs/{serial}.json, que es un archivo público.
-- ------------------------------------------------------------
-- gen_random_uuid() es nativo de Postgres: 32 caracteres hexadecimales
-- imposibles de adivinar, sin depender de extensiones.
alter table public.projects
  add column if not exists galeria_token text
  default replace(gen_random_uuid()::text, '-', '');

-- El default solo aplica a filas nuevas: se rellenan las que ya existen
update public.projects
set galeria_token = replace(gen_random_uuid()::text, '-', '')
where galeria_token is null;

alter table public.projects alter column galeria_token set not null;

create unique index if not exists projects_galeria_token_idx
  on public.projects (galeria_token);

-- ------------------------------------------------------------
-- 2. Fotos tomadas por los robots
--    El archivo vive en Storage con el nombre {id}.jpg; aquí solo van
--    los datos que la galería necesita para listarlas y buscarlas.
-- ------------------------------------------------------------
create table public.fotos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  -- número corto que ve el visitante en la pantalla del robot
  numero int not null,
  serial text not null,
  -- 'subiendo' mientras el archivo va en camino; 'lista' cuando llegó
  estado text not null default 'subiendo',
  entregada boolean not null default false,
  creado_at timestamptz not null default now(),
  expira_at timestamptz not null default now() + interval '7 days',
  unique (project_id, numero)
);

create index fotos_project_numero_idx on public.fotos (project_id, numero desc);

-- ------------------------------------------------------------
-- 3. Contador de fotos por proyecto
--    Una fila por evento. Se incrementa en una sola operación para que
--    dos robots simultáneos nunca reciban el mismo número.
-- ------------------------------------------------------------
create table public.contador_fotos (
  project_id uuid primary key references public.projects(id) on delete cascade,
  ultimo int not null default 0
);

-- ------------------------------------------------------------
-- 4. Seguridad
--    RLS activo y SIN políticas para el robot: nadie entra directo a
--    estas tablas. Todo pasa por las funciones de abajo, que corren con
--    permisos de su creador (security definer) y solo hacen lo justo.
-- ------------------------------------------------------------
alter table public.fotos enable row level security;
alter table public.contador_fotos enable row level security;

-- El panel (usuario con sesión) sí puede consultarlas
create policy "panel lee fotos" on public.fotos
  for select to authenticated using (true);
create policy "panel gestiona fotos" on public.fotos
  for all to authenticated using (true) with check (true);

-- ------------------------------------------------------------
-- 5. El robot registra la foto y recibe su número
--    Entra con el serial, que es lo único que el robot conoce de sí
--    mismo; el proyecto se deduce de la tabla robots.
-- ------------------------------------------------------------
create or replace function public.registrar_foto(p_serial text)
returns table (id uuid, numero int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project uuid;
  v_numero int;
  v_id uuid;
begin
  select r.project_id into v_project from public.robots r where r.serial = p_serial;
  if v_project is null then
    raise exception 'El robot % no tiene proyecto fijado', p_serial;
  end if;

  -- Incremento atómico: mientras esta fila se actualiza, otra llamada espera.
  -- El greatest() protege de un contador desincronizado (por ejemplo si alguien
  -- lo reinicia a mano sin borrar las fotos): nunca devuelve un número ya usado.
  insert into public.contador_fotos (project_id, ultimo)
  values (v_project, 1)
  on conflict (project_id) do update
    set ultimo = greatest(
          public.contador_fotos.ultimo + 1,
          coalesce((select max(f.numero) from public.fotos f where f.project_id = v_project), 0) + 1
        )
  returning public.contador_fotos.ultimo into v_numero;

  insert into public.fotos (project_id, numero, serial)
  values (v_project, v_numero, p_serial)
  returning public.fotos.id into v_id;

  return query select v_id, v_numero;
end;
$$;

-- ------------------------------------------------------------
-- 6. El robot avisa que el archivo ya subió
-- ------------------------------------------------------------
create or replace function public.marcar_foto_lista(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.fotos set estado = 'lista' where id = p_id;
$$;

-- ------------------------------------------------------------
-- 7. La galería del cliente: se entra con el token del evento
--    Devuelve solo lo que la página necesita. Sin token válido no
--    devuelve nada, y nunca expone datos de otros proyectos.
-- ------------------------------------------------------------
create or replace function public.galeria_info(p_token text)
returns table (nombre text, empresa text)
language sql
security definer
stable
set search_path = public
as $$
  select p.nombre, coalesce(p.config->>'empresa', '')
  from public.projects p
  where p.galeria_token = p_token;
$$;

create or replace function public.fotos_de_galeria(p_token text)
returns table (
  id uuid,
  numero int,
  estado text,
  entregada boolean,
  creado_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select f.id, f.numero, f.estado, f.entregada, f.creado_at
  from public.fotos f
  join public.projects p on p.id = f.project_id
  where p.galeria_token = p_token
    and f.expira_at > now()
  order by f.numero desc;
$$;

-- Marcar una foto como entregada desde la galería (exige el token)
create or replace function public.marcar_entregada(p_token text, p_id uuid, p_valor boolean)
returns void
language sql
security definer
set search_path = public
as $$
  update public.fotos f
  set entregada = p_valor
  from public.projects p
  where p.id = f.project_id
    and p.galeria_token = p_token
    and f.id = p_id;
$$;

-- ------------------------------------------------------------
-- 8. Permisos de ejecución
--    anon es el rol del robot y de la galería (que no inicia sesión).
--    Solo puede llamar estas funciones, no tocar las tablas.
-- ------------------------------------------------------------
revoke all on function public.registrar_foto(text) from public;
revoke all on function public.marcar_foto_lista(uuid) from public;
revoke all on function public.galeria_info(text) from public;
revoke all on function public.fotos_de_galeria(text) from public;
revoke all on function public.marcar_entregada(text, uuid, boolean) from public;

grant execute on function public.registrar_foto(text) to anon, authenticated;
grant execute on function public.marcar_foto_lista(uuid) to anon, authenticated;
grant execute on function public.galeria_info(text) to anon, authenticated;
grant execute on function public.fotos_de_galeria(text) to anon, authenticated;
grant execute on function public.marcar_entregada(text, uuid, boolean) to anon, authenticated;

-- ============================================================
-- 9. Storage: crear el bucket desde el Dashboard -> Storage
--    Nombre: fotos
--    Público: SÍ (los nombres son UUID imposibles de adivinar)
--    Límite de archivo: 3 MB
--    Tipos permitidos: image/jpeg
--
--    Y agregar esta política para que el robot pueda subir, pero
--    nadie pueda listar el bucket:
-- ============================================================
create policy "robot sube fotos" on storage.objects
  for insert to anon
  with check (bucket_id = 'fotos');

-- OJO: Storage sube con INSERT ... RETURNING *, así que sin permiso de
-- lectura la subida falla con "new row violates row-level security policy".
-- Se le da lectura SOLO de lo recién creado: alcanza para confirmar la
-- subida, pero no sirve para listar el bucket (todo lo anterior queda
-- invisible para el robot).
create policy "robot confirma subida" on storage.objects
  for select to anon
  using (bucket_id = 'fotos' and created_at > now() - interval '30 seconds');

create policy "panel gestiona fotos storage" on storage.objects
  for all to authenticated
  using (bucket_id = 'fotos')
  with check (bucket_id = 'fotos');

-- ============================================================
-- 10. Cerrar la fuga del token
--     El schema original le daba lectura anónima a projects y robots.
--     Con el token viviendo en projects, cualquiera con la clave pública
--     podría leer el enlace de la galería de todos los eventos.
--     El robot NO usa esas tablas (baja su config del Storage y solo
--     escribe en events y robot_status), así que se le quita el acceso.
-- ============================================================
drop policy if exists "lectura publica projects" on public.projects;
drop policy if exists "lectura publica robots" on public.robots;

-- Alternativa, si algún día el robot necesitara leer projects:
-- dejar la política y quitarle solo la columna del token.
--   revoke select on public.projects from anon;
--   grant select (id, nombre, config, activo, created_at, updated_at)
--     on public.projects to anon;
-- (no se puede revocar una columna suelta si el permiso se dio sobre
--  toda la tabla: hay que revocar la tabla y volver a otorgar la lista)
