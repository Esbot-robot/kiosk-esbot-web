-- Deshace token_robot_alta.sql: vuelve a la versión de crear_codigo_vinculacion que
-- exige que el robot ya haya reportado, y quita la función de borrar fichas.
-- Las fichas que se hayan creado con el alta manual no se borran.

drop function if exists public.quitar_robot_sin_vincular(text);

create or replace function public.crear_codigo_vinculacion(p_serial text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_posiciones constant int[] := array[0, 1, 2, 3, 4, 5, 9, 10];
  v_bytes bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  v_codigo text := '';
  i int;
begin
  if not public.es_admin() then
    raise exception 'No tienes permiso para vincular robots';
  end if;
  if not exists (select 1 from public.robot_status where serial = p_serial) then
    raise exception 'El robot % todavía no ha enviado ningún latido', p_serial;
  end if;
  foreach i in array v_posiciones loop
    v_codigo := v_codigo || substr(v_alfabeto, (get_byte(v_bytes, i) % 32) + 1, 1);
  end loop;
  insert into public.robot_tokens (serial, codigo_hash, codigo_expira, codigo_intentos)
  values (p_serial, public.hash_secreto(v_codigo), now() + interval '15 minutes', 0)
  on conflict (serial) do update
     set codigo_hash = excluded.codigo_hash,
         codigo_expira = excluded.codigo_expira,
         codigo_intentos = 0;
  return v_codigo;
end $$;
revoke all on function public.crear_codigo_vinculacion(text) from public, anon;
grant execute on function public.crear_codigo_vinculacion(text) to authenticated;
