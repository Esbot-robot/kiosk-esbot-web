-- ───────────────────────────────────────────────────────────────────────────
-- Modo quieto "sin video"
--
-- "Detener recorrido" ahora puede dejar el robot quieto de dos maneras:
--   · con video (como siempre): sigue el video de patrullaje y el primer toque
--     despierta los botones;
--   · sin video: se queda en la pantalla inicial fija, con los botones siempre
--     activos, sin video ni cuenta regresiva de inicio, y dice una frase (voz de
--     Azure) cada cierto número de segundos.
--
-- La frase y el intervalo se escriben en el popup de "Detener recorrido", por
-- robot. Viajan por el latido que ya existe (≤3 s), como el resto del modo
-- quieto: sin tablas nuevas.
--
-- Orden de aplicación: PRIMERO este archivo, DESPUÉS instalar la app 1.10.
-- Para deshacerlo: quieto_sin_video_revertir.sql.
-- ───────────────────────────────────────────────────────────────────────────

alter table public.robot_status
  -- lo que pide el panel (solo vale mientras quieto = true)
  add column if not exists quieto_sin_video boolean not null default false,
  add column if not exists quieto_frase text not null default '',
  add column if not exists quieto_frase_seg integer not null default 60,
  -- número de la última orden de quieto (la pone el servidor en cada cambio)
  add column if not exists quieto_orden bigint not null default 0,
  -- número de la última orden que el robot aplicó: el panel muestra
  -- "Aplicando cambios…" mientras no coinciden
  add column if not exists quieto_orden_hecha bigint not null default 0;


-- El panel solo puede cambiar el modo quieto y sus datos, nada más de la fila
-- (por eso es una función y no una política UPDATE para authenticated).
create or replace function public.fijar_quieto_modo(
  p_serial text,
  p_quieto boolean,
  p_sin_video boolean default false,
  p_frase text default '',
  p_seg integer default 60
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sin_video boolean := p_quieto and coalesce(p_sin_video, false);
begin
  update public.robot_status
     set quieto = p_quieto,
         quieto_sin_video = v_sin_video,
         -- la frase se guarda siempre (el robot solo la usa en "sin video"): así, si se apaga el
         -- interruptor y se vuelve a encender desde el lápiz, la frase sigue ahí
         quieto_frase = left(coalesce(trim(p_frase), ''), 300),
         quieto_frase_seg = least(3600, greatest(10, coalesce(p_seg, 60))),
         quieto_orden = quieto_orden + 1
   where serial = p_serial;
  if not found then
    raise exception 'El robot % todavía no ha enviado ningún latido', p_serial;
  end if;
end $$;

revoke all on function public.fijar_quieto_modo(text, boolean, boolean, text, integer) from public, anon;
grant execute on function public.fijar_quieto_modo(text, boolean, boolean, text, integer) to authenticated;


-- La función de siempre (solo quieto sí/no) se conserva para quien aún la use,
-- pero ahora también limpia el "sin video" y anota la orden.
create or replace function public.fijar_quieto(p_serial text, p_quieto boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.fijar_quieto_modo(p_serial, p_quieto, false, '', 60);
end $$;

revoke all on function public.fijar_quieto(text, boolean) from public, anon;
grant execute on function public.fijar_quieto(text, boolean) to authenticated;
