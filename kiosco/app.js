import { configurarApi } from '../shared/api.js';
import { el } from '../shared/dom.js';
import { t } from '../shared/i18n.js';
import { LIENZO, PATRON_TOKEN, PATRON_VENUE, ROL } from './config.js';
import './textos.js';
import { iniciarNavegacion, ir, registrarPantalla } from './navegacion.js';
import { construirPortada } from './pantallas/portada.js';
import { construirIdentificacion } from './pantallas/identificacion.js';
import { construirMenu } from './pantallas/menu.js';
import { construirOrden } from './pantallas/orden.js';
import { construirTicket } from './pantallas/ticket.js';
import { iniciarInactividad } from './servicios/inactividad.js';
import { construirEspera } from './pantallas/espera.js';

const lienzo = document.getElementById('lienzo');

function ajustarLienzo() {
  const escala = Math.min(window.innerWidth / LIENZO.ancho, window.innerHeight / LIENZO.alto);
  document.documentElement.style.setProperty('--escala', String(escala));
}

function leerParametros() {
  const parametros = new URLSearchParams(window.location.search);
  const venueId = parametros.get('venue') || '';
  const token = parametros.get('token') || '';
  if (!PATRON_VENUE.test(venueId) || !PATRON_TOKEN.test(token)) return null;
  return { venueId, token };
}

function construirErrorConfiguracion() {
  return el(
    'section',
    { clase: 'pantalla pantalla--error' },
    el('div', { clase: 'zona-encabezado' }),
    el(
      'div',
      { clase: 'zona-contenido error-config' },
      el('h1', { clase: 'error-config__titulo', texto: t('error_config_titulo') }),
      el('p', { clase: 'error-config__detalle', texto: t('error_config_detalle') })
    ),
    el('div', { clase: 'zona-acciones' })
  );
}

function arrancar() {
  ajustarLienzo();
  window.addEventListener('resize', ajustarLienzo);
  document.addEventListener('contextmenu', evento => evento.preventDefault());
  document.addEventListener('dragstart', evento => evento.preventDefault());

  iniciarNavegacion(lienzo);
  registrarPantalla('portada', construirPortada);
  registrarPantalla('identificacion', construirIdentificacion);
  registrarPantalla('menu', construirMenu);
  registrarPantalla('orden', construirOrden);
  registrarPantalla('error_config', construirErrorConfiguracion);
  registrarPantalla('ticket', construirTicket);
  registrarPantalla('espera', construirEspera);

  const parametros = leerParametros();
  if (!parametros) {
    ir('error_config');
    return;
  }
  configurarApi({ rol: ROL, venueId: parametros.venueId, token: parametros.token });
  iniciarInactividad(lienzo);
  ir('portada');
}

arrancar();