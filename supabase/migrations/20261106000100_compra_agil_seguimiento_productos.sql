-- Seguimiento manual compartido por oportunidad y línea de producto.
-- Los accesos de navegador pasan por la Edge Function autenticada.
CREATE TABLE IF NOT EXISTS public.compra_agil_seguimiento_productos (
  codigo TEXT NOT NULL
    REFERENCES public.compra_agil_oportunidades(codigo),
  producto_key TEXT NOT NULL,
  producto_nombre TEXT,
  cantidad TEXT,
  unidad_medida TEXT,
  especificacion TEXT,
  estado TEXT NOT NULL DEFAULT 'SIN_EVALUAR'
    CHECK (estado IN (
      'SIN_EVALUAR', 'POSIBLE_COINCIDENCIA', 'PROVEEDOR_CONFIRMADO',
      'BUSCAR_PROVEEDOR', 'NO_DISPONIBLE'
    )),
  proveedor_id UUID REFERENCES public.trovo_proveedores(id),
  proveedor_nombre_manual TEXT,
  observaciones TEXT,
  precio_compra_referencial NUMERIC CHECK (precio_compra_referencial IS NULL OR precio_compra_referencial >= 0),
  condiciones_abastecimiento TEXT,
  fecha_confirmacion DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (codigo, producto_key),
  CHECK (proveedor_id IS NULL OR proveedor_nombre_manual IS NULL)
);

CREATE INDEX IF NOT EXISTS compra_agil_seguimiento_estado_idx
  ON public.compra_agil_seguimiento_productos (estado, codigo);

ALTER TABLE public.compra_agil_seguimiento_productos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.compra_agil_seguimiento_productos FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.compra_agil_seguimiento_productos TO service_role;

-- Exigir proveedor identificado para estados confirmados
ALTER TABLE public.compra_agil_seguimiento_productos
ADD CONSTRAINT seguimiento_proveedor_confirmado_check
CHECK (
  estado <> 'PROVEEDOR_CONFIRMADO'
  OR proveedor_id IS NOT NULL
  OR NULLIF(BTRIM(proveedor_nombre_manual), '') IS NOT NULL
);

-- Actualización automática de fecha al editar
CREATE FUNCTION public.cresce_seguimiento_actualizar_fecha()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER seguimiento_actualizar_fecha
BEFORE UPDATE
ON public.compra_agil_seguimiento_productos
FOR EACH ROW
EXECUTE FUNCTION public.cresce_seguimiento_actualizar_fecha();
