function indiceColumna(nombre, columna) {
  return ENCABEZADOS[nombre].indexOf(columna);
}

function filaAObjeto(nombre, valores) {
  const objeto = {};
  ENCABEZADOS[nombre].forEach((columna, i) => {
    objeto[columna] = valores[i];
  });
  return objeto;
}

function objetoAFila(nombre, objeto) {
  return ENCABEZADOS[nombre].map(columna => (columna in objeto ? objeto[columna] : ''));
}

function leerFilasConPosicion(nombre) {
  const hoja = obtenerHoja(nombre);
  const filas = hoja.getLastRow() - 1;
  if (filas < 1) return [];
  return hoja
    .getRange(2, 1, filas, ENCABEZADOS[nombre].length)
    .getValues()
    .map((valores, i) => ({ fila: i + 2, datos: filaAObjeto(nombre, valores) }));
}

function escribirFila(nombre, fila, datos) {
  const valores = objetoAFila(nombre, datos);
  obtenerHoja(nombre).getRange(fila, 1, 1, valores.length).setValues([valores]);
}

function esFecha(valor) {
  return valor instanceof Date && !isNaN(valor.getTime());
}

function antiguedadMs(valor, ahora) {
  return esFecha(valor) ? ahora.getTime() - valor.getTime() : 0;
}