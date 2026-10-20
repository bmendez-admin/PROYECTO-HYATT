import { ejecutar } from './solicitudes.js';

function datosReposicion(chefId, productoId, cantidad, requestId) {
  return { chef_id: chefId, producto_id: productoId, cantidad, request_id: requestId };
}

export function registrarRelleno(chefId, productoId, cantidad, requestId) {
  return ejecutar('registrar_relleno', datosReposicion(chefId, productoId, cantidad, requestId));
}

export function solicitarReabasto(chefId, productoId, cantidad, requestId) {
  return ejecutar('solicitar_reabasto', datosReposicion(chefId, productoId, cantidad, requestId));
}

export function claveErrorReposicion(resultado) {
  if (resultado.codigo === 'E_CONFLICT') {
    if (resultado.razon === 'sin_turno_activo') return 'aviso_sin_turno';
    if (resultado.razon === 'solicitud_pendiente') return 'aviso_reabasto_pendiente';
  }
  if (resultado.codigo === 'E_NOT_FOUND') return 'aviso_producto_no_disponible';
  if (resultado.codigo === 'E_RED') return 'err_red';
  if (resultado.codigo === 'E_AUTH') return 'err_config';
  if (resultado.codigo === 'E_RATE') return 'aviso_rate';
  return 'err_general';
}

export function reposicionResuelta(resultado) {
  return (
    resultado.codigo === 'E_NOT_FOUND' ||
    (resultado.codigo === 'E_CONFLICT' && resultado.razon === 'solicitud_pendiente')
  );
}