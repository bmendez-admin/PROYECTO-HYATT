import { el, imagen } from '../../shared/dom.js';
import { t } from '../../shared/i18n.js';
import { RUTAS } from '../config.js';

export function construirEncabezadoPrincipal({ chef, alPausar, alFinalizar }) {
  const iconos = RUTAS.iconosChef[chef.avatar === 'm' ? 'm' : 'h'];
  const botonPausa = el(
    'button',
    { type: 'button', clase: 'accion principal__break', onclick: alPausar },
    el('span', { clase: 'icono icono--break', 'aria-hidden': 'true' }),
    el('span', { texto: t('principal_break') })
  );
  const botonFinalizar = el(
    'button',
    { type: 'button', clase: 'accion accion--oscura principal__finalizar', onclick: alFinalizar },
    el('span', { clase: 'icono icono--gorro', 'aria-hidden': 'true' }),
    el('span', { texto: t('principal_finalizar') })
  );
  const banner = el('p', { clase: 'principal__sin-conexion', role: 'status', texto: t('sin_conexion'), hidden: true });
  const nodo = el(
    'header',
    { clase: 'principal__encabezado' },
    el('div', { clase: 'principal__banda' }),
    el('div', { clase: 'principal__tab principal__tab--izq' }),
    el('div', { clase: 'principal__tab principal__tab--der' }),
    el(
      'div',
      { clase: 'principal__chef' },
      imagen(iconos.activo, { clase: 'principal__chef-icono', contener: true }),
      el('span', { clase: 'principal__chef-nombre', texto: chef.nombre })
    ),
    botonPausa,
    botonFinalizar,
    imagen(RUTAS.logoColor, { clase: 'principal__logo', contener: true, alt: 'Breathless Resorts & Spas' }),
    banner
  );
  return { nodo, botonPausa, botonFinalizar, banner };
}