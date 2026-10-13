import { el } from '../../shared/dom.js';
import { t } from '../../shared/i18n.js';
import { EXTENSION_PRODUCTO, PATRON_IMAGEN, RUTAS } from '../config.js';
import { etiquetaEspera } from '../servicios/semaforo.js';
import { itemsDe, textoItem } from './lista-items.js';

function modoDe(total) {
  if (total <= 3) return 'grande';
  if (total <= 6) return 'medio';
  if (total <= 12) return 'chico';
  return 'lista';
}

function construirContenido(items) {
  const modo = modoDe(items.length);
  if (modo === 'lista') {
    return el('ul', { clase: 'activo__items activo__items--lista' }, items.map(item => el('li', { texto: textoItem(item) })));
  }
  return el('div', { clase: 'activo__items activo__items--' + modo }, items.map(construirItem));
}

function construirFotoVacia() {
  const icono = el('img', { clase: 'activo__icono', src: RUTAS.iconoBandeja, alt: '', draggable: 'false' });
  icono.addEventListener('error', () => icono.remove());
  return el('div', { clase: 'activo__foto activo__foto--vacia' }, icono);
}

function construirFoto(item) {
  if (typeof item.imagen !== 'string' || !PATRON_IMAGEN.test(item.imagen)) return construirFotoVacia();
  const foto = el('img', {
    clase: 'activo__foto',
    src: RUTAS.productos + item.imagen + EXTENSION_PRODUCTO,
    alt: '',
    draggable: 'false'
  });
  foto.addEventListener('error', () => foto.replaceWith(construirFotoVacia()));
  return foto;
}

function construirItem(item) {
  return el(
    'figure',
    { clase: 'activo__item' },
    construirFoto(item),
    el('figcaption', { clase: 'activo__nombre', texto: textoItem(item) })
  );
}

export function construirPanelActivo(pedido, { minutos, nivel, deshabilitado, alListo, alCancelar, alDevolver }) {
  return el(
    'article',
    { clase: 'activo activo--' + nivel },
    el(
      'div',
      { clase: 'activo__cabecera' },
      el(
        'button',
        {
          type: 'button',
          clase: 'activo__devolver',
          disabled: deshabilitado,
          onclick: () => alDevolver(pedido)
        },
        el('span', { clase: 'icono icono--retroceder', 'aria-hidden': 'true' }),
        el('span', { texto: t('accion_devolver') })
      ),
      el('span', { clase: 'activo__numero', texto: String(pedido.numero) }),
      el('span', { clase: 'activo__espera', texto: etiquetaEspera(minutos) })
    ),
    construirContenido(itemsDe(pedido)),
    el(
      'div',
      { clase: 'activo__acciones' },
      el(
        'button',
        { type: 'button', clase: 'accion', disabled: deshabilitado, onclick: () => alListo(pedido) },
        el('span', { texto: t('accion_listo') }),
        el('span', { clase: 'icono icono--check', 'aria-hidden': 'true' })
      ),
      el(
        'button',
        { type: 'button', clase: 'accion accion--contorno', disabled: deshabilitado, onclick: () => alCancelar(pedido) },
        el('span', { texto: t('accion_cancelar') }),
        el('span', { clase: 'icono icono--equis', 'aria-hidden': 'true' })
      )
    )
  );
}