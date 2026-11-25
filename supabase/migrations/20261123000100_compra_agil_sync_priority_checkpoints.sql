-- Checkpoints independientes del flujo prioritario. El historial existente
-- permanece intacto en compra_agil_sync_state.
create table if not exists public.compra_agil_sync_priority_state (
  region_id smallint primary key check (region_id in (9, 14)),
  lock_token uuid,
  cursor_success timestamptz,
  window_from timestamptz,
  window_to timestamptz,
  next_page integer not null default 1 check (next_page > 0),
  total_pages integer check (total_pages is null or total_pages > 0),
  last_success_at timestamptz,
  last_attempt_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now(),
  check ((window_from is null) = (window_to is null))
);

alter table public.compra_agil_sync_priority_state
  add column if not exists lock_token uuid;

insert into public.compra_agil_sync_priority_state (region_id)
values (9), (14)
on conflict (region_id) do nothing;

alter table public.compra_agil_sync_priority_state enable row level security;
revoke all on public.compra_agil_sync_priority_state from public, anon, authenticated;
grant select, insert, update on public.compra_agil_sync_priority_state to service_role;

comment on table public.compra_agil_sync_priority_state is
  'Ventanas y cursores del barrido prioritario privado de Compra Ágil para Araucanía y Los Ríos; independiente del historial.';
