import { el, imagen } from '../../shared/dom.js';
import { t } from '../../shared/i18n.js';
import { RUTAS } from '../config.js';
import { construirSelectorIdioma } from './selector-idioma.js';

function construirBotonVolver(alVolver) {
  return el(
    'button',
    { type: 'button', clase: 'encabezado__volver', onclick: alVolver },
    el('span', { clase: 'encabezado__volver-icono', 'aria-hidden': 'true' }),
    el('span', { texto: t('volver') })
  );
}

export function construirEncabezado(opciones = {}) {
  const selector = opciones.idioma === false ? null : construirSelectorIdioma('banda');
  const volver = typeof opciones.alVolver === 'function' ? construirBotonVolver(opciones.alVolver) : null;
  return el(
    'div',
    { clase: 'zona-encabezado encabezado' },
    el('div', { clase: 'encabezado__banda' }),
    selector,
    volver,
    imagen(RUTAS.logoColor, { clase: 'encabezado__logo', contener: true, alt: 'Hyatt Breathless' })
  );
}