\set ON_ERROR_STOP on

select 'create role anon nologin' where not exists (select 1 from pg_roles where rolname = 'anon') \gexec
select 'create role authenticated nologin' where not exists (select 1 from pg_roles where rolname = 'authenticated') \gexec
select 'create role service_role nologin' where not exists (select 1 from pg_roles where rolname = 'service_role') \gexec

create table public.compra_agil_oportunidades (
  codigo text primary key,
  nombre text,
  descripcion text,
  estado text,
  organismo text,
  region text,
  monto_estimado numeric,
  fecha_publicacion timestamptz,
  fecha_cierre timestamptz,
  datos_originales jsonb not null default '{}'::jsonb,
  primera_deteccion timestamptz not null default now(),
  ultima_revision timestamptz not null default now()
);
alter table public.compra_agil_oportunidades enable row level security;

\ir ../migrations/20261118000100_compra_agil_sync_checkpoints.sql
\ir ../migrations/20261123000100_compra_agil_sync_priority_checkpoints.sql
\ir ../migrations/20261123000200_compra_agil_sync_atomic_commit.sql
update public.compra_agil_sync_state set window_from='2026-11-09T00:00:00Z',window_to='2026-11-18T00:00:00Z',next_page=31,total_pages=99 where region_id=9;
update public.compra_agil_sync_priority_state set window_from='2026-11-23T00:00:00Z',window_to='2026-11-24T00:00:00Z',next_page=1,total_pages=4 where region_id=9;
-- Repeat to verify safe reapplication without resetting either cursor.
\ir ../migrations/20261118000100_compra_agil_sync_checkpoints.sql
\ir ../migrations/20261123000100_compra_agil_sync_priority_checkpoints.sql
\ir ../migrations/20261123000200_compra_agil_sync_atomic_commit.sql
do $$ begin
  if (select next_page from public.compra_agil_sync_state where region_id=9) <> 31
     or (select window_to from public.compra_agil_sync_state where region_id=9) <> '2026-11-18T00:00:00Z'
     or (select next_page from public.compra_agil_sync_priority_state where region_id=9) <> 1
     or (select window_to from public.compra_agil_sync_priority_state where region_id=9) <> '2026-11-24T00:00:00Z' then
    raise exception 'Reaplicar migraciones reinició un checkpoint';
  end if;
end $$;

do $$
declare
  v_token uuid := '00000000-0000-4000-8000-000000000009';
  v_window_to timestamptz := '2026-11-24T00:00:00Z';
  v_result jsonb;
  v_failed boolean := false;
  v_historical public.compra_agil_sync_state%rowtype;
  v_priority public.compra_agil_sync_priority_state%rowtype;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.compra_agil_sync_state'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.compra_agil_sync_priority_state'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.compra_agil_sync_observations'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.compra_agil_oportunidades'::regclass) then
    raise exception 'RLS no está activado en todas las tablas del fixture';
  end if;
  if has_table_privilege('anon', 'public.compra_agil_sync_observations', 'select')
     or has_table_privilege('authenticated', 'public.compra_agil_sync_observations', 'select')
     or has_table_privilege('service_role', 'public.compra_agil_sync_observations', 'select')
     or has_function_privilege('anon', 'public.compra_agil_sync_commit_page(text,smallint,uuid,integer,integer,boolean,timestamptz,jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.compra_agil_sync_commit_page(text,smallint,uuid,integer,integer,boolean,timestamptz,jsonb)', 'execute')
     or not has_function_privilege('service_role', 'public.compra_agil_sync_commit_page(text,smallint,uuid,integer,integer,boolean,timestamptz,jsonb)', 'execute') then
    raise exception 'Permisos observados no coinciden con el acceso privado esperado';
  end if;
  if has_table_privilege('anon', 'public.compra_agil_sync_priority_state', 'select')
     or has_table_privilege('authenticated', 'public.compra_agil_sync_priority_state', 'select') then
    raise exception 'Un rol público puede leer checkpoints';
  end if;

  update public.compra_agil_sync_state set
    lock_token = v_token, lock_until = clock_timestamp() + interval '5 minutes',
    window_from = '2026-11-09T00:00:00Z', window_to = '2026-11-18T00:00:00Z', next_page = 31, total_pages = 99
  where region_id = 9;
  update public.compra_agil_sync_priority_state set
    lock_token = v_token, window_from = '2026-11-23T00:00:00Z', window_to = v_window_to, next_page = 1, total_pages = 4
  where region_id = 9;

  select public.compra_agil_sync_commit_page('priority', 9::smallint, v_token, 1, 4, false, v_window_to,
    '[{"codigo":"555-1-COT26","nombre":"Primera versión","estado":{"codigo":"publicada"},"institucion":{"region":9,"nombre_region":"Región de La Araucanía"},"fechas":{"fecha_ultimo_cambio":"2026-11-23T10:00:00Z","fecha_cierre":"2026-11-17 16:28"},"montos":{"monto_disponible_clp":100}}]'::jsonb)
  into v_result;
  if (v_result->>'inserted')::int <> 1 then raise exception 'Commit prioritario no insertó su registro'; end if;
  select * into v_historical from public.compra_agil_sync_state where region_id = 9;
  select * into v_priority from public.compra_agil_sync_priority_state where region_id = 9;
  if v_historical.next_page <> 31 or v_historical.window_to <> '2026-11-18T00:00:00Z' or v_priority.next_page <> 2 then
    raise exception 'La página prioritaria alteró/ignoró los checkpoints separados';
  end if;
  if (select fecha_cierre from public.compra_agil_oportunidades where codigo = '555-1-COT26') <> '2026-11-17T19:28:00Z'::timestamptz then
    raise exception 'Fecha sin zona no se normalizó a America/Santiago (DST noviembre)';
  end if;

  select public.compra_agil_sync_commit_page('historical', 9::smallint, v_token, 31, 99, false, '2026-11-18T00:00:00Z', '[]'::jsonb) into v_result;
  select * into v_historical from public.compra_agil_sync_state where region_id = 9;
  select * into v_priority from public.compra_agil_sync_priority_state where region_id = 9;
  if v_historical.next_page <> 32 or v_priority.next_page <> 2 then raise exception 'Flujo histórico no avanzó su propio cursor'; end if;

  -- Stale historical source version is observed but cannot replace priority data.
  perform public.compra_agil_sync_commit_page('historical', 9::smallint, v_token, 32, 99, false, '2026-11-18T00:00:00Z',
    '[{"codigo":"555-1-COT26","nombre":"Versión antigua","fechas":{"fecha_ultimo_cambio":"2026-11-22T10:00:00Z"},"montos":{"monto_disponible_clp":1}}]'::jsonb);
  if (select nombre from public.compra_agil_oportunidades where codigo = '555-1-COT26') <> 'Primera versión'
     or (select count(*) from public.compra_agil_sync_observations where codigo = '555-1-COT26' and reason = 'source_version_older') <> 1 then
    raise exception 'Versión histórica obsoleta reemplazó los datos prioritarios o no quedó observada';
  end if;

  -- A later comparable source timestamp can update the row; missing source time cannot.
  perform public.compra_agil_sync_commit_page('priority', 9::smallint, v_token, 2, 4, false, v_window_to,
    '[{"codigo":"555-1-COT26","nombre":"Versión nueva","fechas":{"fecha_ultimo_cambio":"2026-11-24T10:00:00Z"},"montos":{"monto_disponible_clp":250}}]'::jsonb);
  perform public.compra_agil_sync_commit_page('priority', 9::smallint, v_token, 3, 4, false, v_window_to,
    '[{"codigo":"555-1-COT26","nombre":"Sin versión verificable"}]'::jsonb);
  if (select nombre from public.compra_agil_oportunidades where codigo = '555-1-COT26') <> 'Versión nueva'
     or (select monto_estimado from public.compra_agil_oportunidades where codigo = '555-1-COT26') <> 250
     or (select count(*) from public.compra_agil_sync_observations where codigo = '555-1-COT26' and reason = 'source_timestamp_unverifiable') <> 1 then
    raise exception 'Comparación de versiones oficiales no fue conservadora';
  end if;

  -- Failed second item must roll back first item and checkpoint advancement.
  begin
    perform public.compra_agil_sync_commit_page('priority', 9::smallint, v_token, 4, 4, true, v_window_to,
      '[{"codigo":"777-1-COT26","nombre":"Debe revertirse"},{"codigo":"bad-code"}]'::jsonb);
  exception when sqlstate '22023' then v_failed := true;
  end;
  select * into v_priority from public.compra_agil_sync_priority_state where region_id = 9;
  if not v_failed or exists(select 1 from public.compra_agil_oportunidades where codigo = '777-1-COT26') or v_priority.next_page <> 4 then
    raise exception 'Falló la atomicidad: quedó dato/checkpoint después de error';
  end if;

  -- Expired shared lease rejects both flows and changes nothing.
  update public.compra_agil_sync_state set lock_until = clock_timestamp() - interval '1 second' where region_id = 9;
  v_failed := false;
  begin
    perform public.compra_agil_sync_commit_page('priority', 9::smallint, v_token, 4, 4, true, v_window_to, '[]'::jsonb);
  exception when sqlstate '55000' then v_failed := true;
  end;
  select * into v_historical from public.compra_agil_sync_state where region_id = 9;
  select * into v_priority from public.compra_agil_sync_priority_state where region_id = 9;
  if not v_failed or v_priority.next_page <> 4 or v_historical.next_page <> 33 then raise exception 'Lease vencido avanzó checkpoint'; end if;

  -- Winter offset check uses the actual PostgreSQL tzdata for America/Santiago.
  if public.compra_agil_sync_parse_source_date('2026-07-17 16:28') <> '2026-07-17T20:28:00Z'::timestamptz then
    raise exception 'Fecha invierno no respeta zona America/Santiago';
  end if;
  if public.compra_agil_sync_parse_source_date('2026-11-17T16:28:00-03:00') <> '2026-11-17T19:28:00Z'::timestamptz
     or public.compra_agil_sync_parse_source_date('2026-11-17') is not null then
    raise exception 'Offset explícito o forma de fecha no verificable se interpretó incorrectamente';
  end if;
  raise notice 'PostgreSQL assertions: checkpoints separados, permisos/RLS, versions, rollback, lease y zona Chile OK';
end $$;

update public.compra_agil_sync_state set lock_token = '00000000-0000-4000-8000-000000000016',
  lock_until = clock_timestamp() + interval '5 minutes', window_from = '2026-11-23T00:00:00Z',
  window_to = '2026-11-24T00:00:00Z', next_page = 1, total_pages = 2 where region_id = 16;

-- Concurrency phase uses region 14 and is raced by two independent psql sessions.
update public.compra_agil_sync_state set lock_token = '00000000-0000-4000-8000-000000000014',
  lock_until = clock_timestamp() + interval '5 minutes', window_from = '2026-11-23T00:00:00Z',
  window_to = '2026-11-24T00:00:00Z', next_page = 1, total_pages = 2 where region_id = 14;
update public.compra_agil_sync_priority_state set lock_token = '00000000-0000-4000-8000-000000000014',
  window_from = '2026-11-23T00:00:00Z', window_to = '2026-11-24T00:00:00Z', next_page = 1, total_pages = 2 where region_id = 14;
create function public.test_delay_concurrent_insert() returns trigger language plpgsql as $$
begin if new.codigo = '888-1-COT26' then perform pg_sleep(2); end if; return new; end $$;
create trigger test_delay_concurrent_insert before insert on public.compra_agil_oportunidades
for each row execute function public.test_delay_concurrent_insert();
