-- ───────────────────────────────────────────────────────────────────────────
-- Token por robot — PASO C (cierre)
--
-- Quita al rol anónimo el acceso directo a robot_status y la inserción directa
-- de eventos. A partir de aquí, un robot solo puede reportar y registrar
-- eventos con su token (funciones latido y registrar_evento).
--
-- CORRER SOLO CUANDO todos los robots que se usan estén vinculados: en el panel,
-- Robots, cada tarjeta debe decir "Vinculado". Un robot sin vincular, o con la
-- app anterior, queda "desconectado" y sus eventos se pierden hasta que se
-- vincule.
--
-- Para deshacer: token_robot_cerrar_revertir.sql (queda como estaba antes).
-- ───────────────────────────────────────────────────────────────────────────

drop policy if exists "robot inserta estado" on public.robot_status;
drop policy if exists "robot actualiza estado" on public.robot_status;
drop policy if exists "robot lee estado" on public.robot_status;
drop policy if exists "robot registra eventos" on public.events;

-- Comprobación rápida: debe devolver 0 filas de políticas para anon
select policyname, tablename
  from pg_policies
 where schemaname = 'public'
   and tablename in ('robot_status', 'events')
   and 'anon' = any (roles);
