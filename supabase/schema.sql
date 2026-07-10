-- ============================================================
-- Kiosk Esbot — schema de Supabase
-- Ejecutar en: Dashboard de Supabase -> SQL Editor -> New query
-- ============================================================

-- Proyectos: cada uno guarda el EventConfig completo como JSON
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  config jsonb not null,
  activo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Robots: asignación serial del temi -> proyecto activo
create table public.robots (
  serial text primary key,
  project_id uuid references public.projects(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- updated_at automático al editar
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();
create trigger robots_touch before update on public.robots
  for each row execute function public.touch_updated_at();

-- ============================================================
-- Seguridad (Row Level Security)
-- Panel (usuario logueado): acceso total.
-- Robot (anónimo): solo lectura — no puede modificar nada.
-- ============================================================
alter table public.projects enable row level security;
alter table public.robots enable row level security;

create policy "admin gestiona projects" on public.projects
  for all to authenticated using (true) with check (true);
create policy "admin gestiona robots" on public.robots
  for all to authenticated using (true) with check (true);

create policy "lectura publica projects" on public.projects
  for select to anon using (true);
create policy "lectura publica robots" on public.robots
  for select to anon using (true);

-- ============================================================
-- Storage: crear los buckets desde el Dashboard -> Storage:
--   1. bucket "media"   (PUBLIC)  -> videos y fondos que sube el panel
--   2. bucket "configs" (PUBLIC)  -> JSON publicado por robot:
--      al "Fijar proyecto a robot", el panel sube configs/{serial}.json
--      y la app del robot lo descarga con un GET simple sin headers:
--      https://TU-PROYECTO.supabase.co/storage/v1/object/public/configs/{serial}.json
--
-- OJO: "public" en el bucket solo permite LEER. Para que el panel
-- pueda SUBIR archivos hay que crear estas politicas:
-- ============================================================

create policy "panel sube archivos" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('media', 'configs'));

create policy "panel reemplaza archivos" on storage.objects
  for update to authenticated
  using (bucket_id in ('media', 'configs'))
  with check (bucket_id in ('media', 'configs'));

create policy "panel elimina archivos" on storage.objects
  for delete to authenticated
  using (bucket_id in ('media', 'configs'));

create policy "panel lee archivos" on storage.objects
  for select to authenticated
  using (bucket_id in ('media', 'configs'));

-- ============================================================
-- Analítica: eventos de interacción que envían los robots
-- (toque de pantalla en patrullaje, botón jugar, etc.)
-- El robot inserta como anónimo; solo el panel puede leerlos.
-- ============================================================
create table public.events (
  id bigint generated always as identity primary key,
  serial text not null,
  tipo text not null,
  video_seg double precision,
  -- Para el evento boton_jugar: la pregunta mostrada y la respuesta elegida
  pregunta text,
  respuesta text,
  creado_at timestamptz not null default now()
);

create index events_serial_creado_idx on public.events (serial, creado_at);

alter table public.events enable row level security;

create policy "robot registra eventos" on public.events
  for insert to anon with check (true);
create policy "panel registra eventos" on public.events
  for insert to authenticated with check (true);
create policy "panel lee eventos" on public.events
  for select to authenticated using (true);

-- Agregación en el servidor: la gráfica pide totales por hora/día en vez de
-- descargar todos los eventos (escala a millones de filas sin mover datos).
create or replace function public.eventos_agrupados(
  p_desde timestamptz,
  p_hasta timestamptz,
  p_serial text default null,
  p_gran text default 'dia'
) returns table (bucket text, tipo text, total bigint)
language sql stable as $$
  select
    to_char(
      date_trunc(case when p_gran = 'hora' then 'hour' else 'day' end, creado_at),
      case when p_gran = 'hora' then 'YYYY-MM-DD"T"HH24' else 'YYYY-MM-DD' end
    ) as bucket,
    tipo,
    count(*) as total
  from public.events
  where creado_at >= p_desde
    and creado_at <= p_hasta
    -- "Todos": solo robots reales (serial de 11 caracteres), sin demo/prueba
    and (case when p_serial is null then char_length(serial) = 11 else serial = p_serial end)
  group by 1, 2
$$;
