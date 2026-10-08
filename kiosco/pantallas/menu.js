import { el, imagen } from '../../shared/dom.js';
import { t, textoLocalizado } from '../../shared/i18n.js';
import { construirEncabezado } from '../componentes/encabezado.js';
import { construirTarjetaProducto } from '../componentes/tarjeta-producto.js';
import { RUTAS } from '../config.js';
import { sesion } from '../estado.js';
import { ir, pantallaActual } from '../navegacion.js';
import { agregarAlCarrito, unidadesTotales } from '../servicios/carrito.js';
import { cargarCatalogo, catalogoActual, catalogoVigente } from '../servicios/catalogo.js';

const ESPERA_LENTA_MS = 10000;
const DURACION_AVISO_MS = 2500;
const AVISOS = { max_producto: 'aviso_max_producto', max_total: 'aviso_max_total' };
const CATEGORIAS_ESQUELETO = 7;
const TARJETAS_ESQUELETO = 6;

const ui = { generacion: -1, categoria: '', error: false, lento: false, esperando: false };
let refs = null;
let temporizadorLento = null;
let temporizadorAviso = null;

function restablecerUi() {
  clearTimeout(temporizadorLento);
  clearTimeout(temporizadorAviso);
  ui.generacion = sesion.generacion;
  ui.categoria = '';
  ui.error = false;
  ui.lento = false;
  ui.esperando = false;
}

function listarCategorias(datos) {
  const vistas = new Map();
  datos.productos.forEach(producto => {
    if (!vistas.has(producto.categoria_es)) vistas.set(producto.categoria_es, producto);
  });
  return Array.from(vistas, ([clave, producto]) => ({ clave, nombre: textoLocalizado(producto, 'categoria') }));
}

function pintarCategorias(lista) {
  refs.categorias.replaceChildren(
    ...lista.map(categoria =>
      el('button', {
        type: 'button',
        clase: 'categoria' + (categoria.clave === ui.categoria ? ' categoria--activa' : ''),
        'aria-pressed': categoria.clave === ui.categoria ? 'true' : 'false',
        texto: categoria.nombre,
        onclick: () => elegirCategoria(categoria.clave)
      })
    )
  );
}

function pintarCatalogo(datos) {
  const lista = listarCategorias(datos);
  if (!lista.some(categoria => categoria.clave === ui.categoria)) {
    ui.categoria = lista.length ? lista[0].clave : '';
  }
  const desplazamientoCategorias = refs.categorias.scrollTop;
  pintarCategorias(lista);
  refs.categorias.scrollTop = desplazamientoCategorias;
  const desplazamiento = refs.cuadricula.scrollTop;
  const mismaCategoria = refs.categoriaPintada === ui.categoria;
  refs.cuadricula.replaceChildren(
    ...datos.productos
      .filter(producto => producto.categoria_es === ui.categoria)
      .map(producto => construirTarjetaProducto(producto, { alAgregar: agregar }))
  );
  refs.cuadricula.scrollTop = mismaCategoria ? desplazamiento : 0;
  refs.categoriaPintada = ui.categoria;
}

function construirEsqueletoCategorias() {
  return Array.from({ length: CATEGORIAS_ESQUELETO }, (_, indice) =>
    el(
      'div',
      {
        clase: 'categoria-esqueleto' + (indice === 0 ? ' categoria-esqueleto--activa' : ''),
        'aria-hidden': 'true'
      },
      el('span', { clase: 'esqueleto categoria-esqueleto__texto' })
    )
  );
}

function construirEsqueletoTarjetas() {
  return Array.from({ length: TARJETAS_ESQUELETO }, () =>
    el(
      'div',
      { clase: 'tarjeta-esqueleto', 'aria-hidden': 'true' },
      el('div', { clase: 'esqueleto tarjeta-esqueleto__foto' }, el('span', { clase: 'tarjeta-esqueleto__boton' })),
      el(
        'div',
        { clase: 'tarjeta-esqueleto__nombre' },
        el('span', { clase: 'esqueleto tarjeta-esqueleto__linea' }),
        el('span', { clase: 'esqueleto tarjeta-esqueleto__linea tarjeta-esqueleto__linea--corta' })
      )
    )
  );
}

function pintarEsqueleto() {
  if (!refs.esqueletoListo) {
    refs.categorias.replaceChildren(...construirEsqueletoCategorias());
    refs.cuadricula.replaceChildren(...construirEsqueletoTarjetas());
    refs.esqueletoListo = true;
  }
  refs.cuadricula.setAttribute('aria-busy', 'true');
  refs.cuadricula.setAttribute('aria-label', t('menu_cargando'));
}

function quitarCarga() {
  refs.cuadricula.removeAttribute('aria-busy');
  refs.cuadricula.removeAttribute('aria-label');
}

function pintarEstado() {
  refs.estadoTexto.textContent = t('menu_error');
  refs.reintentar.textContent = t('reintentar');
}

function pintarGlobo() {
  const total = unidadesTotales();
  refs.globo.hidden = total === 0;
  refs.globo.textContent = String(total);
  refs.orden.setAttribute('aria-label', t('orden_aria') + ': ' + total);
}

function actualizar() {
  if (!refs || pantallaActual() !== 'menu') return;
  const datos = catalogoActual();
  const fallo = datos === null && ui.error;
  refs.estado.hidden = !fallo;
  refs.categorias.hidden = fallo;
  refs.cuadricula.hidden = fallo;
  refs.lento.hidden = !(datos === null && !ui.error && ui.lento);
  refs.lento.textContent = t('menu_lento');
  if (datos) {
    quitarCarga();
    pintarCatalogo(datos);
  } else if (fallo) {
    pintarEstado();
  } else {
    pintarEsqueleto();
  }
  pintarGlobo();
}

function sincronizar() {
  if (catalogoVigente() || ui.esperando) return;
  const generacion = sesion.generacion;
  ui.esperando = true;
  ui.error = false;
  ui.lento = false;
  clearTimeout(temporizadorLento);
  if (!catalogoActual()) {
    temporizadorLento = setTimeout(() => {
      if (sesion.generacion !== generacion || !ui.esperando) return;
      ui.lento = true;
      actualizar();
    }, ESPERA_LENTA_MS);
  }
  cargarCatalogo().then(resultado => {
    clearTimeout(temporizadorLento);
    ui.esperando = false;
    ui.lento = false;
    if (sesion.generacion !== generacion) return;
    ui.error = !resultado.ok && !catalogoActual();
    actualizar();
  });
}

function reintentar() {
  ui.error = false;
  actualizar();
  sincronizar();
}

function elegirCategoria(clave) {
  const datos = catalogoActual();
  if (!datos || clave === ui.categoria) return;
  ui.categoria = clave;
  pintarCatalogo(datos);
}

function mostrarAviso(clave) {
  clearTimeout(temporizadorAviso);
  refs.aviso.textContent = t(clave);
  refs.aviso.hidden = false;
  temporizadorAviso = setTimeout(() => {
    if (refs) refs.aviso.hidden = true;
  }, DURACION_AVISO_MS);
}

function agregar(producto) {
  const datos = catalogoActual();
  if (!datos) return;
  const resultado = agregarAlCarrito(producto, datos.limites);
  if (resultado === 'ok') pintarGlobo();
  else if (AVISOS[resultado]) mostrarAviso(AVISOS[resultado]);
}

export function construirMenu() {
  if (ui.generacion !== sesion.generacion) restablecerUi();

  const globo = el('span', { clase: 'menu__globo', hidden: true });
  const orden = el(
    'div',
    { clase: 'menu__orden', role: 'img' },
    imagen(RUTAS.iconoOrden, { clase: 'menu__orden-icono', contener: true }),
    globo
  );
  const categorias = el('nav', { clase: 'menu__categorias' });
  const cuadricula = el('div', { clase: 'menu__cuadricula' });
  const estadoTexto = el('p', { clase: 'menu__estado-texto', role: 'status' });
  const reintentarBoton = el('button', {
    type: 'button',
    clase: 'boton menu__reintentar',
    texto: t('reintentar'),
    onclick: reintentar
  });
  const estado = el('div', { clase: 'menu__estado', hidden: true }, estadoTexto, reintentarBoton);
  const lento = el('p', { clase: 'menu__lento', role: 'status', hidden: true });
  const aviso = el('p', { clase: 'menu__aviso', role: 'status', hidden: true });

  refs = {
    categorias,
    cuadricula,
    categoriaPintada: null,
    esqueletoListo: false,
    estado,
    estadoTexto,
    reintentar: reintentarBoton,
    lento,
    orden,
    globo,
    aviso
  };

  const pantalla = el(
    'section',
    { clase: 'pantalla pantalla--menu' },
    construirEncabezado({ alVolver: () => ir('identificacion') }),
    el(
      'div',
      { clase: 'zona-contenido menu' },
      el('h1', { clase: 'menu__titulo', texto: t('menu_titulo') }),
      orden,
      categorias,
      cuadricula,
      estado,
      lento,
      aviso
    )
  );

  queueMicrotask(() => {
    actualizar();
    sincronizar();
  });
  return pantalla;
}