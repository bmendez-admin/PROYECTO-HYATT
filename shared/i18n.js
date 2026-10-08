const diccionarios = Object.create(null);
const oyentes = new Set();
let idioma = 'es';

export function registrarTextos(codigo, textos) {
  diccionarios[codigo] = textos;
}

export function idiomaActual() {
  return idioma;
}

export function cambiarIdioma(codigo) {
  if (!diccionarios[codigo] || codigo === idioma) return;
  idioma = codigo;
  document.documentElement.lang = codigo;
  oyentes.forEach(oyente => oyente(codigo));
}

export function alCambiarIdioma(oyente) {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

export function t(clave) {
  const actual = diccionarios[idioma];
  if (actual && actual[clave] !== undefined) return actual[clave];
  const base = diccionarios.es;
  return base && base[clave] !== undefined ? base[clave] : clave;
}

export function textoLocalizado(objeto, campo) {
  return objeto[campo + '_' + idioma] || objeto[campo + '_es'] || '';
}