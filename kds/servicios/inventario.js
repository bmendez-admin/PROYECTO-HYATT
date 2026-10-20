import { ErrorRed, llamar } from '../../shared/api.js';
import { LIMITE_INVENTARIO_MS, SONDEO_INVENTARIO_ABIERTO_MS, SONDEO_INVENTARIO_MS } from '../config.js';

const ORDEN_ESTADO = { agotado: 0, bajo: 1, ok: 2 };

const suscriptores = new Set();
const instantanea = { datos: null, error: '', desfase: 0 };
let enCurso = null;
let temporizador = null;
let sondeando = false;
let ronda = 0;
let intervalo = SONDEO_INVENTARIO_MS;

export function inventarioActual() {
  return instantanea.datos ? instantanea.datos.productos : null;
}

export function errorInventario() {
  return instantanea.error;
}

export function ahoraInventario() {
  return Date.now() + instantanea.desfase;
}

export function suscribirInventario(oyente) {
  suscriptores.add(oyente);
  return () => suscriptores.delete(oyente);
}

function avisar() {
  suscriptores.forEach(oyente => oyente());
}

async function pedir() {
  try {
    const resultado = await llamar('inventario', {}, { limiteTotalMs: LIMITE_INVENTARIO_MS });
    if (resultado.ok) {
      instantanea.datos = resultado.data;
      instantanea.error = '';
      const servidor = Date.parse(resultado.data.hora_servidor);
      if (Number.isFinite(servidor)) instantanea.desfase = servidor - Date.now();
    } else {
      instantanea.error = resultado.code;
    }
  } catch (error) {
    if (!(error instanceof ErrorRed)) throw error;
    instantanea.error = 'E_RED';
  }
  avisar();
}

export function consultarInventario() {
  if (!enCurso) {
    enCurso = pedir().finally(() => {
      enCurso = null;
    });
  }
  return enCurso;
}

export async function refrescarInventario() {
  if (enCurso) await enCurso;
  return consultarInventario();
}

async function ciclo(miRonda) {
  await consultarInventario();
  if (!sondeando || miRonda !== ronda) return;
  temporizador = setTimeout(() => ciclo(miRonda), intervalo);
}

export function detenerSondeoInventario() {
  sondeando = false;
  ronda += 1;
  clearTimeout(temporizador);
}

export function iniciarSondeoInventario() {
  detenerSondeoInventario();
  intervalo = SONDEO_INVENTARIO_MS;
  sondeando = true;
  ronda += 1;
  ciclo(ronda);
}

export function fijarRitmoInventario(abierto) {
  intervalo = abierto ? SONDEO_INVENTARIO_ABIERTO_MS : SONDEO_INVENTARIO_MS;
  if (!abierto || !sondeando) return;
  clearTimeout(temporizador);
  ronda += 1;
  ciclo(ronda);
}

export function estadoDe(producto) {
  return producto.estado === 'agotado' || producto.estado === 'bajo' ? producto.estado : 'ok';
}

export function resumenInventario(productos) {
  const resumen = { agotado: 0, bajo: 0, ok: 0, alerta: 0 };
  (productos || []).forEach(producto => {
    resumen[estadoDe(producto)] += 1;
  });
  resumen.alerta = resumen.agotado + resumen.bajo;
  return resumen;
}

export function categoriasDe(productos) {
  const minimos = new Map();
  productos.forEach(producto => {
    const categoria = producto.categoria_es;
    const id = String(producto.producto_id);
    if (!minimos.has(categoria) || id < minimos.get(categoria)) minimos.set(categoria, id);
  });
  return [...minimos.entries()].sort((a, b) => (a[1] < b[1] ? -1 : 1)).map(([categoria]) => categoria);
}

export function ordenarPorUrgencia(productos) {
  return productos
    .map((producto, posicion) => ({ producto, posicion }))
    .sort(
      (a, b) =>
        ORDEN_ESTADO[estadoDe(a.producto)] - ORDEN_ESTADO[estadoDe(b.producto)] || a.posicion - b.posicion
    )
    .map(entrada => entrada.producto);
}

export function cantidadSugerida(producto, min, max) {
  const objetivo = Number(producto.stock_minimo) * 2 - Number(producto.stock_actual);
  return Math.max(min, Math.min(max, Number.isFinite(objetivo) ? objetivo : min));
}