-- Staging no activa: preparar importaciones con revisión explícita antes de modificar catálogos.
create table if not exists public.trovo_importaciones_proveedor (
  id uuid primary key default gen_random_uuid(),
  nombre_archivo text not null,
  tipo_archivo text not null check (tipo_archivo in ('xlsx','xls','csv','pdf')),
  huella_archivo text not null,
  estado text not null default 'pendiente_revision' check (estado in ('pendiente_revision','aprobada','rechazada','aplicada')),
  cargado_por uuid not null references auth.users(id),
  fecha_carga timestamptz not null default now(),
  fecha_revision timestamptz,
  revisado_por uuid references auth.users(id),
  notas_revision text,
  unique (huella_archivo)
);

create table if not exists public.trovo_importacion_proveedor_filas (
  id uuid primary key default gen_random_uuid(),
  importacion_id uuid not null references public.trovo_importaciones_proveedor(id) on delete cascade,
  numero_fila integer not null check (numero_fila > 0),
  proveedor_clave text,
  codigo_proveedor text,
  nombre_producto text,
  precio numeric(14,2),
  tratamiento_iva text check (tratamiento_iva in ('incluido','excluido','desconocido')),
  fuente_original text,
  duplicado_de uuid references public.trovo_importacion_proveedor_filas(id),
  datos_originales jsonb not null,
  unique (importacion_id, numero_fila)
);

alter table public.trovo_importaciones_proveedor enable row level security;
alter table public.trovo_importacion_proveedor_filas enable row level security;
-- Sin políticas de acceso de usuario final: lectura/escritura solo desde backend autorizado.
