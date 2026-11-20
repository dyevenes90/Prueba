# CRESCE — estado de trabajo y siguiente paso

**Corte de esta nota:** 19-11-2026. **Verificar en Git y aplicación antes de ejecutar nuevas tareas.**

## Último estado comprobado
- GitHub `desarrollo-comercial` apuntaba a commit `84ad71b` («Redesign CRESCE visual system and consolidate styles»), confirmado por lectura de GitHub durante esta conversación.
- Se desplegó exitosamente en Supabase `trovo-catalogos-revision` (captura de terminal compartida por el usuario). No confundir ese despliegue con publicación nueva del frontend.
- La UI muestra Radar con oportunidades, pero el usuario observó saltos y recargas al abrir detalles. La apariencia cambió sobre todo estilos, no arquitectura.
- Estado local compartido por el usuario: `app.js` modificado, `git diff --stat` mostró **191 inserciones y 32 eliminaciones**; `.nav-fix.py` es no rastreado. Una sesión de Codex se interrumpió antes de concluir la corrección. **No sobrescribir, resetear, ejecutar el script ni hacer `git add .` sin revisión.**
- Hay otros archivos de datos comerciales sin seguimiento: mantenerlos fuera del repositorio público.

## Tarea inmediata (una sola)
**Concluir de manera segura la reparación de navegación del Radar.**
1. Leer `git status --short`, `git diff -- app.js` y revisar `.nav-fix.py` **como texto**, sin ejecutarlo.
2. Determinar si la edición incompleta ya soluciona algo; comprobar qué falta.
3. Conservar tabla/filtros/página en DOM cuando se abra detalle y al volver.
4. Evitar que las renovaciones de Supabase Auth vuelvan a cargar toda la lista sin necesidad.
5. Evitar saltos provocados por `tbody.replaceChildren()` durante loading y `scrollIntoView()` sobre un panel bajo la tabla; validar contra código actual.
6. Probar y publicar solo si la corrección está completa. Documentar pruebas y pasos de Vercel.

## Navegacion del Radar (20-11-2026)
- La vista de oportunidad reemplaza el panel de trabajo en el mismo espacio; Radar, filtros y pagina permanecen montados. Volver restaura desplazamiento y foco.
- Las lecturas conservan filas mientras cargan, deduplican solicitudes y descartan respuestas antiguas. Renovaciones de token no recargan; cambios de usuario si.
- Verificado localmente con node --check app.js, git diff --check y pruebas DOM simuladas de navegacion, concurrencia y sesion. No se probo contra produccion ni en el Preview publicado.

## Posteriormente (no mezclar con la tarea inmediata)
- Completar recuperación/sincronización de páginas pendientes del Radar y distinguir última ejecución parcial de última exitosa.
- Verificar coincidencias de proveedores y candidatos staging contra catálogos reales.
- Importador autónomo seguro de CSV/XLSX/PDF, con revisión antes de promoción.
- Cotización y rentabilidad completas, controles de IVA, costos, requisitos y despacho.
- UI/UX profundo y PWA para Ximena: después de estabilizar flujo principal.
- `pgvector` para búsqueda híbrida semántica con filtros estrictos: fase futura, no implementado solo por escribirlo aquí.

## Contexto comercial confirmado por el usuario
- Trovofarma está registrada como HÁBIL en Mercado Público y acreditada hasta 18-11-2027 según capturas del usuario. Confirmar habilidad al ofertar.
- Oferta de CONAF `1091-42-COT26` fue ejemplo de análisis: el usuario decidió **no postular**.
- No presentar cotizaciones ni efectuar adquisiciones automáticamente.
