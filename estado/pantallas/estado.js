import { el } from '../../shared/dom.js';
import { construirBloque, pintarMas } from '../componentes/bloque.js';
import { construirEncabezado, formatoFecha, formatoHora } from '../componentes/encabezado.js';
import { actualizarTarjeta, construirTarjeta } from '../componentes/tarjeta.js';
import { MENSAJE_NEUTRO_MS, RUTAS, SIN_CONEXION_MS } from '../config.js';
import { datosActuales, errorActual, iniciarSondeo, msSinExito, suscribir } from '../servicios/consulta.js';
import { modelo, registrar } from '../servicios/tablero.js';
import { texto } from '../textos.js';

let refs = null;
let ultimoDato = null;

function reconciliar(rejilla, items, tipo) {
  const existentes = new Map(Array.from(rejilla.children, nodo => [nodo.dataset.numero, nodo]));
  const claves = new Set(items.map(item => String(item.numero)));
  existentes.forEach((nodo, clave) => {
    if (!claves.has(clave)) nodo.remove();
  });
  items.forEach((item, indice) => {
    const clave = String(item.numero);
    const previo = existentes.get(clave);
    const nodo = previo || construirTarjeta(item, tipo);
    if (previo) actualizarTarjeta(nodo, item, tipo);
    if (rejilla.children[indice] !== nodo) rejilla.insertBefore(nodo, rejilla.children[indice] || null);
  });
}

function claveMensaje() {
  if (errorActual() === 'E_AUTH') return 'sin_configurar';
  const espera = msSinExito();
  if (espera > MENSAJE_NEUTRO_MS) return 'neutro';
  if (espera > SIN_CONEXION_MS) return 'actualizando';
  return '';
}

function pintarMensaje() {
  const clave = claveMensaje();
  if (clave === refs.claveMensaje) return;
  refs.claveMensaje = clave;
  refs.mensaje.hidden = clave === '';
  if (clave === '') return;
  refs.mensaje.replaceChildren(
    el('span', { texto: texto(clave, 'es') }),
    el('span', { clase: 'estado__mensaje-en', lang: 'en', texto: texto(clave, 'en') })
  );
}

function pintarReloj(ahora) {
  const fecha = new Date(ahora);
  const hora = formatoHora(fecha);
  const dia = formatoFecha(fecha);
  if (refs.hora.textContent !== hora) refs.hora.textContent = hora;
  if (refs.fecha.textContent !== dia) refs.fecha.textContent = dia;
}

function pintar() {
  if (!refs) return;
  const ahora = Date.now();
  const datos = datosActuales();
  if (datos && datos !== ultimoDato) {
    ultimoDato = datos;
    registrar(datos, ahora);
  }
  const vista = modelo(ahora);
  reconciliar(refs.preparando.rejilla, vista.preparando, 'preparando');
  reconciliar(refs.listo.rejilla, vista.listo, 'listo');
  pintarMas(refs.preparando.mas, vista.masPreparando);
  pintarMas(refs.listo.mas, vista.masListo);
  refs.preparando.vacio.hidden = vista.preparando.length > 0;
  refs.listo.vacio.hidden = vista.listo.length > 0;
  pintarReloj(ahora);
  pintarMensaje();
}

export function construirEstado() {
  const encabezado = construirEncabezado();
  const preparando = construirBloque({ tipo: 'preparando', icono: RUTAS.olla, claveTitulo: 'preparacion' });
  const listo = construirBloque({ tipo: 'listo', icono: RUTAS.cubiertos, claveTitulo: 'listo' });
  const mensaje = el('p', { clase: 'estado__mensaje', role: 'status', hidden: true });

  refs = {
    hora: encabezado.hora,
    fecha: encabezado.fecha,
    preparando,
    listo,
    mensaje,
    claveMensaje: ''
  };
  ultimoDato = null;

  const pantalla = el(
    'section',
    { clase: 'pantalla estado' },
    encabezado.nodo,
    el('div', { clase: 'estado__panel' }, preparando.nodo, listo.nodo),
    mensaje
  );

  suscribir(pintar);
  setInterval(pintar, 1000);
  queueMicrotask(() => {
    pintar();
    iniciarSondeo();
  });
  return pantalla;
}