class ErrorApi extends Error {
  constructor(codigo, detalle, datos) {
    super(codigo);
    this.codigo = codigo;
    this.detalle = detalle || '';
    this.datos = datos;
  }
}

function respuesta(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(ContentService.MimeType.JSON);
}

function obtenerHoja(nombre) {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nombre);
  if (!hoja) throw new ErrorApi('E_INTERNAL', 'Hoja inexistente: ' + nombre);
  return hoja;
}

function leerTabla(nombre) {
  const hoja = obtenerHoja(nombre);
  const filas = hoja.getLastRow();
  if (filas < 2) return [];
  const valores = hoja.getRange(1, 1, filas, ENCABEZADOS[nombre].length).getValues();
  const encabezados = valores[0];
  return valores.slice(1).map(fila => {
    const objeto = {};
    encabezados.forEach((columna, i) => {
      objeto[columna] = fila[i];
    });
    return objeto;
  });
}

function agregarFilas(nombre, filas) {
  if (!filas.length) return;
  const hoja = obtenerHoja(nombre);
  const inicio = hoja.getLastRow() + 1;
  const fin = inicio + filas.length - 1;
  if (fin > hoja.getMaxRows()) {
    hoja.insertRowsAfter(hoja.getMaxRows(), fin - hoja.getMaxRows() + 500);
  }
  hoja.getRange(inicio, 1, filas.length, ENCABEZADOS[nombre].length).setValues(filas);
}

function validarTexto(valor, maximo, patron) {
  if (typeof valor !== 'string') throw new ErrorApi('E_VALIDATION', 'tipo');
  const limpio = valor.trim();
  if (!limpio || limpio.length > maximo) throw new ErrorApi('E_VALIDATION', 'longitud');
  if (patron && !patron.test(limpio)) throw new ErrorApi('E_VALIDATION', 'formato');
  return limpio;
}

function neutralizar(valor) {
  const texto = String(valor === undefined || valor === null ? '' : valor);
  return /^[=+\-@\t\r]/.test(texto) ? "'" + texto : texto;
}

function aIso(valor) {
  return valor instanceof Date ? valor.toISOString() : '';
}

function obtenerVenue(venueId) {
  const venue = leerTabla(HOJAS.VENUES).find(v => v.venue_id === venueId && v.activo === true);
  if (!venue) throw new ErrorApi('E_NOT_FOUND', 'venue ' + venueId);
  return venue;
}

function minutosDeHora(texto) {
  const partes = String(texto).split(':').map(Number);
  return partes[0] * 60 + (partes[1] || 0);
}

function diaOperativo(fecha, venue) {
  const desplazada = new Date(fecha.getTime() - minutosDeHora(venue.dia_operativo_inicio) * 60000);
  return Utilities.formatDate(desplazada, venue.zona_horaria, 'yyyyMMdd');
}

function conCache(clave, segundos, generar) {
  const cache = CacheService.getScriptCache();
  const guardado = cache.get(clave);
  if (guardado) return JSON.parse(guardado);
  const valor = generar();
  cache.put(clave, JSON.stringify(valor), segundos);
  return valor;
}

function invalidarCache(venueId) {
  CacheService.getScriptCache().removeAll([
    'catalogo_' + venueId,
    'cola_' + venueId,
    'estado_' + venueId,
    'inventario_' + venueId
  ]);
}

function conLock(funcion) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_ESPERA_MS)) throw new ErrorApi('E_CONFLICT', 'lock');
  try {
    return funcion();
  } finally {
    SpreadsheetApp.flush();
    lock.releaseLock();
  }
}

function registrarLog(accion, rol, venueId, codigo, detalle) {
  try {
    obtenerHoja(HOJAS.LOG).appendRow([
      new Date(),
      neutralizar(accion),
      neutralizar(rol),
      neutralizar(venueId),
      neutralizar(codigo),
      neutralizar(String(detalle || '').slice(0, 500))
    ]);
  } catch (error) {
    return;
  }
}