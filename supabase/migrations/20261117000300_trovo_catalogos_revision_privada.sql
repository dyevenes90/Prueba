-- Zona privada de revisiÃƒÆ’Ã‚Â³n para catÃƒÆ’Ã‚Â¡logos normalizados importados desde CRESCE.
-- No modifica proveedores, productos, precios, candidatos ni inventario existente.

alter table public.trovo_importaciones_proveedor
  add column if not exists resumen_importacion jsonb not null default '{}'::jsonb,
  add column if not exists estado_carga text not null default 'completa'
    check (estado_carga in ('en_carga', 'completa', 'error'));

alter table public.trovo_importacion_proveedor_filas
  add column if not exists identidad_proveedor text,
  add column if not exists codigo_barras text,
  add column if not exists marca text,
  add column if not exists categoria text,
  add column if not exists linea text,
  add column if not exists presentacion text,
  add column if not exists pagina_fuente integer,
  add column if not exists ubicacion_fuente text,
  add column if not exists estado_precio text not null default 'pendiente',
  add column if not exists stock_referencial text,
  add column if not exists stock_confirmado boolean not null default false,
  add column if not exists transito_referencial text,
  add column if not exists codigo_repetido boolean not null default false,
  add column if not exists estado_iva text not null default 'pendiente',
  add column if not exists cantidad_precio text,
  add column if not exists unidad_precio text not null default 'por_identificar',
  add column if not exists proveedor_confirmado boolean not null default false;

alter table public.trovo_importacion_proveedor_filas
  drop constraint if exists trovo_importacion_proveedor_filas_importacion_id_fkey;
alter table public.trovo_importacion_proveedor_filas
  add constraint trovo_importacion_proveedor_filas_importacion_id_fkey
  foreign key (importacion_id) references public.trovo_importaciones_proveedor(id) on delete restrict;

alter table public.trovo_importaciones_proveedor
  drop constraint if exists trovo_importaciones_proveedor_estado_carga_check;
alter table public.trovo_importaciones_proveedor
  add constraint trovo_importaciones_proveedor_estado_carga_check
  check (estado_carga in ('en_carga', 'completa', 'error'));
create index if not exists trovo_importaciones_revision_fecha_idx
  on public.trovo_importaciones_proveedor (fecha_carga desc);
create index if not exists trovo_importaciones_revision_estado_idx
  on public.trovo_importaciones_proveedor (estado, estado_carga);
create index if not exists trovo_importacion_filas_codigo_idx
  on public.trovo_importacion_proveedor_filas (codigo_proveedor);
create index if not exists trovo_importacion_filas_review_idx
  on public.trovo_importacion_proveedor_filas (importacion_id, codigo_repetido, numero_fila);

alter table public.trovo_importaciones_proveedor enable row level security;
alter table public.trovo_importacion_proveedor_filas enable row level security;

revoke all on public.trovo_importaciones_proveedor from public, anon, authenticated;
revoke all on public.trovo_importaciones_proveedor from public;
revoke all on public.trovo_importaciones_proveedor from public;
revoke all on public.trovo_importacion_proveedor_filas from anon, authenticated;
revoke all on public.trovo_importacion_proveedor_filas from public;
grant all on public.trovo_importaciones_proveedor to service_role;
grant all on public.trovo_importacion_proveedor_filas to service_role;

comment on table public.trovo_importaciones_proveedor is
  'Importaciones privadas de catÃƒÆ’Ã‚Â¡logos; huella_archivo evita duplicar el mismo archivo.';
comment on table public.trovo_importacion_proveedor_filas is
  'Filas aisladas en revisiÃƒÆ’Ã‚Â³n; proveedor, IVA, precio, unidad y stock permanecen sin confirmar.';
