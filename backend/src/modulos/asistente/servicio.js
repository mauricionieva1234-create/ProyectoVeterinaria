import { tienePermiso } from '../../config/permisos.js';
import { hoyEnTucuman } from '../../utils/fechas.js';
import { enmascararDocumento } from '../../utils/texto.js';
import { buscarClientePorId } from '../clientes/repositorio.js';
import { obtenerHistoriaClinica } from '../historia/servicio.js';
import { buscarPacientePorId, listarPorCliente } from '../pacientes/repositorio.js';
import { interpretar } from './parser.js';
import * as repositorio from './repositorio.js';

const ZONA_HORARIA = 'America/Argentina/Tucuman';

const ETIQUETAS_ESTADO = {
  borrador: 'Borrador',
  cerrada: 'Cerrada',
  corregida: 'Corregida',
  pendiente: 'Pendiente',
  realizado: 'Realizado',
  ausente: 'Ausente',
  cancelado: 'Cancelado',
  reprogramado: 'Reprogramado',
  pedido: 'Pedido',
  resultado_cargado: 'Resultado cargado',
  programada: 'Programada',
  suspendida: 'Suspendida',
  cancelada: 'Cancelada',
};

const ETIQUETAS_FRANJA = {
  manana: 'Mañana',
  tarde: 'Tarde',
  cualquiera: 'Cualquier horario',
};

const ETIQUETAS_SEXO = {
  macho: 'Macho',
  hembra: 'Hembra',
  desconocido: 'Desconocido',
};

const ETIQUETAS_ANTIPARASITARIO = {
  interno: 'Interno',
  externo: 'Externo',
};

function etiqueta(mapa, valor) {
  return mapa[valor] ?? valor ?? '—';
}

function formatearFecha(valor) {
  if (!valor) return '—';

  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor.trim())) {
    const [anio, mes, dia] = valor.trim().split('-');
    return `${dia}/${mes}/${anio}`;
  }

  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '—';

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: ZONA_HORARIA,
  }).format(fecha);
}

function formatearHora(valor) {
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '';

  return new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: ZONA_HORARIA,
  }).format(fecha);
}

function formatearFechaHora(valor) {
  if (!valor) return '—';

  // Las fechas sin hora se muestran tal cual para no correr un día por la zona.
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor.trim())) {
    return formatearFecha(valor);
  }

  const hora = formatearHora(valor);
  return hora ? `${formatearFecha(valor)} ${hora} hs` : formatearFecha(valor);
}

function sumarUnDia(fecha) {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia + 1)).toISOString().slice(0, 10);
}

function nombreCompleto(entidad) {
  return `${entidad?.nombre ?? ''} ${entidad?.apellido ?? ''}`.trim();
}

function dato(etiquetaTexto, valor, nota) {
  const item = { etiqueta: etiquetaTexto, valor: valor ?? '—' };
  if (nota) item.nota = nota;
  return item;
}

function seccion(titulo, items = [], nota) {
  const bloque = { titulo, items };
  if (nota) bloque.nota = nota;
  return bloque;
}

function respuesta(tipo, titulo, resumen, secciones = [], opciones = [], enlaces = []) {
  return { tipo, titulo, resumen, secciones, opciones, enlaces };
}

function sinDatos(titulo, resumen, sugerencias = []) {
  return respuesta('sin_datos', titulo, resumen, [
    seccion(
      'Qué podés probar',
      sugerencias.length > 0
        ? sugerencias
        : [
            dato('Nombre', 'Escribí el nombre de la mascota o del titular'),
            dato('Documento', 'Ej.: documento 93000101'),
            dato('Teléfono', 'Ej.: teléfono 3815550111'),
            dato('Controles', 'Ej.: controles de hoy'),
          ],
    ),
  ]);
}

function ayuda() {
  return respuesta(
    'ayuda',
    'Puedo consultar los datos del sistema',
    'Trabajo con reglas locales, solo con tu sesión y en modo lectura. No creo, edito ni anulo nada.',
    [
      seccion('Qué podés preguntarme', [
        dato('Controles', '“controles de hoy”, “controles de mañana”, “controles pendientes”'),
        dato(
          'Mascotas',
          '“vacunas de Firulais”, “última visita de Firulais”, “resumen de Firulais”',
        ),
        dato('Titulares', '“documento 93000101”, “teléfono 3815550111”, “mascotas de Demo”'),
      ]),
      seccion('Datos clínicos', [
        dato('Vacunas y antiparasitarios', 'Aplicaciones y próximas dosis'),
        dato('Estudios y cirugías', 'Estado y resultados cargados'),
        dato('Medicación y visitas', 'Indicaciones y atenciones registradas'),
        dato('Controles y adjuntos', 'Pendientes y archivos del paciente'),
      ]),
    ],
    [
      { etiqueta: 'Controles de hoy', mensaje: 'controles de hoy' },
      { etiqueta: 'Controles de mañana', mensaje: 'controles de mañana' },
      { etiqueta: 'Controles pendientes', mensaje: 'controles pendientes' },
    ],
  );
}

function etiquetaPaciente(fila) {
  const especie = fila.especie_nombre ?? fila.especieNombre ?? 'sin especie';
  const titular = `${fila.cliente_nombre ?? fila.cliente?.nombreCompleto ?? ''} ${
    fila.cliente_apellido ?? ''
  }`.trim();

  return [fila.nombre, especie, titular].filter(Boolean).join(' · ');
}

function opcionesDePacientes(pacientes) {
  return pacientes.slice(0, 10).map((fila) => ({
    etiqueta: etiquetaPaciente(fila),
    mensaje: `@paciente:${fila.id}`,
  }));
}

function opcionesDeCliente(cliente) {
  return cliente.slice(0, 10).map((fila) => ({
    etiqueta: `${nombreCompleto(fila)} · ${enmascararDocumento(fila.nro_documento)} · ${
      fila.pacientes
    } mascota(s)`,
    mensaje: `@cliente:${fila.id}`,
  }));
}

function enlacesDePaciente(id) {
  return [
    { texto: 'Abrir ficha del paciente', href: `/pacientes/${id}` },
    { texto: 'Ver historia clínica', href: `/pacientes/${id}/historia-clinica` },
  ];
}

function enlacesDeCliente(id) {
  return [{ texto: 'Abrir ficha del titular', href: `/clientes/${id}` }];
}

function opcionesDePaciente(paciente) {
  const codigo = paciente.codigoInterno;

  return [
    { etiqueta: 'Ver vacunas', mensaje: `vacunas de ${codigo}` },
    { etiqueta: 'Ver controles', mensaje: `controles de ${codigo}` },
    { etiqueta: 'Ver última visita', mensaje: `última visita de ${codigo}` },
    { etiqueta: 'Ver medicación', mensaje: `medicación de ${codigo}` },
  ];
}

function respuestaSinPermisoClinico(paciente) {
  return respuesta(
    'sin_permiso',
    'No tenés permiso para ver datos clínicos',
    `Podés consultar los datos de ${paciente.nombre}, pero tu rol no incluye la lectura clínica.`,
    [seccion('Mascota', datosBasicosDePaciente(paciente))],
    [{ etiqueta: 'Ver datos del titular', mensaje: `dueño de ${paciente.codigoInterno}` }],
    enlacesDePaciente(paciente.id),
  );
}

function datosBasicosDePaciente(paciente) {
  return [
    dato('Nombre', paciente.nombre),
    dato('Código', paciente.codigoInterno),
    dato('Especie', paciente.especieNombre),
    dato('Sexo', etiqueta(ETIQUETAS_SEXO, paciente.sexo)),
    dato('Nacimiento', formatearFecha(paciente.fechaNacimiento)),
    dato(
      'Estado',
      paciente.fechaDeceso ? `Fallecido el ${formatearFecha(paciente.fechaDeceso)}` : 'Activo',
    ),
  ];
}

function resumenDePaciente(paciente, historia) {
  const registros = historia.registros;
  const controlesPendientes = historia.controles.filter(
    (control) => control.estado === 'pendiente' && control.fechaControl >= hoyEnTucuman(),
  );
  const ultimaVisita = historia.visitas[0] ?? null;
  const proximoControl = controlesPendientes[0] ?? null;

  return respuesta(
    'ficha_paciente',
    `Resumen de ${paciente.nombre}`,
    `${paciente.nombre} · ${paciente.especieNombre}${
      paciente.razaNombre ? ` · ${paciente.razaNombre}` : ''
    } · Titular: ${paciente.cliente?.nombreCompleto ?? 'sin datos'}`,
    [
      seccion('Mascota', datosBasicosDePaciente(paciente)),
      seccion('Titular', [
        dato('Nombre', paciente.cliente?.nombreCompleto ?? 'Sin datos'),
        dato('Teléfono', paciente.cliente?.telefonoPrincipal ?? 'Sin teléfono'),
      ]),
      seccion(
        'Última visita',
        ultimaVisita
          ? [
              dato(
                formatearFechaHora(ultimaVisita.inicioEn),
                ultimaVisita.motivoConsulta ?? 'Sin motivo registrado',
                [
                  `Estado: ${etiqueta(ETIQUETAS_ESTADO, ultimaVisita.estado)}`,
                  ultimaVisita.veterinarioNombre
                    ? `Veterinario: ${ultimaVisita.veterinarioNombre}`
                    : null,
                  ultimaVisita.diagnostico ? `Diagnóstico: ${ultimaVisita.diagnostico}` : null,
                ]
                  .filter(Boolean)
                  .join(' · '),
              ),
            ]
          : [],
        ultimaVisita ? undefined : 'Sin visitas registradas.',
      ),
      seccion(
        'Próximo control',
        proximoControl
          ? [
              dato(
                `${formatearFecha(proximoControl.fechaControl)} · ${etiqueta(
                  ETIQUETAS_FRANJA,
                  proximoControl.franja,
                )}`,
                proximoControl.motivo ?? 'Control',
                `Estado: ${etiqueta(ETIQUETAS_ESTADO, proximoControl.estado)}`,
              ),
            ]
          : [],
        proximoControl ? undefined : 'Sin controles pendientes.',
      ),
      seccion('Registros', [
        dato('Vacunas', `${registros.vacunas.length} registro(s)`),
        dato('Antiparasitarios', `${registros.antiparasitarios.length} registro(s)`),
        dato('Estudios', `${registros.estudios.length} registro(s)`),
        dato('Cirugías', `${registros.cirugias.length} registro(s)`),
        dato('Visitas', `${historia.visitas.length} registro(s)`),
        dato('Adjuntos', `${historia.adjuntos.length} archivo(s)`),
      ]),
    ],
    opcionesDePaciente(paciente),
    enlacesDePaciente(paciente.id),
  );
}

function listadoDeVacunas(paciente, historia, soloUltima) {
  let vacunas = historia.registros.vacunas;

  if (soloUltima) vacunas = vacunas.slice(0, 1);

  return respuesta(
    'listado',
    soloUltima ? `Última vacuna de ${paciente.nombre}` : `Vacunas de ${paciente.nombre}`,
    vacunas.length > 0
      ? `${vacunas.length} vacuna(s) registrada(s).`
      : 'No hay vacunas registradas.',
    [
      seccion(
        'Vacunas',
        vacunas.map((vacuna) =>
          dato(
            vacuna.vacuna,
            `Aplicada el ${formatearFecha(vacuna.fechaAplicacion)}`,
            [
              vacuna.lote ? `Lote ${vacuna.lote}` : null,
              vacuna.fechaProximaDosis
                ? `Próxima dosis: ${formatearFecha(vacuna.fechaProximaDosis)}`
                : null,
              vacuna.aplicadaPorNombre ? `Aplicada por ${vacuna.aplicadaPorNombre}` : null,
            ]
              .filter(Boolean)
              .join(' · '),
          ),
        ),
        vacunas.length > 0 ? undefined : 'Sin vacunas registradas.',
      ),
    ],
    opcionesDePaciente(paciente),
    enlacesDePaciente(paciente.id),
  );
}

function listadoDeAntiparasitarios(paciente, historia, soloUltima) {
  let filas = historia.registros.antiparasitarios;

  if (soloUltima) filas = filas.slice(0, 1);

  return respuesta(
    'listado',
    soloUltima
      ? `Último antiparasitario de ${paciente.nombre}`
      : `Antiparasitarios de ${paciente.nombre}`,
    filas.length > 0
      ? `${filas.length} antiparasitario(s) registrado(s).`
      : 'No hay antiparasitarios registrados.',
    [
      seccion(
        'Antiparasitarios',
        filas.map((fila) =>
          dato(
            fila.producto,
            `${etiqueta(ETIQUETAS_ANTIPARASITARIO, fila.tipoProducto)} · Aplicado el ${formatearFecha(
              fila.fechaAplicacion,
            )}`,
            [
              fila.dosis ? `Dosis: ${fila.dosis}` : null,
              fila.fechaProxima ? `Próxima: ${formatearFecha(fila.fechaProxima)}` : null,
              fila.aplicadoPorNombre ? `Aplicado por ${fila.aplicadoPorNombre}` : null,
            ]
              .filter(Boolean)
              .join(' · '),
          ),
        ),
        filas.length > 0 ? undefined : 'Sin antiparasitarios registrados.',
      ),
    ],
    opcionesDePaciente(paciente),
    enlacesDePaciente(paciente.id),
  );
}

function listadoDeEstudios(paciente, historia, soloUltima) {
  let filas = historia.registros.estudios;

  if (soloUltima) filas = filas.slice(0, 1);

  return respuesta(
    'listado',
    soloUltima ? `Último estudio de ${paciente.nombre}` : `Estudios de ${paciente.nombre}`,
    filas.length > 0 ? `${filas.length} estudio(s) registrado(s).` : 'No hay estudios registrados.',
    [
      seccion(
        'Estudios',
        filas.map((fila) =>
          dato(
            fila.tipoEstudio,
            `${etiqueta(ETIQUETAS_ESTADO, fila.estado)} · Pedido el ${formatearFecha(
              fila.fechaPedido,
            )}`,
            [
              fila.fechaResultado ? `Resultado del ${formatearFecha(fila.fechaResultado)}` : null,
              fila.resultadoResumen,
            ]
              .filter(Boolean)
              .join(' · '),
          ),
        ),
        filas.length > 0 ? undefined : 'Sin estudios registrados.',
      ),
    ],
    opcionesDePaciente(paciente),
    enlacesDePaciente(paciente.id),
  );
}

function listadoDeCirugias(paciente, historia, soloUltima) {
  let filas = historia.registros.cirugias;

  if (soloUltima) filas = filas.slice(0, 1);

  return respuesta(
    'listado',
    soloUltima ? `Última cirugía de ${paciente.nombre}` : `Cirugías de ${paciente.nombre}`,
    filas.length > 0 ? `${filas.length} cirugía(s) registrada(s).` : 'No hay cirugías registradas.',
    [
      seccion(
        'Cirugías',
        filas.map((fila) =>
          dato(
            fila.tipoCirugia,
            `${etiqueta(ETIQUETAS_ESTADO, fila.estado)} · Programada para el ${formatearFecha(
              fila.fechaProgramada,
            )}`,
            [
              fila.cirujanoNombre ? `Cirujano: ${fila.cirujanoNombre}` : null,
              fila.notasPostoperatorio,
            ]
              .filter(Boolean)
              .join(' · '),
          ),
        ),
        filas.length > 0 ? undefined : 'Sin cirugías registradas.',
      ),
    ],
    opcionesDePaciente(paciente),
    enlacesDePaciente(paciente.id),
  );
}

function listadoDeMedicacion(paciente, historia) {
  const filas = historia.visitas.flatMap((visita) =>
    visita.medicacion.map((medicacion) => ({ ...medicacion, visita })),
  );

  return respuesta(
    'listado',
    `Medicación de ${paciente.nombre}`,
    filas.length > 0
      ? `${filas.length} medicamento(s) indicado(s).`
      : 'No hay medicación registrada.',
    [
      seccion(
        'Medicación',
        filas.map((fila) =>
          dato(
            fila.medicamento,
            [fila.dosis, fila.frecuencia].filter(Boolean).join(' · ') || 'Sin dosis indicada',
            [
              `Visita del ${formatearFechaHora(fila.visita.inicioEn)}`,
              fila.via ? `Vía ${fila.via}` : null,
              fila.duracionDias ? `${fila.duracionDias} día(s)` : null,
              fila.indicaciones,
            ]
              .filter(Boolean)
              .join(' · '),
          ),
        ),
        filas.length > 0 ? undefined : 'Sin medicación registrada.',
      ),
    ],
    opcionesDePaciente(paciente),
    enlacesDePaciente(paciente.id),
  );
}

function listadoDeVisitas(paciente, historia, soloUltima) {
  const visitas = soloUltima ? historia.visitas.slice(0, 1) : historia.visitas;

  return respuesta(
    'listado',
    soloUltima ? `Última visita de ${paciente.nombre}` : `Visitas de ${paciente.nombre}`,
    visitas.length > 0
      ? `${visitas.length} visita(s) registrada(s).`
      : 'No hay visitas registradas.',
    [
      seccion(
        'Visitas',
        visitas.map((visita) =>
          dato(
            formatearFechaHora(visita.inicioEn),
            visita.motivoConsulta ?? 'Sin motivo registrado',
            [
              `Estado: ${etiqueta(ETIQUETAS_ESTADO, visita.estado)}`,
              visita.veterinarioNombre ? `Veterinario: ${visita.veterinarioNombre}` : null,
              visita.diagnostico ? `Diagnóstico: ${visita.diagnostico}` : null,
            ]
              .filter(Boolean)
              .join(' · '),
          ),
        ),
        visitas.length > 0 ? undefined : 'Sin visitas registradas.',
      ),
    ],
    opcionesDePaciente(paciente),
    enlacesDePaciente(paciente.id),
  );
}

function listadoDeControlesDePaciente(paciente, historia, ventana) {
  const hoy = hoyEnTucuman();
  const manana = sumarUnDia(hoy);

  let controles = historia.controles;

  if (ventana === 'hoy') controles = controles.filter((control) => control.fechaControl === hoy);
  if (ventana === 'manana')
    controles = controles.filter((control) => control.fechaControl === manana);
  if (ventana === 'pendientes')
    controles = controles.filter((control) => control.estado === 'pendiente');

  return respuesta(
    'listado',
    `Controles de ${paciente.nombre}`,
    controles.length > 0
      ? `${controles.length} control(es) encontrado(s).`
      : 'No hay controles con ese criterio.',
    [
      seccion(
        'Controles',
        controles.map((control) =>
          dato(
            `${formatearFecha(control.fechaControl)} · ${etiqueta(ETIQUETAS_FRANJA, control.franja)}`,
            control.motivo ?? 'Control',
            `Estado: ${etiqueta(ETIQUETAS_ESTADO, control.estado)}`,
          ),
        ),
        controles.length > 0 ? undefined : 'Sin controles para mostrar.',
      ),
    ],
    opcionesDePaciente(paciente),
    enlacesDePaciente(paciente.id),
  );
}

function listadoDeAdjuntos(paciente, historia) {
  const adjuntos = historia.adjuntos;

  return respuesta(
    'listado',
    `Adjuntos de ${paciente.nombre}`,
    adjuntos.length > 0 ? `${adjuntos.length} archivo(s) adjunto(s).` : 'No hay adjuntos.',
    [
      seccion(
        'Adjuntos',
        adjuntos.map((adjunto) =>
          dato(
            adjunto.nombreOriginal,
            `${formatearTamano(adjunto.tamanoBytes)} · ${formatearFecha(adjunto.creadoEn)}`,
            adjunto.subidoPorNombre ? `Subido por ${adjunto.subidoPorNombre}` : null,
          ),
        ),
        adjuntos.length > 0
          ? 'Los archivos se descargan desde la ficha del paciente.'
          : 'Sin adjuntos registrados.',
      ),
    ],
    opcionesDePaciente(paciente),
    enlacesDePaciente(paciente.id),
  );
}

function formatearTamano(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function fichaDelDueno(paciente, ejecutor) {
  const clienteId = paciente.cliente?.id;
  const cliente = clienteId ? await buscarClientePorId(clienteId) : null;

  if (!cliente) {
    return sinDatos(
      'No encontré el titular',
      `La mascota ${paciente.nombre} no tiene un titular asociado.`,
    );
  }

  const mascotas = await listarPorCliente(cliente.id);
  const otras = mascotas.filter((fila) => String(fila.id) !== String(paciente.id));

  return respuesta(
    'ficha_cliente',
    `Titular de ${paciente.nombre}`,
    `${nombreCompleto(cliente)} · ${cliente.telefono_principal ?? 'Sin teléfono'}`,
    [
      seccion('Titular', [
        dato('Nombre', nombreCompleto(cliente)),
        dato('Documento', enmascararDocumento(cliente.nro_documento) || 'Sin documento'),
        dato('Teléfono principal', cliente.telefono_principal ?? 'Sin teléfono'),
        dato('Teléfono alternativo', cliente.telefono_alternativo ?? 'Sin teléfono alternativo'),
        dato('Email', cliente.email ?? 'Sin email'),
        dato('Localidad', cliente.localidad_barrio ?? 'Sin datos'),
        dato('Ficha', cliente.ficha_incompleta ? 'Incompleta' : 'Completa'),
      ]),
      seccion(
        'Otras mascotas del titular',
        otras.map((fila) =>
          dato(
            fila.nombre,
            `${fila.especie_nombre}${fila.raza_nombre ? ` · ${fila.raza_nombre}` : ''}`,
            fila.fecha_deceso ? `Fallecido el ${formatearFecha(fila.fecha_deceso)}` : 'Activo',
          ),
        ),
        otras.length > 0 ? undefined : 'No hay otras mascotas registradas.',
      ),
    ],
    ejecutor ? opcionesDePacientes([paciente, ...otras]) : [],
    enlacesDeCliente(cliente.id),
  );
}

async function responderPaciente(pacienteId, consulta, ejecutor) {
  const fila = await buscarPacientePorId(pacienteId);

  if (!fila) {
    return sinDatos(
      'No encontré la mascota',
      'La mascota indicada ya no existe o no está disponible.',
    );
  }

  const paciente = {
    id: fila.id,
    nombre: fila.nombre,
    codigoInterno: fila.codigo_interno,
    especieNombre: fila.especie_nombre,
    razaNombre: fila.raza_nombre,
    sexo: fila.sexo,
    fechaNacimiento: fila.fecha_nacimiento,
    fechaDeceso: fila.fecha_deceso,
    provisorio: fila.provisorio,
    cliente: {
      id: fila.cliente_id,
      nombreCompleto: nombreCompleto({
        nombre: fila.cliente_nombre,
        apellido: fila.cliente_apellido,
      }),
      telefonoPrincipal: fila.cliente_telefono,
    },
  };

  if (consulta.intencion === 'dueno') {
    return fichaDelDueno(paciente, ejecutor);
  }

  // Toda respuesta clínica exige el mismo permiso que la historia clínica.
  // Recepción lo tiene en modo lectura; si un rol no lo tuviera, solo se
  // muestran los datos básicos.
  if (!tienePermiso(ejecutor.rol, 'historia.ver')) {
    return respuestaSinPermisoClinico(paciente);
  }

  const historia = await obtenerHistoriaClinica(pacienteId);
  const pacienteCompleto = historia.paciente;

  switch (consulta.intencion) {
    case 'vacunas':
      return listadoDeVacunas(pacienteCompleto, historia, consulta.soloUltima);
    case 'antiparasitarios':
      return listadoDeAntiparasitarios(pacienteCompleto, historia, consulta.soloUltima);
    case 'estudios':
      return listadoDeEstudios(pacienteCompleto, historia, consulta.soloUltima);
    case 'cirugias':
      return listadoDeCirugias(pacienteCompleto, historia, consulta.soloUltima);
    case 'medicacion':
      return listadoDeMedicacion(pacienteCompleto, historia);
    case 'visitas':
      return listadoDeVisitas(pacienteCompleto, historia, consulta.soloUltima);
    case 'controles':
      return listadoDeControlesDePaciente(pacienteCompleto, historia, consulta.ventana);
    case 'adjuntos':
      return listadoDeAdjuntos(pacienteCompleto, historia);
    default:
      return resumenDePaciente(pacienteCompleto, historia);
  }
}

function datosDelTitular(cliente) {
  return [
    dato('Nombre', nombreCompleto(cliente)),
    dato('Documento', enmascararDocumento(cliente.nro_documento) || 'Sin documento'),
    dato('Teléfono principal', cliente.telefono_principal ?? 'Sin teléfono'),
    dato('Teléfono alternativo', cliente.telefono_alternativo ?? 'Sin teléfono alternativo'),
    dato('Email', cliente.email ?? 'Sin email'),
    dato('Localidad', cliente.localidad_barrio ?? 'Sin datos'),
    dato('Ficha', cliente.ficha_incompleta ? 'Incompleta' : 'Completa'),
  ];
}

function datosDeMascotas(mascotas) {
  return mascotas.map((fila) =>
    dato(
      fila.nombre,
      `${fila.especie_nombre}${fila.raza_nombre ? ` · ${fila.raza_nombre}` : ''}`,
      fila.fecha_deceso ? `Fallecido el ${formatearFecha(fila.fecha_deceso)}` : 'Activo',
    ),
  );
}

async function responderCliente(clienteId, consulta, ejecutor) {
  const cliente = await buscarClientePorId(clienteId);

  if (!cliente || cliente.fusionado_en_cliente_id) {
    return sinDatos('No encontré el titular', 'El titular indicado no está disponible.');
  }

  const mascotas = await listarPorCliente(clienteId);
  const intencionClinica = [
    'vacunas',
    'antiparasitarios',
    'estudios',
    'cirugias',
    'medicacion',
    'visitas',
    'controles',
    'adjuntos',
  ].includes(consulta.intencion);

  const titulo = intencionClinica
    ? `Mascotas de ${nombreCompleto(cliente)}`
    : `Ficha de ${nombreCompleto(cliente)}`;

  const resumen = intencionClinica
    ? 'Para consultar datos clínicos, elegí una de sus mascotas.'
    : `${mascotas.length} mascota(s) registrada(s) · ${cliente.telefono_principal ?? 'Sin teléfono'}`;

  const opciones = mascotas.slice(0, 10).map((fila) => ({
    etiqueta: `${fila.nombre} · ${fila.especie_nombre}`,
    mensaje: `@paciente:${fila.id}`,
  }));

  return respuesta(
    'ficha_cliente',
    titulo,
    resumen,
    [
      seccion('Titular', datosDelTitular(cliente)),
      seccion(
        'Mascotas',
        datosDeMascotas(mascotas),
        mascotas.length > 0 ? undefined : 'No hay mascotas registradas.',
      ),
    ],
    ejecutor ? opciones : [],
    enlacesDeCliente(cliente.id),
  );
}

function formatearControlGlobal(fila) {
  return dato(
    `${formatearFecha(fila.fecha_control)} · ${etiqueta(ETIQUETAS_FRANJA, fila.franja)}`,
    `${fila.paciente_nombre} (${fila.especie_nombre})`,
    [
      `Titular: ${`${fila.cliente_nombre} ${fila.cliente_apellido}`.trim()}`,
      fila.telefono_principal ? `Tel: ${fila.telefono_principal}` : 'Sin teléfono',
      fila.motivo,
    ]
      .filter(Boolean)
      .join(' · '),
  );
}

async function responderControlesGlobales(ventana, ejecutor) {
  if (!tienePermiso(ejecutor.rol, 'controles.ver')) {
    return respuesta(
      'sin_permiso',
      'No tenés permiso para ver controles',
      'Tu rol no incluye la consulta de controles.',
    );
  }

  const hoy = hoyEnTucuman();
  const manana = sumarUnDia(hoy);

  let desde = null;
  let hasta = null;

  if (ventana === 'hoy') desde = hasta = hoy;
  if (ventana === 'manana') desde = hasta = manana;

  const filas = await repositorio.listarControlesPendientes({ desde, hasta });

  const titulo =
    ventana === 'hoy'
      ? 'Controles pendientes de hoy'
      : ventana === 'manana'
        ? 'Controles pendientes de mañana'
        : 'Controles pendientes';

  const nota =
    'Solo lectura: se muestran los controles tal como están guardados. El asistente no cambia estados.';

  let secciones;

  if (ventana === 'hoy' || ventana === 'manana') {
    secciones = [
      seccion(
        ventana === 'hoy' ? 'Hoy' : 'Mañana',
        filas.map(formatearControlGlobal),
        filas.length > 0 ? undefined : 'No hay controles pendientes para esa fecha.',
      ),
    ];
  } else {
    const vencidos = filas.filter((fila) => fila.fecha_control < hoy);
    const deHoy = filas.filter((fila) => fila.fecha_control === hoy);
    const proximos = filas.filter((fila) => fila.fecha_control > hoy);

    secciones = [
      seccion(
        'Vencidos sin cerrar',
        vencidos.map(formatearControlGlobal),
        vencidos.length > 0 ? undefined : 'Sin controles vencidos en estado pendiente.',
      ),
      seccion(
        'Hoy',
        deHoy.map(formatearControlGlobal),
        deHoy.length > 0 ? undefined : 'Sin controles pendientes para hoy.',
      ),
      seccion(
        'Próximos',
        proximos.map(formatearControlGlobal),
        proximos.length > 0 ? undefined : 'Sin controles pendientes próximos.',
      ),
    ];
  }

  return respuesta(
    'listado_controles',
    titulo,
    `${filas.length} control(es) pendiente(s). ${nota}`,
    secciones,
    [],
    [{ texto: 'Abrir controles', href: '/controles' }],
  );
}

export async function consultar(mensaje, ejecutor) {
  const consulta = interpretar(mensaje);

  if (consulta.seleccion) {
    if (consulta.seleccion.tipo === 'cliente') {
      return responderCliente(consulta.seleccion.id, consulta, ejecutor);
    }

    return responderPaciente(consulta.seleccion.id, consulta, ejecutor);
  }

  if (consulta.intencion === 'ayuda' || !consulta.termino) {
    if (consulta.intencion === 'controles') {
      return responderControlesGlobales(consulta.ventana, ejecutor);
    }

    return ayuda();
  }

  // Las búsquedas numéricas apuntan a titulares: documento o teléfono.
  if (
    consulta.objetivo === 'cliente' ||
    ['documento', 'telefono', 'numero'].includes(consulta.tipoBusqueda)
  ) {
    const clientes = await repositorio.buscarClientes(consulta.termino);

    if (clientes.length === 1) {
      return responderCliente(clientes[0].id, consulta, ejecutor);
    }

    if (clientes.length > 1) {
      return respuesta(
        'opciones',
        'Encontré varios titulares',
        `Hay ${clientes.length} titulares que coinciden con “${consulta.termino}”. Elegí uno.`,
        [],
        opcionesDeCliente(clientes),
      );
    }

    return sinDatos(
      'No encontré coincidencias',
      `No hay titulares que coincidan con “${consulta.termino}”.`,
    );
  }

  const pacientes = await repositorio.buscarPacientes(consulta.termino);

  if (pacientes.length === 1) {
    return responderPaciente(pacientes[0].id, consulta, ejecutor);
  }

  if (pacientes.length > 1) {
    return respuesta(
      'opciones',
      'Encontré varias mascotas',
      `Hay ${pacientes.length} mascotas que coinciden con “${consulta.termino}”. Elegí una.`,
      [],
      opcionesDePacientes(pacientes),
    );
  }

  const clientes = await repositorio.buscarClientes(consulta.termino);

  if (clientes.length === 1) {
    return responderCliente(clientes[0].id, consulta, ejecutor);
  }

  if (clientes.length > 1) {
    return respuesta(
      'opciones',
      'Encontré varios titulares',
      `Hay ${clientes.length} titulares que coinciden con “${consulta.termino}”. Elegí uno.`,
      [],
      opcionesDeCliente(clientes),
    );
  }

  return sinDatos(
    'No encontré coincidencias',
    `No hay mascotas ni titulares que coincidan con “${consulta.termino}”.`,
  );
}
