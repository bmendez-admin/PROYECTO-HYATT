import { llamar } from '../../shared/api.js';
import { ESPERA_LIMITE_CONSULTA_MS } from '../config.js';

export async function consultarPendientes() {
  try {
    const resultado = await llamar('estado', {}, { limiteTotalMs: ESPERA_LIMITE_CONSULTA_MS });
    if (!resultado.ok) return { ok: false };
    const pedidos = resultado.data.en_proceso
      .filter(pedido => pedido && pedido.numero !== undefined && pedido.numero !== null)
      .map(pedido => ({ numero: String(pedido.numero), preparando: pedido.estatus === 'en_preparacion' }));
    return { ok: true, pedidos };
  } catch (error) {
    return { ok: false };
  }
}