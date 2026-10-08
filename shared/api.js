import { API_URL } from './config.js';

const ESPERAS_MS = [1000, 2000, 4000];
const TIMEOUT_MS = 30000;

const esObjeto = valor => valor !== null && typeof valor === 'object' && !Array.isArray(valor);

const VALIDADORES = {
  catalogo: d => esObjeto(d) && Array.isArray(d.productos) && esObjeto(d.limites) && esObjeto(d.venue),
  validar_cuarto: d => esObjeto(d) && typeof d.huesped_id === 'string' && typeof d.nombre_display === 'string',
  crear_pedido: d => esObjeto(d) && typeof d.pedido_id === 'string' && d.numero !== undefined
};

let contexto = null;

export class ErrorRed extends Error {
  constructor(tipo) {
    super(tipo);
    this.tipo = tipo;
  }
}

export function configurarApi({ rol, venueId, token }) {
  contexto = { rol, venueId, token };
}

export function nuevoRequestId() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return 'rq-' + Date.now().toString(36) + '-' + hex;
}

const esperar = ms => new Promise(resolver => setTimeout(resolver, ms));

async function intentar(cuerpo) {
  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), TIMEOUT_MS);
  let respuesta;
  try {
    respuesta = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: cuerpo,
      signal: control.signal,
      redirect: 'follow',
      credentials: 'omit',
      referrerPolicy: 'no-referrer'
    });
  } catch (error) {
    throw new ErrorRed(control.signal.aborted ? 'timeout' : 'red');
  } finally {
    clearTimeout(temporizador);
  }
  if (!respuesta.ok) throw new ErrorRed('http');
  let json;
  try {
    json = await respuesta.json();
  } catch (error) {
    throw new ErrorRed('formato');
  }
  if (!esObjeto(json) || typeof json.ok !== 'boolean') throw new ErrorRed('formato');
  return json;
}

export async function llamar(accion, datos = {}, opciones = {}) {
  if (!contexto) throw new Error('api sin configurar');
  if (!API_URL) throw new ErrorRed('sin_url');
  const cuerpo = JSON.stringify({
    ...datos,
    action: accion,
    rol: contexto.rol,
    venue_id: contexto.venueId,
    token: contexto.token
  });
  const validar = VALIDADORES[accion];
  let ultimoError = new ErrorRed('red');
  for (let intento = 0; intento <= ESPERAS_MS.length; intento++) {
    if (intento > 0) {
      if (opciones.alReintentar) opciones.alReintentar(intento);
      await esperar(ESPERAS_MS[intento - 1]);
    }
    try {
      const json = await intentar(cuerpo);
      if (json.ok) {
        if (validar && !validar(json.data)) {
          ultimoError = new ErrorRed('formato');
          continue;
        }
        return { ok: true, data: json.data };
      }
      if (json.code === 'E_METHOD') {
        ultimoError = new ErrorRed('metodo');
        continue;
      }
      return { ok: false, code: String(json.code || 'E_INTERNAL'), data: json.data };
    } catch (error) {
      if (!(error instanceof ErrorRed)) throw error;
      ultimoError = error;
    }
  }
  throw ultimoError;
}