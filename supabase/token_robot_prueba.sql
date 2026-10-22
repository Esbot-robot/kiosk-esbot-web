-- ───────────────────────────────────────────────────────────────────────────
-- Prueba de token_robot.sql con un robot ficticio (PRUEBA000001)
--
-- Simula todo el recorrido: código de vinculación → token → latido → evento, y
-- comprueba que se escriben los campos correctos y que se rechaza lo que debe.
-- NO deja nada en la base: al final lanza un error a propósito y Postgres
-- deshace todo lo que se creó. Se puede correr las veces que se quiera.
--
-- Resultado esperado en el SQL Editor (aparece como "error"):
--   PRUEBA OK: ... (todo se deshizo)
-- Cualquier otro mensaje que empiece por "FALLO" dice qué salió mal.
-- ───────────────────────────────────────────────────────────────────────────
do $$
declare
  v public.robot_status;
  v_token text;
  v_n int;
  v_ok boolean;
  v_codigo constant text := 'ABCD2345';
begin
  insert into public.robot_status (serial, nombre) values ('PRUEBA000001', 'Prueba');
  insert into public.robot_tokens (serial, codigo_hash, codigo_expira)
  values ('PRUEBA000001', public.hash_secreto(v_codigo), now() + interval '15 minutes');

  -- 1. Código incorrecto: devuelve null y cuenta el intento
  if public.reclamar_robot('PRUEBA000001', 'ZZZZZZZZ') is not null then
    raise exception 'FALLO: aceptó un código incorrecto';
  end if;
  select codigo_intentos into v_n from public.robot_tokens where serial = 'PRUEBA000001';
  if v_n <> 1 then raise exception 'FALLO: no contó el intento fallido (%)', v_n; end if;

  -- 2. Código correcto (con espacios y minúsculas): entrega el token
  v_token := public.reclamar_robot('PRUEBA000001', ' abcd2345 ');
  if v_token is null or length(v_token) <> 64 then raise exception 'FALLO: no entregó el token'; end if;

  -- 3. El código ya no sirve una segunda vez
  if public.reclamar_robot('PRUEBA000001', v_codigo) is not null then
    raise exception 'FALLO: el código se pudo usar dos veces';
  end if;

  -- 4. Latido con token falso: debe rechazarse con PT401
  v_ok := false;
  begin
    perform public.latido('PRUEBA000001', 'falso', '{}'::jsonb);
  exception when sqlstate 'PT401' then v_ok := true;
  end;
  if not v_ok then raise exception 'FALLO: el latido aceptó un token falso'; end if;

  -- 5. Latido completo con todos los campos que envía la app
  select * into v from public.latido('PRUEBA000001', v_token,
    '{"nombre":"Robot de prueba","bateria":77,"cargando":true,"quieto_confirmado":true,"quieto_orden_hecha":3,"version_config":9,"quieto":true,"ubicaciones_mapa":["a","b"],"comando_hecho_id":4,"videollamada_id":5,"videollamada_url":"https://x","videollamada_error":null,"ruta":["a"],"ruta_actualizada_ms":123}'::jsonb);
  if v.serial is distinct from 'PRUEBA000001'
     or v.nombre is distinct from 'Robot de prueba'
     or v.bateria is distinct from 77
     or v.cargando is not true
     or v.quieto_confirmado is not true
     or v.quieto_orden_hecha is distinct from 3
     or v.version_config is distinct from 9
     or v.quieto is not true
     or jsonb_array_length(v.ubicaciones_mapa) is distinct from 2
     or v.comando_hecho_id is distinct from 4
     or v.videollamada_id is distinct from 5
     or v.videollamada_url is distinct from 'https://x'
     or v.ruta is distinct from '["a"]'::jsonb
     or v.ruta_actualizada_ms is distinct from 123
  then
    raise exception 'FALLO: el latido completo no escribió o devolvió lo esperado: %', to_jsonb(v);
  end if;

  -- 6. Un campo que no viene no se toca (igual que el upsert de antes)
  select * into v from public.latido('PRUEBA000001', v_token, '{"cargando":false}'::jsonb);
  if v.bateria is distinct from 77 or v.cargando is not false or v.nombre is distinct from 'Robot de prueba' then
    raise exception 'FALLO: un latido parcial modificó campos que no venían: %', to_jsonb(v);
  end if;

  -- 7. Lo que solo puede ordenar el panel, el robot no lo puede escribir
  select * into v from public.latido('PRUEBA000001', v_token, '{"comando":"reiniciar","comando_id":99}'::jsonb);
  if v.comando is not null or v.comando_id is not null then
    raise exception 'FALLO: el robot pudo escribir una orden del panel: %', to_jsonb(v);
  end if;

  -- 8. Evento con token
  perform public.registrar_evento('PRUEBA000001', v_token, 'toque_pantalla', 1.5, null, null, '2026-10-21T10:00:00', null);
  select count(*) into v_n from public.events where serial = 'PRUEBA000001' and tipo = 'toque_pantalla';
  if v_n <> 1 then raise exception 'FALLO: el evento no se guardó (%)', v_n; end if;

  -- 9. Evento con token falso: rechazado
  v_ok := false;
  begin
    perform public.registrar_evento('PRUEBA000001', 'falso', 'toque_pantalla');
  exception when sqlstate 'PT401' then v_ok := true;
  end;
  if not v_ok then raise exception 'FALLO: el evento aceptó un token falso'; end if;

  -- 10. Tipo de evento con caracteres no permitidos: rechazado
  v_ok := false;
  begin
    perform public.registrar_evento('PRUEBA000001', v_token, 'TIPO MALO!');
  exception when others then v_ok := true;
  end;
  if not v_ok then raise exception 'FALLO: el evento aceptó un tipo no válido'; end if;

  -- Todo bien: este error deshace todo lo que se creó arriba
  raise exception 'PRUEBA OK: vinculación, latido, campos y eventos funcionan (todo se deshizo)';
end $$;
