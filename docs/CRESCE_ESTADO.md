# CRESCE — estado de trabajo y siguiente paso

**Última actualización:** 20-11-2026. **El estado local, Git y producción deben verificarse antes de cada tarea.**

## Cambios verificados y publicados
- `desarrollo-comercial` incorporó la Memoria Técnica (`AGENTS.md`, `docs/`) en `75198d4`.
- Corrección de navegación del Radar publicada en `0341b0f`: el usuario confirmó visualmente que conserva filtros, página y posición al abrir y cerrar oportunidades, y que abrir otra ficha funciona.
- Correcciones visuales específicas publicadas en `248049a`: se elimina la duplicación del código de oportunidad en la tabla (`app.js`) y se hace opaco el fondo de los encabezados sticky (`styles.css`). Se comprobó sintaxis JavaScript estática; **pendiente validar el render de Vercel y la experiencia de usuario**.
- La función de Supabase `trovo-catalogos-revision` fue desplegada previamente, según captura del terminal del usuario. No confundirla con despliegue frontend.
- Respaldo local `stash@{0}` mostrado por usuario contiene **solo eliminación de cuatro archivos antiguos de documentación** (movidos a respaldo de escritorio), no la corrección de `app.js`. No restaurar automáticamente; conservar hasta revisión voluntaria. Otros archivos comerciales siguen untracked.

## Próximos pendientes priorizados
1. **Verificar en Preview** que el commit `248049a` elimine códigos visualmente repetidos y transparencia del encabezado. Verificar también que la corrección del Radar persista. No suponer que el Preview ya se desplegó solo por el push.
2. **Completar sincronización incremental de Mercado Público**: capturas mostraron 857 oportunidades almacenadas y 150 páginas pendientes; la última ejecución parcial era del 19-11 y la última sincronización exitosa general del 05-11. Usar checkpoints y respetar cuotas. No afirmar cobertura completa mientras existan pendientes.
3. **Distinguir ítems globales con anexo**: una oportunidad `2751-50-COT26` mostraba `Lápices de colores`, cantidad `1 GL`, pero descripción `MATERIALES E INSUMOS VARIOS SEGUN ARCHIVO ADJUNTO`. Requiere analizar anexo oficial antes de considerar cobertura o costo total. No tratar 1 GL como un lápiz.
4. Mejorar ficha si carece de detalle: indicador de carga, reintento manual y búsqueda oficial, sin consultar masivamente detalles ni consumir cuota.
5. Vincular candidatos de proveedores/catálogos (Pronobel/Rhein y Mashini) a requisitos y productos, con confirmación de equivalencias, precio, IVA, stock y condiciones.
6. Completar rentabilidad, borradores de cotización, flujo humano de aprobación y luego PWA y rediseño profundo.

## Problemas o restricciones conocidos
- Algunas fechas de cierre de la API no tienen zona horaria verificable. Mantener advertencia y no afirmar vigencia confirmada basándose solo en `publicada`.
- Los enlaces actuales de «Abrir en Mercado Público» llevan a la búsqueda general, no a una ficha individual validada. No fabricar URLs; comprobar una ruta directa oficial antes de implementarla.
- Candidatos staging no son proveedores ni precios confirmados. Los anexos pueden cambiar lo efectivamente solicitado.
- No presentar cotizaciones automáticamente en Mercado Público ni alterar datos de terceros.
- La prueba de CONAF `1091-42-COT26` fue ejemplo: el usuario decidió no postular.
- Trovofarma figuraba HÁBIL y acreditada hasta 18-11-2027 en capturas del usuario; revisar condición vigente antes de ofertas.

## Regla de trabajo
Trabajar sobre una tarea acotada, pruebas dirigidas, `git status` primero y commit/push solamente de archivos revisados. No guardar secretos ni catálogos privados en Git. Mantener este documento breve y actualizado cuando cambie el estado.
