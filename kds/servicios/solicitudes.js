import { ErrorRed, llamar } from '../../shared/api.js';
import { LIMITE_TURNO_MS } from '../config.js';

export async function ejecutar(accion, datos) {
  try {
    const resultado = await llamar(accion, datos, { limiteTotalMs: LIMITE_TURNO_MS });
    if (resultado.ok) return { ok: true, repetido: resultado.data.repetido === true, datos: resultado.data };
    const razon = resultado.data && typeof resultado.data.razon === 'string' ? resultado.data.razon : '';
    return { ok: false, codigo: resultado.code, razon };
  } catch (error) {
    if (!(error instanceof ErrorRed)) throw error;
    return { ok: false, codigo: 'E_RED', razon: '' };
  }
}

export function claveErrorGeneral(resultado) {
  if (resultado.codigo === 'E_RED') return 'err_red';
  if (resultado.codigo === 'E_AUTH') return 'err_config';
  if (resultado.codigo === 'E_RATE') return 'aviso_rate';
  return 'err_general';
}