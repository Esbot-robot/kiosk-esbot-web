-- Deshace token_robot.sql (PASO A). Si ya se corrió el PASO C, correr antes
-- token_robot_cerrar_revertir.sql para que los robots vuelvan a poder escribir.
-- Los robots con la app 1.15 que ya tengan token pasan a "sin vincular" y siguen
-- por el camino anterior, que mientras tanto vuelve a existir por el revertir de C.

drop function if exists public.registrar_evento(text, text, text, double precision, text, text, text, uuid);
drop function if exists public.latido(text, text, jsonb);
drop function if exists public.listar_vinculos();
drop function if exists public.revocar_vinculo(text);
drop function if exists public.reclamar_robot(text, text);
drop function if exists public.crear_codigo_vinculacion(text);
drop function if exists public.robot_token_valido(text, text);
drop function if exists public.hash_secreto(text);
drop table if exists public.robot_tokens;
