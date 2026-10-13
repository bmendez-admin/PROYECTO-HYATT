import { el, imagen } from '../../shared/dom.js';
import { t } from '../../shared/i18n.js';
import { RUTAS } from '../config.js';

export function construirMarcoAcceso() {
  const tarjeta = el(
    'div',
    { clase: 'acceso__tarjeta' },
    el('h1', { clase: 'acceso__titulo', texto: t('acceso_titulo') })
  );
  const nodo = el(
    'section',
    { clase: 'pantalla pantalla--acceso' },
    el('div', { clase: 'acceso__fondo', 'aria-hidden': 'true' }),
    imagen(RUTAS.logoColor, { clase: 'acceso__logo', contener: true, alt: 'Breathless Resorts & Spas' }),
    tarjeta
  );
  return { nodo, tarjeta };
}