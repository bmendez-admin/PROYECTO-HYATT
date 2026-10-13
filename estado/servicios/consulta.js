import { ErrorRed, llamar } from '../../shared/api.js';
import { LIMITE_CONSULTA_MS, SONDEO_MS } from '../config.js';

const suscriptores = new Set();
const instantanea = { datos: null, error: '', ultimoExito: Date.now() };
let enCurso = null;
let temporizador = null;
let sondeando = false;

export function datosActuales() {
  return instantanea.datos;
}

export function errorActual() {
  return instantanea.error;
}

export function msSinExito() {
  return Date.now() - instantanea.ultimoExito;
}

export function suscribir(oyente) {
  suscriptores.add(oyente);
  return () => suscriptores.delete(oyente);
}

function avisar() {
  suscriptores.forEach(oyente => oyente());
}

async function pedir() {
  try {
    const resultado = await llamar('estado', {}, { limiteTotalMs: LIMITE_CONSULTA_MS });
    if (resultado.ok) {
      instantanea.datos = resultado.data;
      instantanea.error = '';
      instantanea.ultimoExito = Date.now();
    } else {
      instantanea.error = resultado.code;
    }
  } catch (error) {
    if (!(error instanceof ErrorRed)) throw error;
    instantanea.error = 'E_RED';
  }
  avisar();
}

function consultar() {
  if (!enCurso) {
    enCurso = pedir().finally(() => {
      enCurso = null;
    });
  }
  return enCurso;
}

async function ciclo() {
  await consultar();
  if (!sondeando) return;
  temporizador = setTimeout(ciclo, SONDEO_MS);
}

export function iniciarSondeo() {
  if (sondeando) return;
  sondeando = true;
  ciclo();
}

export function detenerSondeo() {
  sondeando = false;
  clearTimeout(temporizador);
}