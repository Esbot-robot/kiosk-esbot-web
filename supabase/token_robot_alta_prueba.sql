-- ───────────────────────────────────────────────────────────────────────────
-- Prueba de token_robot_alta.sql con un robot ficticio (PRUEBAALTA1)
--
-- Simula la sesión del super administrador, da de alta un robot que nunca ha
-- reportado, genera su código, comprueba las validaciones y el borrado, y por
-- último confirma que un robot vinculado NO se puede quitar.
-- NO deja nada en la base: al final lanza un error a propósito y Postgres
-- deshace todo. Resultado esperado (aparece como "error"):
--   PRUEBA OK: ... (todo se deshizo)
-- Cualquier otro mensaje que empiece por "FALLO" dice qué salió mal.
-- ───────────────────────────────────────────────────────────────────────────
do $$
declare
  v_admin uuid;
  v_codigo text;
  v_token text;
  v_n int;
  v_ok boolean;
  v_fecha timestamptz;
begin
  select user_id into v_admin from public.perfiles where rol = 'superadmin' limit 1;
  if v_admin is null then raise exception 'FALLO: no hay super administrador para simular la sesión'; end if;
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

  -- 1. Serial con formato inválido: rechazado
  v_ok := false;
  begin
    perform public.crear_codigo_vinculacion('123');
  exception when others then v_ok := true;
  end;
  if not v_ok then raise exception 'FALLO: aceptó un serial de 3 caracteres'; end if;

  v_ok := false;
  begin
    perform public.crear_codigo_vinculacion('ABC DEF GHIJ');
  exception when others then v_ok := true;
  end;
  if not v_ok then raise exception 'FALLO: aceptó un serial con espacios'; end if;

  -- 2. Alta de un robot que nunca ha reportado
  v_codigo := public.crear_codigo_vinculacion(' PRUEBAALTA1 ');
  if v_codigo is null or length(v_codigo) <> 8 then raise exception 'FALLO: no devolvió un código de 8 caracteres'; end if;
  select updated_at into v_fecha from public.robot_status where serial = 'PRUEBAALTA1';
  if v_fecha is null then raise exception 'FALLO: no creó la ficha del robot'; end if;
  if v_fecha > now() - interval '30 seconds' then raise exception 'FALLO: la ficha nueva aparecería "en línea"'; end if;
  select count(*) into v_n from public.robot_tokens where serial = 'PRUEBAALTA1' and codigo_hash is not null;
  if v_n <> 1 then raise exception 'FALLO: no guardó el código de vinculación'; end if;

  -- 3. Repetir el alta con el mismo serial no duplica nada
  perform public.crear_codigo_vinculacion('PRUEBAALTA1');
  select count(*) into v_n from public.robot_status where serial = 'PRUEBAALTA1';
  if v_n <> 1 then raise exception 'FALLO: duplicó la ficha del robot'; end if;

  -- 4. Quitar una ficha sin vincular
  perform public.quitar_robot_sin_vincular('PRUEBAALTA1');
  select count(*) into v_n from (
    select serial from public.robot_status where serial = 'PRUEBAALTA1'
    union all select serial from public.robot_tokens where serial = 'PRUEBAALTA1'
  ) x;
  if v_n <> 0 then raise exception 'FALLO: no borró la ficha del robot (%)', v_n; end if;

  -- 5. Un robot vinculado no se puede quitar
  v_codigo := public.crear_codigo_vinculacion('PRUEBAALTA1');
  v_token := public.reclamar_robot('PRUEBAALTA1', v_codigo);
  if v_token is null then raise exception 'FALLO: el robot dado de alta no pudo vincularse con su código'; end if;
  v_ok := false;
  begin
    perform public.quitar_robot_sin_vincular('PRUEBAALTA1');
  exception when others then v_ok := true;
  end;
  if not v_ok then raise exception 'FALLO: quitó un robot vinculado'; end if;

  raise exception 'PRUEBA OK: alta, validaciones, código, vinculación y borrado funcionan (todo se deshizo)';
end $$;
