-- ───────────────────────────────────────────────────────────────────────────
-- Deshace quieto_sin_video.sql
--
-- Deja "Detener recorrido" como estaba (solo quieto sí/no). Si la app 1.10 o el
-- panel con el popup nuevo siguen en uso, fallarán al no encontrar las columnas
-- o la función: revierte también esos cambios, o vuelve a aplicar
-- quieto_sin_video.sql.
-- ───────────────────────────────────────────────────────────────────────────

-- La función de siempre, tal como estaba en modo_quieto.sql
create or replace function public.fijar_quieto(p_serial text, p_quieto boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.robot_status
     set quieto = p_quieto
   where serial = p_serial;
  if not found then
    raise exception 'El robot % todavía no ha enviado ningún latido', p_serial;
  end if;
end $$;

revoke all on function public.fijar_quieto(text, boolean) from public, anon;
grant execute on function public.fijar_quieto(text, boolean) to authenticated;

drop function if exists public.fijar_quieto_modo(text, boolean, boolean, text, integer);

alter table public.robot_status
  drop column if exists quieto_sin_video,
  drop column if exists quieto_frase,
  drop column if exists quieto_frase_seg,
  drop column if exists quieto_orden,
  drop column if exists quieto_orden_hecha;
