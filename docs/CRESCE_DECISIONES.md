# CRESCE — decisiones permanentes y límites

## Estrategia
- **No reconstruir CRESCE**: evolucionar el stack existente por módulos, con cambios pequeños y verificables.
- Consolidar Trovofarma Compra Ágil para uso real de Ximena, con pocos botones y posibilidades futuras de móvil/PWA.
- Separar datos, permisos y flujos de Trovofarma, StrongRoot, La Casa del Filo y Gestión de Proyectos.
- La app analiza e informa, prepara borradores y prioriza oportunidades, pero una persona valida y envía la oferta.
- `main` no se modifica durante desarrollo comercial; la rama de trabajo es `desarrollo-comercial`.

## Proveedores y compras
- Pronobel (incluye marca Rhein comercializada por Pronobel) y Mashini: catálogos en revisión, no fuentes automáticamente confirmadas.
- Los registros de proveedor y sus precios necesitan trazabilidad, fecha, IVA, presentación, equivalencia técnica, stock y condiciones de entrega.
- No sustituir catálogo activo por staging ni asegurar ganancias con datos incompletos.
- La información del SII/MarketPlace y los rubros de Mercado Público deben manejarse como verificaciones independientes.

## Evolución de IA (propuestas, NO afirmar como implementadas)
- **Ahora**: `AGENTS.md` + documentos cortos de arquitectura/estado/decisiones en Git. Codex lee lo necesario según tarea.
- **Después**: Skills específicas para Radar, catálogos, análisis comercial, pruebas y publicación.
- **NotebookLM**: biblioteca documental de manuales, decisiones y textos, sin sustituir Git como verdad del código.
- **Supabase pgvector**: búsqueda semántica/híbrida de productos y requisitos, con verificación de restricciones duras (ml, unidades, contenido, especificaciones) antes de considerar una coincidencia.
- **Hermes/orquestador**: evaluar cuando haya flujos repetitivos maduros; empezar con acciones de lectura, nunca acceso de escritura irrestricto.
- **Móvil**: PWA en primera fase; WhatsApp/Telegram solo si resuelven una necesidad concreta y con controles de acceso.

## Convenciones de seguridad y operación
- No publicar ni copiar secrets, `.env`, credenciales, tokens o catálogos privados.
- No ocultar errores ni simular pruebas externas.
- En cada cambio, registrar un resumen del resultado en `CRESCE_ESTADO.md` para futuras sesiones, evitando duplicar largas conversaciones.
