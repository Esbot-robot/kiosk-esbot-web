-- Deshace cerrar_lectura_publica.sql: vuelve a abrir la lectura anónima de
-- projects y robots. OJO: reabre la fuga de los tokens de galería (H2);
-- usar solo si algo dejó de funcionar y mientras se encuentra la causa.
create policy "lectura publica projects" on public.projects for select to anon using (true);
create policy "lectura publica robots" on public.robots for select to anon using (true);
