import { llamar } from '../../shared/api.js';
import { VIGENCIA_CATALOGO_MS } from '../config.js';

const estado = { datos: null, hora: 0, pendiente: null };

export function catalogoActual() {
  return estado.datos;
}

export function catalogoVigente() {
  return estado.datos !== null && Date.now() - estado.hora < VIGENCIA_CATALOGO_MS;
}

async function pedir() {
  try {
    const resultado = await llamar('catalogo');
    if (!resultado.ok) return { ok: false };
    estado.datos = resultado.data;
    estado.hora = Date.now();
    return { ok: true };
  } catch (error) {
    return { ok: false };
  }
}

export function cargarCatalogo() {
  if (estado.pendiente) return estado.pendiente;
  if (catalogoVigente()) return Promise.resolve({ ok: true });
  estado.pendiente = pedir().finally(() => {
    estado.pendiente = null;
  });
  return estado.pendiente;
}

export function refrescarCatalogo() {
  estado.hora = 0;
  return cargarCatalogo();
}