import { nuevoRequestId } from '../../shared/api.js';
import { el } from '../../shared/dom.js';
import { t } from '../../shared/i18n.js';
import { construirEncabezadoPrincipal } from '../componentes/encabezado-principal.js';
import { construirModalCantidad } from '../componentes/modal-cantidad.js';
import {
  construirModalCancelar,
  construirModalFinalizada,
  construirModalFinalizar,
  construirModalPausa,
  construirModalPausaSelector
} from '../componentes/modales.js';
import { construirPanelActivo } from '../componentes/panel-activo.js';
import { construirPanelInventario } from '../componentes/panel-inventario.js';
import { construirTarjetaDespacho } from '../componentes/tarjeta-despacho.js';
import { construirTarjetaFila } from '../componentes/tarjeta-fila.js';
import { CANTIDAD_MAX, CANTIDAD_MIN, DURACION_AVISO_MS, SIN_CONEXION_MS } from '../config.js';
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
import {
  ahoraInventario,
  cantidadSugerida,
  detenerSondeoInventario,
  errorInventario,
  fijarRitmoInventario,
  inventarioActual,
  iniciarSondeoInventario,
  refrescarInventario,
  resumenInventario,
  suscribirInventario
} from '../servicios/inventario.js';
import { cambiarEstatus, claveErrorEstatus, esConflictoDeEstado } from '../servicios/pedidos.js';
import { claveErrorReposicion, registrarRelleno, reposicionResuelta, solicitarReabasto } from '../servicios/reposicion.js';
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
  inventarioAbierto: false,
  filtroEstado: '',
  filtroCategoria: '',
  cantidad: null,
  firmaTablero: '',
  firmaModal: '',
  firmaInventario: ''
};
let refs = null;
let desuscribir = null;
let desuscribirInventario = null;
let temporizadorAviso = null;

function reiniciarUi() {
  ui.modal = '';
  ui.pausaTipo = 'corto';
  ui.motivo = '';
  ui.enviando = false;
  ui.sincronizado = false;
  ui.esperaFresca = false;
  ui.vistos = null;
  ui.inventarioAbierto = false;
  ui.filtroEstado = '';
  ui.filtroCategoria = '';
  ui.cantidad = null;
  ui.firmaTablero = '';
  ui.firmaModal = '';
  ui.firmaInventario = '';
}

function salir() {
  detenerSondeo();
  detenerSondeoInventario();
  if (desuscribir) desuscribir();
  desuscribir = null;
  if (desuscribirInventario) desuscribirInventario();
  desuscribirInventario = null;
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

function ocultarInventario() {
  ui.inventarioAbierto = false;
  ui.filtroEstado = '';
  ui.filtroCategoria = '';
  fijarRitmoInventario(false);
}

function terminarJornada() {
  detenerSondeo();
  detenerSondeoInventario();
  cerrarSesionChef();
  ocultarInventario();
  ui.cantidad = null;
  ui.modal = 'finalizada';
}

function reconciliar(datos) {
  if (ui.modal === 'finalizada') return;
  if (!datos.yo || datos.yo.turno === 'ninguno') {
    terminarJornada();
    return;
  }
  if (datos.yo.turno === 'pausa') {
    ocultarInventario();
    ui.cantidad = null;
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
  refs.botonInventario.disabled = bloqueado;
  const alertas = resumenInventario(inventarioActual());
  refs.insignia.hidden = alertas.alerta === 0;
  refs.insignia.textContent = String(alertas.alerta);
  refs.insignia.classList.toggle('principal__insignia--rojo', alertas.agotado > 0);
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

function productoDe(productoId) {
  const productos = inventarioActual();
  return productos ? productos.find(producto => producto.producto_id === productoId) || null : null;
}

function pintarInventario(datos) {
  const abierto = ui.inventarioAbierto && ui.modal !== 'finalizada';
  refs.inventarioAnfitrion.hidden = !abierto;
  if (!abierto) {
    ui.firmaInventario = '';
    refs.inventarioAnfitrion.replaceChildren();
    return;
  }
  const productos = inventarioActual();
  const ahora = ahoraInventario();
  const firma = JSON.stringify([
    bloqueo(),
    ui.filtroEstado,
    ui.filtroCategoria,
    datos.pendientes.length,
    errorInventario(),
    Math.floor(ahora / 60000),
    productos
      ? productos.map(p => [p.producto_id, p.stock_actual, p.stock_minimo, p.estado, p.reabasto_pendiente, p.ultimo_relleno])
      : null
  ]);
  if (firma === ui.firmaInventario) return;
  ui.firmaInventario = firma;
  const anterior = refs.inventarioAnfitrion.querySelector('.inventario__lista');
  const desplazamiento = anterior ? anterior.scrollTop : 0;
  refs.inventarioAnfitrion.replaceChildren(
    construirPanelInventario({
      productos,
      error: errorInventario(),
      filtroEstado: ui.filtroEstado,
      filtroCategoria: ui.filtroCategoria,
      pedidosEnFila: datos.pendientes.length,
      deshabilitado: bloqueo(),
      ahora,
      alFiltrarEstado: filtrarEstado,
      alFiltrarCategoria: filtrarCategoria,
      alRellenar: producto => abrirCantidad('relleno', producto),
      alReabastecer: producto => abrirCantidad('reabasto', producto),
      alReintentar: refrescarInventario,
      alCerrar: cerrarInventario
    })
  );
  const nueva = refs.inventarioAnfitrion.querySelector('.inventario__lista');
  if (nueva) nueva.scrollTop = desplazamiento;
}

function construirModalActual(datos) {
  const deshabilitado = bloqueo();
  if (ui.modal === 'cantidad' && ui.cantidad) {
    const producto = productoDe(ui.cantidad.productoId);
    if (producto) {
      return construirModalCantidad({
        tipo: ui.cantidad.tipo,
        producto,
        valor: ui.cantidad.valor,
        deshabilitado,
        alCambiar: cambiarCantidad,
        alConfirmar: confirmarCantidad,
        alCancelar: cerrarModal
      });
    }
  }
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
  const producto = ui.cantidad ? productoDe(ui.cantidad.productoId) : null;
  const firma = [
    ui.modal,
    ui.pausaTipo,
    ui.motivo,
    bloqueo(),
    datos.activo ? datos.activo.pedido_id : '',
    ui.cantidad ? [ui.cantidad.tipo, ui.cantidad.productoId, ui.cantidad.valor, producto ? producto.stock_actual : ''] : ''
  ].join('|');
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
  if (ui.modal === 'cantidad' && inventarioActual() && (!ui.cantidad || !productoDe(ui.cantidad.productoId))) {
    ui.modal = '';
    ui.cantidad = null;
  }
  pintarEncabezado();
  pintarTablero(cola, datos);
  pintarInventario(datos);
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
  ui.cantidad = null;
  pintar();
}

function abrirInventario() {
  ui.inventarioAbierto = true;
  fijarRitmoInventario(true);
}

function cerrarInventario() {
  ocultarInventario();
  pintar();
}

function alternarInventario() {
  if (bloqueo()) return;
  if (ui.inventarioAbierto) {
    cerrarInventario();
    return;
  }
  abrirInventario();
  pintar();
}

function filtrarEstado(estado) {
  ui.filtroEstado = estado;
  pintar();
}

function filtrarCategoria(categoria) {
  ui.filtroCategoria = categoria;
  pintar();
}

function abrirCantidad(tipo, producto) {
  if (bloqueo()) return;
  ui.cantidad = {
    tipo,
    productoId: producto.producto_id,
    valor: cantidadSugerida(producto, CANTIDAD_MIN, CANTIDAD_MAX),
    requestId: nuevoRequestId()
  };
  ui.modal = 'cantidad';
  pintar();
}

function cambiarCantidad(valor) {
  if (!ui.cantidad || ui.enviando) return;
  ui.cantidad.valor = Math.max(CANTIDAD_MIN, Math.min(CANTIDAD_MAX, valor));
  pintar();
}

async function confirmarCantidad() {
  const solicitud = ui.cantidad;
  if (!solicitud) return;
  const producto = productoDe(solicitud.productoId);
  const operacion = solicitud.tipo === 'relleno' ? registrarRelleno : solicitarReabasto;
  const resultado = await ejecutar(() =>
    operacion(refs.chef.chef_id, solicitud.productoId, solicitud.valor, solicitud.requestId)
  );
  if (!resultado) return;
  if (resultado.ok) {
    ui.modal = '';
    ui.cantidad = null;
    const nombre = producto ? producto.nombre_es : '';
    const cantidad = Number(resultado.datos.cantidad);
    const prefijo = solicitud.tipo === 'relleno' ? t('aviso_relleno_ok') + ' +' : t('aviso_reabasto_ok') + ' ';
    mostrarAviso(prefijo + cantidad + ' ' + nombre);
    await refrescarInventario();
  } else {
    if (reposicionResuelta(resultado)) {
      ui.modal = '';
      ui.cantidad = null;
      refrescarInventario();
    }
    mostrarAviso(t(claveErrorReposicion(resultado)));
  }
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
  ocultarInventario();
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
  ocultarInventario();
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

  const encabezado = construirEncabezadoPrincipal({
    chef,
    alPausar: pedirPausa,
    alFinalizar: pedirFinalizar,
    alInventario: alternarInventario
  });
  const contadorFila = el('span', { clase: 'columna__contador', texto: '0' });
  const contadorDespacho = el('span', { clase: 'columna__contador', texto: '0' });
  const listaFila = el('div', { clase: 'columna__lista' });
  const listaDespacho = el('div', { clase: 'columna__lista' });
  const centro = el('div', { clase: 'columna__centro' });
  const aviso = el('p', { clase: 'principal__aviso', role: 'status', hidden: true });
  const inventarioAnfitrion = el('div', { clase: 'inventario-anfitrion', hidden: true });
  const modalAnfitrion = el('div', { clase: 'modal-anfitrion' });

  refs = {
    chef,
    botonPausa: encabezado.botonPausa,
    botonFinalizar: encabezado.botonFinalizar,
    botonInventario: encabezado.botonInventario,
    insignia: encabezado.insignia,
    banner: encabezado.banner,
    contadorFila,
    contadorDespacho,
    listaFila,
    listaDespacho,
    centro,
    aviso,
    inventarioAnfitrion,
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
    inventarioAnfitrion,
    modalAnfitrion,
    aviso
  );

  desuscribir = suscribirCola(pintar);
  desuscribirInventario = suscribirInventario(pintar);
  queueMicrotask(async () => {
    iniciarSondeo();
    iniciarSondeoInventario();
    pintar();
    await refrescarCola();
    ui.sincronizado = errorCola() === '';
    ui.esperaFresca = !ui.sincronizado;
    pintar();
  });
  return pantalla;
}