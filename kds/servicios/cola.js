import { ErrorRed, llamar } from '../../shared/api.js';
import { LIMITE_COLA_MS, SONDEO_MS } from '../config.js';

const suscriptores = new Set();
const instantanea = { datos: null, error: '', ultimoExito: 0, desfase: 0 };
let enCurso = null;
let temporizador = null;
let sondeando = false;
let ronda = 0;

export function colaActual() {
  return instantanea.datos;
}

export function errorCola() {
  return instantanea.error;
}

export function ahoraServidor() {
  return Date.now() + instantanea.desfase;
}

export function msDesdeUltimoExito() {
  return instantanea.ultimoExito ? Date.now() - instantanea.ultimoExito : Infinity;
}

export function suscribirCola(oyente) {
  suscriptores.add(oyente);
  return () => suscriptores.delete(oyente);
}

function avisar() {
  suscriptores.forEach(oyente => oyente());
}

async function pedir() {
  try {
    const resultado = await llamar('cola', {}, { limiteTotalMs: LIMITE_COLA_MS });
    if (resultado.ok) {
      instantanea.datos = resultado.data;
      instantanea.error = '';
      instantanea.ultimoExito = Date.now();
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

export function consultarCola() {
  if (!enCurso) {
    enCurso = pedir().finally(() => {
      enCurso = null;
    });
  }
  return enCurso;
}

export async function refrescarCola() {
  if (enCurso) await enCurso;
  return consultarCola();
}

async function ciclo(miRonda) {
  await consultarCola();
  if (!sondeando || miRonda !== ronda) return;
  temporizador = setTimeout(() => ciclo(miRonda), SONDEO_MS);
}

export function detenerSondeo() {
  sondeando = false;
  ronda += 1;
  clearTimeout(temporizador);
}

export function iniciarSondeo() {
  detenerSondeo();
  sondeando = true;
  ronda += 1;
  ciclo(ronda);
}