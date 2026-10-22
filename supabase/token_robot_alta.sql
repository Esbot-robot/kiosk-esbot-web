-- ───────────────────────────────────────────────────────────────────────────
-- Alta manual de robots desde el panel
--
-- Hasta ahora un robot solo podía vincularse si ya había enviado algún latido
-- (su ficha nacía sola en robot_status). Con el cierre total del acceso anónimo
-- eso dejaría de ser posible para un robot nuevo. Con este archivo, un
-- administrador da de alta el robot escribiendo su número de serie:
--
--   crear_codigo_vinculacion   ahora crea la ficha del robot si todavía no
--                              existe (valida que el serial tenga 11 letras o
--                              números) y genera el código de siempre.
--   quitar_robot_sin_vincular  borra la ficha de un robot que no tiene token
--                              (para deshacer un serial mal escrito).
--
-- No cambia nada de lo que ya funciona: un robot que se conecta solo sigue
-- apareciendo por su cuenta mientras el acceso anónimo siga abierto.
--
-- Correr una sola vez en el SQL Editor, después de token_robot.sql.
-- Para deshacer: token_robot_alta_revertir.sql
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.crear_codigo_vinculacion(p_serial text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  -- sin 0/O ni 1/I para que no se confundan al escribirlo en el robot
  v_alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_posiciones constant int[] := array[0, 1, 2, 3, 4, 5, 9, 10]; -- bytes completamente aleatorios del uuid
  v_bytes bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  v_codigo text := '';
  i int;
begin
  if not public.es_admin() then
    raise exception 'No tienes permiso para vincular robots';
  end if;
  p_serial := btrim(coalesce(p_serial, ''));
  if p_serial !~ '^[A-Za-z0-9]{11}$' then
    raise exception 'El número de serie debe tener 11 letras o números';
  end if;

  -- Alta: si el robot nunca ha reportado, se crea su ficha. Queda "sin señal"
  -- desde el primer momento (hora de hace un minuto), no "en línea".
  insert into public.robot_status (serial, updated_at)
  values (p_serial, now() - interval '1 minute')
  on conflict (serial) do nothing;

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

-- Quitar una ficha que no sirve (serial mal escrito, robot dado de baja)
create or replace function public.quitar_robot_sin_vincular(p_serial text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then
    raise exception 'No tienes permiso para quitar robots';
  end if;
  if exists (select 1 from public.robot_tokens where serial = p_serial and token_hash is not null) then
    raise exception 'El robot está vinculado: revoque el vínculo antes de quitarlo';
  end if;
  delete from public.robot_tokens where serial = p_serial;
  delete from public.robot_status where serial = p_serial;
end $$;
revoke all on function public.quitar_robot_sin_vincular(text) from public, anon;
grant execute on function public.quitar_robot_sin_vincular(text) to authenticated;
