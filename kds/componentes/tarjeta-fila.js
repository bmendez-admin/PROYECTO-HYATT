import { el } from '../../shared/dom.js';
import { t } from '../../shared/i18n.js';
import { etiquetaEspera } from '../servicios/semaforo.js';
import { LIMITE_ITEMS_FILA } from '../config.js';
import { construirListaItems } from './lista-items.js';

export function construirTarjetaFila(pedido, { minutos, nivel, deshabilitado, alComenzar }) {
  return el(
    'article',
    { clase: 'tarjeta-fila tarjeta-fila--' + nivel },
    el(
      'div',
      { clase: 'tarjeta-fila__cabecera' },
      el('span', { clase: 'tarjeta-fila__numero', texto: String(pedido.numero) }),
      el(
        'button',
        {
          type: 'button',
          clase: 'accion accion--chica',
          disabled: deshabilitado,
          onclick: () => alComenzar(pedido)
        },
        el('span', { texto: t('accion_comenzar') }),
        el('span', { clase: 'icono icono--avanzar', 'aria-hidden': 'true' })
      )
    ),
    construirListaItems(pedido, 'tarjeta-fila__items', LIMITE_ITEMS_FILA),
    el('span', { clase: 'tarjeta-fila__espera', texto: etiquetaEspera(minutos) })
  );
}