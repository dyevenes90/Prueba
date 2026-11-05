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
let cresceDashboardClient = null;
let cresceDashboardAuthSubscription = null;
let cresceDashboardState = { page: 1, tab: 'radar', filters: {}, selected: null, summary: null };

function dashboardConfig(){
 const config=window.CRESCE_SUPABASE_CONFIG||{};
 if(!window.supabase?.createClient||typeof config.url!=='string'||!/^https:\/\//.test(config.url)||typeof config.publishableKey!=='string'||!config.publishableKey.startsWith('sb_publishable_'))return null;
 if(!cresceDashboardClient)cresceDashboardClient=window.supabase.createClient(config.url,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 return cresceDashboardClient;
}
function caNode(tag, text, className){const node=document.createElement(tag);if(text!==undefined&&text!==null)node.textContent=String(text);if(className)node.className=className;return node;}
function caSetStatus(message, kind='info'){const status=document.getElementById('ca-status');if(status){status.textContent=message;status.dataset.kind=kind;status.hidden=!message;}}
function caSantiagoDate(value){
 if(typeof value!=='string'||!value)return {text:'Sin fecha informada',verified:false};
 if(!/(Z|[+-]\d{2}:\d{2})$/i.test(value))return {text:'Zona horaria no verificable · '+value,verified:false};
 const date=new Date(value);if(!Number.isFinite(date.getTime()))return {text:'Fecha inválida',verified:false};
 return {text:new Intl.DateTimeFormat('es-CL',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Santiago'}).format(date)+' (Chile)',verified:true};
}
function caMoney(value){return typeof value==='number'&&Number.isFinite(value)?new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(value):'No informado';}
function caDisplay(value,fallback='No informado'){return value===null||value===undefined||value===''?fallback:String(value);}
function caSafeDetail(container,label,value){const block=caNode('div',undefined,'ca-detail-field');block.append(caNode('span',label),caNode('strong',caDisplay(value)));container.append(block);}

async function caInvoke(body){
 const client=dashboardConfig();if(!client)throw new Error('Configuración incompleta: falta URL pública o clave sb_publishable_.');
 const {data,error}=await client.functions.invoke('cresce-dashboard',{body});
 if(error){const status=error.context?.status;if(status===401)throw new Error('Sesión expirada. Inicia sesión nuevamente.');if(status===403)throw new Error('Tu usuario no está autorizado para los datos comerciales.');throw new Error('No se pudo conectar con el servicio de datos comerciales.');}
 if(data?.error)throw new Error(data.error);
 return data;
}

function caRenderLogin(message=''){
 const auth=document.getElementById('ca-auth');if(!auth)return;
 auth.hidden=false;document.getElementById('ca-data').hidden=true;auth.replaceChildren();
 const card=caNode('section',undefined,'ca-auth-card');card.setAttribute('aria-labelledby','ca-login-title');
 card.append(caNode('span','ACCESO PRIVADO','eyebrow'),caNode('h3','Iniciar sesión',''));card.lastChild.id='ca-login-title';
 card.append(caNode('p','Los datos comerciales de Trovofarma Store requieren un usuario autorizado de CRESCE. No hay registro público.','ca-muted'));
 if(message)card.append(caNode('p',message,'ca-inline-error'));
 const form=document.createElement('form');form.id='ca-login-form';
 const emailLabel=caNode('label','Correo electrónico');emailLabel.htmlFor='ca-email';const email=document.createElement('input');email.id='ca-email';email.name='email';email.type='email';email.autocomplete='username';email.required=true;
 const passLabel=caNode('label','Contraseña');passLabel.htmlFor='ca-password';const password=document.createElement('input');password.id='ca-password';password.name='password';password.type='password';password.autocomplete='current-password';password.required=true;
 const button=caNode('button','Entrar','ca-primary');button.type='submit';form.append(emailLabel,email,passLabel,password,button);
 form.addEventListener('submit',async event=>{event.preventDefault();const client=dashboardConfig();if(!client){caRenderLogin('Configuración incompleta: completa supabase-config.js con URL y clave publicable.');return;}button.disabled=true;button.textContent='Validando…';try{const {error}=await client.auth.signInWithPassword({email:email.value.trim(),password:password.value});if(error)throw new Error('No se pudo iniciar sesión. Revisa tus credenciales o el estado de tu usuario.');await caLoadPrivate();}catch(err){caRenderLogin(err.message);}finally{button.disabled=false;button.textContent='Entrar';}});
 card.append(form,caNode('p','El administrador debe crear usuarios desde Supabase Auth y autorizar sus UUID en la Edge Function.','ca-footnote'));auth.append(card);
}

function caRenderMetric(container,label,value,note){const card=caNode('article',undefined,'metric ca-metric');card.append(caNode('span',label),caNode('strong',value),caNode('small',note));container.append(card);}

async function caLoadPrivate(){
 const client=dashboardConfig();if(!client){caRenderLogin('Configuración incompleta: agrega URL y clave sb_publishable_ en supabase-config.js.');return;}
 const {data:{session},error}=await client.auth.getSession();if(error||!session){caRenderLogin();return;}
 const auth=document.getElementById('ca-auth'),content=document.getElementById('ca-data');auth.hidden=true;content.hidden=false;caSetStatus('Cargando datos privados…','loading');
 try{
  const summary=await caInvoke({consulta:'resumen'});cresceDashboardState.summary=summary;caRenderSummary(summary);
  await caLoadOpportunities();caSetStatus('', '');
 }catch(err){caSetStatus(err.message,'error');if(/Sesión expirada|No autorizado/.test(err.message)){await client.auth.signOut();caRenderLogin(err.message);}}
}

function caRenderSummary(summary){
 const metrics=document.getElementById('ca-metrics');metrics.replaceChildren();
 caRenderMetric(metrics,'Oportunidades almacenadas',summary.oportunidades,'Registros de CRESCE');
 caRenderMetric(metrics,'Cierres futuros verificables',summary.cierres_futuros_verificables,'Con fecha y zona horaria reconocibles por Supabase');
 caRenderMetric(metrics,'Regiones con datos',Array.isArray(summary.compras_por_region)?summary.compras_por_region.length:0,'Según región registrada');
 const region=document.getElementById('ca-regions');region.replaceChildren();
 if(!summary.compras_por_region?.length)region.append(caNode('p','No hay oportunidades con región informada.','ca-empty'));
 else for(const item of summary.compras_por_region){const row=caNode('div',undefined,'ca-region-row');row.append(caNode('span',caDisplay(item.region)),caNode('strong',item.cantidad));region.append(row);} if(summary.regiones_parcial)region.append(caNode('p','Conteo parcial: se alcanzó el límite seguro de 10.000 registros.','ca-warning'));
 const recent=document.getElementById('ca-recent');recent.replaceChildren();
 if(!summary.consultas_recientes?.length)recent.append(caNode('p','Aún no hay ejecuciones registradas.','ca-empty'));
 else for(const item of summary.consultas_recientes){const row=caNode('div',undefined,'ca-recent-row');const date=caSantiagoDate(item.inicio);row.append(caNode('strong',caDisplay(item.estado)),caNode('span',date.text),caNode('small',`${Number(item.oportunidades_encontradas)||0} encontradas · ${Number(item.oportunidades_nuevas)||0} nuevas`));recent.append(row);}
 const select=document.getElementById('ca-region');const prior=select.value;select.replaceChildren();select.append(new Option('Todas las regiones',''));for(const item of summary.compras_por_region||[])select.append(new Option(item.region,item.region));select.value=prior;
}

function caFilters(){return {texto:document.getElementById('ca-search').value.trim(),region:document.getElementById('ca-region').value,desde:document.getElementById('ca-date-from').value,hasta:document.getElementById('ca-date-to').value,monto_minimo:document.getElementById('ca-min-amount').value,monto_maximo:document.getElementById('ca-max-amount').value,orden:document.getElementById('ca-sort').value,direccion:document.getElementById('ca-direction').value,pagina:cresceDashboardState.page};}
async function caLoadOpportunities(){
 const tbody=document.getElementById('ca-opportunity-rows');if(!tbody)return;tbody.replaceChildren();tbody.append(caNode('tr',undefined,'ca-loading-row'));tbody.firstChild.append(caNode('td','Consultando oportunidades…'));
 const result=await caInvoke({consulta:'oportunidades',...caFilters()});tbody.replaceChildren();
 if(!result.items?.length){const row=caNode('tr');const cell=caNode('td','No hay resultados para estos filtros.','ca-empty');cell.colSpan=8;row.append(cell);tbody.append(row);}
 else for(const item of result.items){
  const tr=document.createElement('tr');const close=caSantiagoDate(item.fecha_cierre);
  const cells=[item.organismo,item.nombre,item.codigo,item.region,caMoney(item.monto_estimado),close.text,item.estado];
  for(const value of cells)tr.append(caNode('td',caDisplay(value)));
  const action=caNode('td',undefined,'ca-row-actions');const view=caNode('button','Ver oportunidad','ca-small-button');view.type='button';view.addEventListener('click',()=>caOpenDetail(item));action.append(view);tr.append(action);tbody.append(tr);
 }
 const total=result.total||0;document.getElementById('ca-page-label').textContent=`Página ${result.pagina} · ${total} resultados filtrados${result.parcial?' · conjunto parcial (límite de seguridad de 1.000)':''}`;
 document.getElementById('ca-prev').disabled=result.pagina<=1;document.getElementById('ca-next').disabled=result.pagina*result.por_pagina>=total;
}

async function caOpenDetail(opportunity){
 cresceDashboardState.selected=opportunity;const panel=document.getElementById('ca-detail-panel');panel.hidden=false;panel.replaceChildren(caNode('p','Cargando detalle…','ca-muted'));panel.scrollIntoView({behavior:'smooth',block:'start'});
 try{const response=await caInvoke({consulta:'detalle',codigo:opportunity.codigo});if(!response.detalle){panel.replaceChildren(caNode('h3','Detalle de la oportunidad'),caNode('p',response.mensaje||'Detalle aún no disponible.','ca-empty'));caDetailActions(panel,opportunity);return;}caRenderDetail(panel,opportunity,response.detalle.datos_detalle||{});}
 catch(error){panel.replaceChildren(caNode('h3','Detalle de la oportunidad'),caNode('p',error.message,'ca-inline-error'));caDetailActions(panel,opportunity);}
}
function caDetailActions(panel,opportunity){const actions=caNode('div',undefined,'ca-actions');for(const [label,kind] of [['Evaluar','evaluate'],['Preparar cotización','prepare']]){const button=caNode('button',label,'ca-secondary');button.type='button';button.addEventListener('click',()=>caSetManualAction(opportunity,kind));actions.append(button);}panel.append(actions);}
function caRenderDetail(panel,opportunity,detail){
 panel.replaceChildren();const top=caNode('div',undefined,'ca-detail-head');top.append(caNode('div',undefined));top.firstChild.append(caNode('span','DETALLE','eyebrow'),caNode('h3',caDisplay(detail.nombre||opportunity.nombre)),caNode('p',caDisplay(opportunity.codigo)));const close=caNode('button','Cerrar','ca-close');close.type='button';close.addEventListener('click',()=>panel.hidden=true);top.append(close);panel.append(top);
 const fields=caNode('div',undefined,'ca-detail-fields');caSafeDetail(fields,'Institución',detail.institucion?.organismo_comprador||opportunity.organismo);const closeDate=caSantiagoDate(detail.fechas?.fecha_cierre||opportunity.fecha_cierre);caSafeDetail(fields,'Fecha de cierre',closeDate.text);if(!closeDate.verified)fields.append(caNode('p','No se presenta como cierre confirmado porque no se verificó la zona horaria.','ca-warning'));
 caSafeDetail(fields,'Lugar de entrega',detail.entrega?.direccion_entrega);caSafeDetail(fields,'Plazo de entrega (días)',detail.entrega?.plazo_entrega_dias);panel.append(fields);
 panel.append(caNode('h4','Descripción de la solicitud'));panel.append(caNode('p',caDisplay(detail.descripcion),'ca-detail-description'));
 panel.append(caNode('h4','Productos requeridos y especificaciones'));const products=Array.isArray(detail.productos_solicitados)?detail.productos_solicitados:[];if(!products.length)panel.append(caNode('p','El detalle no informa productos requeridos.','ca-empty'));else{const list=caNode('div',undefined,'ca-product-list');for(const product of products){const card=caNode('article',undefined,'ca-product-card');card.append(caNode('strong',caDisplay(product.nombre)),caNode('p',caDisplay(product.descripcion,'Sin especificación técnica informada')),caNode('small',`Cantidad: ${caDisplay(product.cantidad)} ${caDisplay(product.unidad_medida,'')}`));list.append(card);}panel.append(list);}
 panel.append(caNode('h4','Documentos adjuntos'));const documents=Array.isArray(detail.documentos)?detail.documentos:[];if(!documents.length)panel.append(caNode('p','No hay adjuntos informados en el detalle.','ca-empty'));else{const list=caNode('ul',undefined,'ca-document-list');for(const document of documents){const item=caNode('li',`${caDisplay(document.nombre)}${document.id?` · ID ${document.id}`:''}`);list.append(item);}panel.append(list);}
 panel.append(caNode('h4','Condiciones disponibles'));const flags=detail.flags||{};const conditions=caNode('div',undefined,'ca-condition-list');for(const [label,key] of [['Requisitos medioambientales','considera_requisitos_medioambientales'],['Impacto social o económico','considera_requisitos_impacto_social_economico']])conditions.append(caNode('p',`${label}: ${typeof flags[key]==='boolean'?(flags[key]?'Sí':'No'):'No informado'}`));panel.append(conditions);caDetailActions(panel,opportunity);
}
function caSetManualAction(opportunity,kind){const target=document.getElementById('ca-manual-prep');target.hidden=false;target.replaceChildren(caNode('h3',kind==='evaluate'?'Evaluación comercial pendiente':'Preparación manual de cotización'),caNode('p',`${opportunity.codigo} · ${caDisplay(opportunity.nombre)}`),caNode('p',kind==='evaluate'?'No se calcularon costos, impuestos, transporte, margen ni utilidad: faltan datos verificados.':'Área de trabajo manual. Revisa requerimientos, precios y condiciones antes de preparar cualquier documento. No se enviará ninguna oferta.','ca-warning'));document.querySelector('[data-ca-tab="evaluacion"]').click();}

function caShowTab(tab){cresceDashboardState.tab=tab;document.querySelectorAll('[data-ca-tab]').forEach(button=>button.setAttribute('aria-selected',String(button.dataset.caTab===tab)));document.querySelectorAll('[data-ca-pane]').forEach(pane=>pane.hidden=pane.dataset.caPane!==tab);}
async function caLoadSuppliers(){
 const list=document.getElementById('ca-supplier-list');list.replaceChildren(caNode('p','Buscando catálogos…','ca-muted'));
 try{const response=await caInvoke({consulta:'proveedores',texto:document.getElementById('ca-supplier-search').value.trim(),proveedor:document.getElementById('ca-supplier-filter').value});list.replaceChildren();if(!response.items?.length){list.append(caNode('p','No se encontraron artículos con esos criterios.','ca-empty'));return;}
  for(const item of response.items){const card=caNode('article',undefined,'ca-supplier-card');const product=item.producto||{};const provider=String(item.proveedor||'');const name=product.nombre_producto||product.nombre||product.descripcion||product.codigo_proveedor||product.clave_articulo||'Artículo sin nombre informado';card.append(caNode('span',provider==='cone'?'Catálogo CONE':'Proveedor: '+provider,'ca-vendor-label'),caNode('h4',name));const meta=[product.proveedor_clave,product.codigo_proveedor||product.clave_articulo,product.marca,product.estado_revision,product.unidad_precio,product.pagina_pdf,product.estado_validacion].filter(Boolean).join(' · ');if(meta)card.append(caNode('p',meta,'ca-muted'));
   const prices=Array.isArray(item.precios)?item.precios:[];if(provider==='cone'){const priceList=caNode('div',undefined,'ca-prices');for(const [label,value] of [['Precio catálogo con IVA',product.precio_catalogo_iva],['Costo IVA verificado (fuente)',product.costo_iva_verificado]]){const row=caNode('div',undefined,'ca-price-row');row.append(caNode('span',label),caNode('strong',caDisplay(value)));priceList.append(row);}card.append(priceList);}else if(prices.length){const priceList=caNode('div',undefined,'ca-prices');for(const price of prices){const verified=price.precio_confirmado===true;const badge=verified?'Precio verificado':'Precio preliminar';const row=caNode('div',undefined,'ca-price-row');row.append(caNode('span',caMoney(price.precio_publicado_clp)),caNode('span',badge,verified?'ca-verified':'ca-preliminary'),caNode('small',[price.presentacion_precio,price.tratamiento_iva,price.cantidad_minima?`Mínimo ${price.cantidad_minima}`:''].filter(Boolean).join(' · ')||'Condiciones no informadas'));priceList.append(row);}card.append(priceList);}else card.append(caNode('p','Precio no informado en esta fuente.','ca-muted'));
   if(product.stock_proveedor)card.append(caNode('p',`Referencia de stock declarada por proveedor: ${product.stock_proveedor}. No es inventario propio.`,'ca-stock-note'));list.append(card);
  }
  if(response.errores_fuentes?.length)caSetStatus(`Fuentes con error: ${response.errores_fuentes.join(', ')}`,'warning');else caSetStatus('', '');
 }catch(error){list.replaceChildren(caNode('p',error.message,'ca-inline-error'));}
}

function caBuildDashboard(){
 main.innerHTML=`<a class="back" href="#inicio">← Todas las áreas</a><div class="workspace-heading">${icon(areas[0])}<div><span class="eyebrow">TROVOFARMA STORE · DATOS PRIVADOS</span><h1>Compra Ágil</h1><p>Oportunidades reales y antecedentes disponibles en CRESCE.</p></div></div><div class="workspace ca-workspace"><nav class="sidebar" aria-label="Secciones de Trovofarma Store">${areas[0].modules.map(m=>`<a href="#trovofarma/${slug(m)}" ${m==='Compra Ágil'?'aria-current="page"':''}>${m}</a>`).join('')}</nav><section class="ca-main"><div class="module-heading"><h2>Radar de Oportunidades</h2><button type="button" id="ca-refresh" class="ca-secondary">Actualizar</button></div><p class="module-description">Datos obtenidos de las tablas privadas de Supabase. La revisión comercial y cualquier cotización son manuales.</p><div id="ca-status" class="ca-status" role="status" hidden></div><div id="ca-auth"></div><div id="ca-data" hidden><div id="ca-metrics" class="metrics ca-metrics"></div><div class="ca-summary-grid"><section class="panel"><h3>Compras por región</h3><div id="ca-regions"></div></section><section class="panel"><h3>Últimas consultas</h3><div id="ca-recent"></div></section></div><div class="ca-tabs" role="tablist" aria-label="Compra Ágil"><button type="button" role="tab" aria-selected="true" data-ca-tab="radar">Radar</button><button type="button" role="tab" aria-selected="false" data-ca-tab="proveedores">Proveedores</button><button type="button" role="tab" aria-selected="false" data-ca-tab="evaluacion">Evaluación comercial</button></div><section data-ca-pane="radar" class="ca-pane"><div class="ca-filters"><label>Buscar<input id="ca-search" type="search" placeholder="Código, institución o nombre"></label><label>Región<select id="ca-region"><option value="">Todas las regiones</option></select></label><label>Publicación desde<input id="ca-date-from" type="date"></label><label>Publicación hasta<input id="ca-date-to" type="date"></label><label>Monto mínimo CLP<input id="ca-min-amount" type="number" min="0" inputmode="numeric"></label><label>Monto máximo CLP<input id="ca-max-amount" type="number" min="0" inputmode="numeric"></label><label>Ordenar por<select id="ca-sort"><option value="fecha_publicacion">Fecha de publicación</option><option value="fecha_cierre">Fecha de cierre</option><option value="monto_estimado">Monto estimado</option><option value="nombre">Nombre</option></select></label><label>Dirección<select id="ca-direction"><option value="desc">Descendente</option><option value="asc">Ascendente</option></select></label></div><div class="ca-table-wrap"><table class="ca-table"><thead><tr><th>Institución</th><th>Compra</th><th>Código</th><th>Región</th><th>Monto estimado</th><th>Cierre</th><th>Estado</th><th>Acción</th></tr></thead><tbody id="ca-opportunity-rows"></tbody></table></div><div class="ca-pagination"><button type="button" id="ca-prev" class="ca-secondary">Anterior</button><span id="ca-page-label"></span><button type="button" id="ca-next" class="ca-secondary">Siguiente</button></div><section id="ca-detail-panel" class="panel ca-detail-panel" hidden></section></section><section data-ca-pane="proveedores" class="ca-pane" hidden><div class="ca-supplier-controls"><label>Buscar por código o nombre<input id="ca-supplier-search" type="search" placeholder="Código o nombre del artículo"></label><label>Proveedor<select id="ca-supplier-filter"><option value="">Todos</option><option value="cone">CONE</option><option value="herbanatura">Herbanatura</option><option value="silcam">SILCAM</option></select></label><button type="button" id="ca-supplier-refresh" class="ca-secondary">Buscar</button></div><p class="ca-stock-note">Los datos de disponibilidad pertenecen al proveedor; no representan inventario propio de Trovofarma Store.</p><div id="ca-supplier-list" class="ca-supplier-grid"></div></section><section data-ca-pane="evaluacion" class="ca-pane" hidden><div class="ca-evaluation-intro"><h3>Evaluación comercial</h3><p>El análisis se mantiene pendiente hasta contar con equivalencias técnicas y costos verificados.</p></div><div class="ca-evaluation-grid">${['Costo neto','IVA','Descuentos','Transporte','Capital necesario','Margen','Utilidad estimada'].map(label=>`<article><span>${label}</span><strong>Pendiente</strong></article>`).join('')}</div><p class="ca-warning">No se calculan valores ni se asume equivalencia de productos automáticamente. La evaluación y la preparación de ofertas son manuales.</p><section id="ca-manual-prep" class="panel ca-manual-prep" hidden></section></section><div class="ca-account"><span id="ca-account-label"></span><button type="button" id="ca-signout" class="ca-link-button">Cerrar sesión</button></div></div></section></div>`;
 const config=dashboardConfig();if(!config){caRenderLogin('Configuración incompleta: completa supabase-config.js con URL y clave pública sb_publishable_.');return;}
 if(!cresceDashboardAuthSubscription)cresceDashboardAuthSubscription=config.auth.onAuthStateChange((_event,session)=>{if(location.hash.includes('trovofarma/compra-agil'))queueMicrotask(()=>{if(session){const label=document.getElementById('ca-account-label');if(label)label.textContent='Sesión activa';caLoadPrivate();}else caRenderLogin();});}).data.subscription;
 document.getElementById('ca-refresh').addEventListener('click',()=>caLoadPrivate());
 document.getElementById('ca-signout').addEventListener('click',async()=>{await config.auth.signOut();caRenderLogin();});
 document.querySelectorAll('[data-ca-tab]').forEach(button=>button.addEventListener('click',()=>{caShowTab(button.dataset.caTab);if(button.dataset.caTab==='proveedores')caLoadSuppliers();}));
 let debounce;for(const id of ['ca-search','ca-region','ca-date-from','ca-date-to','ca-min-amount','ca-max-amount','ca-sort','ca-direction'])document.getElementById(id).addEventListener(id==='ca-search'||id==='ca-min-amount'||id==='ca-max-amount'?'input':'change',()=>{clearTimeout(debounce);cresceDashboardState.page=1;debounce=setTimeout(()=>caLoadOpportunities().catch(error=>caSetStatus(error.message,'error')),250);});
 document.getElementById('ca-prev').addEventListener('click',()=>{cresceDashboardState.page=Math.max(1,cresceDashboardState.page-1);caLoadOpportunities().catch(error=>caSetStatus(error.message,'error'));});
 document.getElementById('ca-next').addEventListener('click',()=>{cresceDashboardState.page++;caLoadOpportunities().catch(error=>caSetStatus(error.message,'error'));});
 document.getElementById('ca-supplier-refresh').addEventListener('click',()=>caLoadSuppliers());document.getElementById('ca-supplier-search').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();caLoadSuppliers();}});document.getElementById('ca-supplier-filter').addEventListener('change',()=>caLoadSuppliers());
 config.auth.getSession().then(({data,error})=>{if(error||!data.session)caRenderLogin();else{document.getElementById('ca-account-label').textContent='Sesión activa';caLoadPrivate();}}).catch(()=>caRenderLogin('No se pudo leer la sesión. Vuelve a iniciar sesión.'));
 document.title='Compra Ágil · Trovofarma Store | CRESCE';
}
function home(){
 main.innerHTML = `<h1 class="sr-only">Áreas de trabajo</h1><div class="area-grid">${areas.map(a=>`<article class="area-card" style="--ink:${a.ink}"><div class="card-top">${icon(a)}</div><h2>${a.name}</h2><p>${a.description}</p><div class="tags">${a.tags.map(t=>`<span>${t}</span>`).join('')}</div><a class="enter" href="#${a.id}/resumen" aria-label="Entrar a ${a.name}">Entrar <span aria-hidden="true">↗</span></a></article>`).join('')}</div>`;
 document.title='CRESCE';
}
function workspace(area, module){
 if(area.id==='trovofarma'&&module==='Compra Ágil'){caBuildDashboard();return;}
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
