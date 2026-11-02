/* Cada área declara su navegación y sus ejemplos. Nuevos módulos pueden añadirse aquí. */
const areas = [
 {id:'trovofarma',logo:'assets/logos/trovofarma.png',name:'Trovofarma Store',icon:'store',ink:'#3f6e56',tint:'#edf4e9',description:'Conecta tu operación comercial: ventas, abastecimiento y nuevas oportunidades en un solo lugar.',tags:['Comercio','Inventario','Crecimiento'],modules:['Resumen','Ventas','Compras','Inventario','Finanzas','Compra Ágil','Laboratorio de ideas','Automatizaciones IA','Configuración'],examples:['Revisar productos con stock bajo','Preparar seguimiento de ventas','Planificar próxima compra']},
 {id:'casa-del-filo',logo:'assets/logos/La Casa del Filo.png',name:'La Casa del Filo',icon:'blade',ink:'#8c6849',tint:'#f5ede2',description:'Organiza servicios, clientes y trabajos. Dale claridad a cada pedido, desde el ingreso hasta la entrega.',tags:['Servicios','Clientes','Pedidos'],modules:['Resumen','Servicios','Clientes','Trabajos / pedidos','Finanzas','Compra Ágil','Laboratorio de ideas','Automatizaciones IA','Configuración'],examples:['Confirmar entrega de un pedido','Preparar cotización de afilado','Contactar a un cliente recurrente']},
 {id:'proyectos',logo:'assets/logos/Gestion de proyectos.png',name:'Gestión de Proyectos',icon:'projects',ink:'#586c99',tint:'#edf0f9',description:'Transforma antecedentes e ideas en proyectos con dirección, seguimiento y próximos pasos claros.',tags:['Planificación','Antecedentes','Seguimiento'],modules:['Resumen','Proyectos activos','Banco Integrado / antecedentes','Seguimiento','Finanzas','Laboratorio de ideas','Automatizaciones IA','Configuración'],examples:['Ordenar antecedentes del proyecto','Revisar próximo hito de entrega','Preparar evaluación de una iniciativa']},
 {id:'strongroot',logo:'assets/logos/Logo Strongroot.png',name:'StrongRoot',icon:'root',ink:'#657543',tint:'#eff2e3',description:'Cultiva una visión completa de tu operación: producción, recursos y tecnología trabajando juntos.',tags:['Agro','Producción','Tecnología'],modules:['Resumen','Frambuesas','Riego / sensores','Invernaderos','Pellet','Cámara de frío','Finanzas','Compra Ágil','Laboratorio de ideas','Automatizaciones IA','Configuración'],examples:['Revisar programación de riego','Planificar labores en frambuesas','Verificar capacidad de cámara de frío']}
];
const moduleContent = {
 'Ventas':['Organiza ventas y oportunidades de seguimiento.',['Venta de muestra · Pedido 001','Oportunidad · Cliente recurrente','Seguimiento · Cotización enviada']],
 'Compras':['Planifica el abastecimiento y centraliza tus proveedores.',['Solicitud de reposición','Comparación de proveedores','Orden de compra de muestra']],
 'Inventario':['Prepara el control de productos, existencias y reposiciones.',['Producto de muestra · Stock por revisar','Reposición de productos prioritarios','Revisión de movimientos de bodega']],
 'Finanzas':['Reúne ingresos, gastos y compromisos para entender tu operación.',['Ingreso de muestra por conciliar','Gasto operativo por clasificar','Presupuesto del próximo período']],
 'Compra Ágil':['Organiza oportunidades de compra y sus antecedentes.',['Oportunidad de muestra por evaluar','Antecedentes para preparar oferta','Seguimiento de propuesta']],
 'Laboratorio de ideas':['Captura posibilidades y conviértelas en próximos experimentos.',['Idea · Nuevo servicio complementario','Experimento · Mejorar seguimiento comercial','Hipótesis · Simplificar una tarea repetitiva']],
 'Automatizaciones IA':['Explora flujos que podrían ahorrar tiempo en esta área.',['Propuesta · Resumir antecedentes','Propuesta · Clasificar solicitudes','Propuesta · Preparar recordatorios']],
 'Configuración':['Espacio inicial para definir preferencias, responsables y futuras integraciones.',['Definir responsables del área','Organizar categorías de trabajo','Planificar integraciones necesarias']],
 'Servicios':['Estructura tu catálogo de servicios y sus condiciones.',['Afilado de cuchillos · Ejemplo','Mantención de herramientas · Ejemplo','Evaluación de pieza especial · Ejemplo']],
 'Clientes':['Prepara una visión ordenada de tus contactos y su seguimiento.',['Cliente de muestra · Primera atención','Cliente de muestra · Seguimiento pendiente','Cliente de muestra · Servicio recurrente']],
 'Trabajos / pedidos':['Acompaña cada trabajo desde su recepción hasta su entrega.',['Pedido 001 · Recibido','Pedido 002 · En preparación','Pedido 003 · Listo para entregar']],
 'Proyectos activos':['Centraliza iniciativas, responsables y próximos hitos.',['Proyecto de muestra · Etapa inicial','Iniciativa de mejora · En planificación','Proyecto piloto · Revisión de alcance']],
 'Banco Integrado / antecedentes':['Ordena la documentación y el contexto de cada iniciativa.',['Ficha de iniciativa · Ejemplo','Antecedentes técnicos · Por reunir','Presupuesto de referencia · Por revisar']],
 'Seguimiento':['Mantén a la vista hitos, compromisos y próximos pasos.',['Hito de muestra · Revisar alcance','Compromiso de muestra · Solicitar antecedentes','Próximo paso · Preparar reunión']],
 'Frambuesas':['Organiza las labores, la producción y el seguimiento del cultivo.',['Plan de cosecha · Ejemplo','Revisión de labores del cuartel','Registro de producción · Por definir']],
 'Riego / sensores':['Prepara la supervisión del riego y las futuras lecturas de terreno.',['Programación de riego · Ejemplo','Sensor de humedad · Sin conexión configurada','Revisión de sectores de riego']],
 'Invernaderos':['Planifica cultivos y tareas por espacio productivo.',['Invernadero de muestra · Plan de labores','Revisión de ventilación','Programación de próxima siembra']],
 'Pellet':['Organiza producción, insumos y entregas de pellet.',['Lote de muestra · En planificación','Revisión de materia prima','Programación de despacho']],
 'Cámara de frío':['Prepara el control de almacenamiento y condiciones de conservación.',['Lote de muestra · Ingreso planificado','Revisión de capacidad disponible','Temperatura · Sin sensor conectado']]
};
const main = document.getElementById('contenido');
const slug = name => name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-$/,'');
const icon = area => `<span class="original-logo"><img src="${area.logo}" alt="Logo original de ${area.name}" decoding="async"></span>`;
function home(){
 main.innerHTML = `<h1 class="sr-only">Áreas de trabajo</h1><div class="area-grid">${areas.map(a=>`<article class="area-card" style="--ink:${a.ink}"><div class="card-top">${icon(a)}</div><h2>${a.name}</h2><p>${a.description}</p><div class="tags">${a.tags.map(t=>`<span>${t}</span>`).join('')}</div><a class="enter" href="#${a.id}/resumen" aria-label="Entrar a ${a.name}">Entrar <span aria-hidden="true">↗</span></a></article>`).join('')}</div>`;
 document.title='CRESCE';
}
function workspace(area, module){
 const summary = module === 'Resumen';
 const [description,rows] = summary ? ['Una vista inicial para organizar prioridades y conectar los distintos módulos.',area.examples] : moduleContent[module];
 main.innerHTML = `<a class="back" href="#inicio">← Todas las áreas</a><div class="workspace-heading">${icon(area)}<div><span class="eyebrow">ESPACIO DE TRABAJO</span><h1>${area.name}</h1><p>Operación, ideas y próximos pasos.</p></div></div><div class="workspace"><nav class="sidebar" aria-label="Secciones de ${area.name}">${area.modules.map(m=>`<a href="#${area.id}/${slug(m)}" ${m===module?'aria-current="page"':''}>${m}</a>`).join('')}</nav><section aria-labelledby="module-title"><div class="module-heading"><h2 id="module-title">${module}</h2><span class="demo-label">Vista de demostración</span></div><p class="module-description">${description}</p>${summary?`<div class="metrics"><div class="metric"><span>Módulos del espacio</span><strong>${area.modules.length}</strong></div><div class="metric"><span>Prioridades de ejemplo</span><strong>3</strong></div><div class="metric"><span>Etapa actual</span><strong>Inicial</strong></div></div>`:''}<div class="panel"><h3>${summary?'Tu próximo foco':'Contenido inicial'}</h3>${rows.map((r,i)=>`<div class="sample-row"><span class="sample-marker" aria-hidden="true">${String(i+1).padStart(2,'0')}</span><div class="row-text">${r}<small>${summary?'Una prioridad para explorar en este espacio.':'Ejemplo para definir el futuro funcionamiento del módulo.'}</small></div><span class="status">Ejemplo</span></div>`).join('')}</div><p class="next-step">Estos ejemplos no representan datos reales. Las integraciones y automatizaciones de este espacio aún no están activas.</p></section></div>`;
 document.title=`${module} · ${area.name} | CRESCE`;
}
function render(){
 const [areaId,moduleId] = location.hash.slice(1).split('/');
 const area=areas.find(a=>a.id===areaId);
 if(area){const module=area.modules.find(m=>slug(m)===moduleId)||'Resumen';workspace(area,module);}
 else home();
 window.scrollTo(0,0);
 const heading=main.querySelector('h1');
 heading.setAttribute('tabindex','-1');
 heading.focus({preventScroll:true});
}
window.addEventListener('hashchange',render);
render();
