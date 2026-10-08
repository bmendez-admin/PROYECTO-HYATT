import { el } from '../../shared/dom.js';
import { t } from '../../shared/i18n.js';
import { AVISO_INACTIVIDAD_S, ESPERA_PORTADA_MS, INACTIVIDAD_MS, PANTALLAS_INACTIVIDAD } from '../config.js';
import { reiniciarSesion } from '../estado.js';
import { irConFundido, pantallaActual } from '../navegacion.js';
import { unidadesTotales } from './carrito.js';

const REVISION_MS = 1000;

let lienzo = null;
let revisor = null;
let cuenta = null;
let pausado = false;
let aviso = null;
let ultimaActividad = Date.now();
let pantallaVista = null;

function limiteActual() {
  const pantalla = pantallaActual();
  if (pantalla === 'portada') return ESPERA_PORTADA_MS;
  if (PANTALLAS_INACTIVIDAD.includes(pantalla)) return INACTIVIDAD_MS;
  return 0;
}

function cerrarAviso() {
  clearInterval(cuenta);
  cuenta = null;
  if (aviso) aviso.remove();
  aviso = null;
}

function seguirAqui() {
  cerrarAviso();
  ultimaActividad = Date.now();
}

function expirar() {
  cerrarAviso();
  reiniciarSesion();
  ultimaActividad = Date.now();
  irConFundido('portada');
}

function abrirAviso() {
  let restante = AVISO_INACTIVIDAD_S;
  const clave = unidadesTotales() > 0 ? 'inactividad_pedido' : 'inactividad_sesion';
  const numero = el('p', { clase: 'inactividad__numero', 'aria-hidden': 'true', texto: String(restante) });
  const boton = el('button', {
    type: 'button',
    clase: 'boton inactividad__boton',
    texto: t('inactividad_seguir'),
    onclick: seguirAqui
  });
  aviso = el(
    'div',
    { clase: 'inactividad', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'inactividad-titulo' },
    el(
      'div',
      { clase: 'inactividad__tarjeta' },
      el('h2', { id: 'inactividad-titulo', clase: 'inactividad__titulo', texto: t('inactividad_titulo') }),
      el('p', { clase: 'inactividad__texto', texto: t(clave) }),
      numero,
      el('p', { clase: 'inactividad__unidad', texto: t('inactividad_segundos') }),
      boton
    )
  );
  lienzo.append(aviso);
  boton.focus();
  cuenta = setInterval(() => {
    restante -= 1;
    if (restante <= 0) {
      expirar();
      return;
    }
    numero.textContent = String(restante);
  }, 1000);
}

function revisar() {
  if (pausado || aviso) return;
  const pantalla = pantallaActual();
  if (pantalla !== pantallaVista) {
    pantallaVista = pantalla;
    ultimaActividad = Date.now();
    return;
  }
  const limite = limiteActual();
  if (!limite || Date.now() - ultimaActividad < limite) return;
  if (pantalla === 'portada') {
    ultimaActividad = Date.now();
    irConFundido('espera');
    return;
  }
  abrirAviso();
}

function registrarActividad() {
  if (aviso) return;
  ultimaActividad = Date.now();
}

export function fijarPausaInactividad(valor) {
  pausado = valor;
  if (!valor) ultimaActividad = Date.now();
}

export function iniciarInactividad(contenedor) {
  lienzo = contenedor;
  ultimaActividad = Date.now();
  document.addEventListener('pointerdown', registrarActividad, true);
  document.addEventListener('keydown', registrarActividad, true);
  clearInterval(revisor);
  revisor = setInterval(revisar, REVISION_MS);
}