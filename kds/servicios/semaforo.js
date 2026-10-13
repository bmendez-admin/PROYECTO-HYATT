import { t } from '../../shared/i18n.js';
import { ahoraServidor } from './cola.js';

export function minutosEspera(pedido) {
  const llegada = Date.parse(pedido.hora_llegada);
  if (!Number.isFinite(llegada)) return 0;
  return Math.max(0, (ahoraServidor() - llegada) / 60000);
}

export function nivelEspera(minutos, parametros) {
  const rojo = Number(parametros.semaforo_rojo_min);
  const amarillo = Number(parametros.semaforo_amarillo_min);
  if (Number.isFinite(rojo) && minutos >= rojo) return 'rojo';
  if (Number.isFinite(amarillo) && minutos >= amarillo) return 'amarillo';
  return 'normal';
}

export function etiquetaEspera(minutos) {
  if (minutos < 1) return t('espera_nuevo');
  return Math.floor(minutos) + ' ' + t('espera_min');
}