import { el } from '../../shared/dom.js';
import { t } from '../../shared/i18n.js';
import { LIMITE_ITEMS_DESPACHO } from '../config.js';
import { construirListaItems } from './lista-items.js';

export function construirTarjetaDespacho(pedido, { deshabilitado, alDespachar }) {
  return el(
    'article',
    { clase: 'tarjeta-despacho' },
    el(
      'div',
      { clase: 'tarjeta-fila__cabecera' },
      el('span', { clase: 'tarjeta-fila__numero', texto: String(pedido.numero) }),
      el(
        'button',
        {
          type: 'button',
          clase: 'accion accion--chica accion--oscura',
          disabled: deshabilitado,
          onclick: () => alDespachar(pedido)
        },
        el('span', { texto: t('accion_despachar') }),
        el('span', { clase: 'icono icono--bandeja', 'aria-hidden': 'true' })
      )
    ),
    construirListaItems(pedido, 'tarjeta-fila__items', LIMITE_ITEMS_DESPACHO)
  );
}