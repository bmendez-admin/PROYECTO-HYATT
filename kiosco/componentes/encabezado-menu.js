import { el, imagen } from '../../shared/dom.js';
import { t } from '../../shared/i18n.js';
import { RUTAS } from '../config.js';
import { sesion } from '../estado.js';
import { construirInterruptorIdioma } from './interruptor-idioma.js';

function dosDigitos(numero) {
  return String(numero).padStart(2, '0');
}

function horaActual() {
  const ahora = new Date();
  return dosDigitos(ahora.getHours()) + ' : ' + dosDigitos(ahora.getMinutes());
}

function textoUbicacion() {
  const datos = sesion.identificacion;
  const partes = [];
  if (datos.edificio) partes.push(t('menu_edificio') + ' ' + String(datos.edificio).toUpperCase());
  if (datos.habitacion) partes.push(t('menu_habitacion') + ' ' + datos.habitacion);
  return partes.join(' · ');
}

function construirBotonVolver(alVolver) {
  return el(
    'button',
    { type: 'button', clase: 'encabezado__atras', onclick: alVolver },
    el('span', { clase: 'encabezado__atras-icono', 'aria-hidden': 'true' }),
    el('span', { clase: 'encabezado__atras-texto', texto: t('volver') })
  );
}

export function construirEncabezadoMenu({ alVolver }) {
  const hora = el('span', { clase: 'encabezado__hora', texto: horaActual() });
  const nodo = el(
    'div',
    { clase: 'zona-encabezado encabezado encabezado--menu' },
    el('div', { clase: 'encabezado__banda' }),
    construirBotonVolver(alVolver),
    construirInterruptorIdioma(),
    el('span', { clase: 'encabezado__division', 'aria-hidden': 'true' }),
    el(
      'div',
      { clase: 'encabezado__ubicacion' },
      el('span', { clase: 'encabezado__lugar', texto: textoUbicacion() }),
      hora
    ),
    imagen(RUTAS.logoColor, { clase: 'encabezado__logo', contener: true, alt: 'Hyatt Breathless' })
  );

  function programar() {
    const espera = 60000 - (Date.now() % 60000) + 50;
    setTimeout(() => {
      if (!nodo.isConnected) return;
      hora.textContent = horaActual();
      programar();
    }, espera);
  }
  programar();
  return nodo;
}