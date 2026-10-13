import { configurarApi } from '../shared/api.js';
import { el } from '../shared/dom.js';
import { LIENZO, PATRON_TOKEN, PATRON_VENUE, RECARGA_MS, ROL } from './config.js';
import { construirEstado } from './pantallas/estado.js';
import { texto } from './textos.js';

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
    el('h1', { clase: 'error-config__titulo', texto: texto('config_titulo', 'es') }),
    el('p', { clase: 'error-config__detalle', texto: texto('config_detalle', 'es') }),
    el('p', { clase: 'error-config__detalle', lang: 'en', texto: texto('config_detalle', 'en') })
  );
}

function arrancar() {
  ajustarLienzo();
  window.addEventListener('resize', ajustarLienzo);
  document.addEventListener('contextmenu', evento => evento.preventDefault());
  document.addEventListener('dragstart', evento => evento.preventDefault());

  const parametros = leerParametros();
  if (!parametros) {
    lienzo.replaceChildren(construirErrorConfiguracion());
    return;
  }
  configurarApi({ rol: ROL, venueId: parametros.venueId, token: parametros.token });
  lienzo.replaceChildren(construirEstado());
  setTimeout(() => window.location.reload(), RECARGA_MS);
}

arrancar();