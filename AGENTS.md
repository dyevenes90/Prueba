# CRESCE — instrucciones permanentes para agentes de desarrollo

## Proyecto y fuentes de verdad
- Repositorio: `dyevenes90/Prueba`; trabajar en `desarrollo-comercial`. No modificar `main` sin autorización.
- Web modular: Trovofarma Store / Compra Ágil, La Casa del Filo, Gestión de Proyectos y StrongRoot.
- Stack actual: HTML/CSS/JavaScript, Vercel, Supabase PostgreSQL/Auth, Edge Functions (Deno/TypeScript), integración con API Mercado Público.
- **El código y el estado real de Git/Supabase prevalecen sobre estos documentos.** Antes de editar, revisar `git status`, diff y los archivos implicados. No asumir que una modificación local o un despliegue fue concluido.
- Mapa: `docs/CRESCE_MAPA.md`; estado y tareas: `docs/CRESCE_ESTADO.md`; decisiones: `docs/CRESCE_DECISIONES.md`.
- **Ahorro de contexto:** leer solo el documento y los fragmentos de código pertinentes a la tarea. No recorrer todo el repositorio ni cargar grandes antecedentes por defecto.

## Reglas innegociables
- No reescribir lo que funciona ni alterar lógica no relacionada con la solicitud.
- Nunca incluir en Git: `.env`, secretos, tickets API, claves privadas, archivos de clientes/proveedores, CSV/XLSX/PDF/ZIP comerciales.
- No cambiar en producción tablas, migraciones, RLS, datos ni Edge Functions sin revisar impacto, separar despliegue de código y autorización pertinente.
- Supabase: autenticación y datos comerciales privados; no desactivar RLS ni exponer `service_role` ni ticket de Mercado Público en frontend.
- **CRESCE nunca envía ofertas automáticamente.** Las cotizaciones se preparan para aprobación y envío humano en Mercado Público.
- No tratar candidatos de catálogos como productos, precios, equivalencias o existencias confirmados. No tratar stock del proveedor como inventario propio.
- Reutilizar los módulos/cálculos existentes. No añadir dependencias ni servicios de IA pagados sin justificación y aprobación.
- Antes de publicar: pruebas pertinentes, `git diff --check`, verificar archivos incluidos y hacer commit/push solo de cambios revisados.
- Declarar explícitamente qué se comprobó de verdad y qué no (no confundir tests locales, push a GitHub, despliegue Vercel y despliegue Supabase).

## Método de trabajo eficiente
1. Confirmar rama, `git status`, diff y si hay cambios previos incompletos; preservarlos.
2. Identificar archivos/funciones específicos y explicar el cambio mínimo.
3. Editar únicamente lo necesario para el objetivo de la sesión.
4. Probar de forma proporcional al cambio.
5. Actualizar brevemente `docs/CRESCE_ESTADO.md` solo si hubo un cambio real de estado.
6. Informar: hecho, probado, no comprobado, archivos tocados y paso de despliegue si aplica.

## Inicio rápido
- Para bugs del Radar: consultar `docs/CRESCE_MAPA.md` y `docs/CRESCE_ESTADO.md` antes de abrir `app.js`.
- Para importación y proveedores: consultar mapa y funciones `trovo-catalogos-revision`.
- Para decisiones arquitectónicas: consultar `docs/CRESCE_DECISIONES.md`.
