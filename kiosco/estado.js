import { cambiarIdioma } from '../shared/i18n.js';

function identificacionInicial() {
  return { edificio: '', habitacion: '', campoActivo: null, huesped: null };
}

export const sesion = {
  huesped: null,
  carrito: [],
  identificacion: identificacionInicial(),
  generacion: 0
};

export function reiniciarSesion() {
  sesion.huesped = null;
  sesion.carrito = [];
  sesion.identificacion = identificacionInicial();
  sesion.generacion += 1;
  cambiarIdioma('es');
}