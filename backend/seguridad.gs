function propiedades() {
  return PropertiesService.getScriptProperties();
}

function sha256Hex(texto) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, texto, Utilities.Charset.UTF_8)
    .map(byte => ('0' + (byte & 0xff).toString(16)).slice(-2))
    .join('');
}

function obtenerSal() {
  const almacen = propiedades();
  let sal = almacen.getProperty('SAL');
  if (!sal) {
    sal = Utilities.getUuid() + Utilities.getUuid();
    almacen.setProperty('SAL', sal);
  }
  return sal;
}

function generarToken() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
}

function clavePropiedadToken(rol, venueId) {
  return 'TOK_' + rol + '_' + venueId;
}

function iguales(a, b) {
  if (a.length !== b.length) return false;
  let diferencia = 0;
  for (let i = 0; i < a.length; i++) {
    diferencia |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diferencia === 0;
}

function validarToken(rol, venueId, token) {
  const guardado = propiedades().getProperty(clavePropiedadToken(rol, venueId));
  if (!guardado) return false;
  return iguales(guardado, sha256Hex(obtenerSal() + token));
}

function limitarFrecuencia(clave, maximo) {
  const cache = CacheService.getScriptCache();
  const llave = 'rate_' + clave + '_' + Math.floor(Date.now() / 60000);
  const total = Number(cache.get(llave) || 0) + 1;
  if (total > maximo) throw new ErrorApi('E_RATE', clave);
  cache.put(llave, String(total), 90);
}

function generarTokens() {
  const sal = obtenerSal();
  const almacen = propiedades();
  const venues = leerTabla(HOJAS.VENUES).map(venue => venue.venue_id);
  const lineas = [];
  ROLES_CON_TOKEN.forEach(rol => {
    venues.forEach(venueId => {
      const token = generarToken();
      almacen.setProperty(clavePropiedadToken(rol, venueId), sha256Hex(sal + token));
      lineas.push(rol + ' | ' + venueId + ' | ' + token);
    });
  });
  Logger.log(lineas.join('\n'));
}

function aplicarPin() {
  const almacen = propiedades();
  const pin = String(almacen.getProperty('PIN_DASHBOARD') || '');
  if (!/^\d{6}$/.test(pin)) {
    throw new Error('Define la propiedad PIN_DASHBOARD con 6 digitos');
  }
  almacen.setProperty('PIN_HASH', sha256Hex(obtenerSal() + pin));
  almacen.deleteProperty('PIN_DASHBOARD');
  Logger.log('PIN aplicado');
}