-- Guarda una página oficial y avanza su checkpoint en una sola transacción.
-- Nunca toca documentos, evaluaciones comerciales ni checkpoints del otro flujo.
do $$
declare
  required_column text;
  opportunity_table regclass := to_regclass('public.compra_agil_oportunidades');
  codigo_attnum smallint;
  missing_checkpoint_table text;
begin
  if opportunity_table is null then
    raise exception 'Falta public.compra_agil_oportunidades; no se puede preparar el commit atómico';
  end if;
  foreach required_column in array array[
    'codigo', 'nombre', 'descripcion', 'estado', 'organismo', 'region',
    'monto_estimado', 'fecha_publicacion', 'fecha_cierre', 'datos_originales',
    'primera_deteccion', 'ultima_revision'
  ] loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'compra_agil_oportunidades'
        and column_name = required_column
    ) then
      raise exception 'Falta la columna requerida public.compra_agil_oportunidades.%', required_column;
    end if;
  end loop;
  select a.attnum into codigo_attnum from pg_attribute a
  where a.attrelid = opportunity_table and a.attname = 'codigo' and not a.attisdropped;
  if not exists (
    select 1 from pg_index i
    where i.indrelid = opportunity_table and i.indisunique and i.indpred is null
      and i.indnkeyatts = 1 and i.indkey[0] = codigo_attnum
  ) then
    raise exception 'public.compra_agil_oportunidades.codigo requiere una restricción UNIQUE individual';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'compra_agil_oportunidades'
      and column_name = 'datos_originales' and udt_name = 'jsonb'
  ) then
    raise exception 'public.compra_agil_oportunidades.datos_originales debe ser jsonb';
  end if;
  foreach missing_checkpoint_table in array array['compra_agil_sync_state', 'compra_agil_sync_priority_state'] loop
    if to_regclass(format('public.%I', missing_checkpoint_table)) is null then
      raise exception 'Falta el checkpoint requerido public.%', missing_checkpoint_table;
    end if;
  end loop;
  foreach required_column in array array[
    'region_id', 'lock_token', 'lock_until', 'window_to', 'cursor_success',
    'window_from', 'next_page', 'total_pages', 'last_success_at', 'last_attempt_at', 'last_error', 'updated_at'
  ] loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'compra_agil_sync_state'
        and column_name = required_column
    ) then
      raise exception 'Falta la columna requerida public.compra_agil_sync_state.%', required_column;
    end if;
  end loop;
  foreach required_column in array array[
    'region_id', 'lock_token', 'window_to', 'cursor_success', 'window_from',
    'next_page', 'total_pages', 'last_success_at', 'last_attempt_at', 'last_error', 'updated_at'
  ] loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'compra_agil_sync_priority_state'
        and column_name = required_column
    ) then
      raise exception 'Falta la columna requerida public.compra_agil_sync_priority_state.%', required_column;
    end if;
  end loop;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'compra_agil_sync_state'
      and column_name = 'lock_until' and data_type = 'timestamp with time zone'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'compra_agil_sync_state'
      and column_name = 'lock_token' and udt_name = 'uuid'
  ) then
    raise exception 'El checkpoint histórico no tiene lease UUID/timestamptz compatible';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'compra_agil_sync_priority_state'
      and column_name = 'lock_token' and udt_name = 'uuid'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'compra_agil_sync_priority_state'
      and column_name = 'next_page' and data_type = 'integer'
  ) then
    raise exception 'El checkpoint prioritario no tiene token/paginación compatibles';
  end if;
end $$;

create table if not exists public.compra_agil_sync_observations (
  id bigint generated always as identity primary key,
  flow text not null check (flow in ('historical', 'priority')),
  region_id smallint not null check (region_id between 1 and 16),
  codigo text not null,
  source_modified_at timestamptz,
  observed_at timestamptz not null default now(),
  reason text not null check (reason in ('source_version_older', 'source_timestamp_unverifiable')),
  snapshot_hash text not null,
  snapshot jsonb not null,
  unique (flow, region_id, codigo, snapshot_hash)
);

alter table public.compra_agil_sync_observations enable row level security;
revoke all on public.compra_agil_sync_observations from public, anon, authenticated, service_role;
do $$
declare
  observation_sequence regclass := pg_get_serial_sequence('public.compra_agil_sync_observations', 'id')::regclass;
begin
  if observation_sequence is not null then
    execute format('revoke all on sequence %s from public, anon, authenticated, service_role', observation_sequence);
  end if;
end $$;

create or replace function public.compra_agil_sync_source_modified_at(p_snapshot jsonb)
returns timestamptz
language plpgsql
immutable
set search_path = pg_catalog, public
as $$
declare
  v_value text := p_snapshot #>> '{fechas,fecha_ultimo_cambio}';
begin
  if v_value is null or v_value !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' then
    return null;
  end if;
  return v_value::timestamptz;
exception when others then
  return null;
end $$;

create or replace function public.compra_agil_sync_merge_jsonb(p_old jsonb, p_new jsonb)
returns jsonb
language sql
immutable
set search_path = pg_catalog, public
as $$
  select case
    when p_new is null or p_new = 'null'::jsonb then p_old
    when jsonb_typeof(p_old) = 'object' and jsonb_typeof(p_new) = 'object' then (
      select coalesce(jsonb_object_agg(coalesce(o.key, n.key),
        case when n.key is null then o.value
             when o.key is null then n.value
             else public.compra_agil_sync_merge_jsonb(o.value, n.value) end), '{}'::jsonb)
      from jsonb_each(p_old) o full join jsonb_each(p_new) n using (key)
    )
    else p_new
  end
$$;

create or replace function public.compra_agil_sync_commit_page(
  p_flow text,
  p_region_id smallint,
  p_run_token uuid,
  p_page integer,
  p_total_pages integer,
  p_complete boolean,
  p_window_to timestamptz,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_lock public.compra_agil_sync_state%rowtype;
  v_priority public.compra_agil_sync_priority_state%rowtype;
  v_item jsonb;
  v_code text;
  v_inserted_code text;
  v_region text;
  v_source_at timestamptz;
  v_existing_source_at timestamptz;
  v_existing jsonb;
  v_hash text;
  v_reason text;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_observed integer := 0;
  v_now timestamptz;
  v_lease_until timestamptz;
begin
  if p_flow is null or p_flow not in ('historical', 'priority') or p_run_token is null
     or p_region_id is null or p_region_id not between 1 and 16 or p_page is null or p_page < 1
     or (p_total_pages is not null and p_total_pages < 1) or p_complete is null
     or p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) > 50 or p_window_to is null then
    raise exception 'Parámetros inválidos para commit de sincronización' using errcode = '22023';
  end if;
  if p_flow = 'priority' and p_region_id not in (9, 14) then
    raise exception 'El flujo prioritario admite únicamente las regiones 9 y 14' using errcode = '22023';
  end if;
  if p_complete and p_total_pages is not null and p_page < p_total_pages then
    raise exception 'No se puede cerrar una ventana con páginas informadas pendientes' using errcode = '22023';
  end if;
  if p_complete and p_total_pages is null and jsonb_array_length(p_items) >= 50 then
    raise exception 'Una página completa sin total informado debe ser menor al tamaño máximo' using errcode = '22023';
  end if;
  if not p_complete and ((p_total_pages is not null and p_page >= p_total_pages)
     or (p_total_pages is null and jsonb_array_length(p_items) < 50)) then
    raise exception 'La página indica fin de resultados; no puede guardarse como parcial' using errcode = '22023';
  end if;

  v_now := clock_timestamp();
  select * into v_lock from public.compra_agil_sync_state
    where region_id = p_region_id for update;
  if not found or v_lock.lock_token is distinct from p_run_token or v_lock.lock_until <= v_now then
    raise exception 'Lease histórico/regional vencido o perteneciente a otro proceso' using errcode = '55000';
  end if;
  if v_lock.window_to is distinct from p_window_to or v_lock.next_page <> p_page then
    raise exception 'La página no coincide con el checkpoint histórico vigente' using errcode = '40001';
  end if;
  v_lease_until := v_now + interval '5 minutes';
  update public.compra_agil_sync_state
    set lock_until = v_lease_until, updated_at = v_now
    where region_id = p_region_id and lock_token = p_run_token;

  if p_flow = 'priority' then
    select * into v_priority from public.compra_agil_sync_priority_state
      where region_id = p_region_id for update;
    if not found or v_priority.lock_token is distinct from p_run_token
       or v_priority.window_to is distinct from p_window_to
       or v_priority.next_page <> p_page then
      raise exception 'Checkpoint prioritario vencido o perteneciente a otro proceso' using errcode = '40001';
    end if;
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_code := nullif(btrim(v_item ->> 'codigo'), '');
    if v_code is null or v_code !~ '^[0-9]+-[0-9]+-COT[0-9]{2}$' then
      raise exception 'La página incluye un código de Compra Ágil inválido' using errcode = '22023';
    end if;
    if nullif(v_item #>> '{institucion,region}', '') is not null
       and (v_item #>> '{institucion,region}')::smallint <> p_region_id then
      raise exception 'La región del registro no coincide con la consulta' using errcode = '22023';
    end if;

    v_source_at := public.compra_agil_sync_source_modified_at(v_item);
    v_region := coalesce(nullif(v_item #>> '{institucion,nombre_region}', ''),
      case p_region_id
        when 1 then 'Región de Tarapacá' when 2 then 'Región de Antofagasta'
        when 3 then 'Región de Atacama' when 4 then 'Región de Coquimbo'
        when 5 then 'Región de Valparaíso' when 6 then 'Región del Libertador General Bernardo O’Higgins'
        when 7 then 'Región del Maule' when 8 then 'Región del Biobío'
        when 9 then 'Región de La Araucanía' when 10 then 'Región de Los Lagos'
        when 11 then 'Región de Aysén del General Carlos Ibáñez del Campo'
        when 12 then 'Región de Magallanes y de la Antártica Chilena'
        when 13 then 'Región Metropolitana de Santiago' when 14 then 'Región de Los Ríos'
        when 15 then 'Región de Arica y Parinacota' when 16 then 'Región de Ñuble'
      end);

    insert into public.compra_agil_oportunidades (
      codigo, nombre, descripcion, estado, organismo, region, monto_estimado,
      fecha_publicacion, fecha_cierre, datos_originales, primera_deteccion, ultima_revision
    ) values (
      v_code, nullif(v_item ->> 'nombre', ''), v_item ->> 'descripcion',
      v_item #>> '{estado,codigo}', v_item #>> '{institucion,organismo_comprador}',
      v_region, nullif(v_item #>> '{montos,monto_disponible_clp}', '')::numeric,
      nullif(v_item #>> '{fechas,fecha_publicacion}', '')::timestamptz,
      nullif(v_item #>> '{fechas,fecha_cierre}', '')::timestamptz,
      v_item, v_now, v_now
    ) on conflict (codigo) do nothing
    returning codigo into v_inserted_code;
    if found then
      v_inserted := v_inserted + 1;
      continue;
    end if;

    select o.datos_originales into v_existing
    from public.compra_agil_oportunidades o where o.codigo = v_code for update;
    if not found then
      -- Otra región pudo insertar el código concurrentemente; releer tras el conflicto.
      select o.datos_originales into v_existing
      from public.compra_agil_oportunidades o where o.codigo = v_code for update;
    end if;
    v_existing_source_at := public.compra_agil_sync_source_modified_at(v_existing);
    if v_source_at is null or v_existing_source_at is null then
      v_reason := 'source_timestamp_unverifiable';
    elsif v_source_at < v_existing_source_at then
      v_reason := 'source_version_older';
    else
      update public.compra_agil_oportunidades o set
        nombre = coalesce(nullif(v_item ->> 'nombre', ''), o.nombre),
        descripcion = coalesce(o.descripcion, v_item ->> 'descripcion'),
        estado = coalesce(v_item #>> '{estado,codigo}', o.estado),
        organismo = coalesce(v_item #>> '{institucion,organismo_comprador}', o.organismo),
        region = coalesce(v_region, o.region),
        monto_estimado = coalesce(nullif(v_item #>> '{montos,monto_disponible_clp}', '')::numeric, o.monto_estimado),
        fecha_publicacion = coalesce(nullif(v_item #>> '{fechas,fecha_publicacion}', '')::timestamptz, o.fecha_publicacion),
        fecha_cierre = coalesce(nullif(v_item #>> '{fechas,fecha_cierre}', '')::timestamptz, o.fecha_cierre),
        datos_originales = public.compra_agil_sync_merge_jsonb(o.datos_originales, v_item),
        ultima_revision = v_now
      where o.codigo = v_code;
      v_updated := v_updated + 1;
      continue;
    end if;

    v_hash := md5(v_item::text);
    insert into public.compra_agil_sync_observations (
      flow, region_id, codigo, source_modified_at, observed_at, reason, snapshot_hash, snapshot
    ) values (p_flow, p_region_id, v_code, v_source_at, v_now, v_reason, v_hash, v_item)
    on conflict (flow, region_id, codigo, snapshot_hash) do nothing;
    if found then v_observed := v_observed + 1; end if;
  end loop;

  -- Cursor advancement and opportunity/observation writes commit or roll back together.
  if p_flow = 'priority' then
    update public.compra_agil_sync_priority_state set
      cursor_success = case when p_complete then p_window_to else cursor_success end,
      window_from = case when p_complete then null else window_from end,
      window_to = case when p_complete then null else window_to end,
      next_page = case when p_complete then 1 else p_page + 1 end,
      total_pages = case when p_complete then null else p_total_pages end,
      last_success_at = case when p_complete then v_now else last_success_at end,
      last_attempt_at = v_now, last_error = null, updated_at = v_now
    where region_id = p_region_id and lock_token = p_run_token;
    if not found then raise exception 'El propietario prioritario cambió antes del commit' using errcode = '40001'; end if;
  else
    update public.compra_agil_sync_state set
      cursor_success = case when p_complete then p_window_to else cursor_success end,
      window_from = case when p_complete then null else window_from end,
      window_to = case when p_complete then null else window_to end,
      next_page = case when p_complete then 1 else p_page + 1 end,
      total_pages = case when p_complete then null else p_total_pages end,
      last_success_at = case when p_complete then v_now else last_success_at end,
      last_attempt_at = v_now, last_error = null, updated_at = v_now
    where region_id = p_region_id and lock_token = p_run_token;
    if not found then raise exception 'El propietario histórico cambió antes del commit' using errcode = '40001'; end if;
  end if;

  if clock_timestamp() >= v_lease_until then
    raise exception 'El lease expiró durante el commit; toda la página fue revertida' using errcode = '55P03';
  end if;
  return jsonb_build_object('inserted', v_inserted, 'updated', v_updated, 'observed', v_observed,
    'page', p_page, 'next_page', case when p_complete then 1 else p_page + 1 end,
    'complete', p_complete);
end $$;

revoke all on function public.compra_agil_sync_source_modified_at(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.compra_agil_sync_merge_jsonb(jsonb, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.compra_agil_sync_commit_page(text, smallint, uuid, integer, integer, boolean, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.compra_agil_sync_commit_page(text, smallint, uuid, integer, integer, boolean, timestamptz, jsonb) to service_role;
