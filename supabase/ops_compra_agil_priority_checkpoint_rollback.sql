-- Reversible únicamente antes de que el nuevo flujo guarde progreso.
-- Operación manual explícita; no ejecutar durante o después de una sincronización.
do $$
begin
  if to_regclass('public.compra_agil_sync_priority_state') is null then
    raise notice 'La tabla prioritaria no existe; no hay nada que retirar.';
    return;
  end if;
  if exists (
    select 1 from public.compra_agil_sync_priority_state
    where lock_token is not null or cursor_success is not null or window_from is not null or window_to is not null
       or next_page <> 1 or total_pages is not null or last_success_at is not null
       or last_attempt_at is not null or last_error is not null
  ) then
    raise exception 'Rollback detenido: existen checkpoints prioritarios; exporte y revise el estado antes de retirar la tabla.';
  end if;
  drop table public.compra_agil_sync_priority_state;
end $$;
