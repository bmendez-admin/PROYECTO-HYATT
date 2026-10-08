import { alCambiarIdioma } from '../shared/i18n.js';

const pantallas = new Map();
let lienzo = null;
let actual = null;

export function iniciarNavegacion(contenedor) {
  lienzo = contenedor;
  alCambiarIdioma(() => {
    if (actual) mostrar(actual);
  });
}

export function registrarPantalla(nombre, construir) {
  pantallas.set(nombre, construir);
}

function mostrar(nombre) {
  const construir = pantallas.get(nombre);
  if (!construir) throw new Error('pantalla desconocida: ' + nombre);
  lienzo.replaceChildren(construir());
  actual = nombre;
}

export function ir(nombre) {
  mostrar(nombre);
}

export function irConFundido(nombre) {
  const anterior = lienzo ? lienzo.firstElementChild : null;
  mostrar(nombre);
  if (!anterior || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  anterior.classList.add('pantalla--saliente');
  lienzo.append(anterior);
  const retirar = () => anterior.remove();
  anterior.addEventListener('animationend', retirar, { once: true });
  setTimeout(retirar, 1000);
}

export function pantallaActual() {
  return actual;
}