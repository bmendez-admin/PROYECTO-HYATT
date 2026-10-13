import { el, imagen } from '../../shared/dom.js';
import { RUTAS } from '../config.js';

function iconosDe(chef) {
  return RUTAS.iconosChef[chef.avatar === 'm' ? 'm' : 'h'];
}

export function construirTarjetaChef(chef, { seleccionada, bloqueada, etiqueta, alElegir }) {
  const iconos = iconosDe(chef);
  return el(
    'button',
    {
      type: 'button',
      clase:
        'tarjeta-chef' + (seleccionada ? ' tarjeta-chef--activa' : '') + (bloqueada ? ' tarjeta-chef--bloqueada' : ''),
      'aria-pressed': seleccionada ? 'true' : 'false',
      'aria-disabled': bloqueada ? 'true' : null,
      onclick: () => {
        if (!bloqueada) alElegir(chef);
      }
    },
    el('span', { clase: 'tarjeta-chef__nombre', texto: chef.nombre }),
    imagen(seleccionada ? iconos.activo : iconos.normal, { clase: 'tarjeta-chef__icono', contener: true }),
    bloqueada ? el('span', { clase: 'tarjeta-chef__etiqueta', texto: etiqueta }) : null
  );
}

export function construirAvatarChef(chef) {
  return el(
    'div',
    { clase: 'tarjeta-chef tarjeta-chef--activa tarjeta-chef--grande' },
    el('span', { clase: 'tarjeta-chef__nombre', texto: chef.nombre }),
    imagen(iconosDe(chef).activo, { clase: 'tarjeta-chef__icono', contener: true })
  );
}