import { el } from '../../shared/dom.js';
import { t, textoLocalizado } from '../../shared/i18n.js';
import { EXTENSION_PRODUCTO, PATRON_IMAGEN, RUTAS } from '../config.js';

function construirIcono() {
  const icono = el('img', { clase: 'tarjeta__icono', src: RUTAS.iconoOrden, alt: '', draggable: 'false' });
  icono.addEventListener('error', () => icono.remove());
  return icono;
}

function construirLienzo(producto) {
  const lienzo = el('div', { clase: 'tarjeta__lienzo' });
  if (typeof producto.imagen !== 'string' || !PATRON_IMAGEN.test(producto.imagen)) {
    lienzo.append(construirIcono());
    return lienzo;
  }
  const foto = el('img', {
    clase: 'tarjeta__img',
    src: RUTAS.productos + producto.imagen + EXTENSION_PRODUCTO,
    alt: '',
    draggable: 'false'
  });
  foto.addEventListener('error', () => foto.replaceWith(construirIcono()));
  lienzo.append(foto);
  return lienzo;
}

export function construirTarjetaProducto(producto, { alAgregar }) {
  const agotado = producto.agotado === true;
  const nombre = textoLocalizado(producto, 'nombre');
  return el(
    'article',
    { clase: 'tarjeta' + (agotado ? ' tarjeta--agotada' : '') },
    el(
      'div',
      { clase: 'tarjeta__foto' },
      construirLienzo(producto),
      agotado ? el('span', { clase: 'tarjeta__agotado', texto: t('agotado') }) : null,
      el(
        'button',
        {
          type: 'button',
          clase: 'tarjeta__agregar',
          'aria-label': t('agregar') + ' ' + nombre,
          disabled: agotado,
          onclick: () => alAgregar(producto)
        },
        el('span', { clase: 'tarjeta__mas', 'aria-hidden': 'true' })
      )
    ),
    el('h2', { clase: 'tarjeta__nombre' }, el('span', { clase: 'tarjeta__nombre-texto', texto: nombre }))
  );
}