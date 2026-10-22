-- Deshace token_robot_cerrar.sql (PASO C): los robots vuelven a poder escribir
-- directo en robot_status e insertar eventos, como antes. Se pueden correr varias veces.

drop policy if exists "robot inserta estado" on public.robot_status;
create policy "robot inserta estado" on public.robot_status
  for insert to anon with check (true);

drop policy if exists "robot actualiza estado" on public.robot_status;
create policy "robot actualiza estado" on public.robot_status
  for update to anon using (true) with check (true);

drop policy if exists "robot lee estado" on public.robot_status;
create policy "robot lee estado" on public.robot_status
  for select to anon using (true);

drop policy if exists "robot registra eventos" on public.events;
create policy "robot registra eventos" on public.events
  for insert to anon with check (true);
