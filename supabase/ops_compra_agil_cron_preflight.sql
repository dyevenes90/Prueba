-- PREPARACIÓN DE REVISIÓN; NO ACTIVA NI CREA TRABAJOS.
-- La ejecución queda bloqueada hasta validar el código desplegado, autenticación y cuota del ticket.
select jobid, jobname, schedule, active, command
from cron.job
where jobname ilike '%compra%agil%' or jobname ilike '%cresce%';

select jobid, runid, status, return_message, start_time, end_time
from cron.job_run_details
where jobid in (
  select jobid from cron.job
  where jobname ilike '%compra%agil%' or jobname ilike '%cresce%'
)
order by start_time desc
limit 50;

-- La futura acción incremental debe usar region=9 y 14, cambio_desde desde la última
-- sincronización correcta, tamano_pagina=50 y recorrer total_paginas.
-- Ante HTTP 429, esperar al reinicio diario de cuota de ChileCompra.
