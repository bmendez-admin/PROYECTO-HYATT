function setup() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(ENCABEZADOS).forEach(nombre => prepararHoja(libro, nombre));
  sembrarDatosDemo();
  Logger.log(JSON.stringify(verificarEsquema(), null, 2));
}

function prepararHoja(libro, nombre) {
  const encabezados = ENCABEZADOS[nombre];
  let hoja = libro.getSheetByName(nombre);
  if (!hoja) hoja = libro.insertSheet(nombre);
  if (hoja.getMaxColumns() < encabezados.length) {
    hoja.insertColumnsAfter(hoja.getMaxColumns(), encabezados.length - hoja.getMaxColumns());
  }
  if (hoja.getLastRow() === 0) {
    hoja.getRange(1, 1, 1, encabezados.length).setValues([encabezados]);
  } else if (!encabezadosCoinciden(hoja, encabezados) && !completarEncabezados(hoja, encabezados)) {
    throw new Error('Los encabezados de ' + nombre + ' no coinciden con el esquema');
  }
  aplicarFormato(hoja, nombre);
}

function completarEncabezados(hoja, encabezados) {
  const actuales = hoja.getRange(1, 1, 1, encabezados.length).getValues()[0];
  const primerVacio = actuales.indexOf('');
  if (primerVacio === -1) return false;
  const prefijoOk = actuales.slice(0, primerVacio).every((valor, i) => valor === encabezados[i]);
  const restoVacio = actuales.slice(primerVacio).every(valor => valor === '');
  if (!prefijoOk || !restoVacio) return false;
  hoja.getRange(1, 1, 1, encabezados.length).setValues([encabezados]);
  return true;
}

function encabezadosCoinciden(hoja, encabezados) {
  return hoja
    .getRange(1, 1, 1, encabezados.length)
    .getValues()[0]
    .every((valor, i) => valor === encabezados[i]);
}

function aplicarFormato(hoja, nombre) {
  const encabezados = ENCABEZADOS[nombre];
  if (hoja.getMaxRows() < 2) hoja.insertRowAfter(1);
  const filasDeDatos = hoja.getMaxRows() - 1;
  hoja.getRange(1, 1, 1, encabezados.length).setFontWeight('bold').setBackground('#ece6f1');
  hoja.setFrozenRows(1);
  (COLUMNAS_TEXTO[nombre] || []).forEach(columna => {
    hoja.getRange(2, encabezados.indexOf(columna) + 1, filasDeDatos, 1).setNumberFormat('@');
  });
  (COLUMNAS_FECHA[nombre] || []).forEach(columna => {
    hoja.getRange(2, encabezados.indexOf(columna) + 1, filasDeDatos, 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
  });
}

function sembrar(nombre, objetos) {
  const hoja = obtenerHoja(nombre);
  if (hoja.getLastRow() > 1) return;
  const encabezados = ENCABEZADOS[nombre];
  const filas = objetos.map(objeto => encabezados.map(columna => (columna in objeto ? objeto[columna] : '')));
  hoja.getRange(2, 1, filas.length, encabezados.length).setValues(filas);
}

function sembrarDatosDemo() {
  const productos = productosBites();
  sembrar(HOJAS.VENUES, VENUES_DEMO);
  sembrar(HOJAS.DB, productos);
  sembrar(HOJAS.HUESPEDES, generarHuespedes());
  sembrar(HOJAS.CHEFS, CHEFS_DEMO);
  sembrar(HOJAS.INVENTARIO, movimientosIniciales(productos));
}

function verificarEsquema() {
  return Object.keys(ENCABEZADOS).map(nombre => {
    const hoja = obtenerHoja(nombre);
    return {
      hoja: nombre,
      filas_de_datos: Math.max(0, hoja.getLastRow() - 1),
      encabezados_ok: encabezadosCoinciden(hoja, ENCABEZADOS[nombre])
    };
  });
}

function limpiarDatos(nombre) {
  const hoja = obtenerHoja(nombre);
  const filas = hoja.getLastRow() - 1;
  if (filas > 0) hoja.getRange(2, 1, filas, ENCABEZADOS[nombre].length).clearContent();
}

function reiniciarDemo() {
  conLock(() => {
    [HOJAS.KIOSCO, HOJAS.PEDIDO_ITEMS, HOJAS.KDS, HOJAS.TURNOS, HOJAS.REABASTO, HOJAS.INVENTARIO, HOJAS.DB, HOJAS.CHEFS].forEach(limpiarDatos);
    sembrarDatosDemo();
  });
  leerTabla(HOJAS.VENUES).forEach(venue => {
    invalidarCache(venue.venue_id);
    const claves = ['cuarto_bloqueo_' + venue.venue_id, 'cuarto_fallos_' + venue.venue_id];
    CHEFS_DEMO.forEach(chef => {
      claves.push('chef_bloqueo_' + venue.venue_id + '_' + chef.chef_id, 'chef_fallos_' + venue.venue_id + '_' + chef.chef_id);
    });
    CacheService.getScriptCache().removeAll(claves);
  });
  Logger.log(JSON.stringify(verificarEsquema(), null, 2));
}

function reiniciarChefs() {
  conLock(() => {
    [HOJAS.TURNOS, HOJAS.CHEFS].forEach(limpiarDatos);
    sembrar(HOJAS.CHEFS, CHEFS_DEMO);
  });
  leerTabla(HOJAS.VENUES).forEach(venue => invalidarCache(venue.venue_id));
  Logger.log(JSON.stringify(leerTabla(HOJAS.CHEFS).map(c => c.chef_id + ' ' + c.nombre + ' ' + c.avatar + ' ' + c.codigo), null, 2));
}