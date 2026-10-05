-- Deshace videollamada_prueba.sql. Quita antes la app y el panel que la usan.

create or replace function public.enviar_comando(p_serial text, p_comando text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  if p_comando not in ('actualizar', 'reiniciar') then
    raise exception 'Orden no válida: %', p_comando;
  end if;
  update public.robot_status
     set comando = p_comando,
         comando_id = v_id
   where serial = p_serial;
  if not found then
    raise exception 'El robot % todavía no ha enviado ningún latido', p_serial;
  end if;
  return v_id;
end $$;

alter table public.robot_status
  drop column if exists videollamada_id,
  drop column if exists videollamada_url,
  drop column if exists videollamada_error;
