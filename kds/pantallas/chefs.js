import { el } from '../../shared/dom.js';
import { t } from '../../shared/i18n.js';
import { construirMarcoAcceso } from '../componentes/marco-acceso.js';
import { construirTarjetaChef } from '../componentes/tarjeta-chef.js';
import { cerrarSesionChef, chefGuardado, elegirCandidato, iniciarSesionChef } from '../estado.js';
import { ir, pantallaActual } from '../navegacion.js';
import {
  colaActual,
  consultarCola,
  detenerSondeo,
  errorCola,
  iniciarSondeo,
  suscribirCola
} from '../servicios/cola.js';

const TARJETAS_ESQUELETO = 6;

const ui = { seleccion: '', restauracionIntentada: false };
let refs = null;
let desuscribir = null;

function estaBloqueado(chef) {
  return chef.turno !== 'ninguno' && chef.chef_id !== chefGuardado();
}

function etiquetaBloqueo(chef) {
  return t(chef.turno === 'pausa' ? 'chef_en_pausa' : 'chef_en_turno');
}

function salir() {
  detenerSondeo();
  if (desuscribir) desuscribir();
  desuscribir = null;
}

function entrarComoChef(chef) {
  salir();
  iniciarSesionChef(chef);
  ir('principal');
}

function restaurarSesion(chefs) {
  if (ui.restauracionIntentada) return false;
  ui.restauracionIntentada = true;
  const guardado = chefGuardado();
  if (!guardado) return false;
  const chef = chefs.find(item => item.chef_id === guardado);
  if (chef && chef.turno !== 'ninguno') {
    entrarComoChef(chef);
    return true;
  }
  cerrarSesionChef();
  return false;
}

function elegir(chef) {
  ui.seleccion = chef.chef_id;
  pintar();
}

function comenzar() {
  const cola = colaActual();
  const chef = cola ? cola.chefs.find(item => item.chef_id === ui.seleccion) : null;
  if (!chef || estaBloqueado(chef)) return;
  salir();
  elegirCandidato(chef);
  ir('codigo');
}

function pintarEsqueleto() {
  if (refs.esqueletoListo) return;
  refs.esqueletoListo = true;
  refs.rejilla.replaceChildren(
    ...Array.from({ length: TARJETAS_ESQUELETO }, () =>
      el('div', { clase: 'tarjeta-chef tarjeta-chef--esqueleto', 'aria-hidden': 'true' })
    )
  );
  refs.rejilla.setAttribute('aria-busy', 'true');
}

function pintar() {
  if (!refs || pantallaActual() !== 'chefs') return;
  const cola = colaActual();
  const fallo = !cola && errorCola() !== '';
  refs.estado.hidden = !fallo;
  refs.rejilla.hidden = fallo;
  refs.comenzar.hidden = fallo;
  if (fallo) {
    refs.estadoTexto.textContent = t(errorCola() === 'E_AUTH' ? 'err_config' : 'chef_error');
    return;
  }
  if (!cola) {
    pintarEsqueleto();
    refs.comenzar.disabled = true;
    return;
  }
  if (restaurarSesion(cola.chefs)) return;
  refs.rejilla.removeAttribute('aria-busy');
  const actual = cola.chefs.find(chef => chef.chef_id === ui.seleccion);
  if (!actual || estaBloqueado(actual)) ui.seleccion = '';
  refs.vacio.hidden = cola.chefs.length > 0;
  refs.rejilla.replaceChildren(
    ...cola.chefs.map(chef =>
      construirTarjetaChef(chef, {
        seleccionada: chef.chef_id === ui.seleccion,
        bloqueada: estaBloqueado(chef),
        etiqueta: etiquetaBloqueo(chef),
        alElegir: elegir
      })
    )
  );
  refs.comenzar.disabled = ui.seleccion === '';
}

export function construirChefs() {
  salir();
  const marco = construirMarcoAcceso();
  const rejilla = el('div', { clase: 'chefs__rejilla' });
  const vacio = el('p', { clase: 'chefs__vacio', texto: t('chef_sin_chefs'), hidden: true });
  const estadoTexto = el('p', { clase: 'chefs__estado-texto', role: 'status' });
  const reintentarBoton = el('button', {
    type: 'button',
    clase: 'acceso__boton chefs__reintentar',
    texto: t('reintentar'),
    onclick: () => consultarCola()
  });
  const estado = el('div', { clase: 'chefs__estado', hidden: true }, estadoTexto, reintentarBoton);
  const comenzarBoton = el('button', {
    type: 'button',
    clase: 'acceso__boton chefs__comenzar',
    texto: t('chef_comenzar'),
    disabled: true,
    onclick: comenzar
  });

  refs = { rejilla, vacio, estado, estadoTexto, comenzar: comenzarBoton, esqueletoListo: false };
  marco.tarjeta.append(rejilla, vacio, estado, comenzarBoton);
  desuscribir = suscribirCola(pintar);
  queueMicrotask(() => {
    iniciarSondeo();
    pintar();
  });
  return marco.nodo;
}