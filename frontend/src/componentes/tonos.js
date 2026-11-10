// Paleta por módulo. Las clases de Tailwind se escriben completas (sin
// interpolar) para que el compilador pueda detectarlas.
export const TONOS = {
  teal: {
    cabecera: 'from-teal-600 via-teal-600 to-emerald-500',
    borde: 'border-teal-200',
    fondo: 'bg-teal-50/70',
    titulo: 'text-teal-950',
    texto: 'text-teal-800',
    chip: 'bg-teal-100 text-teal-800',
    acento: 'bg-teal-500',
  },
  sky: {
    cabecera: 'from-sky-600 via-sky-600 to-cyan-500',
    borde: 'border-sky-200',
    fondo: 'bg-sky-50/70',
    titulo: 'text-sky-950',
    texto: 'text-sky-800',
    chip: 'bg-sky-100 text-sky-800',
    acento: 'bg-sky-500',
  },
  violet: {
    cabecera: 'from-violet-600 via-violet-600 to-fuchsia-500',
    borde: 'border-violet-200',
    fondo: 'bg-violet-50/70',
    titulo: 'text-violet-950',
    texto: 'text-violet-800',
    chip: 'bg-violet-100 text-violet-800',
    acento: 'bg-violet-500',
  },
  indigo: {
    cabecera: 'from-indigo-600 via-indigo-600 to-violet-500',
    borde: 'border-indigo-200',
    fondo: 'bg-indigo-50/70',
    titulo: 'text-indigo-950',
    texto: 'text-indigo-800',
    chip: 'bg-indigo-100 text-indigo-800',
    acento: 'bg-indigo-500',
  },
  amber: {
    cabecera: 'from-amber-500 via-amber-500 to-orange-500',
    borde: 'border-amber-200',
    fondo: 'bg-amber-50/70',
    titulo: 'text-amber-950',
    texto: 'text-amber-900',
    chip: 'bg-amber-100 text-amber-900',
    acento: 'bg-amber-500',
  },
  emerald: {
    cabecera: 'from-emerald-600 via-emerald-600 to-teal-500',
    borde: 'border-emerald-200',
    fondo: 'bg-emerald-50/70',
    titulo: 'text-emerald-950',
    texto: 'text-emerald-800',
    chip: 'bg-emerald-100 text-emerald-800',
    acento: 'bg-emerald-500',
  },
  rose: {
    cabecera: 'from-rose-600 via-rose-600 to-pink-500',
    borde: 'border-rose-200',
    fondo: 'bg-rose-50/70',
    titulo: 'text-rose-950',
    texto: 'text-rose-800',
    chip: 'bg-rose-100 text-rose-800',
    acento: 'bg-rose-500',
  },
  cyan: {
    cabecera: 'from-cyan-600 via-cyan-600 to-sky-500',
    borde: 'border-cyan-200',
    fondo: 'bg-cyan-50/70',
    titulo: 'text-cyan-950',
    texto: 'text-cyan-800',
    chip: 'bg-cyan-100 text-cyan-800',
    acento: 'bg-cyan-500',
  },
  orange: {
    cabecera: 'from-orange-500 via-orange-500 to-amber-500',
    borde: 'border-orange-200',
    fondo: 'bg-orange-50/70',
    titulo: 'text-orange-950',
    texto: 'text-orange-800',
    chip: 'bg-orange-100 text-orange-800',
    acento: 'bg-orange-500',
  },
  slate: {
    cabecera: 'from-slate-700 via-slate-700 to-slate-500',
    borde: 'border-slate-200',
    fondo: 'bg-slate-50/80',
    titulo: 'text-slate-950',
    texto: 'text-slate-700',
    chip: 'bg-slate-200 text-slate-800',
    acento: 'bg-slate-500',
  },
  purple: {
    cabecera: 'from-purple-600 via-purple-600 to-indigo-500',
    borde: 'border-purple-200',
    fondo: 'bg-purple-50/70',
    titulo: 'text-purple-950',
    texto: 'text-purple-800',
    chip: 'bg-purple-100 text-purple-800',
    acento: 'bg-purple-500',
  },
};

export function resolverTono(tono) {
  return TONOS[tono] ?? TONOS.teal;
}

// Botón pensado para ir sobre el degradado de EncabezadoPagina.
export const claseBotonEncabezado =
  'rounded-lg border border-white/40 bg-white/15 px-3 py-2 text-sm font-medium text-white backdrop-blur-sm hover:bg-white/25 disabled:opacity-60';

// Botón principal sobre el degradado: fondo blanco y texto oscuro.
export const claseBotonEncabezadoSolido =
  'rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-100 disabled:opacity-60';
