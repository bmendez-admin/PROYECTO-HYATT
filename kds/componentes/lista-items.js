import { el } from '../../shared/dom.js';
import { t } from '../../shared/i18n.js';

export function itemsDe(pedido) {
  return Array.isArray(pedido.items) ? pedido.items : [];
}

export function textoItem(item) {
  const nombre = typeof item.nombre_es === 'string' ? item.nombre_es : '';
  const texto = item.cantidad + ' x ' + nombre;
  return /[.!?]$/.test(texto) ? texto : texto + '.';
}

export function construirListaItems(pedido, clase, limite = Infinity) {
  const items = itemsDe(pedido);
  const visibles = items.length > limite ? items.slice(0, limite) : items;
  const nodos = visibles.map(item => el('li', { texto: textoItem(item) }));
  if (visibles.length < items.length) {
    nodos.push(el('li', { clase: 'lista-items__mas', texto: '+ ' + (items.length - visibles.length) + ' ' + t('items_mas') }));
  }
  return el('ul', { clase }, nodos);
}