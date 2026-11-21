# Encargo para Codex VS Code — CRESCE Holding + Compra Ágil

## Contexto y objetivo

La carpeta local del usuario es `D:\Programar\Prueba`. Trabaja con VS Code + Codex. El objetivo es **completar, probar y pulir** el diseño propuesto en la rama remota `origin/design/cresce-holding-vhs-20261121`, no reconstruir desde cero.

Lee antes `AGENTS.md`, `docs/CRESCE_DISENO_HOLDING_2026-11-21.md` y los fragmentos pertinentes de `index.html`, `app.js`, `styles.css`. Sigue las normas del repositorio: no alterar lógica funcional ni datos de producción.

### Seguridad del árbol de trabajo

1. Inspecciona `git status --short`, `git branch --show-current`, `git remote -v`, y `git fetch origin`.
2. Nunca pierdas cambios locales, ni hagas `reset --hard`, `git clean`, ni `stash` sin autorización. Si existen cambios locales, propón y utiliza un **worktree nuevo** para esta rama en lugar de sobrescribir el trabajo del usuario.
3. Trabaja exclusivamente sobre `design/cresce-holding-vhs-20261121`; no merges a `desarrollo-comercial` o `main`. La PR de seguridad #1 es independiente y está pendiente.
4. Si los cambios de la rama remota avanzaron, integra mediante un fast-forward sin sobrescribir.

## Recursos entregados

El usuario tiene un archivo ZIP `cresce-codex-assets.zip`. Dentro está `assets/logos/cresce-logo.webp`: es el **logo original** convertido a WebP optimizado. El archivo debe residir en el repositorio exactamente en esa ruta, sustituyendo el fallback de la portada. Si el ZIP no está en el directorio actual, busca en la carpeta Descargas del usuario o solicita que lo adjunte al workspace. **No lo sustituyas por imágenes aleatorias, genéricas ni generadas.** No versionar el ZIP después de extraer.

## Requisitos visuales que ya fueron acordados

- Dos capas: portada ejecutiva de holding, y módulos operativos limpios.
- Estética editorial con movimiento inspirada conceptualmente en VHS Archive de MotionSites, **implementación original**. Color carbón/negro, bronce/dorado envejecido, grafito y marfil. No copiar elementos propietarios.
- Portada sin frases, subtítulos, etiquetas, cifras de ejemplo ni textos de presentación; exhibir **solo logo de CRESCE, logos de las cuatro empresas y controles accesibles**.
- Tarjetas/carousel de cuatro empresas; flechas, teclado, toque en celular; movimientos suaves y menos movimiento si `prefers-reduced-motion`.
- Trovofarma abre `#trovofarma/compra-agil` directamente. Barra lateral de módulos existente permanece, aunque hoy solamente Compra Ágil esté operativa.
- En otros módulos eliminar estadísticas o listas ficticias y textos de demostración; no simular datos reales ni inventar funciones.
- Compra Ágil: quitar textos redundantes del título; mantener `Actualizar` pequeño porque recarga únicamente datos guardados; no lanzar consultas a Mercado Público al abrir.
- Quitar visualmente el prefiltro superior de regiones y fecha de recuperación, sin cambiar a escondidas la cobertura de API. Mientras el backend solo contemple Araucanía y Los Ríos conservar el alcance anterior y mostrarlo cuando se ejecute una sincronización real. **No prometer «todas las oportunidades vigentes» si hay 125 páginas pendientes/checkpoints u otros datos incompletos.**
- Mantener los filtros detallados de la tabla, incluido el acceso a oportunidades históricas. «Solo oportunidades vigentes» preseleccionado al iniciar Radar sobre el dataset realmente guardado, siempre permitiendo desmarcarlo.
- Reducir métricas y últimas consultas a lo esencial y esconder/plegar historial amplio. Ocultar oportunidades para revisar si no hay hallazgos.
- No perder filtros, scroll, página y selección cuando se abre y cierra detalle; no interferir con Supabase Auth.

## Chequeos de implementación

1. Comprueba que el logo se muestre sin 404 ni errores de consola y que mantiene su proporción; no usar imagen de terceros.
2. Comprueba HTML, CSS y JS actuales por sintaxis: `node --check app.js` y `git diff --check`; si hay herramientas de pruebas web instaladas, ejecutar pruebas dirigidas sin introducir dependencias pagadas.
3. Valida que los selectores/IDs que espera el JavaScript continúan presentes (`ca-sync-regions`, `ca-sync-from`, `ca-sync`, `ca-refresh`, `ca-only-current`, `ca-metrics`, `ca-regions`, `ca-recent`, `ca-review-panel`, filtros y páginas).
4. Revisa si la implementación actual tiene transiciones CSS inválidas o problemas de responsive (móvil, 950px, escritorio) y corrígelos sin añadir frameworks.
5. Prueba inicio, home, navegación entre empresas, clic/flechas/teclado/touch del carrusel, Trovofarma → Compra Ágil, filtrado histórico y apertura de ficha. Si no puedes probar sesiones privadas, informa el límite sin inventar resultados.
6. Comprueba accesibilidad básica: contraste, foco visible, controles con etiquetas y movimiento reducido.
7. Evita que el trabajo cosmético invoque sincronizaciones, cambie datos, haga migraciones, exponga claves o consuma cuota de API.
8. Revisa la caché de navegación del Radar al cambiar entre secciones; no regresionar las correcciones previas.

## Entrega y publicación

- Editar solo archivos necesarios; registrar cambios en `docs/CRESCE_DISENO_HOLDING_2026-11-21.md`.
- Mostrar resumen de cambios, pruebas realizadas y pendientes reales.
- Crear commit únicamente con cambios revisados; `git push -u origin design/cresce-holding-vhs-20261121` si está permitido y confirmado el destino. Vercel generará Preview; informar URL exacta obtenida, sin inventarla.
- Mantener `https://github.com/dyevenes90/Prueba/pull/2` en **draft** hasta que el propietario apruebe visualmente.
- No fusionar PR #2, PR #1, ni modificar producción.

## Punto adicional — no confundir diseño con función

El usuario quiere eventualmente que Compra Ágil detecte automáticamente todas las oportunidades realmente vigentes sin gestión manual. Es una mejora backend posterior: requiere política de ventanas, estados, sincronización incremental, cuotas y checkpoints. **No cambiarlo en este encargo visual**. Registrar como siguiente tarea separada, sujeta a pruebas y autorización.
