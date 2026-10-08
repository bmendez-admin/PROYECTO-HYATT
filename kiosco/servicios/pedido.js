import { ErrorRed, llamar, nuevoRequestId } from '../../shared/api.js';
import { LIMITE_PEDIDO_MS } from '../config.js';
import { sesion } from '../estado.js';

function itemsDelCarrito() {
  return sesion.carrito.map(linea => ({ producto_id: linea.producto_id, cantidad: linea.cantidad }));
}

function firmaDe(huespedId, items) {
  const ordenados = items.map(item => item.producto_id + ':' + item.cantidad).sort();
  return huespedId + '|' + ordenados.join(',');
}

function requestIdPara(firma) {
  if (!sesion.pedido || sesion.pedido.firma !== firma) {
    sesion.pedido = { request_id: nuevoRequestId(), firma };
  }
  return sesion.pedido.request_id;
}

export async function enviarPedido() {
  const huesped = sesion.huesped;
  const items = itemsDelCarrito();
  if (!huesped || items.length === 0) return { ok: false, tipo: 'general' };
  const requestId = requestIdPara(firmaDe(huesped.huesped_id, items));
  try {
    const resultado = await llamar(
      'crear_pedido',
      { request_id: requestId, huesped_id: huesped.huesped_id, items },
      { limiteTotalMs: LIMITE_PEDIDO_MS }
    );
    if (resultado.ok) return { ok: true, numero: resultado.data.numero };
    return { ok: false, tipo: 'servidor', code: resultado.code };
  } catch (error) {
    return { ok: false, tipo: error instanceof ErrorRed && error.tipo !== 'sin_url' ? 'red' : 'general' };
  }
}