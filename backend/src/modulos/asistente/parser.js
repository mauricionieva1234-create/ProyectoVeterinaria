// Parser local y determinista del asistente. No hay IA externa: se reconocen
// palabras clave y se extrae un término de búsqueda. Ante la duda, el asistente
// devuelve ayuda o pide elegir una opción, nunca inventa datos.

const INTENCIONES = [
  {
    clave: 'controles',
    palabras: [
      'control',
      'controles',
      'recordatorio',
      'recordatorios',
      'turno',
      'turnos',
      'pendiente',
      'pendientes',
    ],
  },
  {
    clave: 'vacunas',
    palabras: ['vacuna', 'vacunas', 'vacunacion', 'vacunaciones', 'vacunado', 'vacunada'],
  },
  {
    clave: 'antiparasitarios',
    palabras: [
      'antiparasitario',
      'antiparasitarios',
      'desparasitacion',
      'desparasitar',
      'antipulgas',
      'pipeta',
    ],
  },
  {
    clave: 'estudios',
    palabras: [
      'estudio',
      'estudios',
      'analisis',
      'laboratorio',
      'radiografia',
      'ecografia',
      'placa',
    ],
  },
  {
    clave: 'cirugias',
    palabras: ['cirugia', 'cirugias', 'operacion', 'operaciones', 'operado', 'operada'],
  },
  {
    clave: 'medicacion',
    palabras: [
      'medicacion',
      'medicamento',
      'medicamentos',
      'receta',
      'recetas',
      'tratamiento',
      'tratamientos',
    ],
  },
  {
    clave: 'adjuntos',
    palabras: ['adjunto', 'adjuntos', 'archivo', 'archivos'],
  },
  {
    clave: 'dueno',
    palabras: ['dueno', 'duenos', 'duena', 'titular', 'titulares', 'propietario', 'propietaria'],
  },
  {
    clave: 'visitas',
    palabras: [
      'visita',
      'visitas',
      'atencion',
      'atenciones',
      'consulta',
      'consultas',
      'ultima',
      'ultimo',
      'ultimas',
      'ultimos',
    ],
  },
  {
    clave: 'cliente',
    palabras: ['cliente', 'clientes'],
  },
  {
    clave: 'resumen',
    palabras: ['resumen', 'historia', 'ficha', 'panorama', 'informacion', 'datos', 'todo'],
  },
];

const PALABRAS_INTENCION = new Set(INTENCIONES.flatMap((intencion) => intencion.palabras));

// Palabras que no aportan al nombre buscado. Se quitan del término.
const IGNORADAS = new Set([
  ...PALABRAS_INTENCION,
  'a',
  'al',
  'algo',
  'algun',
  'alguna',
  'algunas',
  'algunos',
  'animal',
  'animales',
  'ante',
  'ayuda',
  'ayudame',
  'buenas',
  'buenos',
  'busca',
  'buscame',
  'buscar',
  'como',
  'con',
  'cuando',
  'cuanta',
  'cuantas',
  'cuanto',
  'cuantos',
  'de',
  'del',
  'desde',
  'dias',
  'dime',
  'donde',
  'el',
  'en',
  'entre',
  'era',
  'es',
  'esa',
  'ese',
  'eso',
  'esta',
  'estan',
  'este',
  'esto',
  'favor',
  'fue',
  'gata',
  'gato',
  'gracias',
  'hay',
  'hola',
  // "hoy" y "mañana" son ventanas de fecha, no parte del nombre buscado.
  'hoy',
  'la',
  'las',
  'lo',
  'los',
  'manana',
  'mascota',
  'mascotas',
  'me',
  'mi',
  'mis',
  'mostra',
  'mostrame',
  'mostrar',
  'muestra',
  'muestrame',
  'necesito',
  'o',
  'paciente',
  'pacientes',
  'para',
  'pero',
  'perra',
  'perro',
  'por',
  'porfavor',
  'que',
  'quien',
  'quienes',
  'quiero',
  'saber',
  'se',
  'sin',
  'sobre',
  'su',
  'sus',
  'te',
  'tiene',
  'tienen',
  'toda',
  'todas',
  'todos',
  'tu',
  'tus',
  'un',
  'una',
  'unas',
  'unos',
  'ver',
  'y',
  'ya',
]);

// Minúsculas y sin tildes, para que "vacunación" y "vacunacion" sean iguales.
export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9@:+.\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function palabrasDe(texto) {
  return new Set(normalizar(texto).split(' ').filter(Boolean));
}

function detectarIntencion(palabras) {
  for (const intencion of INTENCIONES) {
    if (intencion.palabras.some((palabra) => palabras.has(palabra))) {
      return intencion.clave;
    }
  }

  return null;
}

// Los botones de opción envían un mensaje interno como "@paciente:12". Así el
// asistente resuelve la opción por id sin exponer documentos ni depender de
// nombres repetidos.
function detectarSeleccion(texto) {
  const coincidencia = String(texto ?? '')
    .trim()
    .match(/^@(paciente|cliente):(\d+)$/i);

  if (!coincidencia) return null;

  return {
    tipo: coincidencia[1].toLowerCase(),
    id: Number(coincidencia[2]),
  };
}

function buscarNumero(texto, etiquetas) {
  const grupo = etiquetas.join('|');
  const coincidencia = texto.match(
    new RegExp(`\\b(?:${grupo})\\b[^0-9+]{0,15}([+0-9][0-9.\\s-]{4,})`),
  );

  if (!coincidencia) return null;

  const limpio = coincidencia[1].replace(/[^\d+]/g, '');
  const digitos = limpio.replace(/\D/g, '');

  return digitos.length >= 5 ? digitos : null;
}

function buscarCodigoPaciente(texto) {
  const coincidencia = texto.match(/\bpac[\s-]+(\d{1,})\b/);
  if (!coincidencia) return null;

  return `PAC-${coincidencia[1].padStart(6, '0')}`;
}

// Si el mensaje es solo un número, se busca en documento y teléfono a la vez.
function buscarNumeroSuelto(texto) {
  const coincidencia = texto.match(/\b(\d[\d.\s-]{4,})\b/);
  if (!coincidencia) return null;

  const digitos = coincidencia[1].replace(/\D/g, '');
  return digitos.length >= 5 ? digitos : null;
}

function limpiarTermino(texto) {
  const termino = normalizar(texto)
    .split(' ')
    .filter((palabra) => palabra.length >= 2 && !IGNORADAS.has(palabra))
    .join(' ')
    .trim();

  return termino;
}

export function interpretar(mensaje) {
  const original = String(mensaje ?? '').trim();
  const seleccion = detectarSeleccion(original);

  if (seleccion) {
    return {
      intencion: 'resumen',
      termino: '',
      tipoBusqueda: 'texto',
      ventana: null,
      soloUltima: false,
      objetivo: 'paciente',
      seleccion,
    };
  }

  const texto = normalizar(original);
  const palabras = palabrasDe(texto);
  const intencion = detectarIntencion(palabras);

  let termino;
  let tipoBusqueda = 'texto';

  const documento = buscarNumero(texto, ['documento', 'dni', 'doc', 'libreta']);
  const telefono = buscarNumero(texto, ['telefono', 'tel', 'celular', 'cel', 'whatsapp']);
  const codigo = buscarCodigoPaciente(texto);

  if (documento) {
    termino = documento;
    tipoBusqueda = 'documento';
  } else if (telefono) {
    termino = telefono;
    tipoBusqueda = 'telefono';
  } else if (codigo) {
    termino = codigo;
    tipoBusqueda = 'codigo';
  } else {
    const numeroSuelto = buscarNumeroSuelto(texto);

    if (numeroSuelto && palabras.size <= 3) {
      termino = numeroSuelto;
      tipoBusqueda = 'numero';
    } else {
      termino = limpiarTermino(texto);
    }
  }

  const ventana = palabras.has('manana')
    ? 'manana'
    : palabras.has('hoy')
      ? 'hoy'
      : palabras.has('pendiente') || palabras.has('pendientes')
        ? 'pendientes'
        : null;

  // "mascotas de Demo" o "animales de Demo" buscan al titular, no a una
  // mascota llamada Demo. Si hay una intención clínica, manda la mascota.
  const buscaMascotasDeUnTitular =
    !intencion && (palabras.has('mascotas') || palabras.has('animales'));

  const objetivo = intencion === 'cliente' || buscaMascotasDeUnTitular ? 'cliente' : 'paciente';

  return {
    intencion: intencion ?? (termino ? 'resumen' : 'ayuda'),
    termino,
    tipoBusqueda,
    ventana,
    soloUltima: ['ultima', 'ultimo', 'ultimas', 'ultimos'].some((palabra) => palabras.has(palabra)),
    objetivo,
    seleccion: null,
  };
}
