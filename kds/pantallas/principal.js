import { el } from '../../shared/dom.js';
import { t } from '../../shared/i18n.js';
import { construirEncabezadoPrincipal } from '../componentes/encabezado-principal.js';
import {
  construirModalCancelar,
  construirModalFinalizada,
  construirModalFinalizar,
  construirModalPausa,
  construirModalPausaSelector
} from '../componentes/modales.js';
import { construirPanelActivo } from '../componentes/panel-activo.js';
import { construirTarjetaDespacho } from '../componentes/tarjeta-despacho.js';
import { construirTarjetaFila } from '../componentes/tarjeta-fila.js';
import { DURACION_AVISO_MS, SIN_CONEXION_MS } from '../config.js';
import { cerrarSesionChef, sesion } from '../estado.js';
import { ir, pantallaActual } from '../navegacion.js';
import {
  colaActual,
  detenerSondeo,
  errorCola,
  iniciarSondeo,
  msDesdeUltimoExito,
  refrescarCola,
  suscribirCola
} from '../servicios/cola.js';
import { cambiarEstatus, claveErrorEstatus, esConflictoDeEstado } from '../servicios/pedidos.js';
import { minutosEspera, nivelEspera } from '../servicios/semaforo.js';
import { sonarPedidoNuevo } from '../servicios/sonido.js';
import { claveErrorGeneral } from '../servicios/solicitudes.js';
import { cerrarTurno, claveErrorPausa, pausarTurno, reanudarTurno } from '../servicios/turnos.js';

const ui = {
  modal: '',
  pausaTipo: 'corto',
  motivo: '',
  enviando: false,
  sincronizado: false,
  esperaFresca: false,
  vistos: null,
  firmaTablero: '',
  firmaModal: ''
};
let refs = null;
let desuscribir = null;
let temporizadorAviso = null;

function reiniciarUi() {
  ui.modal = '';
  ui.pausaTipo = 'corto';
  ui.motivo = '';
  ui.enviando = false;
  ui.sincronizado = false;
  ui.esperaFresca = false;
  ui.vistos = null;
  ui.firmaTablero = '';
  ui.firmaModal = '';
}

function salir() {
  detenerSondeo();
  if (desuscribir) desuscribir();
  desuscribir = null;
  clearTimeout(temporizadorAviso);
}

function marca(valor) {
  const numero = Date.parse(valor);
  return Number.isFinite(numero) ? numero : 0;
}

function derivar(cola) {
  const chefId = refs.chef.chef_id;
  return {
    yo: cola.chefs.find(chef => chef.chef_id === chefId) || null,
    pendientes: cola.pedidos
      .filter(pedido => pedido.estatus === 'pendiente')
      .sort((a, b) => marca(a.hora_llegada) - marca(b.hora_llegada)),
    activo: cola.pedidos.find(pedido => pedido.estatus === 'en_preparacion' && pedido.chef_id === chefId) || null,
    completos: cola.pedidos
      .filter(pedido => pedido.estatus === 'completo')
      .sort((a, b) => marca(a.hora_completo) - marca(b.hora_completo))
  };
}

function sinConexion() {
  return errorCola() !== '' && msDesdeUltimoExito() > SIN_CONEXION_MS;
}

function bloqueo() {
  return ui.enviando || ui.modal === 'finalizada' || sinConexion();
}

function hayActivo() {
  const cola = colaActual();
  return cola ? derivar(cola).activo !== null : false;
}

function mostrarAviso(texto) {
  clearTimeout(temporizadorAviso);
  refs.aviso.textContent = texto;
  refs.aviso.hidden = false;
  temporizadorAviso = setTimeout(() => {
    if (refs) refs.aviso.hidden = true;
  }, DURACION_AVISO_MS);
}

function detectarNuevos(cola) {
  const ids = new Set(cola.pedidos.map(pedido => pedido.pedido_id));
  if (ui.vistos) {
    const hayNuevo = cola.pedidos.some(pedido => pedido.estatus === 'pendiente' && !ui.vistos.has(pedido.pedido_id));
    if (hayNuevo && ui.modal !== 'pausa') sonarPedidoNuevo();
  }
  ui.vistos = ids;
}

function terminarJornada() {
  detenerSondeo();
  cerrarSesionChef();
  ui.modal = 'finalizada';
}

function reconciliar(datos) {
  if (ui.modal === 'finalizada') return;
  if (!datos.yo || datos.yo.turno === 'ninguno') {
    terminarJornada();
    return;
  }
  if (datos.yo.turno === 'pausa') {
    ui.modal = 'pausa';
    ui.pausaTipo = datos.yo.pausa_tipo === 'comida' ? 'comida' : 'corto';
    return;
  }
  if (ui.modal === 'pausa') ui.modal = '';
}

function pintarEncabezado() {
  const bloqueado = bloqueo();
  refs.banner.hidden = !sinConexion();
  refs.botonPausa.disabled = bloqueado;
  refs.botonFinalizar.disabled = bloqueado;
}

function vistaDe(pedido, parametros) {
  const minutos = minutosEspera(pedido);
  return { pedido, minutos, nivel: nivelEspera(minutos, parametros) };
}

function pintarLista(contenedor, nodos, vacio) {
  const desplazamiento = contenedor.scrollTop;
  contenedor.replaceChildren(...(nodos.length ? nodos : [el('p', { clase: 'columna__vacio', texto: vacio })]));
  contenedor.scrollTop = desplazamiento;
}

function pintarTablero(cola, datos) {
  const bloqueado = bloqueo();
  const fila = datos.pendientes.map(pedido => vistaDe(pedido, cola.parametros));
  const activo = datos.activo ? vistaDe(datos.activo, cola.parametros) : null;
  const firma = JSON.stringify([
    bloqueado,
    fila.map(vista => [vista.pedido.pedido_id, Math.floor(vista.minutos), vista.nivel]),
    activo ? [activo.pedido.pedido_id, Math.floor(activo.minutos), activo.nivel] : null,
    datos.completos.map(pedido => pedido.pedido_id)
  ]);
  if (firma === ui.firmaTablero) return;
  ui.firmaTablero = firma;

  refs.contadorFila.textContent = String(fila.length);
  refs.contadorDespacho.textContent = String(datos.completos.length);
  pintarLista(
    refs.listaFila,
    fila.map(vista =>
      construirTarjetaFila(vista.pedido, {
        minutos: vista.minutos,
        nivel: vista.nivel,
        deshabilitado: bloqueado || activo !== null,
        alComenzar: comenzar
      })
    ),
    t('fila_vacia')
  );
  pintarLista(
    refs.listaDespacho,
    datos.completos.map(pedido =>
      construirTarjetaDespacho(pedido, { deshabilitado: bloqueado, alDespachar: despachar })
    ),
    t('despachados_vacio')
  );
  refs.centro.replaceChildren(
    activo
      ? construirPanelActivo(activo.pedido, {
          minutos: activo.minutos,
          nivel: activo.nivel,
          deshabilitado: bloqueado,
          alListo: marcarListo,
          alCancelar: pedirCancelacion,
          alDevolver: devolver
        })
      : el('p', { clase: 'principal__vacio-centro', texto: t('activo_vacio') })
  );
}

function construirModalActual(datos) {
  const deshabilitado = bloqueo();
  if (ui.modal === 'selector') {
    return construirModalPausaSelector({ deshabilitado, alElegir: elegirPausa, alCerrar: cerrarModal });
  }
  if (ui.modal === 'pausa') {
    return construirModalPausa({ chef: refs.chef, tipo: ui.pausaTipo, deshabilitado, alVolver: volverACocinar });
  }
  if (ui.modal === 'cancelar' && datos.activo) {
    return construirModalCancelar({
      pedido: datos.activo,
      motivo: ui.motivo,
      deshabilitado,
      alElegir: elegirMotivo,
      alConfirmar: confirmarCancelacion,
      alVolver: cerrarModal
    });
  }
  if (ui.modal === 'finalizar') {
    return construirModalFinalizar({
      chef: refs.chef,
      deshabilitado,
      alConfirmar: confirmarFinalizar,
      alVolver: cerrarModal
    });
  }
  if (ui.modal === 'finalizada') return construirModalFinalizada({ alInicio: irAInicio });
  return null;
}

function pintarModal(datos) {
  const firma = [ui.modal, ui.pausaTipo, ui.motivo, bloqueo(), datos.activo ? datos.activo.pedido_id : ''].join('|');
  if (firma === ui.firmaModal) return;
  ui.firmaModal = firma;
  const nodo = construirModalActual(datos);
  if (nodo) refs.modalAnfitrion.replaceChildren(nodo);
  else refs.modalAnfitrion.replaceChildren();
}

function pintar() {
  if (!refs || pantallaActual() !== 'principal') return;
  const cola = colaActual();
  if (!cola) return;
  if (!ui.sincronizado && !ui.enviando && ui.esperaFresca && errorCola() === '') ui.sincronizado = true;
  const datos = derivar(cola);
  detectarNuevos(cola);
  if (ui.sincronizado && !ui.enviando) reconciliar(datos);
  if (ui.modal === 'cancelar' && !datos.activo) {
    ui.modal = '';
    ui.motivo = '';
  }
  pintarEncabezado();
  pintarTablero(cola, datos);
  pintarModal(datos);
}

async function ejecutar(operacion) {
  if (bloqueo()) return null;
  ui.enviando = true;
  pintar();
  let resultado = null;
  try {
    resultado = await operacion();
    await refrescarCola();
    ui.sincronizado = errorCola() === '';
    ui.esperaFresca = !ui.sincronizado;
  } finally {
    ui.enviando = false;
  }
  return resultado;
}

function resolverEstatus(resultado, pedido, transicion) {
  if (resultado && !resultado.ok) {
    const error = claveErrorEstatus(resultado, transicion);
    mostrarAviso(t(error.clave) + (error.conNumero ? ' ' + pedido.numero + '.' : ''));
  }
  pintar();
}

async function transicionar(pedido, transicion, motivo) {
  const resultado = await ejecutar(() => cambiarEstatus(pedido.pedido_id, transicion, refs.chef.chef_id, motivo));
  resolverEstatus(resultado, pedido, transicion);
  return resultado;
}

function comenzar(pedido) {
  return transicionar(pedido, 'tomar');
}

function marcarListo(pedido) {
  return transicionar(pedido, 'completar');
}

function despachar(pedido) {
  return transicionar(pedido, 'recibir');
}

function devolver(pedido) {
  return transicionar(pedido, 'liberar');
}

function cerrarModal() {
  if (ui.enviando) return;
  ui.modal = '';
  ui.motivo = '';
  pintar();
}

function pedirCancelacion() {
  if (bloqueo()) return;
  ui.modal = 'cancelar';
  ui.motivo = '';
  pintar();
}

function elegirMotivo(clave) {
  ui.motivo = clave;
  pintar();
}

async function confirmarCancelacion(pedido) {
  if (!ui.motivo) return;
  const resultado = await ejecutar(() =>
    cambiarEstatus(pedido.pedido_id, 'cancelar', refs.chef.chef_id, ui.motivo)
  );
  if (resultado && (resultado.ok || esConflictoDeEstado(resultado))) {
    ui.modal = '';
    ui.motivo = '';
  }
  resolverEstatus(resultado, pedido, 'cancelar');
}

function pedirPausa() {
  if (bloqueo()) return;
  if (hayActivo()) {
    mostrarAviso(t('aviso_pedido_activo'));
    return;
  }
  ui.modal = 'selector';
  pintar();
}

async function elegirPausa(tipo) {
  const resultado = await ejecutar(() => pausarTurno(refs.chef.chef_id, tipo));
  if (!resultado) return;
  if (resultado.ok) {
    ui.modal = 'pausa';
    ui.pausaTipo = resultado.datos.tipo === 'comida' ? 'comida' : 'corto';
  } else {
    ui.modal = '';
    mostrarAviso(t(claveErrorPausa(resultado) || claveErrorGeneral(resultado)));
  }
  pintar();
}

async function volverACocinar() {
  const resultado = await ejecutar(() => reanudarTurno(refs.chef.chef_id));
  if (!resultado) return;
  if (resultado.ok || (resultado.codigo === 'E_CONFLICT' && resultado.razon === 'turno_no_pausado')) {
    ui.modal = '';
  } else {
    mostrarAviso(t(claveErrorPausa(resultado) || claveErrorGeneral(resultado)));
  }
  pintar();
}

function pedirFinalizar() {
  if (bloqueo()) return;
  if (hayActivo()) {
    mostrarAviso(t('aviso_pedido_activo'));
    return;
  }
  ui.modal = 'finalizar';
  pintar();
}

async function confirmarFinalizar() {
  const resultado = await ejecutar(() => cerrarTurno(refs.chef.chef_id));
  if (!resultado) return;
  if (resultado.ok || (resultado.codigo === 'E_CONFLICT' && resultado.razon === 'sin_turno_abierto')) {
    terminarJornada();
  } else {
    ui.modal = '';
    mostrarAviso(t(claveErrorPausa(resultado) || claveErrorGeneral(resultado)));
  }
  pintar();
}

function irAInicio() {
  salir();
  cerrarSesionChef();
  ir('chefs');
}

function construirColumna(clase, titulo, contador, lista) {
  return el(
    'section',
    { clase: 'columna ' + clase },
    el('header', { clase: 'columna__cabecera' }, el('h2', { clase: 'columna__titulo', texto: titulo }), contador),
    lista
  );
}

export function construirPrincipal() {
  const chef = sesion.chef;
  if (!chef) {
    queueMicrotask(() => ir('chefs'));
    return el('section', { clase: 'pantalla' });
  }
  salir();
  reiniciarUi();

  const encabezado = construirEncabezadoPrincipal({ chef, alPausar: pedirPausa, alFinalizar: pedirFinalizar });
  const contadorFila = el('span', { clase: 'columna__contador', texto: '0' });
  const contadorDespacho = el('span', { clase: 'columna__contador', texto: '0' });
  const listaFila = el('div', { clase: 'columna__lista' });
  const listaDespacho = el('div', { clase: 'columna__lista' });
  const centro = el('div', { clase: 'columna__centro' });
  const aviso = el('p', { clase: 'principal__aviso', role: 'status', hidden: true });
  const modalAnfitrion = el('div', { clase: 'modal-anfitrion' });

  refs = {
    chef,
    botonPausa: encabezado.botonPausa,
    botonFinalizar: encabezado.botonFinalizar,
    banner: encabezado.banner,
    contadorFila,
    contadorDespacho,
    listaFila,
    listaDespacho,
    centro,
    aviso,
    modalAnfitrion
  };

  const pantalla = el(
    'section',
    { clase: 'pantalla principal' },
    encabezado.nodo,
    el(
      'div',
      { clase: 'principal__cuerpo' },
      construirColumna('columna--fila', t('columna_fila'), contadorFila, listaFila),
      el('section', { clase: 'columna columna--centro' }, centro),
      construirColumna('columna--despacho', t('columna_despachados'), contadorDespacho, listaDespacho)
    ),
    modalAnfitrion,
    aviso
  );

  desuscribir = suscribirCola(pintar);
  queueMicrotask(async () => {
    iniciarSondeo();
    pintar();
    await refrescarCola();
    ui.sincronizado = errorCola() === '';
    ui.esperaFresca = !ui.sincronizado;
    pintar();
  });
  return pantalla;
}