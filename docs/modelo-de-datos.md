# Modelo de datos · Sistema de gestión veterinaria

Borrador v1 · 8 de noviembre de 2026 · Motor de base de datos: PostgreSQL

## 1. Alcance de las etapas 1, 2 y 3

**Incluye:** alta de clientes y pacientes (con alta rápida para urgencias), cola de espera diaria con urgencias, visita clínica con historial de cambios, registros por tipo (vacunas, antiparasitarios, estudios, cirugías y controles), avisos manuales de control, fichas incompletas, unión de duplicados, permisos por rol, cobro de visitas, pagos por medio, deudas, cierre diario de caja, lista de precios con historial y detalle del cobro por ítem.

**Fuera de alcance:** venta de productos y stock, facturación fiscal, recordatorios automáticos por correo o WhatsApp, turnos y reportes.

## 2. Convenciones generales

- Todas las tablas llevan `id`, `creado_en`, `creado_por`, `actualizado_en` y `actualizado_por`. Se omiten en las tablas de abajo.
- Nada clínico se borra: se anula con `anulado`, `motivo_anulacion`, `anulado_por` y `anulado_en`.
- Las fechas y horas se guardan en UTC y se muestran en hora de Tucumán (UTC-3).
- Los datos personales (documento, dirección, teléfono) se ven según el rol, y el documento no se muestra completo en los listados.
- Los tipos de dato son genéricos (texto, entero, decimal, booleano, fecha, fecha-hora, JSON). En PostgreSQL: `text`, `bigint`, `numeric`, `boolean`, `date`, `timestamptz`, `jsonb`.

## 3. Relaciones principales

- Un cliente tiene muchos pacientes. Cada paciente tiene un cliente titular; los dueños anteriores quedan en `paciente_dueno_historial`.
- Una especie tiene muchas razas. Un paciente tiene una especie y, opcionalmente, una raza.
- Un paciente tiene muchos ingresos a la cola, muchas visitas y muchos registros (vacunas, antiparasitarios, estudios, cirugías y controles).
- Un ingreso a la cola puede generar una visita. Una visita tiene medicación, versiones, notas y adjuntos.
- Una visita cerrada puede tener un cobro, y un cobro tiene muchos pagos. Las deudas son los cobros activos con saldo.
- Un cobro puede tener muchos ítems. Cada ítem puede referenciar un precio de la lista o quedar como concepto manual, y guarda su propio snapshot de nombre e importe.
- Un precio tiene muchos cambios en su historial. Desactivarlo no borra nada.
- Un control nace de una visita y tiene muchos avisos.

## 4. Tablas

### 4.1 Usuarios y auditoría

**usuario**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| nombre_completo | texto | Sí | |
| email | texto | Sí | Único. Sirve para iniciar sesión |
| password_hash | texto | Sí | Nunca se guarda la clave en claro |
| rol | lista | Sí | admin, veterinario, recepcion |
| matricula | texto | No | Solo veterinarios |
| activo | booleano | Sí | Se desactiva, no se borra |

**auditoria**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| usuario_id | referencia | Sí | Quién hizo la acción |
| entidad | texto | Sí | Nombre de la tabla afectada |
| entidad_id | entero | Sí | |
| accion | lista | Sí | crear, editar, anular, unir, ver_sensible, exportar |
| antes | JSON | No | Estado previo |
| despues | JSON | No | Estado posterior |
| fecha | fecha-hora | Sí | |

### 4.2 Clientes

**cliente**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| nombre | texto | Sí | |
| apellido | texto | Sí | |
| tipo_documento | lista | Sí | DNI, pasaporte, otro |
| nro_documento | texto | Sí | Índice, no único: ante un duplicado se avisa y no se bloquea |
| telefono_principal | texto | Completa: sí | Formato normalizado. No es obligatorio en el alta rápida |
| telefono_es_whatsapp | booleano | No | |
| telefono_alternativo | texto | No | Por ejemplo, un familiar |
| email | texto | No | Validar formato |
| calle_numero | texto | No | |
| localidad_barrio | texto | No | |
| provincia | texto | No | |
| pais | texto | No | Por defecto, Argentina |
| acepta_correo | booleano | No | Consentimiento de contacto |
| acepta_whatsapp | booleano | No | Consentimiento de contacto |
| fecha_consentimiento | fecha | No | |
| observaciones | texto | No | |
| alta_rapida | booleano | Sí | Se creó desde una urgencia |
| ficha_incompleta | booleano | Sí | Se calcula: falta teléfono u otro dato obligatorio |
| fusionado_en_cliente_id | referencia | No | Si se unió con otro cliente |

El cliente activo no se guarda: se calcula (por ejemplo, tuvo una visita en los últimos 12 meses).

### 4.3 Pacientes

**especie**: `nombre` (texto, obligatorio, único).

**raza**: `especie_id` (referencia, obligatorio), `nombre` (texto, obligatorio). Solo el administrador crea especies y razas. Al escribir una nueva, el sistema sugiere coincidencias para evitar duplicados por errores de tipeo.

**paciente**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| cliente_id | referencia | Sí | Titular actual |
| codigo_interno | texto | Sí | Se genera solo |
| nombre | texto | Sí | Admite Sin nombre |
| especie_id | referencia | Sí | |
| raza_id | referencia | No | Lista con mestizo y otra |
| sexo | lista | Sí | macho, hembra, desconocido |
| castrado | booleano | No | |
| fecha_castracion | fecha | No | |
| es_reproductor | booleano | No | |
| fecha_nacimiento | fecha | No | |
| nacimiento_aproximado | booleano | No | Para rescatados |
| fecha_deceso | fecha | No | Si tiene valor, el paciente figura como fallecido |
| origen | lista | No | criado, adoptado, rescatado, otro |
| chip_codigo | texto | No | Validar longitud (los chips estándar suelen tener 15 dígitos, a confirmar) |
| color | texto | No | |
| foto | archivo | No | |
| comentario | texto | No | |
| provisorio | booleano | Sí | Creado automáticamente en una alta rápida |
| ficha_incompleta | booleano | Sí | |

La edad del paciente se calcula a partir de `fecha_nacimiento`.

**paciente_dueno_historial**: `paciente_id`, `cliente_id`, `desde` (fecha), `hasta` (fecha, vacío si es el actual).

### 4.4 Cola de espera

**ingreso**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| paciente_id | referencia | Sí | |
| fecha_dia | fecha | Sí | |
| numero_orden | entero | Sí | Reinicia cada día. Único junto con fecha_dia |
| hora_llegada | fecha-hora | Sí | Nunca se modifica, aunque haya urgencia |
| servicio | lista | Sí | atencion_clinica, vacunacion, control, cirugia, otro |
| prioridad | lista | Sí | normal, urgente |
| urgencia_estado | lista | Sí | sin_marca, posible, confirmada, descartada |
| urgencia_confirmada_por | referencia | No | Veterinario de turno |
| urgencia_confirmada_en | fecha-hora | No | |
| hora_ingreso_consultorio | fecha-hora | No | |
| estado | lista | Sí | esperando, en_consulta, atendido, se_retiro, cancelado, sin_cerrar |
| comentario | texto | No | |

Al terminar el día, los ingresos que quedaron en esperando o en_consulta pasan a sin_cerrar y aparecen en una lista de revisión. La cola solo muestra el día actual.

### 4.5 Visita clínica

**visita**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| paciente_id | referencia | Sí | |
| ingreso_id | referencia | No | Vacío si no pasó por la cola |
| veterinario_id | referencia | Sí | |
| inicio_en | fecha-hora | Sí | |
| cierre_en | fecha-hora | No | |
| estado | lista | Sí | borrador, cerrada, corregida |
| motivo_consulta | texto | Sí al cerrar | |
| anamnesis | texto | No | |
| temperatura_c | decimal | No | |
| peso_kg | decimal | No | |
| diagnostico | texto | No | |
| observaciones | texto | No | |

**visita_version**: `visita_id`, `numero` (entero), `contenido` (JSON con el estado completo), `motivo_cambio` (texto), `modificado_por`, `modificado_en`. Se crea una versión cada vez que se edita una visita cerrada.

**visita_nota**: `visita_id`, `texto`, `autor_id`, `creado_en`. Sirve para agregar información después, sin sobrescribir el texto original.

**medicacion**: `visita_id`, `medicamento` (texto), `dosis` (texto), `via` (texto), `frecuencia` (texto), `duracion_dias` (entero), `indicaciones` (texto), `peso_referencia_kg` (decimal).

### 4.6 Registros por tipo

Todos llevan `paciente_id` (obligatorio) y `visita_id` (opcional, porque una vacunación puede darse sin consulta clínica).

**registro_vacuna**: `vacuna` (texto), `lote` (texto), `fecha_aplicacion` (fecha), `fecha_proxima_dosis` (fecha, opcional), `aplicada_por` (referencia).

**registro_antiparasitario**: `producto` (texto), `tipo` (interno, externo), `dosis` (texto), `fecha_aplicacion` (fecha), `fecha_proxima` (fecha, opcional), `aplicado_por` (referencia).

**registro_estudio**: `tipo_estudio` (texto), `fecha_pedido` (fecha), `estado` (pedido, realizado, resultado_cargado), `fecha_resultado` (fecha, opcional), `resultado_resumen` (texto, opcional).

**registro_cirugia**: `tipo_cirugia` (texto), `fecha_programada` (fecha), `estado` (programada, realizada, suspendida, cancelada), `indicaciones_previas` (texto, por ejemplo ayuno), `notas_postoperatorio` (texto), `cirujano_id` (referencia), `visita_origen_id` (referencia).

### 4.7 Controles y avisos manuales

**control**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| paciente_id | referencia | Sí | |
| visita_origen_id | referencia | Sí | Visita en la que se indicó |
| fecha_control | fecha | Sí | |
| franja | lista | Sí | manana, tarde, cualquiera |
| motivo | texto | No | |
| estado | lista | Sí | pendiente, realizado, ausente, cancelado, reprogramado |
| control_nuevo_id | referencia | No | Si se reprogramó |
| visita_realizada_id | referencia | No | Visita en la que se hizo el control |

**aviso_control**

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| control_id | referencia | Sí | |
| canal | lista | Sí | llamada, whatsapp_manual (a futuro: correo, whatsapp_automatico) |
| resultado | lista | Sí | avisado, no_contesta, sin_telefono, pidio_reprogramar |
| nota | texto | No | |
| realizado_por | referencia | Sí | |
| realizado_en | fecha-hora | Sí | |

### 4.8 Adjuntos y configuración

**archivo_adjunto**: `paciente_id`, `visita_id` (opcional), `estudio_id` (opcional), `nombre_original`, `tipo_mime`, `tamano_bytes`, `ruta_almacenamiento`, `subido_por`.

**configuracion_franja_control**: `nombre` (manana o tarde), `hora_desde`, `hora_hasta`. Valores iniciales: mañana de 9:00 a 12:00, tarde de 17:00 a 20:00. Quedan como configuración y no escritos en el código.

### 4.9 Cobros y pagos

**cobro**: `visita_id` (una visita cerrada), `total numeric(12,2)`, `estado` (`pendiente`, `parcial`, `pagado`), `observaciones`, `anulado`, `motivo_anulacion`, `anulado_por`, `anulado_en`, timestamps y usuarios de creación/edición. Un índice único parcial permite un solo cobro activo por visita. El total puede ser 0 si la visita es sin cargo, y en ese caso exige observación.

**pago**: `cobro_id`, `medio` (`efectivo`, `debito`, `credito`, `transferencia`), `monto numeric(12,2)`, `fecha`, `registrado_por`, `anulado`, `motivo_anulacion`, `anulado_por`, `anulado_en`, timestamps y usuarios de creación/edición. Un cobro puede tener varios pagos parciales. El saldo no se guarda: se calcula como total menos la suma de pagos activos.

**precio**: `nombre`, `importe numeric(12,2)`, `activo`, `observaciones`, timestamps y usuarios de creación/edición. Es la lista de precios de servicios vigente. Un índice único parcial impide dos precios activos con el mismo nombre, comparando sin mayúsculas ni tildes.

**precio_historial**: `precio_id`, `nombre_anterior`, `nombre_nuevo`, `importe_anterior`, `importe_nuevo`, `motivo`, `cambiado_por`, `cambiado_en`. Es append-only: cada alta y cada cambio de nombre o importe deja una fila. Desactivar o reactivar no borra el historial.

**cobro_item**: `cobro_id`, `precio_id` (opcional), `nombre`, `cantidad` (entero positivo), `importe_unitario numeric(12,2)`, `subtotal numeric(12,2)` generado. `nombre` e `importe_unitario` son un snapshot del momento del cobro: si después cambia la lista de precios, el cobro no se altera. Un ítem sin `precio_id` es un concepto manual.

## 5. Permisos por rol

| Acción | Recepción | Veterinario | Admin |
|---|---|---|---|
| Alta y edición de clientes y pacientes | Sí | Sí | Sí |
| Alta rápida | Solo con ingreso marcado como urgencia | Sí | Sí |
| Marcar posible urgencia | Sí | Sí | Sí |
| Confirmar urgencia | No | Sí | Sí |
| Crear y editar visitas y registros clínicos | No | Sí | Sí |
| Ver la historia clínica completa (solo lectura) | Sí | Sí | Sí |
| Exportar o imprimir la historia clínica (queda registrado) | Sí | Sí | Sí |
| Usar el asistente de consultas (solo lectura) | Sí | Sí | Sí |
| Ver controles y gestionar avisos | Sí | Sí | Sí |
| Cobrar visitas y registrar pagos | Sí | Sí | Sí |
| Ver la caja y el cierre del día | Sí | Sí | Sí |
| Corregir el total o el detalle de un cobro (con motivo) | Sí | Sí | Sí |
| Consultar la lista de precios | Sí | Sí | Sí |
| Crear, editar, desactivar o reactivar precios | No | No | Sí |
| Anular cobros y pagos (con motivo) | No | No | Sí |
| Anular registros clínicos (con motivo) | No | Sí | Sí |
| Unir clientes duplicados | No | No | Sí |
| Crear especies y razas | No | No | Sí |
| Gestionar usuarios y configuración | No | No | Sí |

## 6. Reglas de negocio clave

1. **Búsqueda previa.** Al ingresar un documento o teléfono, el sistema busca si el cliente ya existe y, en ese caso, carga su ficha y sus mascotas.
2. **Alta rápida.** Se pide solo nombre, apellido y documento. Se marcan `alta_rapida` y `ficha_incompleta` y se crea un paciente provisorio sin nombre. El veterinario indica la especie al iniciar la visita. Solo está disponible si el ingreso está marcado como posible o confirmada urgencia.
3. **Ficha completa.** Requiere teléfono principal. El sistema lo recuerda al cerrar la visita y mantiene una lista de fichas incompletas, con quién las creó y cuándo.
4. **Urgencias.** La recepción marca una posible urgencia y el veterinario de turno la confirma o descarta. Se registran las horas de llegada y de ingreso al consultorio, sin alterar la hora real de llegada.
5. **Visitas.** Mientras está en borrador se edita libremente. Al cerrarla, cada cambio exige un motivo y genera una versión. Lo que se agrega después se guarda como nota con fecha.
6. **Controles.** Se crean desde la visita. La lista de controles a recordar muestra los pendientes de hoy y de mañana, con teléfono y franja. Si pasa la fecha sin realizarse, pasan a ausente y aparecen en una lista para volver a contactar. Reprogramar crea un control nuevo y deja el original como reprogramado.
7. **Unión de duplicados.** Solo el administrador. Reasigna pacientes, visitas y registros al cliente que se conserva y deja `fusionado_en_cliente_id` en el otro.
8. **Anulación en lugar de borrado.** Los registros clínicos no se eliminan.
9. **Historia clínica para el cliente.** Recepción puede ver la historia clínica completa en solo lectura, pero no crear, editar ni anular nada clínico. Cuando un titular la pide, se verifica su documento, se imprime o se exporta, y la entrega queda registrada en la auditoría (acción exportar, con a quién se entregó).
10. **Asistente de consultas.** Es un chat local por reglas, sin IA externa, disponible solo con sesión iniciada y permiso `asistente.usar`. Responde con datos exactos de la base a partir de un término de búsqueda por mascota, titular, documento, teléfono o código `PAC-...`, y a pedidos como controles de hoy, de mañana o pendientes. Si hay varias coincidencias, muestra opciones para elegir. Es de solo lectura: no crea, edita, anula ni audita, no ejecuta el cierre automático de controles vencidos y no conserva memoria entre sesiones. El documento se muestra enmascarado y los datos clínicos respetan el permiso `historia.ver`.
11. **Cobros y caja.** Cada visita cerrada se cobra una sola vez, con total manual o con detalle por ítem, y pagos parciales o totales por medio. Al cerrar la visita, el ingreso pasa a `esperando_cobro`; cuando el cobro queda pagado, pasa a `atendido`. Las deudas son los cobros activos con saldo. Un pago mal cargado se anula con motivo y el saldo vuelve a aparecer; solo el admin puede anular cobros y pagos. Corregir el total o el detalle exige motivo y no puede dejar el total por debajo de lo ya pagado. El cierre del día se calcula desde los pagos activos por medio y se imprime, sin guardarse. Quedan para más adelante la venta de productos y el stock.

## 7. Etapa 2: cobros y caja

Implementada en la migración `014_cobros.sql`, sin tocar las tablas anteriores:

- **cobro**: un registro por visita cerrada, con total manual, estado (`pendiente`, `parcial`, `pagado`), observaciones y anulación lógica.
- **pago**: uno o varios por cobro, con medio, monto, fecha y usuario que lo registró; también con anulación lógica.
- **ingreso.estado**: suma `esperando_cobro` al circuito de la cola.

El cierre del día usa la zona `America/Argentina/Tucumán` y suma solo pagos activos. No se persiste un cierre: se calcula y se imprime. Fuera de alcance: lista de precios con historial, detalle por ítem, venta de productos, stock y facturación fiscal.

## 8. Etapa 3: lista de precios y detalle del cobro

Implementada en la migración `015_precios_y_detalle.sql`, sin tocar las tablas anteriores:

- **precio**: lista de servicios con importe, estado activo y observaciones. Nombre único entre los activos, comparando sin mayúsculas ni tildes.
- **precio_historial**: cada alta y cada cambio de nombre o importe, con motivo, usuario y fecha. Es append-only y no se borra al desactivar.
- **cobro_item**: detalle del cobro con concepto, cantidad, importe unitario y subtotal generado. Guarda un snapshot de nombre e importe, así que los cambios de la lista no alteran cobros viejos.
- **cobro**: sigue teniendo `total`. Si se cargan ítems, el backend calcula la suma de subtotales y descarta el total enviado; si no, se mantiene el total manual de la etapa 2.

Reglas:

- Consultar la lista está disponible para los tres roles. Crear, editar, desactivar y reactivar precios es solo del admin, siempre con motivo al editar.
- Un cobro detallado se edita con ítems; intentar editarlo solo con total se rechaza. Un cobro manual se edita con total.
- El total de un cobro editado no puede quedar por debajo de lo ya pagado.
- Un total 0, manual o por ítems, exige observación y deja el cobro `pagado`.
- El detalle del cobro y la caja muestran ítems, subtotales y pagos, incluidos los anulados.

Fuera de alcance: venta de productos, stock, facturación fiscal, descuentos, recargos y listas por sucursal.

## 9. Preguntas abiertas

1. ¿Para qué se usa el campo Código Veterinaria de MyVete?
2. ¿Puede haber más de un veterinario en una misma visita (por ejemplo, en cirugías con ayudante)?
3. ¿Un paciente puede tener más de un responsable (por ejemplo, una familia) o alcanza con un titular?
