-- Estado incremental por región. Solo la Edge Function autenticada accede a estos cursores.
-- No modifica oportunidades, detalles, documentos ni evaluaciones existentes.
create table if not exists public.compra_agil_sync_state (
  region_id smallint primary key check (region_id between 1 and 16),
  cursor_success timestamptz,
  window_from timestamptz,
  window_to timestamptz,
  next_page integer not null default 1 check (next_page > 0),
  total_pages integer check (total_pages is null or total_pages > 0),
  lock_until timestamptz not null default '1970-01-01 00:00:00+00',
  lock_token uuid,
  last_success_at timestamptz,
  last_attempt_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now(),
  check ((window_from is null) = (window_to is null))
);

insert into public.compra_agil_sync_state (region_id)
select region_id from generate_series(1, 16) as regions(region_id)
on conflict (region_id) do nothing;

alter table public.compra_agil_sync_state enable row level security;
revoke all on public.compra_agil_sync_state from public, anon, authenticated;
grant select, insert, update on public.compra_agil_sync_state to service_role;

comment on table public.compra_agil_sync_state is
  'Cursores, ventanas paginadas y bloqueos del sincronizador privado de Compra Ágil.';
