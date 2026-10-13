import { DESVANECE_MS, MAX_TARJETAS, RESALTE_MS } from '../config.js';

const memoria = {
  cargado: false,
  proceso: new Map(),
  saliendo: new Map(),
  listo: [],
  listoVisto: new Map()
};

function numeroDe(pedido) {
  return Number(pedido.numero);
}

export function registrar(datos, ahora) {
  const actuales = new Map(datos.en_proceso.map(pedido => [numeroDe(pedido), pedido.estatus]));
  const enListo = datos.listo.map(numeroDe);
  const conjuntoListo = new Set(enListo);

  if (memoria.cargado) {
    memoria.proceso.forEach((estatus, numero) => {
      if (!actuales.has(numero) && !conjuntoListo.has(numero) && !memoria.saliendo.has(numero)) {
        memoria.saliendo.set(numero, { desde: ahora, tenue: estatus !== 'en_preparacion' });
      }
    });
  }
  actuales.forEach((_, numero) => memoria.saliendo.delete(numero));
  conjuntoListo.forEach(numero => memoria.saliendo.delete(numero));

  memoria.proceso = actuales;
  memoria.listo = enListo;
  enListo.forEach(numero => {
    if (!memoria.listoVisto.has(numero)) memoria.listoVisto.set(numero, memoria.cargado ? ahora : -Infinity);
  });
  Array.from(memoria.listoVisto.keys()).forEach(numero => {
    if (!conjuntoListo.has(numero)) memoria.listoVisto.delete(numero);
  });
  memoria.cargado = true;
}

function recortar(lista) {
  return { visibles: lista.slice(0, MAX_TARJETAS), ocultos: Math.max(0, lista.length - MAX_TARJETAS) };
}

export function modelo(ahora) {
  Array.from(memoria.saliendo.entries()).forEach(([numero, dato]) => {
    if (ahora - dato.desde >= DESVANECE_MS) memoria.saliendo.delete(numero);
  });

  const preparando = Array.from(memoria.proceso.entries()).map(([numero, estatus]) => ({
    numero,
    tenue: estatus !== 'en_preparacion',
    saliendo: false
  }));
  memoria.saliendo.forEach((dato, numero) => preparando.push({ numero, tenue: dato.tenue, saliendo: true }));
  preparando.sort((a, b) => a.numero - b.numero);

  const listo = memoria.listo.map(numero => ({
    numero,
    nuevo: ahora - memoria.listoVisto.get(numero) < RESALTE_MS
  }));

  const izquierda = recortar(preparando);
  const derecha = recortar(listo);
  return {
    preparando: izquierda.visibles,
    masPreparando: izquierda.ocultos,
    listo: derecha.visibles,
    masListo: derecha.ocultos
  };
}