-- Evaluaciones comerciales privadas por oportunidad.
-- No aplicar en producción sin revisión explícita.
CREATE TABLE IF NOT EXISTS public.compra_agil_decisiones (
  codigo TEXT NOT NULL REFERENCES public.compra_agil_oportunidades(codigo) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('producto', 'gastos', 'requisito')),
  clave TEXT NOT NULL,
  datos JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(datos) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (codigo, tipo, clave)
);

ALTER TABLE public.compra_agil_decisiones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.compra_agil_decisiones FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.compra_agil_decisiones TO service_role;
