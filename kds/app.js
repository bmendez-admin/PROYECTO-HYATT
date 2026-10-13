import { configurarApi } from '../shared/api.js';
import { el } from '../shared/dom.js';
import { t } from '../shared/i18n.js';
import { LIENZO, PATRON_TOKEN, PATRON_VENUE, ROL } from './config.js';
import './textos.js';
import { configurarSesion } from './estado.js';
import { iniciarNavegacion, ir, registrarPantalla } from './navegacion.js';
import { construirChefs } from './pantallas/chefs.js';
import { construirCodigo } from './pantallas/codigo.js';
import { construirPrincipal } from './pantallas/principal.js';
import { prepararSonido } from './servicios/sonido.js';

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
    { clase: 'pantalla error-config' },
    el('h1', { clase: 'error-config__titulo', texto: t('error_config_titulo') }),
    el('p', { clase: 'error-config__detalle', texto: t('error_config_detalle') })
  );
}

function arrancar() {
  ajustarLienzo();
  window.addEventListener('resize', ajustarLienzo);
  document.addEventListener('contextmenu', evento => evento.preventDefault());
  document.addEventListener('dragstart', evento => evento.preventDefault());
  document.addEventListener('pointerdown', prepararSonido);

  iniciarNavegacion(lienzo);
  registrarPantalla('chefs', construirChefs);
  registrarPantalla('codigo', construirCodigo);
  registrarPantalla('principal', construirPrincipal);
  registrarPantalla('error_config', construirErrorConfiguracion);

  const parametros = leerParametros();
  if (!parametros) {
    ir('error_config');
    return;
  }
  configurarApi({ rol: ROL, venueId: parametros.venueId, token: parametros.token });
  configurarSesion(parametros.venueId);
  ir('chefs');
}

arrancar();