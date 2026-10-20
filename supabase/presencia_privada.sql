-- ───────────────────────────────────────────────────────────────────────────
-- Presencia "quién está en línea" en un canal PRIVADO
--
-- El canal del panel ("panel-en-linea") era público: quien tuviera la clave pública
-- de Supabase (va en el código de la página) podía unirse sin iniciar sesión y ver los
-- identificadores de las personas conectadas. Con el canal privado, Supabase solo deja
-- entrar a quien tenga sesión iniciada, según estas reglas sobre realtime.messages.
--
-- Orden: PRIMERO este archivo, DESPUÉS publicar el panel con el cambio de "private: true".
-- (Si el panel nuevo se publica sin este archivo, el canal no abre: la página Usuarios
-- usa su respaldo, que tarda hasta 90 s en notar cambios.)
-- Para deshacerlo: presencia_privada_revertir.sql
-- ───────────────────────────────────────────────────────────────────────────

drop policy if exists "panel: ver quien esta en linea" on realtime.messages;
create policy "panel: ver quien esta en linea"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.topic() = 'panel-en-linea'
    and realtime.messages.extension = 'presence'
  );

drop policy if exists "panel: avisar que esta en linea" on realtime.messages;
create policy "panel: avisar que esta en linea"
  on realtime.messages
  for insert
  to authenticated
  with check (
    realtime.topic() = 'panel-en-linea'
    and realtime.messages.extension = 'presence'
  );
