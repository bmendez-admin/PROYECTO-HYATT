import { el } from '../../shared/dom.js';
import { texto } from '../textos.js';

export function construirBloque({ tipo, icono, claveTitulo }) {
  const rejilla = el('div', { clase: 'bloque__rejilla' });
  const mas = el('p', { clase: 'bloque__mas', hidden: true });
  const vacio = el(
    'p',
    { clase: 'bloque__vacio' },
    el('span', { texto: texto('vacio', 'es') }),
    el('span', { clase: 'bloque__vacio-en', lang: 'en', texto: texto('vacio', 'en') })
  );
  const nodo = el(
    'section',
    { clase: 'bloque bloque--' + tipo },
    el(
      'header',
      { clase: 'bloque__barra' },
      el('img', { clase: 'bloque__icono', src: icono, alt: '', draggable: 'false' }),
      el(
        'h2',
        { clase: 'bloque__titulo' },
        el('span', { clase: 'bloque__titulo-es', texto: texto(claveTitulo, 'es') }),
        el('span', { clase: 'bloque__titulo-en', lang: 'en', texto: texto(claveTitulo, 'en') })
      )
    ),
    el('div', { clase: 'bloque__cuerpo' }, vacio, rejilla, mas)
  );
  return { nodo, rejilla, mas, vacio };
}

export function pintarMas(mas, cantidad) {
  if (cantidad <= 0) {
    mas.hidden = true;
    return;
  }
  mas.hidden = false;
  mas.textContent = '+ ' + cantidad + ' ' + texto('mas', 'es') + ' / ' + texto('mas', 'en');
}