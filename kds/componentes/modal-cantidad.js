import { el } from '../../shared/dom.js';
import { t } from '../../shared/i18n.js';
import { ATAJOS_CANTIDAD, CANTIDAD_MAX, CANTIDAD_MIN } from '../config.js';

export function construirModalCantidad({ tipo, producto, valor, deshabilitado, alCambiar, alConfirmar, alCancelar }) {
  const esRelleno = tipo === 'relleno';
  const stock = Number(producto.stock_actual);
  return el(
    'div',
    { clase: 'modal', role: 'dialog', 'aria-modal': 'true' },
    el(
      'div',
      { clase: 'modal__tarjeta modal__tarjeta--cantidad' },
      el('h2', { clase: 'modal__titulo', texto: t(esRelleno ? 'cantidad_titulo_relleno' : 'cantidad_titulo_reabasto') }),
      el('p', { clase: 'cantidad__producto', texto: producto.nombre_es }),
      el(
        'div',
        { clase: 'cantidad__control' },
        el('button', {
          type: 'button',
          clase: 'accion accion--oscura cantidad__paso',
          disabled: deshabilitado || valor <= CANTIDAD_MIN,
          'aria-label': t('cantidad_menos'),
          texto: '−',
          onclick: () => alCambiar(valor - 1)
        }),
        el('output', { clase: 'cantidad__valor', 'aria-live': 'polite', texto: String(valor) }),
        el('button', {
          type: 'button',
          clase: 'accion accion--oscura cantidad__paso',
          disabled: deshabilitado || valor >= CANTIDAD_MAX,
          'aria-label': t('cantidad_mas'),
          texto: '+',
          onclick: () => alCambiar(valor + 1)
        })
      ),
      el(
        'div',
        { clase: 'cantidad__atajos' },
        ATAJOS_CANTIDAD.map(atajo =>
          el('button', {
            type: 'button',
            clase: 'modal__motivo',
            disabled: deshabilitado || valor >= CANTIDAD_MAX,
            texto: '+' + atajo,
            onclick: () => alCambiar(valor + atajo)
          })
        )
      ),
      el('p', { clase: 'modal__subtitulo cantidad__ayuda', texto: t(esRelleno ? 'cantidad_ayuda_relleno' : 'cantidad_ayuda_reabasto') }),
      el(
        'p',
        { clase: 'cantidad__resumen' },
        t('cantidad_stock_actual') + ' ',
        el('strong', { texto: String(stock) }),
        esRelleno ? '  →  ' + t('cantidad_quedara') + ' ' : null,
        esRelleno ? el('strong', { texto: String(stock + valor) }) : null
      ),
      el(
        'div',
        { clase: 'modal__botones' },
        el(
          'button',
          { type: 'button', clase: 'accion accion--secundaria', disabled: deshabilitado, onclick: alCancelar },
          el('span', { clase: 'icono icono--retroceder', 'aria-hidden': 'true' }),
          el('span', { texto: t('cantidad_cancelar') })
        ),
        el(
          'button',
          { type: 'button', clase: 'accion', disabled: deshabilitado, onclick: alConfirmar },
          el('span', { texto: t(esRelleno ? 'cantidad_confirmar_relleno' : 'cantidad_confirmar_reabasto') }),
          el('span', { clase: 'icono icono--avanzar', 'aria-hidden': 'true' })
        )
      )
    )
  );
}