-- ───────────────────────────────────────────────────────────────────────────
-- Catálogo conectado (primero Odoo)
--
-- Cada proyecto puede traer los productos de su catálogo desde el sistema del
-- cliente en vez de un archivo. Aquí se guarda la conexión: plataforma,
-- dirección, base de datos, filtros y el resultado de la última sincronización.
--
-- La clave API del cliente NO va en esta tabla: se guarda cifrada en el Vault
-- de Supabase y solo la lee la Edge Function "catalogo-odoo" (con la clave de
-- servicio). El panel nunca la vuelve a ver.
--
-- El panel solo LEE esta tabla (admins); todo lo que escribe pasa por la
-- función, que revisa el rol de quien la llama.
--
-- Correr una sola vez en el SQL Editor de Supabase, ANTES de desplegar la
-- función catalogo-odoo. Para deshacer: catalogo_conexion_revertir.sql
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.catalogo_conexiones (
  project_id uuid primary key references public.projects(id) on delete cascade,
  plataforma text not null default 'odoo' check (plataforma in ('odoo')),
  url text not null,
  base_datos text not null default '',
  -- secreto en vault.secrets; la clave nunca sale de la función
  clave_id uuid,
  -- categorías, solo con stock, solo con imagen, máximo y orden
  filtros jsonb not null default '{}'::jsonb,
  ultima_sincronizacion timestamptz,
  -- { productos, omitidos, total, avisos } de la última sincronización
  ultimo_resultado jsonb,
  actualizado_por uuid,
  actualizado_at timestamptz not null default now()
);

alter table public.catalogo_conexiones enable row level security;

drop policy if exists "admin ve conexiones de catálogo" on public.catalogo_conexiones;
create policy "admin ve conexiones de catálogo" on public.catalogo_conexiones
  for select to authenticated using (public.es_admin());

revoke all on public.catalogo_conexiones from anon, authenticated;
grant select on public.catalogo_conexiones to authenticated;
grant all on public.catalogo_conexiones to service_role;

-- ── Clave en el Vault: solo la función (service_role) puede guardarla y leerla ──

create or replace function public.catalogo_guardar_clave(p_project uuid, p_clave text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select clave_id into v_id from public.catalogo_conexiones where project_id = p_project;
  if not found then
    raise exception 'El proyecto no tiene una conexión de catálogo';
  end if;
  if v_id is null then
    -- nombre único: si la conexión se borró y se vuelve a crear, no choca con la anterior
    v_id := vault.create_secret(
      p_clave,
      'catalogo_' || p_project::text || '_' || replace(gen_random_uuid()::text, '-', ''),
      'Clave API del catálogo conectado'
    );
    update public.catalogo_conexiones set clave_id = v_id where project_id = p_project;
  else
    perform vault.update_secret(v_id, p_clave);
  end if;
end $$;

create or replace function public.catalogo_leer_clave(p_project uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.decrypted_secret
    from vault.decrypted_secrets s
    join public.catalogo_conexiones c on c.clave_id = s.id
   where c.project_id = p_project
$$;

create or replace function public.catalogo_borrar_conexion(p_project uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  delete from public.catalogo_conexiones where project_id = p_project returning clave_id into v_id;
  if v_id is not null then
    delete from vault.secrets where id = v_id;
  end if;
end $$;

revoke all on function public.catalogo_guardar_clave(uuid, text) from public, anon, authenticated;
revoke all on function public.catalogo_leer_clave(uuid) from public, anon, authenticated;
revoke all on function public.catalogo_borrar_conexion(uuid) from public, anon, authenticated;
grant execute on function public.catalogo_guardar_clave(uuid, text) to service_role;
grant execute on function public.catalogo_leer_clave(uuid) to service_role;
grant execute on function public.catalogo_borrar_conexion(uuid) to service_role;
