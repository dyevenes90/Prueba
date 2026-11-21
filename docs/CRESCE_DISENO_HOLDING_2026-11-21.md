# CRESCE Holding — iteración visual 2026-11-21

**Rama exclusiva:** `design/cresce-holding-vhs-20261121`. **No fusionar** con `desarrollo-comercial` sin probar Preview y agregar el logo original. No tocar `main`. La PR de seguridad `security/baseline-headers-gitignore-20261120` es separada y sigue pendiente.

## Acuerdo de diseño
- Dos capas: **Holding** (impacto visual) y **Operaciones** (velocidad, lectura y filtros).
- Referencia estética: VHS Archive de MotionSites, reinterpretada como galería propia de cuatro empresas, sin reproducir sus recursos visuales o textos.
- Paleta: carbón, grafito, bronce, oro envejecido, marfil. Sin subtítulos ni textos de demostración; solo logos en el selector principal.
- Trovofarma accede directamente a Compra Ágil; sidebar con módulos se conserva para futuras funcionalidades.
- Módulos sin integración ya no exhiben estadísticas, listas o prioridades ficticias.
- Navbar con accesos de logos solamente, notificaciones de demostración ocultas, botón refrescar compacto.
- Radar: por defecto solo oportunidades vigentes **dentro de los registros almacenados**; filtros manuales debajo siguen permitiendo consultar históricas.
- Ocultar panel de revisión si no contiene señales. Mantener lectura de datos guardados y sincronización real como acciones separadas.
- Tres indicadores principales en Radar y panel colapsable para actividad/regiones (evitar que historial ocupe la pantalla).
- Ocultar selector de regiones y fecha de sincronización, pero **sin ampliar cobertura ni reescribir el backend**. El botón manual conserva el alcance anterior (Araucanía + Los Ríos) y el cálculo automático existente del período de recuperación. **No confundir esto con tener todas las oportunidades vigentes de Mercado Público**.
- Respetar `prefers-reduced-motion`; sin animaciones pesadas, sin dependencias nuevas, sin IA nueva ni cobros.

## Requisito para terminar
Agregar el logo original proporcionado por el usuario en `assets/logos/cresce-logo.webp` dentro de esta rama. Existe una versión WEBP optimizada entregada en esta conversación. Mientras no esté, la portada muestra el texto CRESCE como respaldo.

## Pruebas obligatorias de Preview
1. Home: logos de cuatro empresas y selección flechas/clic/foco con teclado; navegación Trovofarma a Compra Ágil.
2. Compra Ágil: sesión existente, filtros, búsqueda histórica desmarcando «Solo oportunidades vigentes», abrir detalle y regresar preservando posición.
3. Botón actualizar: solo lee registros guardados; no invoca `compra-agil-sync`.
4. Botón Buscar compras nuevas: mantener inactivo durante esta prueba para evitar consumo de API, validar únicamente nombre/capacidad; verificar manualmente con intención explícita en otra sesión.
5. Responsive desktop/móvil, navegación con teclado y movimiento reducido.
6. Comparar consola y Network contra `desarrollo-comercial` sin errores nuevos; rama de seguridad seguirá separada.

## Notas
- Solo se modifican `index.html`, `styles.css` y `app.js`, además de este documento. No modifica Supabase, secretos, RLS ni base de datos.
- La función de sincronización conserva ventanas y checkpoints previos. Automatizar la ingestión completa y continua es una **tarea funcional posterior**, no una transformación cosmética.
