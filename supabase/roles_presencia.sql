-- ============================================================
-- Kiosk Esbot — usuarios en línea y lista por rol
-- Ejecutar DESPUÉS de roles.sql. Para deshacerlo: roles_presencia_revertir.sql
--
-- 1. Cada panel abierto avisa cada 10 s (marcar_visto): así la página
--    Usuarios sabe quién está en línea ahora y cuándo estuvo por última vez.
-- 2. listar_usuarios: el super administrador ve a todos; un administrador
--    solo ve a los clientes lectores.
-- ============================================================

alter table public.perfiles add column if not exists visto_at timestamptz;

-- Solo actualiza la fila de quien llama: nadie puede marcar a otro en línea
create or replace function public.marcar_visto()
returns void language sql security definer set search_path = public as $$
  update public.perfiles set visto_at = now() where user_id = auth.uid()
$$;

revoke all on function public.marcar_visto() from public, anon;
grant execute on function public.marcar_visto() to authenticated;

-- Cambia lo que devuelve: hay que borrarla y crearla de nuevo
drop function if exists public.listar_usuarios();

create function public.listar_usuarios()
returns table (
  user_id uuid,
  nombre text,
  correo text,
  rol text,
  ultimo_ingreso timestamptz,
  visto_at timestamptz,
  creado_at timestamptz,
  proyectos uuid[]
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_rol text := public.mi_rol();
begin
  if v_rol is null or v_rol not in ('admin', 'superadmin') then
    raise exception 'No tienes permiso para ver los usuarios';
  end if;
  return query
    select p.user_id, p.nombre, u.email::text, p.rol, u.last_sign_in_at, p.visto_at, p.creado_at,
           coalesce(array_agg(pp.project_id) filter (where pp.project_id is not null), '{}'::uuid[])
    from public.perfiles p
    join auth.users u on u.id = p.user_id
    left join public.perfil_proyectos pp on pp.user_id = p.user_id
    -- Un administrador solo ve clientes lectores
    where v_rol = 'superadmin' or p.rol = 'lector'
    group by p.user_id, p.nombre, u.email, p.rol, u.last_sign_in_at, p.visto_at, p.creado_at
    order by case p.rol when 'superadmin' then 0 when 'admin' then 1 else 2 end, p.nombre;
end $$;

revoke all on function public.listar_usuarios() from public, anon;
grant execute on function public.listar_usuarios() to authenticated;
