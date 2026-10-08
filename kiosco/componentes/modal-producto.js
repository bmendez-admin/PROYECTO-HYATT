import { el } from '../../shared/dom.js';
import { t, textoLocalizado } from '../../shared/i18n.js';
import { construirLienzo } from './tarjeta-producto.js';

const DURACION_AVISO_MS = 2500;

export function construirModalProducto(producto, { alOrdenar, alCerrar }) {
  const agotado = producto.agotado === true;
  const nombre = textoLocalizado(producto, 'nombre');
  const descripcion = textoLocalizado(producto, 'descripcion');
  const aviso = el('p', { clase: 'modal__aviso', role: 'status', hidden: true });
  let temporizador = null;

  const avisar = texto => {
    clearTimeout(temporizador);
    aviso.textContent = texto;
    aviso.hidden = false;
    temporizador = setTimeout(() => {
      aviso.hidden = true;
    }, DURACION_AVISO_MS);
  };

  const volver = el(
    'button',
    { type: 'button', clase: 'boton modal__boton modal__volver', onclick: alCerrar },
    el('span', { clase: 'modal__chevron modal__chevron--atras', 'aria-hidden': 'true' }),
    el('span', { texto: t('volver') })
  );

  const ordenar = el(
    'button',
    {
      type: 'button',
      clase: 'boton modal__boton modal__ordenar',
      'aria-disabled': agotado ? 'true' : null,
      onclick: alOrdenar
    },
    el('span', { texto: t('ordenar') }),
    el('span', { clase: 'modal__chevron', 'aria-hidden': 'true' })
  );

  const foto = el(
    'div',
    { clase: 'modal__foto' },
    construirLienzo(producto),
    agotado ? el('span', { clase: 'tarjeta__agotado', texto: t('agotado') }) : null
  );

  const cuerpo = el(
    'div',
    { clase: 'modal__cuerpo' },
    el('h2', { clase: 'modal__titulo', id: 'modal-titulo', texto: nombre + ':' }),
    descripcion ? el('p', { clase: 'modal__descripcion', texto: descripcion }) : null
  );

  const tarjeta = el(
    'div',
    {
      clase: 'modal__tarjeta',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'modal-titulo'
    },
    foto,
    cuerpo,
    el('div', { clase: 'modal__acciones' }, volver, ordenar)
  );

  const nodo = el('div', { clase: 'modal' }, tarjeta, aviso);

  return { nodo, avisar };
}