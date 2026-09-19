-- ───────────────────────────────────────────────────────────────────────────
-- Modo quieto
--
-- Desde la tarjeta de cada robot en el panel se puede dejar el robot "quieto":
-- sigue funcionando todo (video de patrullaje, botones, quiz, foto) pero no
-- recorre sus ubicaciones. Sirve para dejarlo en un punto que no existe en el
-- mapa o para cortar un recorrido que se torció.
--
-- Viaja por el latido que ya existe: la app hace upsert en robot_status cada
-- 3 s y ahora pide la fila de vuelta (return=representation), así que la
-- orden le llega en ese mismo POST, sin peticiones nuevas.
--
-- Correr una sola vez en el SQL Editor de Supabase, después de schema.sql.
-- ───────────────────────────────────────────────────────────────────────────

-- Lo que pide el panel
alter table public.robot_status
  add column if not exists quieto boolean not null default false;

-- Lo que el robot tiene aplicado de verdad. Lo reporta en cada latido; así el
-- panel distingue "pedido" de "hecho" y muestra "Deteniendo..." mientras la
-- orden no ha llegado (sin internet, app cerrada, etc.).
alter table public.robot_status
  add column if not exists quieto_confirmado boolean not null default false;


-- La hora del latido NO debe moverse cuando el cambio lo hace el panel.
-- Si se moviera, un robot apagado aparecería "En servicio" solo porque alguien
-- tocó el botón. Por eso robot_status deja de usar touch_updated_at (que es
-- compartida con projects y robots) y tiene la suya.
create or replace function public.robot_status_touch()
returns trigger language plpgsql as $$
begin
  if auth.role() = 'authenticated' then
    new.updated_at := old.updated_at;  -- cambio del panel: no es un latido
  else
    new.updated_at := now();           -- latido del robot
  end if;
  return new;
end $$;

drop trigger if exists robot_status_touch on public.robot_status;
create trigger robot_status_touch before update on public.robot_status
  for each row execute function public.robot_status_touch();


-- El panel solo puede cambiar "quieto", nada más de la fila. Por eso es una
-- función y no una política UPDATE para authenticated, que le dejaría tocar
-- batería, nombre o la hora.
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


-- Nota: el robot (anon) ya tiene INSERT, UPDATE y SELECT sobre robot_status
-- desde schema.sql. El SELECT es lo que permite el return=representation; y
-- el UPDATE es lo que usa la app para escribir quieto = false cuando el
-- operario guarda ubicaciones en el admin del robot.
