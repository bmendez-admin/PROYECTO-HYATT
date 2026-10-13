import { ejecutar } from './solicitudes.js';

export function iniciarTurno(chefId, codigo) {
  return ejecutar('iniciar_turno', { chef_id: chefId, codigo });
}

export function pausarTurno(chefId, tipo) {
  return ejecutar('pausar_turno', { chef_id: chefId, tipo });
}

export function reanudarTurno(chefId) {
  return ejecutar('reanudar_turno', { chef_id: chefId });
}

export function cerrarTurno(chefId) {
  return ejecutar('cerrar_turno', { chef_id: chefId });
}

export function claveErrorTurno(resultado) {
  if (resultado.codigo === 'E_NOT_FOUND' || resultado.codigo === 'E_VALIDATION') return 'err_codigo';
  if (resultado.codigo === 'E_RATE') return 'err_bloqueado';
  if (resultado.codigo === 'E_RED') return 'err_red';
  if (resultado.codigo === 'E_AUTH') return 'err_config';
  if (resultado.codigo === 'E_CONFLICT') {
    if (resultado.razon === 'chef_con_turno') return 'err_chef_con_turno';
    if (resultado.razon === 'turnos_al_maximo') return 'err_turnos_maximo';
  }
  return 'err_general';
}

export function claveErrorPausa(resultado) {
  if (resultado.codigo === 'E_CONFLICT') {
    if (resultado.razon === 'pedidos_en_preparacion') return 'aviso_pedido_activo';
    if (resultado.razon === 'sin_turno_activo') return 'aviso_sin_turno';
  }
  return null;
}