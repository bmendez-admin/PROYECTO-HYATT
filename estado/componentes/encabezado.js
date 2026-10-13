import { el, imagen } from '../../shared/dom.js';
import { RUTAS } from '../config.js';
import { texto } from '../textos.js';

function dos(numero) {
  return String(numero).padStart(2, '0');
}

export function formatoHora(fecha) {
  const horas = fecha.getHours();
  const sufijo = horas >= 12 ? texto('pm', 'es') : texto('am', 'es');
  return dos(horas % 12 || 12) + ':' + dos(fecha.getMinutes()) + ' ' + sufijo;
}

export function formatoFecha(fecha) {
  return dos(fecha.getDate()) + '/' + dos(fecha.getMonth() + 1) + '/' + fecha.getFullYear();
}

export function construirEncabezado() {
  const hora = el('span', { clase: 'encabezado__hora' });
  const fecha = el('span', { clase: 'encabezado__fecha' });
  const nodo = el(
    'header',
    { clase: 'encabezado' },
    imagen(RUTAS.logoColor, { clase: 'encabezado__logo', contener: true, alt: 'Breathless Resorts & Spas' }),
    el(
      'h1',
      { clase: 'encabezado__titulo' },
      el('span', { clase: 'encabezado__titulo-es', texto: texto('titulo', 'es') }),
      el('span', { clase: 'encabezado__titulo-en', lang: 'en', texto: texto('titulo', 'en') })
    ),
    el('div', { clase: 'encabezado__reloj' }, hora, fecha)
  );
  return { nodo, hora, fecha };
}