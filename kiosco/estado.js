import { cambiarIdioma } from '../shared/i18n.js';

function identificacionInicial() {
  return { edificio: '', habitacion: '', campoActivo: null, huesped: null };
}

export const sesion = {
  huesped: null,
  carrito: [],
  identificacion: identificacionInicial(),
  pedido: null,
  ticket: null,
  generacion: 0
};

export function reiniciarSesion() {
  sesion.huesped = null;
  sesion.carrito = [];
  sesion.identificacion = identificacionInicial();
  sesion.pedido = null;
  sesion.ticket = null;
  sesion.generacion += 1;
  cambiarIdioma('es');
}