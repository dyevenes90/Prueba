-- Fija la política horaria por ventana. Las ventanas preexistentes se
-- consideran strict_utc, que es la regla anterior al modo experimental.
alter table public.compra_agil_sync_state
  add column if not exists date_mode text not null default 'strict_utc';
alter table public.compra_agil_sync_priority_state
  add column if not exists date_mode text not null default 'strict_utc';

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.compra_agil_sync_state'::regclass and conname = 'compra_agil_sync_state_date_mode_check') then
    alter table public.compra_agil_sync_state add constraint compra_agil_sync_state_date_mode_check check (date_mode in ('strict_utc','chile_wall_z'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.compra_agil_sync_priority_state'::regclass and conname = 'compra_agil_sync_priority_date_mode_check') then
    alter table public.compra_agil_sync_priority_state add constraint compra_agil_sync_priority_date_mode_check check (date_mode in ('strict_utc','chile_wall_z'));
  end if;
end $$;

create or replace function public.compra_agil_sync_commit_page_with_mode(
  p_flow text,
  p_region_id smallint,
  p_run_token uuid,
  p_page integer,
  p_total_pages integer,
  p_complete boolean,
  p_window_to timestamptz,
  p_items jsonb,
  p_date_mode text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_lock public.compra_agil_sync_state%rowtype;
  v_window_to timestamptz;
  v_next_page integer;
  v_mode text;
begin
  if p_date_mode is null or p_date_mode not in ('strict_utc','chile_wall_z') then
    raise exception 'Modo horario inválido' using errcode = '22023';
  end if;

  -- Same lock order as the atomic RPC: shared regional lease, then flow checkpoint.
  -- Checks and delegated writes belong to the same transaction.
  select * into v_lock from public.compra_agil_sync_state
    where region_id = p_region_id for update;
  if not found or v_lock.lock_token is distinct from p_run_token
     or v_lock.lock_until is null
     or v_lock.lock_until <= clock_timestamp() then
    raise exception 'Lease regional vencido o perteneciente a otro proceso' using errcode = '55000';
  end if;

  if p_flow = 'historical' then
    select window_to, next_page, date_mode into v_window_to, v_next_page, v_mode
      from public.compra_agil_sync_state where region_id = p_region_id;
  elsif p_flow = 'priority' then
    select window_to, next_page, date_mode into v_window_to, v_next_page, v_mode
      from public.compra_agil_sync_priority_state where region_id = p_region_id for update;
  else
    raise exception 'Flujo de sincronización inválido' using errcode = '22023';
  end if;

  if v_window_to is distinct from p_window_to or v_next_page <> p_page then
    raise exception 'Página no coincide con el checkpoint vigente' using errcode = '40001';
  end if;
  if v_mode is distinct from p_date_mode then
    raise exception 'El modo horario del checkpoint no coincide; termina la ventana o aplica el procedimiento de recuperación antes de cambiarlo' using errcode = '40001';
  end if;

  return public.compra_agil_sync_commit_page(
    p_flow, p_region_id, p_run_token, p_page, p_total_pages, p_complete,
    p_window_to, p_items, p_date_mode = 'chile_wall_z'
  );
end $$;

revoke all on function public.compra_agil_sync_commit_page_with_mode(text, smallint, uuid, integer, integer, boolean, timestamptz, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.compra_agil_sync_commit_page_with_mode(text, smallint, uuid, integer, integer, boolean, timestamptz, jsonb, text)
  to service_role;

-- The legacy endpoint cannot enforce per-window mode pinning; only the wrapper
-- may be invoked by the runtime service role after this migration.
revoke execute on function public.compra_agil_sync_commit_page(text, smallint, uuid, integer, integer, boolean, timestamptz, jsonb, boolean)
  from public, anon, authenticated, service_role;
