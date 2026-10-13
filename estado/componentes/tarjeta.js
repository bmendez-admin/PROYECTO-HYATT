import { el } from '../../shared/dom.js';
import { texto } from '../textos.js';

function claseDe(item, tipo) {
  const clases = ['tarjeta'];
  if (tipo === 'listo') {
    clases.push('tarjeta--listo');
    if (item.nuevo) clases.push('tarjeta--nueva');
  } else {
    clases.push(item.tenue ? 'tarjeta--espera' : 'tarjeta--preparando');
    if (item.saliendo) clases.push('tarjeta--saliendo');
  }
  return clases.join(' ');
}

export function construirTarjeta(item, tipo) {
  const clave = tipo === 'listo' ? 'disfruta' : 'paciencia';
  return el(
    'article',
    { clase: claseDe(item, tipo), 'data-numero': String(item.numero) },
    el('span', { clase: 'tarjeta__numero', texto: String(item.numero) }),
    el(
      'p',
      { clase: 'tarjeta__texto' },
      el('span', { clase: 'tarjeta__es', texto: texto(clave, 'es') }),
      el('span', { clase: 'tarjeta__en', lang: 'en', texto: texto(clave, 'en') })
    )
  );
}

export function actualizarTarjeta(nodo, item, tipo) {
  const clase = claseDe(item, tipo);
  if (nodo.className !== clase) nodo.className = clase;
}