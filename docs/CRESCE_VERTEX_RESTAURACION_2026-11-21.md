# CRESCE Holding — versión visual inspirada en Vertex (21-11-2026)

## Solicitud y alcance
Se descartó la portada clara tipo Reelmark/galería anterior. El usuario entregó un prompt de referencia para un hero oscuro Vertex Shops con navegación flotante, estrellas, textos centrados, carrusel de tarjetas sobre una órbita cilíndrica en perspectiva y un mockup de navegador superpuesto en el tercio inferior.

**Adaptación original a CRESCE, no copia literal de Vertex Shops:** se preservan logos reales, las cuatro unidades de negocio y las rutas de la aplicación. No se usan los recursos externos de e-commerce ni cifras ficticias del prompt. La vista de navegador del hero es *ilustrativa* y no muestra métricas operativas.

## Arquitectura
- Nueva rama `design/cresce-vertex-hero-20261121`, base `design/cresce-holding-vhs-20261121`, **sin fusionar**.
- `index.html` restaurado byte a byte desde `desarrollo-comercial`: barra principal, búsqueda y sus scripts operativos permanecen; la portada oculta la barra antigua y muestra su nav propia.
- `app.js`: se restaura desde `desarrollo-comercial` la lógica comercial original de CRESCE, incluida Compra Ágil, proveedores, documentos, evaluación, filtros, sincronizaciones y navegación. **La única adición funcional es `home()`**, que monta la portada con un carrusel visual de 37 tarjetas representando repetidas veces las cuatro empresas. Los destinos de las tarjetas son las rutas existentes; Trovofarma enlaza directamente a `#trovofarma/compra-agil`.
- `styles.css`: CSS original de `desarrollo-comercial` íntegro, con reglas adicionales exclusivamente bajo `.vc-` y `body:has(.vc-stage)`. Los módulos mantienen todos los estilos previos.
- Reutiliza `assets/logos/cresce-logo.webp` y los logos existentes. Sin dependencias nuevas, sin llamadas comerciales automáticas desde home.

## Diseño implementado
- Lienzo base 1172 × 657 px con escala adaptativa a escritorio y composición fluida en teléfonos de 700 px o menos.
- Barra flotante ovalada, badge translúcido, título, botón a Compra Ágil, estrellas decorativas y carrousel cilíndrico de 37 tarjetas.
- Órbita: radio de 891 px, perspectiva de 891 px y descarte de tarjetas fuera de ±42°, avance lento de 1,9°/segundo.
- Mockup de la interfaz de Compra Ágil al pie: ilustrativo, sin datos inventados ni carga de APIs.
- Accesos a las cuatro empresas, menú móvil, foco, teclas Escape, pausa por hover/foco y `prefers-reduced-motion`.

## Comprobaciones
- Revisión sintáctica del JS con `new Function` durante la edición.
- Vercel Preview respondió HTTP 200 para `/`, `/app.js`, `/styles.css`, `/assets/logos/cresce-logo.webp` y el logo de Trovofarma; `app.js` incluye `caBuildDashboard` y `workspace`.
- **Pendiente:** prueba de interacción visual real desde navegador autenticado, prueba de navegación/Supabase Auth/Compra Ágil de punta a punta y comprobación en teléfono. Un build READY no sustituye esto.

## Antes de aprobar/fusionar
1. Abrir Preview y comparar con el prompt recibido; revisar tamaño de logo, centro del título, distribución de la órbita y mockup.
2. Verificar las cuatro rutas, especialmente Trovofarma → Compra Ágil y regresar al holding.
3. Probar login, Radar, proveedores, detalle, seguimiento, descarga documental, evaluación y filtros históricos. No ejecutar sincronización de API para esta prueba visual.
4. Probar móvil con menú, teclado y `prefers-reduced-motion`.
5. Mantener `desarrollo-comercial`, `main`, PR #1 y PR #2 intactas hasta aprobación.

**IMPORTANTE:** la petición de «regresar toda funcionalidad» se implementó restaurando el código completo de `desarrollo-comercial`, no fusionando la lógica de la anterior rama experimental. La visualización del home es nueva, pero la funcionalidad necesita validación humana de navegación para considerarse aprobada.
