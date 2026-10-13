import { ejecutar } from './solicitudes.js';

export function cambiarEstatus(pedidoId, transicion, chefId, motivo) {
  const datos = { pedido_id: pedidoId, transicion, chef_id: chefId };
  if (motivo) datos.motivo = motivo;
  return ejecutar('cambiar_estatus', datos);
}

export function esConflictoDeEstado(resultado) {
  return resultado.codigo === 'E_CONFLICT' || resultado.codigo === 'E_NOT_FOUND';
}

export function claveErrorEstatus(resultado, transicion) {
  if (resultado.codigo === 'E_CONFLICT') {
    if (resultado.razon === 'sin_turno_activo') return { clave: 'aviso_sin_turno', conNumero: false };
    if (transicion === 'tomar') return { clave: 'aviso_ya_tomado', conNumero: true };
    return { clave: 'aviso_pedido_cambio', conNumero: false };
  }
  if (resultado.codigo === 'E_NOT_FOUND') return { clave: 'aviso_pedido_cambio', conNumero: false };
  if (resultado.codigo === 'E_RED') return { clave: 'err_red', conNumero: false };
  if (resultado.codigo === 'E_AUTH') return { clave: 'err_config', conNumero: false };
  if (resultado.codigo === 'E_RATE') return { clave: 'aviso_rate', conNumero: false };
  return { clave: 'err_general', conNumero: false };
}