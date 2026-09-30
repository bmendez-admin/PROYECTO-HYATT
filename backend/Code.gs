function respuesta(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function hoja() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var s = ss.getSheetByName('SPIKE');
  if (!s) {
    s = ss.insertSheet('SPIKE');
    s.getRange('A1').setValue(0);
  }
  return s;
}

function lockTest(id) {
  var lock = LockService.getScriptLock();
  var t0 = Date.now();
  if (!lock.tryLock(10000)) return { ok: false, code: 'E_CONFLICT' };
  try {
    var s = hoja();
    var v = Number(s.getRange('A1').getValue()) + 1;
    Utilities.sleep(150);
    s.getRange('A1').setValue(v);
    s.appendRow([new Date(), id, v]);
    SpreadsheetApp.flush();
    return { ok: true, valor: v, espera_ms: Date.now() - t0 };
  } finally {
    lock.releaseLock();
  }
}

function latido(chef) {
  var c = CacheService.getScriptCache();
  if (chef) c.put('chef_' + chef, String(Date.now()), 90);
  var vivos = [];
  ['chef1', 'chef2'].forEach(function (n) {
    if (c.get('chef_' + n)) vivos.push(n);
  });
  return { ok: true, vivos: vivos };
}

function lectura() {
  var c = CacheService.getScriptCache();
  var h = c.get('lectura');
  if (h) return JSON.parse(h);
  var r = {
    ok: true,
    contador: Number(hoja().getRange('A1').getValue()),
    hora_servidor: new Date().toISOString()
  };
  c.put('lectura', JSON.stringify(r), 3);
  return r;
}

function ruta(b) {
  switch (b.action) {
    case 'ping':
      return { ok: true, hora_servidor: new Date().toISOString() };
    case 'lock_test':
      return lockTest(String(b.request_id || ''));
    case 'latido':
      return latido(String(b.chef || ''));
    case 'lectura':
      return lectura();
    default:
      return { ok: false, code: 'E_VALIDATION' };
  }
}

function doPost(e) {
  try {
    var b = JSON.parse(e.postData.contents);
    return respuesta(ruta(b));
  } catch (err) {
    return respuesta({ ok: false, code: 'E_INTERNAL' });
  }
}

function doGet(e) {
  var a = (e.parameter && e.parameter.action) || 'ping';
  return respuesta(ruta({ action: a }));
}