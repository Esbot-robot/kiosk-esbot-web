-- ───────────────────────────────────────────────────────────────────────────
-- Prueba de ota_app.sql con un robot y una versión ficticios
--
-- Simula la sesión del super administrador: registra una versión de la app (con un
-- archivo ficticio en el bucket), ordena la actualización a un robot ficticio, comprueba
-- las validaciones y que el latido guarde la versión instalada. Si existe un
-- administrador (no super), comprueba también que NO pueda ordenar la actualización.
-- NO deja nada en la base: al final lanza un error a propósito y Postgres deshace todo.
--
-- Resultado esperado (aparece como "error"):
--   PRUEBA OK: ... (todo se deshizo)
-- Cualquier otro mensaje que empiece por "FALLO" dice qué salió mal.
-- ───────────────────────────────────────────────────────────────────────────
do $$
declare
  v_super uuid;
  v_admin uuid;
  v_ok boolean;
  v_n int;
  v_ruta text;
  v public.robot_status;
  v_sha constant text := repeat('ab', 32);
begin
  select user_id into v_super from public.perfiles where rol = 'superadmin' limit 1;
  if v_super is null then raise exception 'FALLO: no hay super administrador para simular la sesión'; end if;
  select user_id into v_admin from public.perfiles where rol = 'admin' limit 1;

  -- Robot ficticio con token (como en token_robot_prueba.sql)
  insert into public.robot_status (serial, nombre) values ('PRUEBAOTA01', 'Prueba OTA');
  insert into public.robot_tokens (serial, token_hash) values ('PRUEBAOTA01', public.hash_secreto('token-de-prueba'));

  -- Sesión del super administrador
  perform set_config('request.jwt.claim.sub', v_super::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_super, 'role', 'authenticated')::text, true);

  -- 1. Sin el archivo en el bucket no se registra la versión
  v_ok := false;
  begin
    perform public.registrar_version_app(9999, '9.9.9', 'prueba/KioskEsbot_v9.9.9.apk', v_sha, 1000, 'x');
  exception when others then v_ok := true;
  end;
  if not v_ok then raise exception 'FALLO: registró una versión sin que existiera el archivo'; end if;

  -- 2. Con el archivo (ficticio) sí se registra
  insert into storage.objects (bucket_id, name) values ('apks', 'prueba/KioskEsbot_v9.9.9.apk');
  perform public.registrar_version_app(9999, '9.9.9', 'prueba/KioskEsbot_v9.9.9.apk', v_sha, 1000, '  notas de prueba ');
  select count(*) into v_n from public.app_versiones where version_code = 9999 and notas = 'notas de prueba' and subida_por is not null;
  if v_n <> 1 then raise exception 'FALLO: la versión no quedó registrada con sus datos (%)', v_n; end if;

  -- 3. Validaciones: repetida, nombre y huella inválidos
  v_ok := false;
  begin
    perform public.registrar_version_app(9999, '9.9.9', 'prueba/KioskEsbot_v9.9.9.apk', v_sha, 1000);
  exception when others then v_ok := true;
  end;
  if not v_ok then raise exception 'FALLO: aceptó un código de versión repetido'; end if;

  v_ok := false;
  begin
    perform public.registrar_version_app(9998, 'abc', 'prueba/KioskEsbot_v9.9.9.apk', v_sha, 1000);
  exception when others then v_ok := true;
  end;
  if not v_ok then raise exception 'FALLO: aceptó un nombre de versión inválido'; end if;

  v_ok := false;
  begin
    perform public.registrar_version_app(9998, '9.9.8', 'prueba/KioskEsbot_v9.9.9.apk', 'no-es-una-huella', 1000);
  exception when others then v_ok := true;
  end;
  if not v_ok then raise exception 'FALLO: aceptó una huella inválida'; end if;

  -- 4. La orden de actualizar: válida solo con una versión que existe y con formato correcto
  perform public.enviar_comando('PRUEBAOTA01', 'actualizar_app:9999');
  select * into v from public.robot_status where serial = 'PRUEBAOTA01';
  if v.comando is distinct from 'actualizar_app:9999' or v.comando_id is null then
    raise exception 'FALLO: la orden no quedó en el robot: %', to_jsonb(v);
  end if;

  v_ok := false;
  begin
    perform public.enviar_comando('PRUEBAOTA01', 'actualizar_app:9997');
  exception when others then v_ok := true;
  end;
  if not v_ok then raise exception 'FALLO: ordenó una versión que no existe'; end if;

  v_ok := false;
  begin
    perform public.enviar_comando('PRUEBAOTA01', 'actualizar_app:abc');
  exception when others then v_ok := true;
  end;
  if not v_ok then raise exception 'FALLO: aceptó una orden con formato inválido'; end if;

  -- 5. Las órdenes de antes siguen funcionando
  perform public.enviar_comando('PRUEBAOTA01', 'reiniciar');
  perform public.enviar_comando('PRUEBAOTA01', 'actualizar');
  perform public.enviar_comando('PRUEBAOTA01', 'decir:{"t":"hola","m":"voz","i":"ES_ES"}');

  -- 6. Un administrador (no super) no puede ordenar la actualización de la app
  if v_admin is not null then
    perform set_config('request.jwt.claim.sub', v_admin::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    v_ok := false;
    begin
      perform public.enviar_comando('PRUEBAOTA01', 'actualizar_app:9999');
    exception when others then v_ok := true;
    end;
    if not v_ok then raise exception 'FALLO: un administrador pudo ordenar la actualización de la app'; end if;
    -- ... ni subir versiones
    v_ok := false;
    begin
      perform public.registrar_version_app(9996, '9.9.6', 'prueba/KioskEsbot_v9.9.9.apk', v_sha, 1000);
    exception when others then v_ok := true;
    end;
    if not v_ok then raise exception 'FALLO: un administrador pudo registrar una versión'; end if;
    -- vuelve a la sesión del super administrador
    perform set_config('request.jwt.claim.sub', v_super::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_super, 'role', 'authenticated')::text, true);
  end if;

  -- 7. El latido con token guarda la versión instalada y el estado de la actualización
  select * into v from public.latido('PRUEBAOTA01', 'token-de-prueba',
    '{"app_version_code":19,"app_version_name":"1.17","app_actualizacion":"descargando 40%"}'::jsonb);
  if v.app_version_code is distinct from 19 or v.app_version_name is distinct from '1.17'
     or v.app_actualizacion is distinct from 'descargando 40%' then
    raise exception 'FALLO: el latido no guardó la versión de la app: %', to_jsonb(v);
  end if;
  -- un latido sin esos campos no los borra (como el de una app anterior)
  select * into v from public.latido('PRUEBAOTA01', 'token-de-prueba', '{"bateria":80}'::jsonb);
  if v.app_version_code is distinct from 19 or v.bateria is distinct from 80 then
    raise exception 'FALLO: un latido sin los campos de versión los modificó: %', to_jsonb(v);
  end if;

  -- 8. Eliminar la versión devuelve la ruta del archivo y borra la fila
  v_ruta := public.eliminar_version_app(9999);
  if v_ruta is distinct from 'prueba/KioskEsbot_v9.9.9.apk' then raise exception 'FALLO: ruta devuelta incorrecta (%)', v_ruta; end if;
  select count(*) into v_n from public.app_versiones where version_code = 9999;
  if v_n <> 0 then raise exception 'FALLO: no borró la versión'; end if;

  raise exception 'PRUEBA OK: versiones, orden de actualizar, permisos y latido con versión funcionan (todo se deshizo)';
end $$;
