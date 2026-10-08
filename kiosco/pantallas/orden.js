import { el, imagen } from '../../shared/dom.js';
import { t, textoLocalizado } from '../../shared/i18n.js';
import { construirEncabezado } from '../componentes/encabezado.js';
import { construirLienzo } from '../componentes/tarjeta-producto.js';
import { construirTeclado } from '../componentes/teclado.js';
import { ESPERA_TRANQUILIZAR_MS, RUTAS } from '../config.js';
import { sesion } from '../estado.js';
import { ir, pantallaActual } from '../navegacion.js';
import { fijarCantidad, quitarLinea, unidadesTotales } from '../servicios/carrito.js';
import { catalogoActual, refrescarCatalogo } from '../servicios/catalogo.js';
import { enviarPedido } from '../servicios/pedido.js';
import { fijarPausaInactividad } from '../servicios/inactividad.js';

const LONGITUD_CANTIDAD = 2;
const DURACION_AVISO_MS = 2500;
const AVISOS = {
  max_producto: 'aviso_max_producto',
  max_total: 'aviso_max_total',
  agotado: 'aviso_agotado'
};

const ui = {
  generacion: -1,
  editando: '',
  texto: '',
  enviando: false,
  lento: false,
  bloqueado: false,
  mensaje: null
};
let refs = null;
let temporizadorAviso = null;
let temporizadorLento = null;

function restablecerUi() {
  clearTimeout(temporizadorAviso);
  clearTimeout(temporizadorLento);
  ui.generacion = sesion.generacion;
  ui.editando = '';
  ui.texto = '';
  ui.enviando = false;
  ui.lento = false;
  ui.bloqueado = false;
  ui.mensaje = null;
}

function lineasDelCarrito() {
  const datos = catalogoActual();
  if (!datos) return [];
  const productos = new Map(datos.productos.map(producto => [producto.producto_id, producto]));
  sesion.carrito
    .filter(linea => !productos.has(linea.producto_id))
    .forEach(linea => quitarLinea(linea.producto_id));
  return sesion.carrito.map(linea => ({ producto: productos.get(linea.producto_id), cantidad: linea.cantidad }));
}

function pintarCantidad(id) {
  const item = refs.cantidades.get(id);
  if (!item) return;
  const editando = ui.editando === id;
  const sinTexto = editando && ui.texto === '';
  item.texto.textContent = editando && !sinTexto ? ui.texto : String(item.cantidad);
  item.texto.classList.toggle('orden__cantidad-texto--pendiente', sinTexto);
  item.caja.classList.toggle('orden__cantidad--activa', editando);
  item.caja.classList.toggle('orden__cantidad--vacia', sinTexto);
}

function construirFila({ producto, cantidad }) {
  const id = producto.producto_id;
  const nombre = textoLocalizado(producto, 'nombre');
  const texto = el('span', { clase: 'orden__cantidad-texto' });
  const caja = el(
    'button',
    {
      type: 'button',
      clase: 'orden__cantidad',
      'aria-label': t('orden_cantidad_aria') + ' ' + nombre,
      disabled: ui.enviando,
      onclick: () => editar(id)
    },
    texto,
    el('span', { clase: 'orden__cursor', 'aria-hidden': 'true' })
  );
  const quitar = el(
    'button',
    {
      type: 'button',
      clase: 'orden__quitar',
      'aria-label': t('orden_quitar') + ' ' + nombre,
      disabled: ui.enviando,
      onclick: () => quitarProducto(id)
    },
    el('span', { clase: 'orden__equis', 'aria-hidden': 'true' })
  );
  const fila = el(
    'div',
    { clase: 'orden__fila' },
    el('div', { clase: 'orden__foto' }, construirLienzo(producto)),
    el('p', { clase: 'orden__nombre', texto: nombre }),
    el('div', { clase: 'orden__controles' }, caja, quitar)
  );
  refs.cantidades.set(id, { fila, caja, texto, cantidad });
  pintarCantidad(id);
  return fila;
}

function pintarLista() {
  const lineas = lineasDelCarrito();
  refs.columnas.hidden = lineas.length === 0;
  refs.vacio.hidden = lineas.length > 0;
  const desplazamiento = refs.lista.scrollTop;
  refs.cantidades = new Map();
  refs.lista.replaceChildren(...lineas.map(construirFila));
  refs.lista.scrollTop = desplazamiento;
}

function pintarGlobo() {
  const total = unidadesTotales();
  refs.globo.hidden = total === 0;
  refs.globo.textContent = String(total);
}

function pintarBotones() {
  refs.continuar.disabled = ui.enviando || ui.bloqueado || unidadesTotales() === 0;
  refs.continuarTexto.textContent = ui.enviando ? t('enviando') : t('continuar');
  refs.chevron.hidden = ui.enviando;
  refs.volver.disabled = ui.enviando;
}

function pintarMensaje() {
  let clave = '';
  let tipo = '';
  let extra = '';
  if (ui.mensaje) {
    clave = ui.mensaje.clave;
    tipo = ui.mensaje.tipo;
    extra = ui.mensaje.extra || '';
  } else if (ui.enviando && ui.lento) {
    clave = 'pedido_lento';
    tipo = 'info';
  }
  refs.mensaje.hidden = !clave;
  refs.mensaje.textContent = clave ? t(clave) + (extra ? ' ' + extra : '') : '';
  refs.mensaje.className = 'orden__mensaje' + (tipo ? ' orden__mensaje--' + tipo : '');
}

function pintarTeclado() {
  const editando = ui.editando !== '';
  refs.pantalla.classList.toggle('pantalla--teclado', editando);
  const actual = refs.acciones.querySelector('.teclado');
  if (actual && !editando) actual.remove();
  if (editando && !actual) {
    refs.acciones.append(
      construirTeclado({ modo: 'numerico', alTecla: escribir, alBorrar: borrar, alListo: listo })
    );
  }
}

function verFila(id) {
  const item = refs.cantidades.get(id);
  if (!item) return;
  const lista = refs.lista;
  const arriba = item.fila.offsetTop;
  const abajo = arriba + item.fila.offsetHeight;
  if (arriba < lista.scrollTop) lista.scrollTop = arriba;
  else if (abajo > lista.scrollTop + lista.clientHeight) lista.scrollTop = abajo - lista.clientHeight;
}

function actualizar() {
  if (!refs || pantallaActual() !== 'orden') return;
  pintarLista();
  pintarGlobo();
  pintarBotones();
  pintarMensaje();
  pintarTeclado();
}

function mostrarAviso(texto) {
  clearTimeout(temporizadorAviso);
  refs.aviso.textContent = texto;
  refs.aviso.hidden = false;
  temporizadorAviso = setTimeout(() => {
    if (refs) refs.aviso.hidden = true;
  }, DURACION_AVISO_MS);
}

function editar(id) {
  if (ui.enviando) return;
  ui.editando = id;
  ui.texto = '';
  ui.mensaje = null;
  actualizar();
  verFila(id);
}

function escribir(caracter) {
  if (!ui.editando || ui.texto.length >= LONGITUD_CANTIDAD) return;
  ui.texto += caracter;
  pintarCantidad(ui.editando);
}

function borrar() {
  if (!ui.editando) return;
  ui.texto = ui.texto.slice(0, -1);
  pintarCantidad(ui.editando);
}

function listo() {
  const id = ui.editando;
  const texto = ui.texto;
  ui.editando = '';
  ui.texto = '';
  const datos = catalogoActual();
  if (id && texto !== '' && datos) {
    const producto = datos.productos.find(item => item.producto_id === id);
    if (producto) {
      const resultado = fijarCantidad(producto, Number(texto), datos.limites);
      if (AVISOS[resultado]) mostrarAviso(t(AVISOS[resultado]));
    }
  }
  actualizar();
}

function quitarProducto(id) {
  if (ui.enviando) return;
  quitarLinea(id);
  ui.mensaje = null;
  if (ui.editando === id) {
    ui.editando = '';
    ui.texto = '';
  }
  actualizar();
}

async function reconciliarCarrito() {
  const antes = catalogoActual();
  const nombresPrevios = new Map(
    (antes ? antes.productos : []).map(producto => [producto.producto_id, textoLocalizado(producto, 'nombre')])
  );
  const refresco = await refrescarCatalogo();
  const datos = catalogoActual();
  if (!refresco.ok || !datos) return null;
  const productos = new Map(datos.productos.map(producto => [producto.producto_id, producto]));
  const cambiados = [];
  sesion.carrito.slice().forEach(linea => {
    const producto = productos.get(linea.producto_id);
    if (!producto || producto.agotado) {
      cambiados.push(nombresPrevios.get(linea.producto_id) || linea.producto_id);
      quitarLinea(linea.producto_id);
      return;
    }
    const tope = Math.min(Number(producto.disponible_max), Number(datos.limites.max_cantidad_producto));
    if (linea.cantidad > tope) {
      fijarCantidad(producto, tope, datos.limites);
      cambiados.push(textoLocalizado(producto, 'nombre'));
    }
  });
  return cambiados;
}

async function ajustarPorDisponibilidad() {
  const cambiados = await reconciliarCarrito();
  if (cambiados === null) return { clave: 'err_red', tipo: 'error' };
  if (cambiados.length === 0) return null;
  return { clave: 'pedido_stock', tipo: 'error', extra: Array.from(new Set(cambiados)).join(', ') + '.' };
}

async function resolverFallo(resultado) {
  if (resultado.tipo === 'red') return { clave: 'err_red', tipo: 'error' };
  if (resultado.tipo === 'servidor') {
    if (resultado.code === 'E_STOCK') {
      const ajuste = await ajustarPorDisponibilidad();
      return ajuste || { clave: 'pedido_stock_reintento', tipo: 'error' };
    }
    if (resultado.code === 'E_NOT_FOUND') {
      const ajuste = await ajustarPorDisponibilidad();
      if (ajuste) return ajuste;
      ui.bloqueado = true;
      return { clave: 'pedido_huesped', tipo: 'error' };
    }
    if (resultado.code === 'E_RATE') return { clave: 'pedido_rate', tipo: 'error' };
  }
  return { clave: 'err_general', tipo: 'error' };
}

async function continuar() {
  if (ui.enviando || ui.bloqueado || unidadesTotales() === 0) return;
  const generacion = sesion.generacion;
  ui.editando = '';
  ui.texto = '';
  ui.mensaje = null;
  ui.enviando = true;
  ui.lento = false;
  clearTimeout(temporizadorLento);
  actualizar();
  fijarPausaInactividad(true);
  temporizadorLento = setTimeout(() => {
    if (sesion.generacion !== generacion || !ui.enviando) return;
    ui.lento = true;
    actualizar();
  }, ESPERA_TRANQUILIZAR_MS);
  try {
    const resultado = await enviarPedido();
    clearTimeout(temporizadorLento);
    if (sesion.generacion !== generacion) return;
    if (resultado.ok) {
      ui.enviando = false;
      ui.lento = false;
      sesion.pedido = null;
      sesion.carrito = [];
      sesion.ticket = { numero: resultado.numero };
      ir('ticket');
      return;
    }
    const mensaje = await resolverFallo(resultado);
    if (sesion.generacion !== generacion) return;
    ui.enviando = false;
    ui.lento = false;
    ui.mensaje = mensaje;
    actualizar();
  } finally {
    clearTimeout(temporizadorLento);
    fijarPausaInactividad(false);
  }
}

function volver() {
  if (ui.enviando) return;
  ui.editando = '';
  ui.texto = '';
  ui.mensaje = null;
  ui.bloqueado = false;
  ir('menu');
}

export function construirOrden() {
  if (ui.generacion !== sesion.generacion) restablecerUi();

  const globo = el('span', { clase: 'orden__globo', hidden: true });
  const columnas = el(
    'div',
    { clase: 'orden__columnas' },
    el('span', { texto: t('orden_producto') }),
    el('span', { texto: t('orden_cantidad') })
  );
  const lista = el('div', { clase: 'orden__lista' });
  const vacio = el('p', { clase: 'orden__vacio', texto: t('orden_vacia'), hidden: true });
  const aviso = el('p', { clase: 'orden__aviso', role: 'status', hidden: true });
  const mensaje = el('p', { clase: 'orden__mensaje', role: 'alert', hidden: true });

  const volverBoton = el(
    'button',
    { type: 'button', clase: 'boton orden__boton orden__volver', onclick: volver },
    el('span', { clase: 'orden__chevron orden__chevron--atras', 'aria-hidden': 'true' }),
    el('span', { texto: t('volver') })
  );
  const continuarTexto = el('span', { texto: t('continuar') });
  const chevron = el('span', { clase: 'orden__chevron', 'aria-hidden': 'true' });
  const continuarBoton = el(
    'button',
    { type: 'button', clase: 'boton orden__boton orden__seguir', onclick: continuar },
    continuarTexto,
    chevron
  );
  const acciones = el('div', { clase: 'zona-acciones' }, volverBoton, continuarBoton);

  const pantalla = el(
    'section',
    { clase: 'pantalla pantalla--orden' },
    construirEncabezado({ alVolver: volver }),
    el(
      'div',
      { clase: 'zona-contenido orden' },
      imagen(RUTAS.iconoOrden, { clase: 'orden__icono', contener: true }),
      globo,
      el('h1', { clase: 'orden__titulo', texto: t('orden_titulo') }),
      columnas,
      lista,
      vacio,
      aviso,
      mensaje
    ),
    acciones
  );

  refs = {
    pantalla,
    acciones,
    lista,
    columnas,
    vacio,
    globo,
    aviso,
    mensaje,
    volver: volverBoton,
    continuar: continuarBoton,
    continuarTexto,
    chevron,
    cantidades: new Map()
  };

  queueMicrotask(actualizar);
  return pantalla;
}