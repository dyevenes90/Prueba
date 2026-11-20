# CRESCE — mapa del sistema

## Datos confirmados del repositorio (2026-11-19)
- Repositorio GitHub: `dyevenes90/Prueba`, rama activa de desarrollo `desarrollo-comercial`.
- Frontend estático existente: `index.html`, `app.js`, `styles.css`, `supabase-config.js`.
- Backend: Supabase (Postgres/Auth/Storage) y Edge Functions Deno/TypeScript.
- Funciones observadas en GitHub:
  - `supabase/functions/compra-agil-sync/`
  - `supabase/functions/compra-agil-detalle/`
  - `supabase/functions/compra-agil-seguimiento/`
  - `supabase/functions/compra-agil-documentos/`
  - `supabase/functions/cresce-dashboard/`
  - `supabase/functions/trovo-catalogos-revision/`
- Documento de configuración vigente: `COMPRA-AGIL-DASHBOARD.md` (importante revisar allí seguridad y autorización).
- Preview de desarrollo usado por el usuario: `https://registro-datos-araucania-git-desarrollo-a66938-prueba-araucania.vercel.app/`. Verificar el despliegue y el commit; no asumir que la URL siempre muestra la versión nueva.

## Módulos de interfaz
- CRESCE contiene espacios: Trovofarma Store, La Casa del Filo, Gestión de Proyectos y StrongRoot.
- Trovofarma/Compra Ágil: Radar, filtros, oportunidades, detalles oficiales, documentos, revisión de requisitos, proveedores, evaluaciones y rentabilidad/cotización preliminar.
- Los otros espacios existen como módulos en distintas fases: verificar en código qué está implementado antes de ampliar.

## Integraciones y límites
- Mercado Público: API oficial desde servidor y ticket privado, con cuotas y fallos posibles. Botón de actualizar pantalla ≠ nueva sincronización.
- Proveedores y catálogos pueden ser candidatos en staging; requiere confirmaciones humanas de precio, IVA, equivalencia, stock y despacho.
- La calculadora es provisional cuando faltan valores/condiciones; no suponer crédito fiscal ni adjudicación.
- Los documentos oficiales pueden venir solo con nombre/ID; no inventar URL de adjuntos.
