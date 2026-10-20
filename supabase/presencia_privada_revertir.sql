-- ───────────────────────────────────────────────────────────────────────────
-- Deshace presencia_privada.sql
--
-- Quita las reglas del canal privado. Si el panel sigue pidiendo el canal privado
-- ("private: true"), ya no podrá abrirlo: revierte también ese cambio del código, o
-- vuelve a aplicar presencia_privada.sql.
-- ───────────────────────────────────────────────────────────────────────────

drop policy if exists "panel: ver quien esta en linea" on realtime.messages;
drop policy if exists "panel: avisar que esta en linea" on realtime.messages;
