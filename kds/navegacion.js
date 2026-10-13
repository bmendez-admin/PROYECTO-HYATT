const pantallas = new Map();
let lienzo = null;
let actual = null;

export function iniciarNavegacion(contenedor) {
  lienzo = contenedor;
}

export function registrarPantalla(nombre, construir) {
  pantallas.set(nombre, construir);
}

export function ir(nombre) {
  const construir = pantallas.get(nombre);
  if (!construir) throw new Error('pantalla desconocida: ' + nombre);
  lienzo.replaceChildren(construir());
  actual = nombre;
}

export function pantallaActual() {
  return actual;
}