/* Cada área declara su navegación y sus ejemplos. Nuevos módulos pueden añadirse aquí. */
const areas = [
 {id:'trovofarma',logo:'assets/logos/trovofarma.png',name:'Trovofarma Store',icon:'store',ink:'#3f6e56',tint:'#edf4e9',description:'Conecta tu operación comercial: ventas, abastecimiento y nuevas oportunidades en un solo lugar.',tags:['Comercio','Inventario','Crecimiento'],modules:['Resumen','Ventas','Compras','Inventario','Finanzas','Compra Ágil','Laboratorio de ideas','Automatizaciones IA','Configuración'],examples:['Revisar productos con stock bajo','Preparar seguimiento de ventas','Planificar próxima compra']},
 {id:'casa-del-filo',logo:'assets/logos/La Casa del Filo.png',name:'La Casa del Filo',icon:'blade',ink:'#8c6849',tint:'#f5ede2',description:'Organiza servicios, clientes y trabajos. Dale claridad a cada pedido, desde el ingreso hasta la entrega.',tags:['Servicios','Clientes','Pedidos'],modules:['Resumen','Servicios','Clientes','Trabajos / pedidos','Finanzas','Compra Ágil','Laboratorio de ideas','Automatizaciones IA','Configuración'],examples:['Confirmar entrega de un pedido','Preparar cotización de afilado','Contactar a un cliente recurrente']},
 {id:'proyectos',logo:'assets/logos/Gestion de proyectos.png',name:'Gestión de Proyectos',icon:'projects',ink:'#586c99',tint:'#edf0f9',description:'Transforma antecedentes e ideas en proyectos con dirección, seguimiento y próximos pasos claros.',tags:['Planificación','Antecedentes','Seguimiento'],modules:['Resumen','Proyectos activos','Banco Integrado / antecedentes','Seguimiento','Finanzas','Laboratorio de ideas','Automatizaciones IA','Configuración'],examples:['Ordenar antecedentes del proyecto','Revisar próximo hito de entrega','Preparar evaluación de una iniciativa']},
 {id:'strongroot',logo:'assets/logos/Logo Strongroot.png',name:'StrongRoot',icon:'root',ink:'#657543',tint:'#eff2e3',description:'Cultiva una visión completa de tu operación: producción, recursos y tecnología trabajando juntos.',tags:['Agro','Producción','Tecnología'],modules:['Resumen','Frambuesas','Riego / sensores','Invernaderos','Pellet','Cámara de frío','Finanzas','Compra Ágil','Laboratorio de ideas','Automatizaciones IA','Configuración'],examples:['Revisar programación de riego','Planificar labores en frambuesas','Verificar capacidad de cámara de frío']}
];
let holdingCarouselController = null;
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
let caSeguimientoProveedores = null;
let caSeguimientoCache = {};
let caAuthMode = 'login';
let caSyncFromEdited=false;
let caSyncFromValue='';
let caAnalysisQuoteContext=null;
let caRadarRequestSequence=0;
let caRadarPending=null;
let caRadarRowsSignature='';
let caRadarVisibleItems=[];
let caRadarStatusTimer=null;
let caRadarReturnState=null;
let caDetailRequestSequence=0;
let caDetailCache=new Map();
let caDetailCurrentCode=null;
let caPrivateLoadPromise=null;
let caPrivateLoadedUserId=null;
let caAuthUserId=null;
let caAuthRevision=0;

function caAuthError(error){
 const message=String(error?.message||'').toLowerCase(),status=error?.status||error?.context?.status;
 if(status===0||/failed to fetch|network|fetch|timeout|load failed/.test(message))return 'No se pudo conectar con Supabase. Revisa tu conexión e inténtalo nuevamente.';
 if(status===429)return 'Se realizaron demasiados intentos. Espera unos minutos y vuelve a probar.';
 if(/invalid login credentials|invalid credentials|email not confirmed/.test(message))return 'Correo o contraseña incorrectos, o la cuenta aún no está confirmada. Verifica los datos o solicita un enlace de recuperación.';
 if(/user not found/.test(message))return 'No existe una cuenta con ese correo. Contacta al administrador de CRESCE.';
 if(/same password/.test(message))return 'La nueva contraseña debe ser distinta de la anterior.';
 if(/password.*(weak|short|least)|weak password/.test(message))return 'La contraseña nueva no cumple los requisitos de seguridad de Supabase.';
 if(status===400||/redirect|url.*allow|not allowed/.test(message))return 'Supabase rechazó la solicitud. Revisa las URLs permitidas de Auth en la configuración del proyecto.';
 return `Supabase no pudo completar la solicitud${status?` (HTTP ${status})`:''}. Revisa la configuración de Auth o inténtalo nuevamente.`;
}

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
function caSantiagoToday(date=new Date()){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
 const values=Object.fromEntries(parts.filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
 return values.year+'-'+values.month+'-'+values.day;
}
function caSantiagoStartOfDayIso(dateValue){
 const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue||'');
 if(!match)throw new Error('Selecciona una fecha inicial valida.');
 const target=Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3]));
 const localAsUtc=instant=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(instant);const values=Object.fromEntries(parts.filter(part=>part.type!=='literal').map(part=>[part.type,Number(part.value)]));return Date.UTC(values.year,values.month-1,values.day,values.hour,values.minute,values.second);};
 let guess=target;for(let i=0;i<4;i++){const delta=target-localAsUtc(new Date(guess));if(!delta)break;guess+=delta;}
 let result=new Date(guess);if(caSantiagoToday(result)!==dateValue){let first=null;for(let instant=guess-6*3600000;instant<=guess+6*3600000;instant+=900000){if(caSantiagoToday(new Date(instant))===dateValue){first=instant;break;}}if(first===null)throw new Error('No se pudo resolver la fecha local de America/Santiago.');for(let instant=first-900000;instant<=first;instant+=60000){if(caSantiagoToday(new Date(instant))===dateValue){first=instant;break;}}result=new Date(first);}return result.toISOString();
}
function caMoney(value){if(value===null||value===undefined||value==='')return 'No informado';const amount=typeof value==='number'?value:Number(value);return Number.isFinite(amount)?new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(amount):'No informado';}
function caDisplay(value,fallback='No informado'){return value===null||value===undefined||value===''?fallback:String(value);}
function caSafeDetail(container,label,value){const block=caNode('div',undefined,'ca-detail-field');block.append(caNode('span',label),caNode('strong',caDisplay(value)));container.append(block);}

async function caInvoke(body){
 const client=dashboardConfig();if(!client)throw new Error('Configuración incompleta: falta URL pública o clave sb_publishable_.');
 const {data,error}=await client.functions.invoke('cresce-dashboard',{body});
 if(error){const status=error.context?.status;if(status===401)throw new Error('Sesión expirada. Inicia sesión nuevamente.');if(status===403)throw new Error('Tu usuario no está autorizado para los datos comerciales.');throw new Error('No se pudo conectar con el servicio de datos comerciales.');}
 if(data?.error)throw new Error(data.error);
 return data;
}
async function caInvokeSeguimiento(body){const client=dashboardConfig();if(!client)throw new Error('Configuración incompleta.');const {data,error}=await client.functions.invoke('compra-agil-seguimiento',{body});if(error)throw new Error(error.context?.status===401?'Sesión expirada. Inicia sesión nuevamente.':'No se pudo conectar con el seguimiento privado.');if(data?.error)throw new Error(data.error);return data;}
async function caInvokeDetalle(body){const client=dashboardConfig();if(!client)throw new Error('Configuración incompleta.');const {data,error}=await client.functions.invoke('compra-agil-detalle',{body});if(error){let message=error.context?.status===401?'Sesión expirada. Inicia sesión nuevamente.':'No se pudo consultar el servicio privado de detalle oficial.';try{const response=error.context instanceof Response?error.context.clone():null;const body=response?await response.json():null;if(typeof body?.error==='string')message=body.error;}catch{}throw new Error(message);}if(data?.error)throw new Error(data.error);return data;}
async function caInvokeDocumentos(body){const client=dashboardConfig();if(!client)throw new Error('Configuración incompleta.');const {data,error}=await client.functions.invoke('compra-agil-documentos',{body});if(error){const context=error.context;let detail=null;if(context instanceof Response)detail=await context.clone().json().catch(()=>null);throw new Error(detail?.error||'No se pudo conectar con el almacenamiento privado.');}if(data?.error)throw new Error(data.error);return data;}
async function caUploadPrivateDocument(code,file){const client=dashboardConfig();const config=window.CRESCE_SUPABASE_CONFIG||{};if(!client)throw new Error('Configuración incompleta.');const {data:{session}}=await client.auth.getSession();if(!session)throw new Error('Inicia sesión para cargar documentos.');const form=new FormData();form.append('codigo',code);form.append('archivo',file);const response=await fetch(`${config.url.replace(/\/$/,'')}/functions/v1/compra-agil-documentos`,{method:'POST',headers:{apikey:config.publishableKey,Authorization:`Bearer ${session.access_token}`},body:form});const result=await response.json().catch(()=>null);if(!response.ok||result?.error)throw new Error(result?.error||'No se pudo guardar el documento privado.');return result;}
function caProductLines(detail){const products=Array.isArray(detail?.productos_solicitados)?detail.productos_solicitados:[],seen=new Map();return products.map(product=>{const parts=[product?.nombre,product?.descripcion,product?.cantidad,product?.unidad_medida].map(value=>value==null?'':String(value).trim()),fingerprint=parts.join('\u001f').normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('es'),occurrence=seen.get(fingerprint)||0;seen.set(fingerprint,occurrence+1);let hash=2166136261,secondHash=0x01234567;for(let i=0;i<fingerprint.length;i++){hash=Math.imul(hash^fingerprint.charCodeAt(i),16777619);secondHash=Math.imul(secondHash^fingerprint.charCodeAt(i),0x01000193);}return {product,key:`${(hash>>>0).toString(16)}${(secondHash>>>0).toString(16)}-${occurrence}`};});}

function caRenderLogin(message=''){
 caAuthMode='login';const auth=document.getElementById('ca-auth');if(!auth)return;auth.hidden=false;document.getElementById('ca-data').hidden=true;auth.replaceChildren();
 caImportSessionLabel(false);const card=caNode('section',undefined,'ca-auth-card');card.setAttribute('aria-labelledby','ca-login-title');card.append(caNode('span','ACCESO PRIVADO','eyebrow'),caNode('h3','Iniciar sesión'));card.lastChild.id='ca-login-title';card.append(caNode('p','Los datos comerciales de Trovofarma Store requieren un usuario autorizado de CRESCE. No hay registro público.','ca-muted'));
 if(message){const feedback=caNode('p',message,'ca-inline-error');feedback.setAttribute('role','alert');card.append(feedback);}
 const form=document.createElement('form');form.id='ca-login-form';const emailLabel=caNode('label','Correo electrónico'),email=document.createElement('input'),passLabel=caNode('label','Contraseña'),password=document.createElement('input'),button=caNode('button','Entrar','ca-primary');email.id='ca-email';email.name='email';email.type='email';email.autocomplete='username';email.required=true;emailLabel.htmlFor=email.id;password.id='ca-password';password.name='password';password.type='password';password.autocomplete='current-password';password.required=true;passLabel.htmlFor=password.id;button.type='submit';form.append(emailLabel,email,passLabel,password,button);
 form.addEventListener('submit',async event=>{event.preventDefault();const client=dashboardConfig();if(!client){caRenderLogin('Configuración incompleta: revisa la URL y la clave publicable en supabase-config.js.');return;}button.disabled=true;button.textContent='Validando…';try{const {error}=await client.auth.signInWithPassword({email:email.value.trim(),password:password.value});if(error)throw error;await caLoadPrivate();}catch(error){caRenderLogin(caAuthError(error));}finally{button.disabled=false;button.textContent='Entrar';}});
 const reset=caNode('button','Olvidé mi contraseña','ca-link-button');reset.type='button';reset.addEventListener('click',()=>caRenderRecovery());card.append(form,reset,caNode('p','El administrador debe crear usuarios desde Supabase Auth y autorizar sus UUID en la Edge Function.','ca-footnote'));auth.append(card);
}
function caRenderRecovery(message=''){
 caAuthMode='recovery';const auth=document.getElementById('ca-auth');if(!auth)return;auth.hidden=false;document.getElementById('ca-data').hidden=true;auth.replaceChildren();const card=caNode('section',undefined,'ca-auth-card');card.setAttribute('aria-labelledby','ca-recovery-title');card.append(caNode('span','ACCESO PRIVADO','eyebrow'),caNode('h3','Recuperar contraseña'));card.lastChild.id='ca-recovery-title';card.append(caNode('p','Ingresa el correo de tu cuenta autorizada. Te enviaremos un enlace para crear una contraseña nueva.','ca-muted'));
 if(message){const neutral=message.startsWith('Si la cuenta');const feedback=caNode('p',message,neutral?'ca-muted':'ca-inline-error');feedback.setAttribute('role',neutral?'status':'alert');card.append(feedback);}
 const form=document.createElement('form'),label=caNode('label','Correo electrónico'),email=document.createElement('input'),submit=caNode('button','Enviar enlace','ca-primary');email.type='email';email.name='email';email.autocomplete='email';email.required=true;email.id='ca-recovery-email';label.htmlFor=email.id;submit.type='submit';form.append(label,email,submit);
 form.addEventListener('submit',async event=>{event.preventDefault();const client=dashboardConfig();if(!client){caRenderRecovery('Configuración incompleta: revisa la URL y la clave publicable en supabase-config.js.');return;}submit.disabled=true;submit.textContent='Enviando…';try{const {error}=await client.auth.resetPasswordForEmail(email.value.trim(),{redirectTo:location.origin+location.pathname+location.hash});if(error)throw error;caRenderRecovery('Si la cuenta está registrada, recibirás un enlace para continuar. Revisa también la carpeta de spam.');}catch(error){caRenderRecovery(caAuthError(error));}finally{submit.disabled=false;submit.textContent='Enviar enlace';}});
 const back=caNode('button','Volver al inicio de sesión','ca-link-button');back.type='button';back.addEventListener('click',()=>caRenderLogin());card.append(form,back);auth.append(card);
}
function caRenderNewPassword(message=''){
 caAuthMode='new-password';const auth=document.getElementById('ca-auth');if(!auth)return;auth.hidden=false;document.getElementById('ca-data').hidden=true;auth.replaceChildren();const card=caNode('section',undefined,'ca-auth-card');card.append(caNode('span','ACCESO PRIVADO','eyebrow'),caNode('h3','Crear contraseña nueva'));card.lastChild.id='ca-new-password-title';card.setAttribute('aria-labelledby','ca-new-password-title');card.append(caNode('p','Elige una contraseña segura para tu cuenta de CRESCE.','ca-muted'));if(message){const feedback=caNode('p',message,'ca-inline-error');feedback.setAttribute('role','alert');card.append(feedback);}
 const form=document.createElement('form'),label=caNode('label','Nueva contraseña'),input=document.createElement('input'),confirmLabel=caNode('label','Repite la contraseña'),confirm=document.createElement('input'),submit=caNode('button','Guardar contraseña','ca-primary');input.type=confirm.type='password';input.autocomplete=confirm.autocomplete='new-password';input.minLength=6;input.required=confirm.required=true;input.id='ca-new-password';confirm.id='ca-confirm-password';label.htmlFor=input.id;confirmLabel.htmlFor=confirm.id;submit.type='submit';form.append(label,input,confirmLabel,confirm,submit);
 form.addEventListener('submit',async event=>{event.preventDefault();if(input.value!==confirm.value){caRenderNewPassword('Las contraseñas no coinciden.');return;}const client=dashboardConfig();if(!client){caRenderNewPassword('Configuración incompleta: revisa la URL y la clave publicable en supabase-config.js.');return;}submit.disabled=true;submit.textContent='Guardando…';try{const {error}=await client.auth.updateUser({password:input.value});if(error)throw error;caRenderLogin('Contraseña actualizada. Ya puedes iniciar sesión.');}catch(error){caRenderNewPassword(caAuthError(error));}finally{submit.disabled=false;submit.textContent='Guardar contraseña';}});card.append(form);auth.append(card);
}
function caRenderMetric(container,label,value,note){const card=caNode('article',undefined,'metric ca-metric');card.append(caNode('span',label),caNode('strong',value),caNode('small',note));container.append(card);}
function caSyncStatusLabel(status){return ({completada:'Completada',parcial_por_limite:'Parcial por límite de páginas',completada_con_errores:'Parcial o con errores (histórico)',error:'Error real',cuota_agotada:'Cuota agotada',iniciada:'En progreso',otra_sincronizacion_en_curso:'En progreso',pendiente_por_limite:'Pendiente por límite',requiere_fecha_inicial:'Requiere fecha inicial'})[status]||caDisplay(status);}

async function caLoadPrivate({force=false}={}){
 const client=dashboardConfig();if(!client){caRenderLogin('Configuración incompleta: agrega URL y clave sb_publishable_ en supabase-config.js.');return;}
 let session;try{session=await caPrivateSession(client);}catch{return;}
 if(!session?.user?.id){caPrivateLoadedUserId=null;caRenderLogin('Inicia sesión para ver los datos privados.');return;}
 const userId=session.user.id;
 if(caPrivateLoadPromise?.userId===userId)return caPrivateLoadPromise.promise;
 if(!force&&caPrivateLoadedUserId===userId)return;
 if(caAuthUserId&&caAuthUserId!==userId)caClearPrivateView();
 caAuthUserId=userId;
 const revision=caAuthRevision;
 const auth=document.getElementById('ca-auth'),content=document.getElementById('ca-data');
 auth.hidden=true;content.hidden=false;
 const promise=(async()=>{
  try{
   const summary=await caInvoke({consulta:'resumen'});
   if(revision!==caAuthRevision||caAuthUserId!==userId)return;
   cresceDashboardState.summary=summary;caRenderSummary(summary);
   await caLoadOpportunities();
   if(revision===caAuthRevision&&caAuthUserId===userId)caPrivateLoadedUserId=userId;
  }catch(err){if(revision!==caAuthRevision||caAuthUserId!==userId)return;caSetStatus(err.message,'error');if(/Sesión expirada|No autorizado/.test(err.message)){await client.auth.signOut();caRenderLogin(err.message);}}
 })();
 caPrivateLoadPromise={userId,promise};
 try{return await promise;}finally{if(caPrivateLoadPromise?.promise===promise)caPrivateLoadPromise=null;}
}
function caClearPrivateView(){
 caAuthRevision++;caPrivateLoadedUserId=null;caPrivateLoadPromise=null;
 caRadarRequestSequence++;caRadarPending=null;caRadarRowsSignature='';caRadarVisibleItems=[];
 caDetailRequestSequence++;caDetailCache.clear();caRadarReturnState=null;
 cresceDashboardState.selected=null;caDetailCurrentCode=null;
 const tbody=document.getElementById('ca-opportunity-rows');tbody?.replaceChildren();
 const detail=document.getElementById('ca-detail-panel');if(detail){detail.replaceChildren();detail.hidden=true;}
 const overview=document.getElementById('ca-dashboard-overview');if(overview)overview.hidden=false;
}
function caHandleAuthStateChange(event,session){
 if(!location.hash.includes('trovofarma/compra-agil'))return;
 if(event==='PASSWORD_RECOVERY'){caRenderNewPassword();return;}
 if(event==='TOKEN_REFRESHED')return;
 if(event==='SIGNED_OUT'){caAuthUserId=null;caClearPrivateView();if(caAuthMode!=='recovery')caRenderLogin();return;}
 if(!session?.user?.id||!['INITIAL_SESSION','SIGNED_IN'].includes(event))return;
 const userId=session.user.id;
 if(caAuthUserId!==userId){caClearPrivateView();caAuthUserId=userId;}
 const label=document.getElementById('ca-account-label');if(label)label.textContent='Sesión activa';
 if(caPrivateLoadedUserId!==userId)void caLoadPrivate();
}

function caRenderSummary(summary){
 const metrics=document.getElementById('ca-metrics');metrics.replaceChildren();
 caRenderMetric(metrics,'Oportunidades almacenadas',summary.oportunidades,'Registros de CRESCE');
 caRenderMetric(metrics,'Páginas pendientes',summary.checkpoints_disponibles?summary.paginas_pendientes??0:'No disponible',summary.ejecucion_en_progreso?'Hay una ejecución activa':summary.regiones_pendientes?.length?`${summary.regiones_pendientes.length} región(es) con checkpoint por continuar`:'Sin ventanas pendientes');
 caRenderMetric(metrics,'Abiertas confirmadas',summary.abiertas_confirmadas??summary.cierres_futuros_verificables,'Fecha de cierre futura y verificable');
 const region=document.getElementById('ca-regions');region.replaceChildren();
 if(!summary.compras_por_region?.length)region.append(caNode('p','No hay oportunidades con región informada.','ca-empty'));
 else for(const item of summary.compras_por_region){const row=caNode('div',undefined,'ca-region-row');row.append(caNode('span',caDisplay(item.region)),caNode('strong',item.cantidad));region.append(row);} if(summary.regiones_parcial)region.append(caNode('p','Conteo parcial: se alcanzó el límite seguro de 10.000 registros.','ca-warning'));
 const recent=document.getElementById('ca-recent');recent.replaceChildren();
 if(summary.sincronizacion_antigua){const alert=caNode('p','Sincronizaci\u00f3n desactualizada: m\u00e1s de 24 horas o sin ejecuci\u00f3n exitosa registrada.','ca-warning');alert.setAttribute('role','alert');recent.prepend(alert);}
 if(!summary.consultas_recientes?.length)recent.append(caNode('p','Sin actividad registrada.','ca-empty'));
 else for(const item of summary.consultas_recientes.slice(0,3)){const row=caNode('div',undefined,'ca-recent-row');const date=caSantiagoDate(item.inicio);row.append(caNode('strong',caSyncStatusLabel(item.estado)),caNode('span',date.text),caNode('small',`${Number(item.oportunidades_encontradas)||0} encontradas · ${Number(item.oportunidades_nuevas)||0} nuevas${item.error_detalle?` | ${item.error_detalle}`:''}`));recent.append(row);}
 if(summary.ultimo_avance_parcial){const partial=summary.ultimo_avance_parcial;recent.prepend(caNode('p',`Último avance parcial: ${caSantiagoDate(partial.termino||partial.inicio).text}. Continúa desde el checkpoint; las páginas guardadas no se repiten.`,'ca-warning'));}
 if(summary.regiones_pendientes?.length){for(const item of summary.regiones_pendientes.slice(0,2)){recent.append(caNode('p',`Región ${item.region_id}: pendiente desde página ${item.next_page}${item.total_pages?` de ${item.total_pages}`:''}${item.last_error?` · ${item.last_error}`:''}`,'ca-warning'));}}
 if(summary.ejecucion_en_progreso)recent.prepend(caNode('p','Hay una sincronización en progreso o un bloqueo vigente. Espera antes de iniciar otra.','ca-warning'));
 const syncButton=document.getElementById('ca-sync');if(syncButton){const selected=(document.getElementById('ca-sync-regions')?.value||'9,14').split(',').map(Number);const pending=(summary.regiones_pendientes||[]).filter((row)=>selected.includes(Number(row.region_id)));const continuePending=pending.length>0;syncButton.textContent=continuePending?'Continuar':'Buscar compras nuevas';syncButton.title=continuePending?'Continuar páginas pendientes desde el último checkpoint':'Consulta real a Mercado Público en Araucanía y Los Ríos';syncButton.setAttribute('aria-label',continuePending?'Continuar páginas pendientes':'Buscar compras nuevas');syncButton.disabled=Boolean(summary.ejecucion_en_progreso);}
 const select=document.getElementById('ca-region');const prior=select.value;select.replaceChildren();select.append(new Option('Todas las regiones',''));const regionNames=['Región de Tarapacá','Región de Antofagasta','Región de Atacama','Región de Coquimbo','Región de Valparaíso',"Región del Libertador General Bernardo O'Higgins",'Región del Maule','Región del Biobío','Región de La Araucanía','Región de Los Lagos','Región de Aysén del General Carlos Ibáñez del Campo','Región de Magallanes y de la Antártica Chilena','Región Metropolitana de Santiago','Región de Los Ríos','Región de Arica y Parinacota','Región de Ñuble'];for(const name of regionNames)select.append(new Option(name,name));select.value=prior;
}

function caFilters(){return {texto:document.getElementById('ca-search').value.trim(),region:document.getElementById('ca-region').value,desde:document.getElementById('ca-date-from').value,hasta:document.getElementById('ca-date-to').value,monto_minimo:document.getElementById('ca-min-amount').value,monto_maximo:document.getElementById('ca-max-amount').value,solo_vigentes:document.getElementById('ca-only-current').checked,orden:document.getElementById('ca-sort').value,direccion:document.getElementById('ca-direction').value,pagina:cresceDashboardState.page};}
function caRadarLoading(message='',kind='loading'){
 const indicator=document.getElementById('ca-radar-loading');if(!indicator)return;
 indicator.hidden=!message;indicator.dataset.kind=kind;indicator.textContent=message;
}
function caOpportunityRowSignature(items){
 return JSON.stringify((items||[]).map(item=>[item.codigo,item.organismo,item.nombre,item.region,item.monto_estimado,item.fecha_cierre,item.vigencia,item.clasificacion_cobertura,item.productos_confirmados,item.productos_posibles,item.productos_total,item.tiene_detalle,item.seguimiento_no_disponible]));
}

/* Revisión sugerida: señales orientativas, nunca bloquean ni ocultan oportunidades. */
function caOpportunityReviewReason(item){
 const plain=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const title=plain(item.nombre);
 const detail=caDetailCache.get(item.codigo)?.detail;
 const products=Array.isArray(detail?.productos_solicitados)?detail.productos_solicitados:[];
 if(products.some(p=>['GL','GLOBAL'].includes(String(p.unidad_medida??'').trim().toUpperCase())))return 'Cantidad global (GL): comprobar qué productos incluye el anexo.';
 const technical=plain([detail?.descripcion,...products.map(p=>p.descripcion)].join(' '));
 if(/\bsegun (?:archivo|anexo|adjunto|documento)\b/.test(technical))return 'El detalle remite a un archivo: revisar los adjuntos.';
 if(/\b(varios|varias|diversos|diversas)\b/.test(title)||/\bsegun (?:archivo|anexo|adjunto)\b/.test(title))return 'Descripción general: comprobar cantidades y adjuntos.';
 return '';
}
function caRadarStatus(item){
 const close=caSantiagoDate(item.fecha_cierre);
 if(item.vigencia==='vencida'||(close.verified&&Date.parse(item.fecha_cierre)<=Date.now()))return 'Vencida';
 return item.vigencia==='abierta_confirmada'&&close.verified&&Date.parse(item.fecha_cierre)>Date.now()
  ?'Abierta confirmada':'Vigencia pendiente de confirmación';
}
function caUpdateRadarTimeStatuses(){
 const tbody=document.getElementById('ca-opportunity-rows');
 if(!tbody||!caRadarVisibleItems.length||tbody.rows.length!==caRadarVisibleItems.length)return;
 let updated=false;
 for(let i=0;i<caRadarVisibleItems.length;i++){
  const cell=tbody.rows[i].querySelector('td[data-label="Vigencia"]');
  const label=caRadarStatus(caRadarVisibleItems[i]);
  if(cell&&cell.textContent!==label){cell.textContent=label;updated=true;}
 }
 if(updated&&document.getElementById('ca-only-current')?.checked)caRadarLoading('La hora de cierre cambió el estado de una oportunidad. Actualiza pantalla para volver a aplicar el filtro de vigentes.','warning');
}
function caRenderRadarReview(){
 const panel=document.getElementById('ca-review-panel'),list=document.getElementById('ca-review-list'),count=document.getElementById('ca-review-count');
 if(!panel||!list||!count)return;
 const flagged=caRadarVisibleItems.map(item=>({item,reason:caOpportunityReviewReason(item)})).filter(row=>row.reason);
 count.textContent=String(flagged.length);
 list.replaceChildren();
 if(!flagged.length){panel.hidden=true;return;}
 for(const {item,reason} of flagged){
  const entry=caNode('article',undefined,'ca-review-item');
  const body=caNode('div');
  body.append(caNode('strong',caDisplay(item.nombre)),caNode('small',caDisplay(item.codigo)+' · '+caDisplay(item.organismo)),caNode('p',reason));
  const open=caNode('button','Ver oportunidad','ca-secondary');open.type='button';open.addEventListener('click',event=>caOpenDetail(item,event.currentTarget));
  entry.append(body,open);list.append(entry);
 }
 panel.hidden=false;
}

function caRadarOpportunityMarkup(item){
 const tr=document.createElement('tr');
 const close=caSantiagoDate(item.fecha_cierre);
 const status=caRadarStatus(item);
 const values=[[item.organismo,'Institución'],[item.nombre,'Compra'],[item.codigo,'Código'],[item.region,'Región'],[caMoney(item.monto_estimado),'Monto estimado'],[close.text,'Cierre'],[status,'Vigencia']];
 for(const [value,label] of values){
  const cell=caNode('td',caDisplay(value));cell.dataset.label=label;
  if(label==='Código'){
   const link=document.createElement('a');link.href='https://buscador.mercadopublico.cl/compra-agil';link.target='_blank';link.rel='noopener noreferrer';link.className='ca-official-process-link';link.textContent='Abrir en Mercado Público';
   const copy=caNode('button','Copiar código','ca-small-button');copy.type='button';copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(String(item.codigo));copy.textContent='Código copiado';}catch{copy.textContent='Código: '+item.codigo;}});
   cell.append(document.createTextNode(' '),link,copy);
  }
  tr.append(cell);
 }
 const action=caNode('td',undefined,'ca-row-actions');action.dataset.label='Acción';action.dataset.codigo=item.codigo;
 const coverageLabel=item.seguimiento_no_disponible?'Seguimiento no disponible':!item.tiene_detalle?'Falta consultar detalle':item.clasificacion_cobertura==='SIN_EVALUAR'?'Sin evaluar':`Cobertura ${item.clasificacion_cobertura==='COBERTURA_COMPLETA'?'completa':'parcial'} · ${item.productos_confirmados||0}/${item.productos_total||0}${item.productos_posibles?` · ${item.productos_posibles} posibles`:''}`;
 action.append(caNode('small',coverageLabel,'ca-coverage-label'));
 if(caOpportunityReviewReason(item))action.append(caNode('small','Revisar anexos','ca-review-hint'));
 const view=caNode('button','Ver oportunidad','ca-small-button');view.type='button';view.addEventListener('click',event=>caOpenDetail(item,event.currentTarget));action.append(view);tr.append(action);
 return tr;
}
async function caLoadOpportunities(){
 const tbody=document.getElementById('ca-opportunity-rows');if(!tbody)return;
 const filters=caFilters(),trackingFilter=document.getElementById('ca-tracking-filter').value;
 const requestKey=JSON.stringify({filters,trackingFilter});
 if(caRadarPending?.key===requestKey)return caRadarPending.promise;
 const requestId=++caRadarRequestSequence;
 caRadarLoading('Actualizando oportunidades…','loading');
 if(!tbody.children.length){const row=caNode('tr');const cell=caNode('td','Cargando oportunidades…','ca-loading-row');cell.colSpan=8;row.append(cell);tbody.append(row);}
 const promise=(async()=>{
  try{
   let result,trackingUnavailable=false;
   if(trackingFilter)result=await caInvokeSeguimiento({accion:'radar',filtros, filtro_cobertura:trackingFilter});
   else{
    result=await caInvoke({consulta:'oportunidades',...filters});
    if(requestId!==caRadarRequestSequence)return;
    try{
     const coverage=await caInvokeSeguimiento({accion:'resumen_lote',codigos:(result.items||[]).map(row=>row.codigo)});
     if(requestId!==caRadarRequestSequence)return;
     cresceDashboardState.coverage=coverage.resumen||{};
     result.items=(result.items||[]).map(row=>({...row,...(coverage.resumen||{})[row.codigo]}));
    }catch{if(requestId!==caRadarRequestSequence)return;trackingUnavailable=true;result.items=(result.items||[]).map(row=>({...row,seguimiento_no_disponible:true}));}
   }
   if(requestId!==caRadarRequestSequence)return;
   const signature=caOpportunityRowSignature(result.items||[]);
   if(signature!==caRadarRowsSignature){
    const rows=!result.items?.length?[(()=>{const row=caNode('tr'),cell=caNode('td','No hay resultados para estos filtros.','ca-empty');cell.colSpan=8;row.append(cell);return row;})()]:result.items.map(caRadarOpportunityMarkup);
    tbody.replaceChildren(...rows);caRadarRowsSignature=signature;
   }
   caRadarVisibleItems=result.items||[];caRenderRadarReview();caUpdateRadarTimeStatuses();
    const total=result.total||0,page=result.pagina||filters.pagina,perPage=result.por_pagina||25;
   document.getElementById('ca-page-label').textContent=`Página ${page} · ${total} resultados filtrados${result.parcial?' · conjunto parcial (límite de seguridad de 10.000)':''}`;
   document.getElementById('ca-prev').disabled=page<=1;document.getElementById('ca-next').disabled=page*perPage>=total;
   caRadarLoading(trackingUnavailable?'Seguimiento no disponible; se conserva el Radar.':result.parcial?'Lectura parcial: se alcanzó el límite seguro.':'',trackingUnavailable||result.parcial?'warning':'loading');
  }catch(error){
   if(requestId!==caRadarRequestSequence)return;
   if(!caRadarRowsSignature){const row=caNode('tr'),cell=caNode('td','No se pudieron cargar las oportunidades. Reintenta la consulta.','ca-inline-error');cell.colSpan=8;row.append(cell);tbody.replaceChildren(row);}
   caRadarLoading('No se pudo actualizar el Radar. Se conserva la lista anterior. '+(error.message||''),'error');
   caSetStatus('No se pudo consultar el Radar.','error');throw error;
  }finally{if(requestId===caRadarRequestSequence&&caRadarPending?.key===requestKey)caRadarPending=null;}
 })();
 caRadarPending={key:requestKey,promise};return promise;
}

function caEnterDetailView(opportunity,trigger){
 if(!caRadarReturnState)caRadarReturnState={scrollY:window.scrollY,focus:trigger||document.activeElement};
 const overview=document.getElementById('ca-dashboard-overview'),panel=document.getElementById('ca-detail-panel');
 if(overview)overview.hidden=true;panel.hidden=false;cresceDashboardState.selected=opportunity;
 const heading=document.querySelector('.workspace-heading');
 if(heading){const y=Math.max(0,heading.getBoundingClientRect().top+window.scrollY-18);window.scrollTo({top:y,behavior:'instant'});}
}
function caCloseDetail(){
 caDetailRequestSequence++;
 const panel=document.getElementById('ca-detail-panel'),overview=document.getElementById('ca-dashboard-overview');
 panel.hidden=true;if(overview)overview.hidden=false;
 const state=caRadarReturnState;caRadarReturnState=null;cresceDashboardState.selected=null;
 caRenderRadarReview();
 if(state){window.scrollTo({top:state.scrollY,behavior:'instant'});if(state.focus?.isConnected)state.focus.focus({preventScroll:true});}
}
async function caOpenDetail(opportunity,trigger=document.activeElement,{refresh=false}={}){
 const panel=document.getElementById('ca-detail-panel');if(!panel)return;
 const same=caDetailCurrentCode===opportunity.codigo;
 if(!same)cresceDashboardState.detailTab='resumen';
 caEnterDetailView(opportunity,trigger);
 if(same&&!refresh&&panel.children.length){panel.querySelector('.ca-detail-back')?.focus({preventScroll:true});return;}
 const requestId=++caDetailRequestSequence;
 caDetailCurrentCode=opportunity.codigo;
 panel.replaceChildren();
 const loading=caNode('div',undefined,'ca-detail-loading');loading.setAttribute('role','status');loading.append(caNode('span','Cargando ficha de oportunidad…','ca-muted'));
 const backLoading=caNode('button','← Volver al Radar','ca-secondary ca-detail-back');backLoading.type='button';backLoading.addEventListener('click',caCloseDetail);loading.prepend(backLoading);panel.append(loading);backLoading.focus({preventScroll:true});
 const title=document.getElementById('ca-page-title');if(title)title.textContent='Cargando oportunidad';
 try{
  const response=await caInvoke({consulta:'detalle',codigo:opportunity.codigo});
  if(requestId!==caDetailRequestSequence||!panel.isConnected)return;
  if(!response.detalle){
   panel.replaceChildren(caNode('h3','Detalle de la oportunidad'));
   const back=caNode('button','← Volver al Radar','ca-secondary ca-detail-back');back.type='button';back.addEventListener('click',caCloseDetail);
   panel.prepend(back,panel.lastChild);
   panel.append(caNode('p',response.mensaje||'Detalle oficial pendiente: todavía no está almacenado.','ca-empty'));
   const consult=caNode('button','Consultar detalle oficial','ca-primary');consult.type='button';
   consult.addEventListener('click',async()=>{consult.disabled=true;consult.textContent='Consultando…';try{await caInvokeDetalle({accion:'consultar',codigo:opportunity.codigo});if(requestId!==caDetailRequestSequence)return;caDetailCache.delete(opportunity.codigo);await caOpenDetail(opportunity,trigger,{refresh:true});}catch(error){if(requestId!==caDetailRequestSequence)return;caAppendOfficialSearch(panel,opportunity.codigo,true,error.message);consult.disabled=false;consult.textContent='Reintentar consulta oficial';}});
   panel.append(consult,caNode('p','La consulta se realiza en el servidor con el ticket privado.','ca-muted'));caDetailActions(panel,opportunity);
   const h=panel.querySelector('h3');if(h){h.id='ca-detail-view-title';h.tabIndex=-1;h.focus({preventScroll:true});}
   if(title)title.textContent='Detalle de oportunidad';return;
  }
  const detail=response.detalle.datos_detalle||{},checkedAt=response.detalle.fecha_consulta||response.detalle.fecha_actualizacion;
  caDetailCache.set(opportunity.codigo,{detail,checkedAt});
  caRenderDetail(panel,opportunity,detail);
  if(checkedAt){const stamp=caNode('p',`Detalle oficial consultado: ${caSantiagoDate(checkedAt).text}`,'ca-muted');const nav=panel.querySelector('.ca-detail-nav');panel.insertBefore(stamp,nav||panel.firstChild);}
  const h=panel.querySelector('#ca-detail-view-title');h?.focus({preventScroll:true});
  if(title)title.textContent='Detalle de oportunidad';
  await caRenderPrivateDocuments(panel,opportunity);if(requestId!==caDetailRequestSequence||!panel.isConnected)return;
  await caRenderTracking(panel,opportunity,detail);if(requestId!==caDetailRequestSequence||!panel.isConnected)return;
  await caRenderEconomic(panel,opportunity,detail);if(requestId!==caDetailRequestSequence||!panel.isConnected)return;
  await caRenderRequirements(panel,opportunity,detail);
 }catch(error){
  if(requestId!==caDetailRequestSequence||!panel.isConnected)return;
  panel.replaceChildren(caNode('h3','Detalle de la oportunidad'));const back=caNode('button','← Volver al Radar','ca-secondary ca-detail-back');back.type='button';back.addEventListener('click',caCloseDetail);panel.prepend(back);caAppendOfficialSearch(panel,opportunity.codigo,false,error.message);caDetailActions(panel,opportunity);
  const h=panel.querySelector('h3');if(h){h.id='ca-detail-view-title';h.tabIndex=-1;h.focus({preventScroll:true});}
  if(title)title.textContent='Detalle de oportunidad';
 }
}
async function caRefreshCoverageRow(codigo){
 try{
  const data=await caInvokeSeguimiento({accion:'resumen_lote',codigos:[codigo]}),summary=data.resumen?.[codigo];
  if(!summary)return;
  const action=[...document.querySelectorAll('#ca-opportunity-rows .ca-row-actions')].find(node=>node.dataset.codigo===codigo);
  if(!action)return;
  const label=action.querySelector('.ca-coverage-label');if(label)label.textContent=summary.clasificacion==='SIN_EVALUAR'?'Sin evaluar':`Cobertura ${summary.clasificacion==='COBERTURA_COMPLETA'?'completa':'parcial'} · ${summary.productos_confirmados||0}/${summary.productos_total||0}${summary.productos_posibles?` · ${summary.productos_posibles} posibles`:''}`;
 }catch{/* El estado guardado persiste aunque el indicador del Radar no pueda refrescarse. */}
}

function caAppendOfficialSearch(panel,code,pending=false,message=''){panel.querySelectorAll('.ca-detail-fetch-error,.ca-detail-pending,.ca-detail-manual-hint,.ca-official-process-link,.ca-official-code-copy').forEach(node=>node.remove());if(message){const error=caNode('p',message,'ca-inline-error');error.classList.add('ca-detail-fetch-error');panel.append(error);}if(pending)panel.append(caNode('p','Detalle oficial pendiente. La oportunidad permanece en el Radar y no se modificaron sus datos guardados.','ca-warning ca-detail-pending'));const hint=caNode('p',`Puedes buscar el proceso ${code} manualmente en Mercado Público.`,'ca-muted ca-detail-manual-hint');panel.append(hint);const link=document.createElement('a');link.href='https://buscador.mercadopublico.cl/compra-agil';link.target='_blank';link.rel='noopener noreferrer';link.className='ca-secondary ca-official-process-link';link.textContent='Abrir en Mercado P\u00fablico';const copy=caNode('button','Copiar c\u00f3digo','ca-secondary ca-official-code-copy');copy.type='button';copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(code);copy.textContent='C\u00f3digo copiado';}catch{copy.textContent='C\u00f3digo: '+code;}});panel.append(link,copy);}
function caDetailActions(panel,opportunity){const actions=caNode('div',undefined,'ca-actions');for(const [label,kind] of [['Evaluar','evaluate'],['Preparar cotización','prepare']]){const button=caNode('button',label,'ca-secondary');button.type='button';button.addEventListener('click',()=>caSetManualAction(opportunity,kind));actions.append(button);}panel.append(actions);}
function caRenderDetail(panel,opportunity,detail){
 panel.replaceChildren();
 const officialUrl='https://buscador.mercadopublico.cl/compra-agil';
 const top=caNode('div',undefined,'ca-detail-head');
 const back=caNode('button','← Volver al Radar','ca-secondary ca-detail-back');back.type='button';back.addEventListener('click',caCloseDetail);top.append(back);
  const heading=caNode('div');heading.append(caNode('span','DETALLE COMERCIAL','eyebrow'),caNode('h3',caDisplay(detail.nombre||opportunity.nombre)),caNode('p',caDisplay(opportunity.codigo)));const title=heading.querySelector('h3');title.id='ca-detail-view-title';title.tabIndex=-1;top.append(heading);panel.append(top);
 const actions=caNode('div',undefined,'ca-actions');const official=document.createElement('a');official.href=officialUrl;official.target='_blank';official.rel='noopener noreferrer';official.className='ca-secondary';official.textContent='Abrir en Mercado P\u00fablico';
 const copy=caNode('button','Copiar c\u00f3digo','ca-secondary');copy.type='button';copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(String(opportunity.codigo));copy.textContent='C\u00f3digo copiado';}catch{copy.textContent='C\u00f3digo: '+opportunity.codigo;}});actions.append(official,copy);panel.append(actions);
 const names=[['resumen','Resumen'],['productos','Productos'],['proveedores','Proveedores'],['requisitos','Requisitos'],['documentos','Documentos'],['rentabilidad','Rentabilidad']];
 const nav=caNode('div',undefined,'ca-detail-nav');nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Secciones de la ficha');
 const panes={};for(let i=0;i<names.length;i++){const key=names[i][0],label=names[i][1],id='ca-detail-'+key;
   const button=caNode('button',label);button.type='button';button.setAttribute('role','tab');button.id=id+'-tab';button.setAttribute('aria-controls',id+'-pane');const selected=(cresceDashboardState.detailTab||'resumen')===key;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;button.dataset.caDetailTab=key;nav.append(button);
   const section=caNode('section',undefined,'ca-detail-section');section.id=id+'-pane';section.setAttribute('role','tabpanel');section.setAttribute('aria-labelledby',id+'-tab');section.dataset.caDetailSection=key;section.hidden=!selected;section.append(caNode('h4',label));panes[key]=section;
 }
 nav.addEventListener('click',event=>{const button=event.target.closest('[data-ca-detail-tab]');if(!button)return;const key=button.dataset.caDetailTab;cresceDashboardState.detailTab=key;for(const tab of nav.querySelectorAll('[role=tab]')){const selected=tab===button;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;}for(const name of names)panes[name[0]].hidden=name[0]!==key;});
 nav.addEventListener('keydown',event=>{const tabs=[...nav.querySelectorAll('[role=tab]')],index=tabs.indexOf(document.activeElement);let next=index;if(event.key==='ArrowRight')next=(index+1)%tabs.length;else if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;else return;event.preventDefault();tabs[next].focus();tabs[next].click();});
 const closeValue=detail.fechas?.fecha_cierre||opportunity.fecha_cierre,closeDate=caSantiagoDate(closeValue),past=closeDate.verified&&Date.parse(closeValue)<=Date.now();
 const products=Array.isArray(detail.productos_solicitados)?detail.productos_solicitados:[];
 const summary=caNode('div',undefined,'ca-detail-summary');const dateText=closeDate.text+(closeDate.verified?' (fecha y zona horaria verificables)':' (zona horaria no verificada)');
 const summaryItems=[['Presupuesto',caMoney(detail.presupuesto?.monto_disponible_clp??detail.presupuesto?.presupuesto_estimado)],['Cierre',dateText],['Plazo de entrega',detail.entrega?.plazo_entrega_dias!=null?String(detail.entrega.plazo_entrega_dias)+' d\u00edas':'No informado'],['Productos',String(products.length)],['Cobertura confirmada','0/'+products.length+' ? cargando seguimiento'],['Requisitos pendientes','Calculando revisi\u00f3n']];
 for(const [label,value] of summaryItems){const card=caNode('div',undefined,'ca-detail-summary-card');card.append(caNode('small',label),caNode('strong',value));summary.append(card);}
 panel.append(summary);
 if(!closeDate.verified||!detail.estado?.codigo)panel.append(caNode('p','Vigencia pendiente de confirmaci\u00f3n oficial. La fecha o el estado disponibles no permiten confirmar que siga abierta.','ca-warning ca-vigencia-warning'));
 else if(past)panel.append(caNode('p','Cierre vencido seg\u00fan la fecha oficial informada. El estado hist\u00f3rico no confirma vigencia.','ca-warning ca-vigencia-warning'));
 else if(detail.vigencia_verificada===true)panel.append(caNode('p','Abierta confirmada mediante informaci\u00f3n oficial consultada.','ca-verified ca-vigencia-warning'));
 else panel.append(caNode('p','Vigencia pendiente de confirmaci\u00f3n oficial; el estado publicado por s\u00ed solo no confirma que siga abierta.','ca-warning ca-vigencia-warning'));
 panel.append(nav);for(const [key] of names)panel.append(panes[key]);
 const fields=caNode('div',undefined,'ca-detail-fields');
 caSafeDetail(fields,'Instituci\u00f3n',detail.institucion?.organismo_comprador||opportunity.organismo);caSafeDetail(fields,'Estado informado por la API',detail.estado?.glosa||detail.estado?.codigo);
 caSafeDetail(fields,'Ofertas por l\u00edneas o partidas','No confirmado: revisar las condiciones oficiales; no se asume que se permitan ofertas parciales.');
 caSafeDetail(fields,'Convocatoria',detail.convocatoria?.descripcion);caSafeDetail(fields,'Fecha oficial de cierre',closeDate.text);caSafeDetail(fields,'Zona horaria',closeDate.verified?'Verificable desde la fecha informada':'No verificable');
 caSafeDetail(fields,'Lugar de entrega',detail.entrega?.direccion_entrega);caSafeDetail(fields,'Plazo de entrega (d\u00edas)',detail.entrega?.plazo_entrega_dias);caSafeDetail(fields,'Presupuesto',caMoney(detail.presupuesto?.monto_disponible_clp??detail.presupuesto?.presupuesto_estimado));caSafeDetail(fields,'Moneda',detail.presupuesto?.moneda);
 panes.resumen.append(fields,caNode('p',caDisplay(detail.descripcion),'ca-detail-description'));
 const exec=caNode('div',undefined,'ca-executive-summary');exec.append(caNode('strong','Cobertura: cargando seguimiento\u2026','ca-executive-coverage'),caNode('strong','Requisitos: pendientes de revisi\u00f3n','ca-executive-requirements'),caNode('strong','Evaluaci\u00f3n econ\u00f3mica: incompleta','ca-executive-profit'));panes.resumen.append(exec);
 if(!products.length)panes.productos.append(caNode('p','El detalle no informa productos requeridos.','ca-empty'));else{const list=caNode('div',undefined,'ca-product-list');for(const product of products){const card=caNode('article',undefined,'ca-product-card');card.append(caNode('strong',caDisplay(product.nombre)),caNode('p',caDisplay(product.descripcion,'Especificaci\u00f3n t\u00e9cnica no informada')),caNode('small','Cantidad: '+caDisplay(product.cantidad)+' '+caDisplay(product.unidad_medida,'')));list.append(card);}panes.productos.append(list);}
 panes.proveedores.append(caNode('p','Pronobel y Mashini permanecen en revisi\u00f3n privada: sus productos son candidatos no confirmados y no se usan para cotizar.','ca-warning ca-staging-notice'),caNode('div',undefined,'ca-detail-provider-content'));
 const flags=detail.flags||{},conditions=caNode('div',undefined,'ca-condition-list');for(const [label,key] of [['Requisitos medioambientales','considera_requisitos_medioambientales'],['Impacto social o econ\u00f3mico','considera_requisitos_impacto_social_economico']])conditions.append(caNode('p',label+': '+(typeof flags[key]==='boolean'?(flags[key]?'S\u00ed':'No'):'No informado')));panes.requisitos.append(conditions,caNode('p','Todo requisito debe revisarse manualmente con la solicitud y sus anexos.','ca-warning'));
 const docs=Array.isArray(detail.documentos)?detail.documentos:[];if(!docs.length)panes.documentos.append(caNode('p','La API no inform\u00f3 adjuntos.','ca-empty'));else{const list=caNode('ul',undefined,'ca-document-list');for(const doc of docs)list.append(caNode('li',caDisplay(doc.nombre)+(doc.id?' \u00b7 ID '+doc.id:'')));panes.documentos.append(list,caNode('p','Se conserva el nombre y el ID oficial. No se inventan enlaces de descarga. Descarga el original manualmente y luego s\u00edbelo abajo para asociarlo a esta compra.','ca-warning'));}
 panes.rentabilidad.append(caNode('p','Los costos, descuentos, IVA y m\u00e1rgenes se muestran \u00fanicamente en este panel privado.','ca-muted'),caNode('div',undefined,'ca-detail-profit-content'));
 const raw=document.createElement('details');raw.className='ca-official-raw';raw.append(caNode('summary','Datos t\u00e9cnicos originales de la API'));const pre=document.createElement('pre');pre.textContent=JSON.stringify(detail,null,2);raw.append(pre);panes.requisitos.append(raw);
}
async function caRenderPrivateDocuments(panel,opportunity){const target=panel.querySelector('[data-ca-detail-section="documentos"]');if(!target)return;const section=caNode('section',undefined,'ca-private-documents');section.append(caNode('h4','Archivos descargados para esta compra'),caNode('p','Carga aqu\u00ed documentos obtenidos manualmente. Quedan en el bucket privado y asociados al c\u00f3digo de la oportunidad.','ca-muted'));const form=document.createElement('form');form.className='ca-document-upload';const input=document.createElement('input');input.type='file';input.accept='.pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png';input.required=true;const upload=caNode('button','Guardar archivo privado','ca-secondary');upload.type='submit';form.append(input,upload);form.addEventListener('submit',async event=>{event.preventDefault();const file=input.files?.[0];if(!file)return;upload.disabled=true;upload.textContent='Guardando\u2026';try{await caUploadPrivateDocument(opportunity.codigo,file);input.value='';await caLoadPrivateDocuments(list,opportunity);}catch(error){list.replaceChildren(caNode('p',error.message,'ca-inline-error'));}finally{upload.disabled=false;upload.textContent='Guardar archivo privado';}});section.append(form);const list=caNode('div',undefined,'ca-private-document-list');section.append(list);target.append(section);await caLoadPrivateDocuments(list,opportunity);}

async function caLoadPrivateDocuments(container,opportunity){
 container.replaceChildren(caNode('p','Cargando archivos privados...','ca-muted'));
 try{
  const result=await caInvokeDocumentos({accion:'listar',codigo:opportunity.codigo});container.replaceChildren();
  if(!result.documentos?.length){container.append(caNode('p','Aún no hay documentos internos cargados.','ca-empty'));return;}
  for(const document of result.documentos){
   const row=caNode('article',undefined,'ca-private-document-row');row.append(caNode('span',document.nombre));
   const actions=caNode('div',undefined,'ca-document-actions');
   const download=caNode('button','Descargar','ca-small-button');download.type='button';download.addEventListener('click',()=>caDownloadPrivateDocument(opportunity,document));actions.append(download);
   const supported=/\.(docx|pdf)$/i.test(document.nombre),analyze=caNode('button',supported?'Analizar requisitos':'Formato no compatible','ca-small-button');analyze.type='button';analyze.disabled=!supported;
   const output=caNode('div',undefined,'ca-document-analysis');
   if(supported)analyze.addEventListener('click',()=>caAnalyzePrivateDocument(opportunity,document,output,analyze));
   actions.append(analyze);row.append(actions,output);container.append(row);
  }
 }catch(error){container.replaceChildren(caNode('p',error.message,'ca-inline-error'));}
}
async function caDownloadPrivateDocument(opportunity,doc){const client=dashboardConfig();const config=window.CRESCE_SUPABASE_CONFIG||{};if(!client){caSetStatus('Configuración incompleta.','error');return;}const {data:{session}}=await client.auth.getSession();if(!session){caSetStatus('Inicia sesión para descargar el documento.','error');return;}try{const response=await fetch(`${config.url.replace(/\/$/,'')}/functions/v1/compra-agil-documentos`,{method:'POST',headers:{apikey:config.publishableKey,Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({accion:'descargar',codigo:opportunity.codigo,key:doc.key})});if(!response.ok)throw new Error('No se pudo recuperar el documento privado.');const objectUrl=URL.createObjectURL(await response.blob());const anchor=document.createElement('a');anchor.href=objectUrl;anchor.download=doc.nombre;anchor.click();setTimeout(()=>URL.revokeObjectURL(objectUrl),60_000);}catch(error){caSetStatus(error.message,'error');}}
async function caRenderTracking(panel,opportunity,detail){
 const target=panel.querySelector('[data-ca-detail-section="proveedores"] .ca-detail-provider-content');if(!target)return;const lines=caProductLines(detail);let records=[],providers=[];
 try{const [saved,providerData]=await Promise.all([caInvokeSeguimiento({accion:'leer',codigo:opportunity.codigo}),caSeguimientoProveedores?Promise.resolve({proveedores:caSeguimientoProveedores}):caInvokeSeguimiento({accion:'proveedores'})]);records=saved.seguimiento||[];caSeguimientoCache=Object.fromEntries(records.map(row=>[row.producto_key,row]));caSeguimientoProveedores=providerData.proveedores||[];providers=caSeguimientoProveedores;}catch(error){target.append(caNode('p','No se pudo cargar el seguimiento guardado. Comprueba la publicación de la migración y la función de seguimiento.','ca-inline-error'));caDetailActions(panel,opportunity);return;}
 const byKey=new Map(records.map(row=>[row.producto_key,row]));let confirmed=0,possible=0;
 const sections=lines.map(({product,key})=>{const saved=byKey.get(key)||{},state=saved.estado||'SIN_EVALUAR';if(state==='PROVEEDOR_CONFIRMADO')confirmed++;if(state==='POSIBLE_COINCIDENCIA')possible++;const card=caNode('article',undefined,'ca-tracking-product');card.append(caNode('strong',caDisplay(product.nombre,'Producto sin nombre informado')),caNode('p',caDisplay(product.descripcion,'Sin especificación técnica informada')),caNode('small',`Cantidad: ${caDisplay(product.cantidad)} ${caDisplay(product.unidad_medida,'')}`));
  const matchBox=caNode('div',undefined,'ca-provider-matches');const findMatches=caNode('button','Buscar coincidencias','ca-secondary');findMatches.type='button';findMatches.addEventListener('click',async()=>{findMatches.disabled=true;matchBox.replaceChildren(caNode('p','Buscando en catalogos activos y revision privada...','ca-muted'));try{const productCode=product.codigo||product.codigo_producto||product.codigo_proveedor||'';const descriptor=[product.nombre,product.marca,product.presentacion,product.medida,product.unidad_medida].filter(Boolean).join(' ');const specs=[product.descripcion,product.especificacion].filter(Boolean).join(' ');const baseTerms=[productCode,descriptor,specs].filter(v=>typeof v==='string'&&v.trim().length>=2);const normalized=baseTerms.join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();const aliases=[['hipoclorito','cloro'],['cloro','hipoclorito'],['papel higienico','papel sanitario'],['papel sanitario','papel higienico'],['lavaloza','lavaplatos'],['lavaplatos','lavaloza'],['toalla de papel','papel absorbente'],['alcohol gel','sanitizante manos']];const terms=[...baseTerms,...aliases.filter(([from])=>normalized.includes(from)).map(([,to])=>to)].slice(0,4);const activeResults=[];for(const term of terms.slice(0,3)){const data=await caInvoke({consulta:'proveedores',texto:term.trim()});activeResults.push(...(data.items||[]));}const stageResults=[];let stageWarning='';for(const term of terms.slice(0,3)){try{const data=await caPrivateCandidates(term.trim());stageResults.push(...(data.candidatos||[]));}catch(error){if(!/configuracion|sesion|autoriz|funcion del importador/i.test(error.message.normalize('NFD').replace(/[\u0300-\u036f]/g,'')))throw error;stageWarning='Catalogos privados en revision no disponibles: '+error.message;break;}}const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();const wantedCode=norm(productCode),wantedName=norm(product.nombre);const uniqueActive=[...new Map(activeResults.map(item=>[`${item.proveedor}:${item.codigo}`,item])).values()].slice(0,12);const uniqueStage=[...new Map(stageResults.map(item=>[item.id,item])).values()].slice(0,12);matchBox.replaceChildren(caNode('p','Coincidencias candidatas. Verifica especificacion, presentacion, precio, IVA y disponibilidad; ninguna confirma cumplimiento.','ca-warning'));if(stageWarning)matchBox.append(caNode('p',stageWarning,'ca-warning'));for(const item of uniqueActive){const prod=item.producto||{},code=item.codigo||prod.codigo_proveedor||prod.clave_articulo||'',name=prod.nombre_producto||prod.nombre||prod.descripcion||code||'Producto sin nombre';const exact=Boolean(wantedCode&&norm(code)===wantedCode),nameNorm=norm(name),similar=Boolean(wantedName&&nameNorm&& (nameNorm.includes(wantedName.slice(0,24))||wantedName.includes(nameNorm.slice(0,24))));const row=caNode('article',undefined,'ca-match-candidate');row.append(caNode('strong',exact?'Coincidencia exacta por codigo; verificar requisitos':similar?'Posible coincidencia tecnica; revisar':'Producto parecido; pendiente de revision'),caNode('p',`${item.proveedor||'Proveedor'} | ${code} | ${name}`,'ca-muted'),caNode('small','Catalogo activo. Confirma fuente, precio y disponibilidad.'));const choose=caNode('button','Usar como candidato','ca-small-button');choose.type='button';choose.addEventListener('click',()=>{const found=providers.find(p=>String(p.clave).toLowerCase()===String(item.proveedor||'').toLowerCase());if(found)provider.value=found.id;manual.value=found?'':String(item.proveedor||'');status.value='POSIBLE_COINCIDENCIA';observation.value=`Candidato ${item.proveedor||''}; codigo ${code}; producto ${name}. Verificar equivalencia, precio, IVA y stock.`;caSetStatus('Candidato asociado; confirma manualmente antes de cotizar.','warning');});row.append(choose);matchBox.append(row);}for(const item of uniqueStage){const code=item.codigo_proveedor||'',name=item.nombre_producto||'Producto sin nombre',nameNorm=norm(name);const exact=Boolean(wantedCode&&norm(code)===wantedCode),similar=Boolean(wantedName&&nameNorm&&(nameNorm.includes(wantedName.slice(0,24))||wantedName.includes(nameNorm.slice(0,24))));const row=caNode('article',undefined,'ca-match-candidate ca-match-staging');row.append(caNode('strong',exact?'Coincidencia exacta por codigo; pendiente de confirmar':similar?'Posible coincidencia tecnica; pendiente':'Producto parecido; pendiente de revision'),caNode('p',`${item.proveedor_clave||'Proveedor por confirmar'} | ${code} | ${name}`,'ca-muted'),caNode('small',`STAGING PRIVADO | ${item.marca||'marca pendiente'} | ${item.presentacion||'presentacion pendiente'} | fuente ${item.fuente_original||'sin informar'} | ${item.ubicacion_fuente||'ubicacion pendiente'} | precio ${item.precio==null?'pendiente':'publicado, no confirmado'} | disponibilidad no confirmada`));const choose=caNode('button','Asociar como posible candidato','ca-small-button');choose.type='button';choose.addEventListener('click',()=>{provider.value='';manual.value=item.proveedor_clave||'Proveedor staging pendiente de confirmar';status.value='POSIBLE_COINCIDENCIA';observation.value=`Candidato staging ${item.proveedor_clave||''}, importacion ${item.importacion?.nombre_archivo||'sin origen'}, codigo ${code}, fila ${item.numero_fila||''}. No usar precio ni stock hasta aprobar y confirmar.`;caSetStatus('Candidato staging asociado como posible; no se incorpora su precio.','warning');});row.append(choose);matchBox.append(row);}if(!uniqueActive.length&&!uniqueStage.length)matchBox.append(caNode('p',stageWarning?'No hay coincidencias en catalogos activos; la revision privada no esta disponible.':'Sin coincidencias en las fuentes consultadas.','ca-empty'));}catch(error){matchBox.replaceChildren(caNode('p',error.message,'ca-inline-error'));}finally{findMatches.disabled=false;}});card.append(findMatches,matchBox);
  const form=document.createElement('div');form.className='ca-tracking-form';const nameLabel=caNode('label','Producto para la cotizacion (revision privada)');const nameInput=document.createElement('input');nameInput.value=saved.producto_nombre||product.nombre||'';nameInput.maxLength=500;nameLabel.append(nameInput);form.append(nameLabel);const qtyLabel=caNode('label','Cantidad solicitada');const qtyInput=document.createElement('input');qtyInput.value=saved.cantidad??product.cantidad??'';qtyInput.maxLength=100;qtyLabel.append(qtyInput);form.append(qtyLabel);const statusLabel=caNode('label','Estado de abastecimiento');const status=document.createElement('select');for(const [value,label] of [['SIN_EVALUAR','Sin evaluar'],['POSIBLE_COINCIDENCIA','Posible coincidencia'],['PROVEEDOR_CONFIRMADO','Proveedor confirmado'],['BUSCAR_PROVEEDOR','Buscar proveedor'],['NO_DISPONIBLE','No disponible']])status.add(new Option(label,value));status.value=state;statusLabel.append(status);form.append(statusLabel);
  const providerLabel=caNode('label','Proveedor existente');const provider=document.createElement('select');provider.add(new Option('Sin asignar',''));for(const p of providers)provider.add(new Option(`${p.clave}${p.nombre?' · '+p.nombre:''}`,p.id));provider.value=saved.proveedor_id||'';providerLabel.append(provider);form.append(providerLabel);
  const manualLabel=caNode('label','Proveedor nuevo (nombre manual)');const manual=document.createElement('input');manual.type='text';manual.maxLength=160;manual.value=saved.proveedor_nombre_manual||'';manual.placeholder='Aún no está en el catálogo';manualLabel.append(manual);form.append(manualLabel);provider.addEventListener('change',()=>{if(provider.value)manual.value='';});manual.addEventListener('input',()=>{if(manual.value)provider.value='';});
  const observationLabel=caNode('label','Observaciones');const observation=document.createElement('textarea');observation.maxLength=3000;observation.value=saved.observaciones||'';observation.placeholder='Producto encontrado, codigo, evidencia y observaciones';observationLabel.append(observation);form.append(observationLabel);
  const priceLabel=caNode('label','Precio de compra referencial (CLP)');const priceInput=document.createElement('input');priceInput.type='number';priceInput.min='0';priceInput.step='any';priceInput.placeholder='Pendiente de confirmacion';priceInput.value=saved.precio_compra_referencial??'';priceLabel.append(priceInput);form.append(priceLabel);
  const termsLabel=caNode('label','Condiciones de abastecimiento');const terms=document.createElement('textarea');terms.maxLength=3000;terms.value=(saved.condiciones_abastecimiento||'').replace(/^DISPONIBILIDAD (?:CONFIRMADA MANUALMENTE|PENDIENTE) - /,'');termsLabel.append(terms);form.append(termsLabel);
  const dateLabel=caNode('label','Fecha de confirmación');const date=document.createElement('input');date.type='date';date.value=saved.fecha_confirmacion||'';dateLabel.append(date);form.append(dateLabel);const availabilityLabel=caNode('label','Disponibilidad confirmada con evidencia');const availability=document.createElement('input');availability.type='checkbox';availability.checked=/DISPONIBILIDAD CONFIRMADA MANUALMENTE/.test(saved.condiciones_abastecimiento||'');availabilityLabel.prepend(availability);form.append(availabilityLabel);
  const save=caNode('button','Guardar seguimiento','ca-secondary');save.type='button';save.addEventListener('click',async()=>{save.disabled=true;save.textContent='Guardando…';if(status.value==='PROVEEDOR_CONFIRMADO'&&(!availability.checked||!terms.value.trim()||!date.value)){caSetStatus('Para confirmar abastecimiento registra disponibilidad, evidencia/condiciones y fecha.','warning');save.disabled=false;save.textContent='Guardar seguimiento';return;}const availabilityEvidence=availability.checked?'DISPONIBILIDAD CONFIRMADA MANUALMENTE - ':'DISPONIBILIDAD PENDIENTE - ';try{const result=await caInvokeSeguimiento({accion:'guardar',codigo:opportunity.codigo,seguimiento:{producto_key:key,producto_nombre:nameInput.value,cantidad:qtyInput.value,unidad_medida:product.unidad_medida,especificacion:product.descripcion,estado:status.value,proveedor_id:provider.value,proveedor_nombre_manual:manual.value,observaciones:observation.value,precio_compra_referencial:priceInput.value===''?null:Number(priceInput.value),condiciones_abastecimiento:availabilityEvidence+terms.value,fecha_confirmacion:date.value}});const idx=records.findIndex(row=>row.producto_key===key);if(idx>=0)records[idx]=result.seguimiento;else records.push(result.seguimiento);caSetStatus('Seguimiento guardado.','success');await caRefreshCoverageRow(opportunity.codigo);}catch(error){caSetStatus(error.message,'error');}finally{save.disabled=false;save.textContent='Guardar seguimiento';}});const search=caNode('button','Buscar proveedor','ca-secondary');search.type='button';search.addEventListener('click',()=>{status.value='BUSCAR_PROVEEDOR';provider.focus();});form.append(search,save);card.append(form);return card;});
 const summary=caNode('section',undefined,'ca-coverage-summary');const total=lines.length;const detailAvailable=Boolean(detail&&typeof detail==='object'&&Object.keys(detail).length);const coverageText=!detailAvailable?'Detalle pendiente':total?`Cobertura confirmada: ${confirmed}/${total} líneas · ${Math.round(confirmed*100/total)}%`:'Sin evaluar · No hay líneas de productos informadas';summary.append(caNode('strong',coverageText),caNode('span',`Posibles coincidencias: ${possible} · No equivalen a abastecimiento confirmado.`));const classification=!detailAvailable?'DETALLE_PENDIENTE':total===0||lines.every(({key})=>(byKey.get(key)?.estado||'SIN_EVALUAR')==='SIN_EVALUAR')?'SIN_EVALUAR':confirmed===total?'COBERTURA_COMPLETA':'COBERTURA_PARCIAL';summary.append(caNode('b',classification==='COBERTURA_COMPLETA'?'Cobertura completa':classification==='COBERTURA_PARCIAL'?'Cobertura parcial':classification==='DETALLE_PENDIENTE'?'Detalle pendiente':'Sin evaluar'));target.append(caNode('h4','Seguimiento manual de productos'),summary);
  const executiveCoverage=panel.querySelector('.ca-executive-coverage');if(executiveCoverage)executiveCoverage.textContent=detailAvailable?`Cobertura confirmada: ${confirmed}/${total} · ${possible} posibles`:'Detalle pendiente';const summaryCoverage=panel.querySelector('.ca-detail-summary-card:nth-child(5) strong');if(summaryCoverage)summaryCoverage.textContent=confirmed+'/'+total+' confirmados';
  if(!lines.length)target.append(caNode('p','El detalle no contiene líneas de productos para evaluar. Esto no significa que la oportunidad sea imposible de abastecer.','ca-empty'));else{const list=caNode('div',undefined,'ca-tracking-list');sections.forEach(card=>list.append(card));target.append(list);}
 target.append(caNode('p','La cobertura completa por líneas no habilita una oferta. Antes de evaluar una cotización, confirma abastecimiento, requisitos técnicos, plazo y condiciones. Si se consideran ofertas parciales, valida expresamente que la solicitud las permita.','ca-warning'));caDetailActions(panel,opportunity);
}

function caDecisionStoreKey(code,type,key){return `${code}:${type}:${key}`;}
async function caDecisionSave(code,type,key,data){return caInvokeSeguimiento({accion:'decision_guardar',codigo:code,tipo:type,clave:key,datos:data});}
async function caRenderEconomic(panel,opportunity,detail){
 const section=panel.querySelector('[data-ca-detail-section="rentabilidad"] .ca-detail-profit-content');if(!section)return;
 section.replaceChildren(caNode('p','Evaluación interna provisional. El crédito fiscal de IVA no se presume; costos y precios requieren respaldo.','ca-warning'));
 let saved={};try{const result=await caInvokeSeguimiento({accion:'decision_leer',codigo:opportunity.codigo});for(const row of result.decisions||[])if(row.tipo==='producto')saved[row.clave]=row.datos||{};saved.__requisitos=Object.fromEntries((result.decisions||[]).filter(row=>row.tipo==='requisito').map(row=>[row.clave,row.datos||{}]));const expense=(result.decisions||[]).find(row=>row.tipo==='gastos');if(expense)saved.__gastos=expense.datos||{};}catch(error){section.append(caNode('p','Persistencia de evaluación pendiente: aplica la migración y publica la función de seguimiento actualizada.','ca-warning'));}
 const lines=caProductLines(detail);if(!lines.length){section.append(caNode('p','Sin productos informados para calcular.','ca-empty'));return;}const expectedRequirements=[];for(const doc of detail.documentos||[])expectedRequirements.push(`doc-${doc.id||slug(doc.nombre||'adjunto')}`);for(const {key} of lines)expectedRequirements.push(`prod-${key}`);if(detail.entrega?.plazo_entrega_dias)expectedRequirements.push('plazo-entrega');if(detail.entrega?.direccion_entrega)expectedRequirements.push('lugar-entrega');if(detail.descripcion)expectedRequirements.push('condiciones');if(!expectedRequirements.length)expectedRequirements.push('revision-general');
  const expense=saved.__gastos||{};const expenses={};const cards=[];for(const [key,label] of [['despacho','Despacho'],['transporte','Transporte'],['otros','Otros gastos']]){const wrap=caNode('label',label,'ca-calc-field');const input=document.createElement('input');input.type='number';input.min='0';input.step='1';input.placeholder='No informado';input.value=expense[key]??'';input.addEventListener('change',()=>{expenses[key]=input.value;expense[key]=input.value===''?null:Number(input.value);caDecisionSave(opportunity.codigo,'gastos','total',expense).catch(()=>{});cards.forEach(card=>card.recalc());});wrap.append(input);section.append(wrap);expenses[key]=input.value;}
  const totals={buy:0,sale:0,profit:0,complete:true};const lineValues=new Map();const quoteRows=new Map();const total=caNode('section',undefined,'ca-economic-total');const quote=caNode('section',undefined,'ca-quote-draft');const refreshTotals=()=>{totals.buy=0;totals.sale=0;totals.profit=0;totals.complete=[...lineValues.values()].length===lines.length&&[...lineValues.values()].every(values=>Number.isFinite(values[0])&&Number.isFinite(values[1]));for(const values of lineValues.values()){if(Number.isFinite(values[0]))totals.buy+=values[0];if(Number.isFinite(values[1]))totals.sale+=values[1];if(Number.isFinite(values[2]))totals.profit+=values[2];}const expensesComplete=[expenses.despacho,expenses.transporte,expenses.otros].every(value=>value!==''&&Number.isFinite(Number(value))&&Number(value)>=0);const expenseTotal=expensesComplete?Number(expenses.despacho)+Number(expenses.transporte)+Number(expenses.otros):NaN;const profit=totals.complete&&Number.isFinite(expenseTotal)?totals.profit-expenseTotal:NaN;total.replaceChildren(caNode('h5','Total interno de la oportunidad'),caNode('p',`Compra total: ${totals.complete?caMoney(totals.buy):'Incompleta'}`),caNode('p',`Venta total neta: ${totals.complete?caMoney(totals.sale):'Incompleta'}`),caNode('p',`Utilidad estimada: ${Number.isFinite(profit)?caMoney(profit):'No calculable; faltan datos o tratamiento de IVA'}`),caNode('p',`Capital requerido: ${totals.complete&&Number.isFinite(expenseTotal)?caMoney(totals.buy+expenseTotal):'No calculable'}`));quote.replaceChildren(caNode('h5','Preparación de cotización · borrador'),caNode('p','Borrador: requisitos obligatorios pendientes de validación manual. Vista externa sin costos, proveedores internos, descuentos recibidos ni márgenes.','ca-warning'));const context=caAnalysisQuoteContext?.codigo===opportunity.codigo?caAnalysisQuoteContext:null;if(context){quote.append(caNode('p','Fuente documental: '+context.document,'ca-muted'));if(context.references.length)quote.append(caNode('p','Referencias: '+context.references.join(', '),'ca-muted'));quote.append(caNode('p','Requisitos pendientes de revision: '+context.pending+'; no se envia ninguna oferta.','ca-warning'));if(context.notMet)quote.append(caNode('p','Requisitos marcados manualmente como no cumplidos: '+context.notMet,'ca-warning'));if(context.budget)quote.append(caNode('p','Presupuesto maximo API: '+caMoney(Number(context.budget))+'; confirma si incluye IVA antes de validar el borrador.','ca-warning'));quote.append(caNode('p',context.partialOffers.length?'Ofertas parciales: '+context.partialOffers.join(' | ')+'; confirmar expresamente si se permiten.':'El anexo no confirma si se permiten ofertas parciales; verificar con la entidad.','ca-warning'));}let quotedGross=0,quoteComplete=quoteRows.size===lines.length;for(const item of quoteRows.values()){quote.append(caNode('p',item.text));quoteComplete=quoteComplete&&item.valid;if(Number.isFinite(item.gross))quotedGross+=item.gross;}const proposalBudget=context?.budget??detail.presupuesto?.monto_disponible_clp??detail.presupuesto?.presupuesto_estimado;const budgetKnown=proposalBudget!==null&&proposalBudget!==undefined&&proposalBudget!==''&&Number.isFinite(Number(proposalBudget));const budgetReady=budgetKnown&&quotedGross<=Number(proposalBudget);const productsReady=lines.every(({key})=>caSeguimientoCache?.[key]?.estado==='PROVEEDOR_CONFIRMADO');const checklistReady=(!context)||(context.pending===0&&context.notMet===0);const requirementsReady=checklistReady&&expectedRequirements.every(key=>saved.__requisitos?.[key]?.estado==='CUMPLE');const profitReady=totals.complete&&expensesComplete&&Number.isFinite(profit);if(quoteComplete)quote.append(caNode('p',!budgetKnown?'Presupuesto oficial pendiente de confirmacion; no se habilita la descarga.':budgetReady?'Total preliminar con IVA dentro del presupuesto informado. Confirma bases y cargos antes de presentar.':'Total preliminar con IVA supera el presupuesto informado.','ca-warning'));const download=caNode('button','Descargar cotizacion preliminar (.txt)','ca-primary');download.type='button';download.disabled=!(quoteComplete&&productsReady&&requirementsReady&&profitReady&&budgetReady);download.title=download.disabled?'Vista externa sin costos ni proveedores internos.':'Confirma productos, requisitos, precios de venta, IVA y gastos en las pestanas correspondientes.';download.addEventListener('click',()=>{if(!(quoteComplete&&productsReady&&requirementsReady&&profitReady&&budgetReady))return;const content=[`COTIZACION PRELIMINAR - ${opportunity.codigo}`,caDisplay(opportunity.nombre),`Fecha: ${caSantiagoToday()}`,'Documento de trabajo; revisar condiciones oficiales antes de presentar.',...(context?.document?[`Fuente documental: ${context.document}`]:[]),...(context?.references?.length?[`Referencias: ${context.references.join(', ')}`]:[]),'Presupuesto comparado con total con IVA; confirmar tratamiento del presupuesto con la entidad.','',...Array.from(quoteRows.values(),row=>row.text),'',`Total preliminar con IVA: ${caMoney(quotedGross)}`,'No enviado a Mercado Publico.'].join('\n');const blob=new Blob([content],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`cotizacion-preliminar-${opportunity.codigo}.txt`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});quote.append(download);};
 for(const {product,key} of lines){const row=saved[key]||{};const follow=caSeguimientoCache?.[key]||{};const lineProduct={...product,nombre:follow.producto_nombre||product.nombre,cantidad:follow.cantidad??product.cantidad};const card=caNode('article',undefined,'ca-economic-product');card.append(caNode('strong',caDisplay(lineProduct.nombre,'Producto sin nombre')),caNode('p',`Cantidad solicitada: ${caDisplay(lineProduct.cantidad)} ${caDisplay(product.unidad_medida,'')}`));
  const fields=caNode('div',undefined,'ca-economic-fields');const add=(label,type='number',value='',options=null)=>{const l=caNode('label',label);let input;if(options){input=document.createElement('select');for(const [v,t] of options)input.add(new Option(t,v));input.value=value||'desconocido';}else{input=document.createElement('input');input.type=type;input.min='0';input.step='any';input.value=value??'';input.placeholder='No informado';}l.append(input);fields.append(l);return input;};
  const buy=add('Precio compra unitario (CLP)','number',follow.precio_compra_referencial??row.compra??'');const seller=add('Precio venta unitario (CLP)','number',row.venta??'');const treatment=[['desconocido','Tratamiento IVA desconocido'],['incluido','Precio incluye IVA'],['neto','Precio neto, IVA adicional']];const buyVat=add('Tratamiento IVA compra','',row.iva_compra,treatment);const saleVat=add('Tratamiento IVA venta','',row.iva_venta,treatment);const providerName=follow.proveedor_nombre_manual||caSeguimientoProveedores?.find(p=>p.id===follow.proveedor_id)?.clave||'';card.append(caNode('p',`Proveedor: ${providerName||'Pendiente de asignación'}`));const isCone=/^cone$/i.test(providerName);const discount=add('Descuento verificado (%)','number',row.descuento??'');const coneConfirmed=document.createElement('input');coneConfirmed.type='checkbox';coneConfirmed.checked=row.descuento_confirmado===true||(isCone&&row.descuento_cone_confirmado===true);const coneLabel=caNode('label','Descuento confirmado por fuente documental');coneLabel.prepend(coneConfirmed);discount.disabled=isCone&&!coneConfirmed.checked;coneConfirmed.addEventListener('change',()=>{discount.disabled=isCone&&!coneConfirmed.checked;recalc();});
   const result=caNode('div',undefined,'ca-economic-result');const recalc=()=>{const q=Number(lineProduct.cantidad),b=buy.value===''?NaN:Number(buy.value),s=seller.value===''?NaN:Number(seller.value),d=Number(discount.value||0);let cost=NaN,sales=NaN,buyTax=NaN,saleTax=NaN;if(Number.isFinite(q)&&q>0&&Number.isFinite(b)&&Number.isFinite(s)&&buyVat.value!=='desconocido'&&saleVat.value!=='desconocido'&&Number.isFinite(d)&&d>=0&&d<=100&&coneConfirmed.checked){const appliedDiscount=d/100;const effectiveBuy=b*appliedDiscount;const discountedBuy=b*(1-appliedDiscount);cost=discountedBuy*q*(buyVat.value==='neto'?1.19:1);sales=(saleVat.value==='incluido'?s/1.19:s)*q;saleTax=saleVat.value==='incluido'?s*q-sales:s*q*.19;buyTax=buyVat.value==='neto'?discountedBuy*q*.19:discountedBuy*q-(discountedBuy*q/1.19);}const extra=[expenses.despacho,expenses.transporte,expenses.otros].every(v=>v!==''&&Number.isFinite(Number(v))&&Number(v)>=0);const extraTotal=extra?Number(expenses.despacho)+Number(expenses.transporte)+Number(expenses.otros):NaN;const profit=Number.isFinite(cost)&&Number.isFinite(sales)?sales-cost:NaN;result.replaceChildren();for(const [label,val] of [['Compra total',cost],['Venta total antes de IVA',sales],['IVA costo (sin crédito presumido)',buyTax],['IVA venta',saleTax],['Utilidad estimada antes de gastos generales',profit],['Margen sobre ventas',Number.isFinite(profit)&&sales?`${(profit/sales*100).toFixed(1)}%`:'No calculable'],['Rentabilidad sobre costo',Number.isFinite(profit)&&cost?`${(profit/cost*100).toFixed(1)}%`:'No calculable']])result.append(caNode('p',`${label}: ${typeof val==='number'&&Number.isFinite(val)?caMoney(val):val||'No calculable'}`));lineValues.set(key,[cost,sales,profit]);quoteRows.set(key,{text:`Producto: ${caDisplay(lineProduct.nombre)} | cantidad ${caDisplay(lineProduct.cantidad)} | precio de venta unitario ${seller.value?caMoney(s):'No informado'} | subtotal ${Number.isFinite(sales)?caMoney(sales):'No informado'} | IVA ${Number.isFinite(saleTax)?caMoney(saleTax):'Por definir'}`,valid:Number.isFinite(q)&&q>0&&Number.isFinite(s)&&saleVat.value!=='desconocido',gross:Number.isFinite(sales)&&Number.isFinite(saleTax)?sales+saleTax:NaN});refreshTotals();};
  for(const input of [buy,seller,buyVat,saleVat,discount])input.addEventListener('input',recalc);for(const input of [buyVat,saleVat])input.addEventListener('change',recalc);const persist=()=>caDecisionSave(opportunity.codigo,'producto',key,{compra:buy.value===''?null:Number(buy.value),venta:seller.value===''?null:Number(seller.value),iva_compra:buyVat.value,iva_venta:saleVat.value,descuento:discount.value===''?null:Number(discount.value),descuento_cone_confirmado:coneConfirmed.checked,descuento_confirmado:coneConfirmed.checked});const save=caNode('button','Guardar evaluación','ca-secondary');save.type='button';save.addEventListener('click',()=>persist().then(()=>caSetStatus('Evaluación guardada.','success')).catch(()=>caSetStatus('No se pudo guardar; revisa la migración pendiente.','warning')));card.append(fields,coneLabel,result,save);section.append(card);cards.push({recalc});
 }
  for(const c of cards)c.recalc();section.append(total,quote,caNode('p','El IVA se calcula al 19% solo cuando eliges explícitamente el tratamiento tributario. No se presume derecho a crédito fiscal.','ca-muted'));
}
async function caRenderRequirements(panel,opportunity,detail){
 const section=panel.querySelector('[data-ca-detail-section="requisitos"]');if(!section)return;let saved=[];try{saved=(await caInvokeSeguimiento({accion:'decision_leer',codigo:opportunity.codigo})).decisions||[];}catch{}
 const byKey=new Map(saved.filter(r=>r.tipo==='requisito').map(r=>[r.clave,r.datos||{}]));const candidates=[];for(const doc of detail.documentos||[])candidates.push({key:`doc-${doc.id||slug(doc.nombre||'adjunto')}`,label:`Anexo/documento: ${doc.nombre||'nombre no informado'}`,source:'documentos'});for(const {product,key} of caProductLines(detail))candidates.push({key:`prod-${key}`,label:`Producto: ${product.nombre||'nombre no informado'} · cantidad ${product.cantidad??'no informada'} · ${product.descripcion||'especificación no informada'}`,source:'productos_solicitados'});if(detail.entrega?.plazo_entrega_dias)candidates.push({key:'plazo-entrega',label:`Plazo de entrega: ${detail.entrega.plazo_entrega_dias} días`,source:'entrega.plazo_entrega_dias'});if(detail.entrega?.direccion_entrega)candidates.push({key:'lugar-entrega',label:`Lugar de entrega: ${detail.entrega.direccion_entrega}`,source:'entrega.direccion_entrega'});if(detail.descripcion)candidates.push({key:'condiciones',label:'Condiciones expresas de solicitud; revisar descripción oficial.',source:'descripcion'});if(!candidates.length)candidates.push({key:'revision-general',label:'Revisar solicitud y anexos oficiales disponibles.',source:'detalle oficial'});
  const list=caNode('div',undefined,'ca-requirement-list');let reviewed=0;for(const item of candidates){const data=byKey.get(item.key)||{};if(data.estado&&data.estado!=='PENDIENTE')reviewed++;const card=caNode('article',undefined,'ca-requirement-card');card.append(caNode('strong',item.label),caNode('small',`Fuente: ${item.source}`));const form=caNode('div',undefined,'ca-requirement-fields');const status=document.createElement('select');for(const [v,l] of [['PENDIENTE','Pendiente'],['CUMPLE','Cumplido manualmente'],['NO_CUMPLE','No cumple'],['REQUIERE_REVISION','Requiere revisión']])status.add(new Option(l,v));status.value=data.estado||'PENDIENTE';const evidence=document.createElement('input');evidence.placeholder='Evidencia revisada';evidence.value=data.evidencia||'';const notes=document.createElement('textarea');notes.placeholder='Observaciones';notes.value=data.observaciones||'';form.append(status,evidence,notes);const save=caNode('button','Guardar revisión','ca-secondary');save.type='button';save.addEventListener('click',()=>caDecisionSave(opportunity.codigo,'requisito',item.key,{requisito:item.label,fuente:item.source,evidencia:evidence.value,estado:status.value,observaciones:notes.value}).then(()=>caSetStatus('Requisito guardado.','success')).catch(()=>caSetStatus('No se pudo guardar; revisa la migración pendiente.','warning')));card.append(form,save);list.append(card);}section.append(list);const executiveReq=panel.querySelector('.ca-executive-requirements');if(executiveReq)executiveReq.textContent=`Requisitos revisados: ${reviewed}/${candidates.length} · validación manual`;const pendingCount=panel.querySelector('.ca-detail-summary-card:nth-child(6) strong');if(pendingCount)pendingCount.textContent=String(candidates.length-reviewed)+' pendientes';
}

function caSetManualAction(opportunity,kind){const target=document.getElementById('ca-manual-prep');target.hidden=false;target.replaceChildren(caNode('h3',kind==='evaluate'?'Evaluación comercial pendiente':'Preparación manual de cotización'),caNode('p',`${opportunity.codigo} · ${caDisplay(opportunity.nombre)}`),caNode('p',kind==='evaluate'?'No se calcularon costos, impuestos, transporte, margen ni utilidad: faltan datos verificados.':'Área de trabajo manual. Revisa requerimientos, precios y condiciones antes de preparar cualquier documento. No se enviará ninguna oferta.','ca-warning'));document.querySelector('[data-ca-tab="evaluacion"]').click();}

function caShowTab(tab){cresceDashboardState.tab=tab;document.querySelectorAll('[data-ca-tab]').forEach(button=>button.setAttribute('aria-selected',String(button.dataset.caTab===tab)));document.querySelectorAll('[data-ca-pane]').forEach(pane=>pane.hidden=pane.dataset.caPane!==tab);}
async function caLoadSuppliers(){
 const list=document.getElementById('ca-supplier-list');if(!list)return;list.replaceChildren(caNode('p','Buscando catálogos…','ca-muted'));caSetStatus('Consultando catálogos…','loading');
 try{
  const response=await caInvoke({consulta:'proveedores',texto:document.getElementById('ca-supplier-search').value.trim(),proveedor:document.getElementById('ca-supplier-filter').value});
  const providerSelect=document.getElementById('ca-supplier-filter');const selectedProvider=providerSelect.value;providerSelect.replaceChildren(new Option('Todos',''));for(const provider of response.proveedores||[])providerSelect.append(new Option(provider.clave,provider.clave));providerSelect.value=selectedProvider;
  list.replaceChildren();
  if(!response.items?.length)list.append(caNode('p','No se encontraron artículos con esos criterios.','ca-empty'));
  const sourceNames={trovo_productos_proveedor:'Catálogo inicial',trovo_precios_proveedor:'Precios de proveedor',trovo_cone_catalogo_revisado:'CONE revisado'};
  for(const item of response.items||[]){
   const card=caNode('article',undefined,'ca-supplier-card');const product=item.producto||{};const provider=String(item.proveedor||'');const isCone=provider.toLocaleLowerCase('es')==='cone';
   const name=product.nombre_producto||product.nombre||product.descripcion||product.codigo_proveedor||product.clave_articulo||'Artículo sin nombre informado';
   card.append(caNode('span',isCone?'Catálogo CONE':'Proveedor: '+provider,'ca-vendor-label'),caNode('h4',name));
   const meta=[item.codigo||product.codigo_proveedor||product.clave_articulo,product.marca,product.estado_revision,product.unidad_precio,product.pagina_pdf?`Página PDF ${product.pagina_pdf}`:''].filter(Boolean).join(' · ');if(meta)card.append(caNode('p',meta,'ca-muted'));
   const origins=Array.isArray(item.fuentes)?item.fuentes.map(source=>sourceNames[source]||source):[];if(origins.length)card.append(caNode('p','Fuentes: '+origins.join(' · '),'ca-source-tags'));
   const prices=Array.isArray(item.precios)?item.precios:[];
   if(isCone){
    const state=caDisplay(product.estado_validacion,'No informado');card.append(caNode('p','Estado de validación: '+state,'ca-validation-state'));
    if(product.fecha_vigencia)card.append(caNode('p','Vigencia informada: '+caDisplay(product.fecha_vigencia),'ca-muted'));
    if(item.conflicto_precios){card.append(caNode('p','Hay precios distintos para este código. Revisión manual necesaria; no se seleccionó un precio.','ca-warning'));}
    else if(typeof item.precio_publicado_con_iva==='number'){
     const price=item.precio_publicado_con_iva;const discount=Math.round(price*0.07);const estimated=price-discount;
     const pricePanel=caNode('div',undefined,'ca-prices');
     pricePanel.append(caNode('p','Precio publicado con IVA: '+caMoney(price),'ca-cone-price'),caNode('p','Descuento comercial CONE (7%): −'+caMoney(discount),'ca-muted'),caNode('p','Costo estimado con IVA después del descuento: '+caMoney(estimated),'ca-cone-estimate'));card.append(pricePanel);
    }else card.append(caNode('p','Precio publicado con IVA no informado.','ca-muted'));
    if(prices.length){const sourcePrices=caNode('div',undefined,'ca-source-prices');for(const price of prices){const row=caNode('p',`${caMoney(price.precio_publicado_clp)} · ${sourceNames[price.fuente_origen]||price.fuente_origen||'Fuente sin identificar'}${price.presentacion_precio?' · '+price.presentacion_precio:''}`);sourcePrices.append(row);}card.append(sourcePrices);}
    if(!/^(verificado|confirmado|validado)(?:\b|$)/i.test(state)||item.conflicto_precios)card.append(caNode('p','Advertencia: el precio requiere confirmación manual antes de cotizar.','ca-warning'));
   }else if(prices.length){
    const priceList=caNode('div',undefined,'ca-prices');for(const price of prices){const verified=price.precio_confirmado===true;const badge=verified?'Precio confirmado en fuente':'Precio preliminar';const row=caNode('div',undefined,'ca-price-row');row.append(caNode('span',caMoney(price.precio_publicado_clp)),caNode('span',badge,verified?'ca-verified':'ca-preliminary'),caNode('small',[price.fuente_origen,price.presentacion_precio,price.tratamiento_iva,price.cantidad_minima?`Mínimo ${price.cantidad_minima}`:''].filter(Boolean).join(' · ')||'Condiciones no informadas'));priceList.append(row);}card.append(priceList);
   }else card.append(caNode('p','Precio no informado en esta fuente.','ca-muted'));
   if(product.stock_proveedor)card.append(caNode('p',`Referencia de stock declarada por proveedor: ${product.stock_proveedor}. No es inventario propio.`,'ca-stock-note'));list.append(card);
  }
  const notices=[];if(response.errores_fuentes?.length)notices.push('Fuentes con error: '+response.errores_fuentes.join(', '));if(response.parcial)notices.push('Resultados parciales: revisa la consulta o vuelve a buscar.');
  caSetStatus(notices.join(' · '),notices.length?'warning':'');
 }catch(error){list.replaceChildren(caNode('p',error.message,'ca-inline-error'));caSetStatus('No se pudieron consultar los catálogos.','error');}
}
function caImportSessionLabel(active){const label=document.getElementById('ca-account-label');if(label)label.textContent=active?'Sesi\u00f3n activa':'Sin sesi\u00f3n activa';}
async function caPrivateSession(client,forceRefresh=false){
 let session=null,sessionError=null;try{const result=await client.auth.getSession();session=result?.data?.session||null;sessionError=result?.error||null;}catch(error){sessionError=error;}
 const now=Math.floor(Date.now()/1000),expiry=session?.expires_at||0,needsRefresh=forceRefresh||!!sessionError||!session||expiry<=now+30;
 if(needsRefresh){let refreshed=null;try{const result=await client.auth.refreshSession();refreshed=result?.data?.session||null;}catch{}if(refreshed)session=refreshed;else if(forceRefresh||!session||!expiry||expiry<=now){caImportSessionLabel(false);caRenderLogin('Sesi\u00f3n no v\u00e1lida o vencida. Inicia sesi\u00f3n nuevamente.');throw new Error('Sesi\u00f3n no v\u00e1lida o vencida. Inicia sesi\u00f3n nuevamente.');}}
 if(!session||session.expires_at&&session.expires_at<=Math.floor(Date.now()/1000)){caImportSessionLabel(false);caRenderLogin('No hay una sesi\u00f3n v\u00e1lida. Inicia sesi\u00f3n nuevamente.');throw new Error('No hay una sesi\u00f3n v\u00e1lida. Inicia sesi\u00f3n nuevamente.');}
 caImportSessionLabel(true);return session;
}
function caPrivateImportHttpError(status){if(status===401)return 'Sesi\u00f3n vencida o no autenticada. Inicia sesi\u00f3n nuevamente.';if(status===403)return 'Tu usuario no est\u00e1 autorizado para revisar cat\u00e1logos.';if(status===404)return 'No se encontr\u00f3 la funci\u00f3n del importador. Revisa el proyecto Supabase configurado y su despliegue.';if(status===413)return 'El CSV supera el l\u00edmite de 1,2 MB.';if(status>=500)return 'El servidor no pudo completar la operaci\u00f3n. Revisa el esquema de revisi\u00f3n y los registros de la funci\u00f3n.';return `No se pudo completar la operaci\u00f3n (HTTP ${status}).`;}
async function caPrivateCandidates(q,offset=0){
 const client=dashboardConfig(),config=window.CRESCE_SUPABASE_CONFIG||{};if(!client)throw new Error('Configuracion Supabase incompleta.');
 if(typeof config.url!=='string'||typeof config.publishableKey!=='string'||!config.publishableKey.startsWith('sb_publishable_'))throw new Error('Configuracion Supabase incompleta.');
 const session=await caPrivateSession(client);let endpoint;try{const base=new URL(config.url);if(base.protocol!=='https:')throw new Error();endpoint=new URL('/functions/v1/trovo-catalogos-revision',base.origin).toString();}catch{throw new Error('La URL HTTPS de Supabase no es valida.');}
 const response=await fetch(endpoint,{method:'POST',headers:{apikey:config.publishableKey,Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json','x-import-action':'candidatos'},body:JSON.stringify({q,offset})});
 const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||caPrivateImportHttpError(response.status));return data;
}
async function caPrivateImportRequest(action,file=null){
 const client=dashboardConfig();const config=window.CRESCE_SUPABASE_CONFIG||{};if(!client)throw new Error('Configuraci\u00f3n Supabase incompleta.');if(!['previsualizar','guardar','listar'].includes(action))throw new Error('Operaci\u00f3n de importaci\u00f3n inv\u00e1lida.');
 if(typeof config.url!=='string'||typeof config.publishableKey!=='string'||!config.publishableKey.startsWith('sb_publishable_'))throw new Error('Falta la URL o clave p\u00fablica sb_publishable_ de Supabase.');
 let endpoint;try{const base=new URL(config.url);if(base.protocol!=='https:')throw new Error();endpoint=new URL('/functions/v1/trovo-catalogos-revision',base.origin).toString();}catch{throw new Error('La URL HTTPS de Supabase no es v\u00e1lida.');}
 let session=await caPrivateSession(client);const headers={apikey:config.publishableKey,Authorization:`Bearer ${session.access_token}`,'x-import-action':action};let body;
 if(action==='listar'){headers['Content-Type']='application/json';body=JSON.stringify({});}else{if(!(file instanceof Blob))throw new Error('Selecciona un archivo CSV.');headers['Content-Type']='text/csv; charset=utf-8';headers['x-file-name']=encodeURIComponent(file.name||'catalogo.csv');body=file;}
 const send=()=>fetch(endpoint,{method:'POST',headers,body});let response;try{response=await send();}catch{throw new Error('No se pudo conectar con la funci\u00f3n del importador. Revisa tu conexi\u00f3n.');}
 if(response.status===401){session=await caPrivateSession(client,true);headers.Authorization=`Bearer ${session.access_token}`;try{response=await send();}catch{throw new Error('No se pudo conectar con la funci\u00f3n del importador. Revisa tu conexi\u00f3n.');}}
 if(response.status===401){caImportSessionLabel(false);caRenderLogin(caPrivateImportHttpError(401));}
 let result={};try{result=await response.json();}catch{}if(!response.ok)throw new Error(typeof result.error==='string'&&response.status>=500?`${caPrivateImportHttpError(response.status)} ${result.error}`:caPrivateImportHttpError(response.status));return result;
}async function caPrivateReviewLoad(){const host=document.getElementById('ca-import-review');if(!host)return;host.replaceChildren(caNode('p','Cargando revision privada...','ca-muted'));try{const data=await caPrivateImportRequest('listar');host.replaceChildren();if(!data.importaciones?.length){host.append(caNode('p','Aun no hay importaciones privadas.','ca-empty'));return;}for(const item of data.importaciones){const details=caNode('details');details.append(caNode('summary',`${item.nombre_archivo} - ${item.estado_carga} - ${new Date(item.fecha_carga).toLocaleString('es-CL')}`));const counts=item.resumen_importacion||{};details.append(caNode('p',`Filas: ${counts.filas??'-'} - Codigos repetidos: ${counts.grupos_codigo_repetido??'-'} - IVA pendiente: ${counts.iva_pendiente??'-'} - Proveedor por confirmar: ${counts.proveedor_sin_confirmar??'-'}`));if(item.id===data.importacion_id)for(const row of data.filas||[]){const card=caNode('article',undefined,'ca-supplier-card');card.append(caNode('h4',row.nombre_producto||'Producto sin nombre'),caNode('p',`Codigo ${row.codigo_proveedor||'sin codigo'} - proveedor por confirmar - IVA pendiente - stock no confirmado`,'ca-warning'),caNode('p',`Precio: ${row.precio==null?'sin asignar':caMoney(Number(row.precio))} - ${row.estado_precio||'pendiente'} - Fuente: ${row.fuente_original||item.nombre_archivo} - ${row.ubicacion_fuente||`Fila ${row.numero_fila}`}`,'ca-muted'));if(row.codigo_repetido)card.append(caNode('p','Codigo repetido: revisar fila/fuente, no se descarto.','ca-warning'));details.append(card);}host.append(details);}}catch(error){host.replaceChildren(caNode('p',error.message,'ca-inline-error'));}}
function caPrivateImportSetup(){const picker=document.getElementById('ca-import-file'),preview=document.getElementById('ca-import-preview'),save=document.getElementById('ca-import-save'),status=document.getElementById('ca-import-status'),metrics=document.getElementById('ca-import-metrics');let checkedFile=null;preview.addEventListener('click',async()=>{const file=picker.files?.[0];if(!file)return caSetStatus('Selecciona un CSV normalizado.','warning');if(file.size>1200000)return caSetStatus('Maximo 1.2 MB por solicitud.','warning');status.textContent='Revisando archivo sin guardar...';save.disabled=true;metrics.replaceChildren();try{const data=await caPrivateImportRequest('previsualizar',file);checkedFile=file;for(const [name,value] of Object.entries(data.resumen||{}))metrics.append(caNode('p',`${name.replaceAll('_',' ')}: ${value}`));status.textContent=`Vista previa lista: ${data.archivo}. No se guardo ningun dato.`;save.disabled=false;}catch(error){status.textContent=error.message;caSetStatus('No se pudo preparar la vista previa.','error');}});save.addEventListener('click',async()=>{if(!checkedFile||picker.files?.[0]!==checkedFile)return caSetStatus('Genera nuevamente la vista previa del archivo.','warning');save.disabled=true;status.textContent='Guardando en zona privada de revision...';try{const result=await caPrivateImportRequest('guardar',checkedFile);status.textContent=result.idempotente?'Este archivo ya estaba en revision; no se duplico.':'Catalogo guardado unicamente en revision privada.';checkedFile=null;picker.value='';save.disabled=true;await caPrivateReviewLoad();}catch(error){status.textContent=error.message;save.disabled=false;}});document.getElementById('ca-import-review-refresh').addEventListener('click',caPrivateReviewLoad);}function caManualSyncSetup(){
 const button=document.getElementById('ca-sync'),dateInput=document.getElementById('ca-sync-from'),regions=document.getElementById('ca-sync-regions');
 if(!button||!dateInput||!regions)return;
 const today=caSantiagoToday(),dateLabel=document.getElementById('ca-sync-today');if(dateLabel)dateLabel.textContent='Fecha de consulta (America/Santiago): '+today;
 const fallback=new Date(Date.parse(today+'T00:00:00Z')-6*86400000).toISOString().slice(0,10);
 if(!caSyncFromEdited){dateInput.value=fallback;caSyncFromValue=fallback;}else dateInput.value=caSyncFromValue;
 dateInput.addEventListener('input',()=>{caSyncFromEdited=true;caSyncFromValue=dateInput.value;});
 dateInput.addEventListener('change',()=>{caSyncFromEdited=true;caSyncFromValue=dateInput.value;});
 button.addEventListener('click',async()=>{
  const client=dashboardConfig();if(!client)return caSetStatus('Configuracion Supabase incompleta.','error');
  let since;try{since=caSantiagoStartOfDayIso(dateInput.value);}catch(error){return caSetStatus(error.message,'warning');}
  const selected=regions.value.split(',').map(Number).filter(Number.isInteger);if(!selected.length)return caSetStatus('Selecciona al menos una region.','warning');
  const label=document.getElementById('ca-sync-result');button.disabled=true;button.textContent='Consultando Mercado Publico...';if(label){label.textContent='Consulta real en curso. Se conservaran los checkpoints existentes.';label.dataset.kind='loading';}
  try{
   const result=await client.functions.invoke('compra-agil-sync',{body:{accion:'buscar_compras_nuevas',regiones:selected,cambio_desde:since}});
   if(result.error)throw result.error;const data=result.data;if(data&&data.error)throw new Error(data.error);
   const rows=Array.isArray(data&&data.regiones)?data.regiones:[];
   if(!rows.length)throw new Error('La funcion no confirmo resultados por region; no se informa una cantidad de oportunidades nuevas.');
   const pages=rows.reduce((sum,row)=>sum+(Number(row.paginas_consultadas)||0),0);
   const problems=rows.filter(row=>['error','cuota_agotada','otra_sincronizacion_en_curso','requiere_fecha_inicial'].includes(row.estado));
   const pending=rows.filter(row=>row.continuable||row.estado==='pendiente_por_limite'||Number(row.paginas_pendientes)>0);
   const lines=rows.map(row=>{const count=Number(row.paginas_consultadas)||0;const name=row.nombre||('Region '+row.region);const failed=['error','cuota_agotada'].includes(row.estado);const fresh=Number(row.nuevas)||0;const updated=Number(row.actualizadas)||0;return count>0?name+': '+count+(failed?' paginas intentadas':' paginas consultadas')+(fresh>0||!failed?', '+fresh+' nuevas':'')+(updated>0||!failed?', '+updated+' actualizadas':'')+', '+(Number(row.paginas_pendientes)||0)+' pendientes; '+caSyncStatusLabel(row.estado)+(row.error?' - '+row.error:''):name+': no se confirmo consulta de paginas; '+caSyncStatusLabel(row.estado)+(row.error?' - '+row.error:'');});
   const limit=data.paginas_maximas_por_ejecucion?'; limite de esta ejecucion: '+data.paginas_maximas_por_ejecucion+' paginas':'';
   if(label){label.textContent=lines.join(' | ')+limit;label.dataset.kind=problems.length?'error':pages===0||pending.length?'warning':'success';}
   await caLoadPrivate({force:true});
  }catch(error){const message=error.message||'No se completo la sincronizacion.';if(label){label.textContent='No se confirmo una consulta completa a Mercado Publico. '+message;label.dataset.kind='error';}caSetStatus(message,'error');}
  finally{button.disabled=false;if(cresceDashboardState.summary)caRenderSummary(cresceDashboardState.summary);}
 });
}
function caBuildDashboard(){
 // Rebuilding the workspace invalidates previous DOM references and in-flight reads.
 caAuthRevision++;caPrivateLoadedUserId=null;caPrivateLoadPromise=null;
 caRadarRequestSequence++;caRadarPending=null;caRadarRowsSignature='';caRadarVisibleItems=[];
 caDetailRequestSequence++;caRadarReturnState=null;caDetailCurrentCode=null;
 main.innerHTML=`<a class="back" href="#inicio">← Holding</a><div class="workspace-heading cresce-workspace-heading">${icon(areas[0])}<div><h1>Compra Ágil</h1></div></div><div class="workspace ca-workspace"><nav class="sidebar" aria-label="Secciones de Trovofarma Store">${areas[0].modules.map(m=>`<a href="#trovofarma/${slug(m)}" ${m==='Compra Ágil'?'aria-current="page"':''}>${m}</a>`).join('')}</nav><section class="ca-main"><div class="module-heading"><h2>Radar de Oportunidades</h2><button type="button" id="ca-refresh" class="ca-secondary cresce-refresh" title="Actualizar datos guardados" aria-label="Actualizar datos guardados">↻</button></div><div id="ca-status" class="ca-status" role="status" hidden></div><div id="ca-auth"></div><div id="ca-data" hidden><div id="ca-dashboard-overview"><div class="ca-sync-controls cresce-sync-compact"><select id="ca-sync-regions" hidden aria-label="Regiones de sincronización"><option value="9,14">Araucanía y Los Ríos</option></select><input id="ca-sync-from" type="date" hidden aria-label="Inicio automático"><span id="ca-sync-today" hidden></span><button type="button" id="ca-sync" class="ca-secondary" title="Consulta real a Mercado Público en Araucanía y Los Ríos">Buscar compras nuevas</button><p id="ca-sync-result" class="ca-sync-result" role="status" aria-live="polite"></p></div><div id="ca-metrics" class="metrics ca-metrics"></div><details class="cresce-activity"><summary>Actividad y regiones</summary><div class="ca-summary-grid"><section class="panel"><h3>Compras por región</h3><div id="ca-regions"></div></section><section class="panel"><h3>Últimas consultas</h3><div id="ca-recent"></div></section></div></details><div class="ca-tabs" role="tablist" aria-label="Compra Ágil"><button type="button" role="tab" aria-selected="true" data-ca-tab="radar">Radar</button><button type="button" role="tab" aria-selected="false" data-ca-tab="proveedores">Proveedores</button><button type="button" role="tab" aria-selected="false" data-ca-tab="evaluacion">Evaluación comercial</button></div><section data-ca-pane="radar" class="ca-pane"><div class="ca-filters"><label>Buscar<input id="ca-search" type="search" placeholder="Código, institución o nombre"></label><label>Región<select id="ca-region"><option value="">Todas las regiones</option></select></label><label>Publicación desde<input id="ca-date-from" type="date"></label><label>Publicación hasta<input id="ca-date-to" type="date"></label><label>Monto mínimo CLP<input id="ca-min-amount" type="number" min="0" inputmode="numeric"></label><label>Monto máximo CLP<input id="ca-max-amount" type="number" min="0" inputmode="numeric"></label><label class="ca-current-filter"><input id="ca-only-current" type="checkbox"> Solo oportunidades vigentes</label><label>Seguimiento<select id="ca-tracking-filter"><option value="">Todas</option><option value="parcial">Cobertura parcial</option><option value="pendientes">Productos pendientes</option><option value="sin_detalle">Falta consultar detalle</option></select></label><label>Ordenar por<select id="ca-sort"><option value="fecha_publicacion">Fecha de publicación</option><option value="fecha_cierre">Fecha de cierre</option><option value="monto_estimado">Monto estimado</option><option value="nombre">Nombre</option></select></label><label>Dirección<select id="ca-direction"><option value="desc">Descendente</option><option value="asc">Ascendente</option></select></label></div><section id="ca-review-panel" class="ca-review-panel" aria-label="Oportunidades para revisar" hidden><div class="ca-review-heading"><div><h3>Oportunidades para revisar <span id="ca-review-count">0</span></h3></div></div><div id="ca-review-list" class="ca-review-list"></div></section><div class="ca-table-wrap ca-radar-table-wrap"><div id="ca-radar-loading" class="ca-radar-loading" role="status" aria-live="polite" hidden></div><table class="ca-table"><thead><tr><th>Institución</th><th>Compra</th><th>Código</th><th>Región</th><th>Monto estimado</th><th>Cierre</th><th>Estado</th><th>Acción</th></tr></thead><tbody id="ca-opportunity-rows"></tbody></table></div><div class="ca-pagination"><button type="button" id="ca-prev" class="ca-secondary">Anterior</button><span id="ca-page-label"></span><button type="button" id="ca-next" class="ca-secondary">Siguiente</button></div></section><section data-ca-pane="proveedores" class="ca-pane" hidden><div class="ca-supplier-controls"><label>Buscar por código o nombre<input id="ca-supplier-search" type="search" placeholder="Código o nombre del artículo"></label><label>Proveedor<select id="ca-supplier-filter"><option value="">Todos</option><option value="cone">CONE</option><option value="herbanatura">Herbanatura</option></select></label><button type="button" id="ca-supplier-refresh" class="ca-secondary">Buscar</button></div><p class="ca-stock-note">Los datos de disponibilidad pertenecen al proveedor; no representan inventario propio de Trovofarma Store.</p><div id="ca-supplier-list" class="ca-supplier-grid"></div><section class="panel ca-import-panel"><h3>Importar catalogo para revision</h3><p>CSV normalizado. La vista previa no guarda datos. Los registros conservan proveedor, precio, IVA y stock sin confirmar, y mantienen codigos repetidos.</p><label>Archivo CSV<input id="ca-import-file" type="file" accept=".csv,text/csv"></label><button type="button" id="ca-import-preview" class="ca-secondary">Ver vista previa</button><div id="ca-import-metrics" class="ca-import-metrics"></div><p id="ca-import-status" role="status"></p><button type="button" id="ca-import-save" class="ca-secondary" disabled>Guardar en revision privada</button><h3>Catalogos en revision privada</h3><button type="button" id="ca-import-review-refresh" class="ca-secondary">Actualizar revisiones</button><div id="ca-import-review"></div></section></section><section data-ca-pane="evaluacion" class="ca-pane" hidden><div class="ca-evaluation-intro"><h3>Evaluación comercial</h3><p>El análisis se mantiene pendiente hasta contar con equivalencias técnicas y costos verificados.</p></div><div class="ca-evaluation-grid">${['Costo neto','IVA','Descuentos','Transporte','Capital necesario','Margen','Utilidad estimada'].map(label=>`<article><span>${label}</span><strong>Pendiente</strong></article>`).join('')}</div><p class="ca-warning">No se calculan valores ni se asume equivalencia de productos automáticamente. La evaluación y la preparación de ofertas son manuales.</p><section id="ca-manual-prep" class="panel ca-manual-prep" hidden></section></section></div><section id="ca-detail-panel" class="panel ca-detail-panel ca-full-page-view" hidden></section><div class="ca-account"><span id="ca-account-label"></span><button type="button" id="ca-signout" class="ca-link-button">Cerrar sesión</button></div></div></section></div>`;
 const config=dashboardConfig();if(!config){caRenderLogin('Configuración incompleta: completa supabase-config.js con URL y clave pública sb_publishable_.');return;}
 if(!cresceDashboardAuthSubscription)cresceDashboardAuthSubscription=config.auth.onAuthStateChange(caHandleAuthStateChange).data.subscription;
 if(location.hash.includes('access_token=')||location.hash.includes('error_description=')){const params=new URLSearchParams(location.hash.slice(location.hash.indexOf('#')+1));if(params.get('type')==='recovery')caRenderNewPassword();else if(params.has('error_description'))caRenderLogin('El enlace no es válido o venció. Solicita uno nuevo para recuperar tu contraseña.');}else if(caAuthMode==='recovery'||caAuthMode==='new-password')caRenderLogin();
 document.getElementById('ca-refresh').addEventListener('click',()=>caLoadPrivate({force:true}));caManualSyncSetup();
 document.getElementById('ca-signout').addEventListener('click',async()=>{await config.auth.signOut();caRenderLogin();});
 document.querySelectorAll('[data-ca-tab]').forEach(button=>button.addEventListener('click',()=>{caShowTab(button.dataset.caTab);if(button.dataset.caTab==='proveedores'){caLoadSuppliers();caPrivateReviewLoad();}}));
 let debounce;for(const id of ['ca-search','ca-region','ca-date-from','ca-date-to','ca-min-amount','ca-max-amount','ca-sort','ca-direction','ca-tracking-filter','ca-only-current'])document.getElementById(id).addEventListener(id==='ca-search'||id==='ca-min-amount'||id==='ca-max-amount'?'input':'change',()=>{clearTimeout(debounce);cresceDashboardState.page=1;debounce=setTimeout(()=>caLoadOpportunities().catch(error=>caSetStatus(error.message,'error')),250);});
 document.getElementById('ca-prev').addEventListener('click',()=>{cresceDashboardState.page=Math.max(1,cresceDashboardState.page-1);caLoadOpportunities().catch(error=>caSetStatus(error.message,'error'));});
 document.getElementById('ca-next').addEventListener('click',()=>{cresceDashboardState.page++;caLoadOpportunities().catch(error=>caSetStatus(error.message,'error'));});
 document.getElementById('ca-supplier-refresh').addEventListener('click',()=>caLoadSuppliers());caPrivateImportSetup();document.getElementById('ca-supplier-search').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();caLoadSuppliers();}});document.getElementById('ca-supplier-filter').addEventListener('change',()=>caLoadSuppliers());
 if(caRadarStatusTimer)clearInterval(caRadarStatusTimer);caRadarStatusTimer=setInterval(caUpdateRadarTimeStatuses,60000);
 caLoadPrivate().catch(()=>caRenderLogin('No se pudo validar la sesion. Inicia sesion nuevamente.'));
 document.title='Compra Ágil · Trovofarma Store | CRESCE';
}
function home(){
  holdingCarouselController?.abort();
  holdingCarouselController=new AbortController();
  const target=area=>area.id==='trovofarma'?'#trovofarma/compra-agil':'#'+area.id+'/resumen';
  main.innerHTML=`<h1 class="sr-only">CRESCE Holding</h1><section class="cresce-holding" aria-label="Empresas de CRESCE">
    <div class="cresce-holding-stage">
      <div class="cresce-holding-backdrop" aria-hidden="true"><img src="assets/logos/cresce-logo.webp" alt=""></div>
      <div class="cresce-holding-mark" aria-hidden="true"><img src="assets/logos/cresce-logo-transparent.png" alt=""></div>
      <div class="cresce-holding-orbit" role="group" aria-label="Empresas del holding">
        ${areas.map((a,i)=>`<a href="${target(a)}" class="cresce-holding-book" data-book="${i}" aria-label="Abrir ${a.name}" title="${a.name}"><span class="cresce-holding-book-face"><img src="${a.logo}" alt="" loading="eager" decoding="async"><span class="cresce-holding-book-name">${a.name}</span></span></a>`).join('')}
      </div>
      <a class="cresce-holding-cta" href="#trovofarma/compra-agil">Entrar a Compra Ágil</a>
    </div>
  </section>`;
  document.title='CRESCE | Holding';
}
function workspace(area, module){
 if(area.id==='trovofarma'&&module==='Compra Ágil'){caBuildDashboard();return;}
 const summary = module === 'Resumen';

 main.innerHTML = `<a class="back" href="#inicio">← Holding</a><div class="workspace-heading"><span class="cresce-area-identity">${icon(area)}</span><h1>${area.name}</h1></div><div class="workspace"><nav class="sidebar" aria-label="Secciones de ${area.name}">${area.modules.map(m=>`<a href="#${area.id}/${slug(m)}" ${m===module?'aria-current="page"':''}>${m}</a>`).join('')}</nav><section class="cresce-operational-section" aria-labelledby="module-title"><div class="module-heading"><h2 id="module-title">${module}</h2></div><div class="cresce-empty-module">${summary?'':'En preparación'}</div></section></div>`;
 document.title=`${module} · ${area.name} | CRESCE`;
}
function render(){
 const [areaId,moduleId] = location.hash.slice(1).split('/');
 const area=areas.find(a=>a.id===areaId);
 if(area){holdingCarouselController?.abort();holdingCarouselController=null;const module=area.modules.find(m=>slug(m)===moduleId)||(area.id==='trovofarma'?'Compra Ágil':'Resumen');workspace(area,module);}
 else home();
 window.scrollTo(0,0);
 const heading=main.querySelector('h1');
 if(heading){heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});}
}
window.addEventListener('hashchange',render);
render();
async function caPrepareQuoteFromAnalysis(output,opportunity,documentoPrivado,analysis,button){
 const panel=output.closest('.ca-detail-panel');if(!panel){caSetStatus('No se encontro la ficha de la oportunidad.','error');return;}
 button.disabled=true;button.textContent='Preparando borrador...';
 try{
  const result=await caInvoke({consulta:'detalle',codigo:opportunity.codigo});const detail=result.detalle?.datos_detalle;if(!detail)throw new Error('Consulta primero el detalle oficial antes de preparar el borrador.');
  const products=Array.isArray(detail.productos_solicitados)?detail.productos_solicitados:[];if(!products.length)throw new Error('El detalle oficial no contiene productos para reutilizar en Rentabilidad.');
  let decisions=[];try{decisions=(await caInvokeSeguimiento({accion:'decision_leer',codigo:opportunity.codigo})).decisions||[];}catch{}
  const checklist=analysis?.checklist||[],stored=new Map(decisions.filter(row=>row.tipo==='requisito').map(row=>[row.clave,row.datos||{}]));
  const hash=Array.from(documentoPrivado.key).reduce((value,char)=>(Math.imul(value^char.charCodeAt(0),16777619)>>>0),2166136261).toString(16);
  let pending=0,notMet=0;for(let i=0;i<checklist.length;i++){const state=stored.get('anexo-'+hash+'-'+(i+1))?.estado||'pendiente';if(state==='no_cumple')notMet++;if(state!=='cumple'&&state!=='no_cumple')pending++;}
  const budget=(analysis?.api_comparisons||[]).find(row=>row.campo==='presupuesto')?.fuente_api;
  const references=[...new Set((analysis?.facts?.products||[]).map(row=>row.source?.ref).filter(Boolean))];
  caAnalysisQuoteContext={codigo:opportunity.codigo,document:documentoPrivado.nombre,references,pending,notMet,budget:budget??null,partialOffers:(analysis?.facts?.partial_offers||[]).map(row=>row.texto)};
  await caRenderEconomic(panel,opportunity,detail);
  panel.querySelector('[data-ca-detail-tab="rentabilidad"]')?.click();
  const staging=caNode('p','Pronobel y Mashini siguen en staging privado y no se usan como proveedores o precios confirmados. La seleccion existente en Proveedores requiere verificacion manual.','ca-warning');panel.querySelector('[data-ca-detail-section="rentabilidad"] .ca-detail-profit-content')?.prepend(staging);
  caSetStatus('Borrador privado listo para revision. Confirma proveedor, precio, IVA, transporte, presupuesto y requisitos antes de utilizarlo.','success');
 }catch(error){caSetStatus(error.message||'No se pudo preparar el borrador.','error');}
 finally{button.disabled=false;button.textContent='Preparar cotizacion desde este analisis';}
}
async function caAnalyzePrivateDocument(opportunity,documentoPrivado,output,button){
 button.disabled=true;button.textContent='Analizando...';output.replaceChildren(caNode('p','El documento se procesa en el servidor privado; no se aplica OCR.','ca-muted'));
 try{const result=await caInvokeDocumentos({accion:'analizar',codigo:opportunity.codigo,key:documentoPrivado.key});await caRenderDocumentAnalysis(output,opportunity,documentoPrivado,result.analysis,result.documento);}
 catch(error){output.replaceChildren(caNode('p',error.message,'ca-inline-error'));}
 finally{button.disabled=false;button.textContent='Analizar requisitos';}
}
async function caRenderDocumentAnalysis(host,opportunity,documentoPrivado,analysis,metadata){
 host.replaceChildren();host.append(caNode('h4','Análisis de requisitos - '+documentoPrivado.nombre));
 const quoteButton=caNode('button','Preparar cotizacion desde este analisis','ca-secondary');quoteButton.type='button';quoteButton.addEventListener('click',()=>caPrepareQuoteFromAnalysis(host,opportunity,documentoPrivado,analysis,quoteButton));host.append(quoteButton);
 host.append(caNode('p','Extracción textual asistida. Confirma cada punto con el archivo original; ningún requisito se marca automáticamente como cumplido.','ca-warning'));
 const identity=analysis?.identification;if(identity?.codigo_oportunidad)host.append(caNode('p','Oportunidad: '+identity.codigo_oportunidad,'ca-muted'));if(identity?.descripcion)host.append(caNode('p','Descripción extraída: '+identity.descripcion,'ca-muted'));const budget=(analysis?.api_comparisons||[]).find(item=>item.campo==='presupuesto');if(budget)host.append(caNode('p','Presupuesto máximo informado por API: '+caMoney(Number(budget.fuente_api))+'; contrasta el tratamiento de IVA en el anexo.','ca-warning'));host.append(caNode('small','Costos de compra, IVA, cantidades/presentaciones y despacho deben validarse en Rentabilidad; no se calcula utilidad definitiva con datos faltantes.','ca-muted'));
 if(metadata?.fecha_consulta_api)host.append(caNode('small','Detalle API consultado: '+metadata.fecha_consulta_api,'ca-muted'));
 if(analysis?.document_summary?.warning)host.append(caNode('p',analysis.document_summary.warning,'ca-warning'));
 if(analysis?.budget_mention)host.append(caNode('p','Mención económica detectada: '+analysis.budget_mention,'ca-muted'));
 const comparison=analysis?.api_comparisons||[];
 if(comparison.length){host.append(caNode('h5','Contraste con el detalle de Mercado Público'));for(const item of comparison){const row=caNode('article',undefined,'ca-analysis-evidence');row.append(caNode('strong',item.campo||'Dato'),caNode('p',JSON.stringify(item)),caNode('small','Una coincidencia textual no implica cumplimiento.'));host.append(row);}}
 for(const alert of analysis?.inadmissibility_alerts||[]){const row=caNode('article',undefined,'ca-analysis-alert');row.append(caNode('strong','Posible inadmisibilidad - verificar alcance'),caNode('p',alert.fundamento_explicito),caNode('small','Fundamento textual: '+alert.source.ref));host.append(row);}
 for(const warning of analysis?.calendar_warnings||[]){const row=caNode('article',undefined,'ca-analysis-alert');row.append(caNode('strong','Contradicción de fecha'),caNode('p',warning.mensaje),caNode('small','Fuente '+warning.source.ref+': '+warning.source.text));host.append(row);}
 for(const limitation of analysis?.limitations||[])host.append(caNode('small',limitation,'ca-muted'));
 const labels={products:'Productos',technical_requirements:'Requisitos técnicos',documents_and_photos:'Documentos y fotografías',dates_and_delivery:'Fechas y entrega',place:'Lugar de entrega',economic_terms:'Condiciones económicas',award_criteria:'Criterios de adjudicación',invoicing:'Facturación',post_award:'Obligaciones posteriores',partial_offers:'Ofertas parciales'};
 for(const [key,label] of Object.entries(labels)){const facts=analysis?.facts?.[key]||[];if(!facts.length)continue;const section=caNode('details');section.append(caNode('summary',label+' ('+facts.length+')'));for(const fact of facts){const item=caNode('article',undefined,'ca-analysis-evidence');item.append(caNode('p',fact.texto),caNode('small','Fuente '+fact.source.ref+(fact.source.heading?' - '+fact.source.heading:'')));section.append(item);}host.append(section);}
 const checklist=analysis?.checklist||[];if(!checklist.length){host.append(caNode('p','No se detectaron requisitos con los criterios iniciales. Revisa igualmente el documento completo.','ca-warning'));return;}
 host.append(caNode('h5','Checklist editable y pendiente de validación'));let saved=[];
 try{saved=(await caInvokeSeguimiento({accion:'decision_leer',codigo:opportunity.codigo})).decisions||[];}catch{}
 const stored=new Map(saved.filter(row=>row.tipo==='requisito').map(row=>[row.clave,row.datos||{}]));
 const hash=Array.from(documentoPrivado.key).reduce((value,char)=>(Math.imul(value^char.charCodeAt(0),16777619)>>>0),2166136261).toString(16);
 for(let i=0;i<checklist.length;i++){
  const item=checklist[i],key='anexo-'+hash+'-'+(i+1),data=stored.get(key)||{},card=caNode('article',undefined,'ca-requirement-card');
  card.append(caNode('strong',item.requirement),caNode('small','Fuente: '+item.source.ref+(item.source.heading?' - '+item.source.heading:'')),caNode('small',item.source.text));
  const fields=caNode('div',undefined,'ca-requirement-fields'),classification=document.createElement('select');
  for(const [value,label] of [['obligatorio','Obligatorio'],['informativo','Informativo'],['por_confirmar','Por confirmar']])classification.add(new Option(label,value));
  classification.value=data.clasificacion||item.classification;
  const status=document.createElement('select');for(const [value,label] of [['pendiente','Pendiente'],['cumple','Cumple'],['no_cumple','No cumple'],['requiere_aclaracion','Requiere aclaración']])status.add(new Option(label,value));status.value=data.estado||'pendiente';
  const evidence=document.createElement('textarea');evidence.placeholder='Evidencia verificada en el documento';evidence.value=data.evidencia||'';
  const observations=document.createElement('textarea');observations.placeholder='Observaciones';observations.value=data.observaciones||'';
  fields.append(caNode('label','Clasificación'),classification,caNode('label','Estado'),status,evidence,observations);
  const save=caNode('button','Guardar revisión','ca-secondary');save.type='button';save.addEventListener('click',async()=>{save.disabled=true;try{await caDecisionSave(opportunity.codigo,'requisito',key,{requisito:item.requirement,fuente:documentoPrivado.nombre,referencia:item.source.ref,fragmento:item.source.text,clasificacion:classification.value,estado:status.value,evidencia:evidence.value,observaciones:observations.value});caSetStatus('Revisión del anexo guardada en el panel privado.','success');}catch(error){caSetStatus(error.message||'No se pudo guardar la revisión.','error');}finally{save.disabled=false;}});
  card.append(fields,save);host.append(card);
 }
}
