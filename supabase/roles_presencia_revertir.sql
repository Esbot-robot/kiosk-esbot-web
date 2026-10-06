-- Deshace roles_presencia.sql: vuelve la lista de usuarios de roles.sql
-- (todos ven a todos, sin "en línea"). Quita antes el panel que la usa.

drop function if exists public.marcar_visto();
drop function if exists public.listar_usuarios();

create function public.listar_usuarios()
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

alter table public.perfiles drop column if exists visto_at;
