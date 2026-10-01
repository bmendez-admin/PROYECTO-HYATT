function pedidosPorEstatus(venueId, estatus) {
  return leerTabla(HOJAS.KDS).filter(p => p.venue_id === venueId && estatus.indexOf(p.estatus) !== -1);
}

function itemsDePedidos(pedidoIds) {
  const porPedido = Object.create(null);
  if (!pedidoIds.length) return porPedido;
  const conjunto = new Set(pedidoIds);
  leerTabla(HOJAS.PEDIDO_ITEMS).forEach(item => {
    if (!conjunto.has(item.pedido_id)) return;
    if (!porPedido[item.pedido_id]) porPedido[item.pedido_id] = [];
    porPedido[item.pedido_id].push({ nombre_es: item.nombre_es, cantidad: Number(item.cantidad) });
  });
  return porPedido;
}

function nombresDeChefs() {
  const nombres = Object.create(null);
  leerTabla(HOJAS.CHEFS).forEach(chef => {
    nombres[chef.chef_id] = chef.nombre;
  });
  return nombres;
}

function buscarPedidoPorRequest(venueId, requestId) {
  const hoja = obtenerHoja(HOJAS.KIOSCO);
  const filas = hoja.getLastRow() - 1;
  if (filas < 1) return null;
  const valores = hoja.getRange(2, 1, filas, 4).getValues();
  const fila = valores.find(f => f[2] === venueId && String(f[3]) === requestId);
  return fila ? { pedido_id: fila[0], numero: Number(fila[1]) } : null;
}

function siguienteNumero(prefijo) {
  const hoja = obtenerHoja(HOJAS.KIOSCO);
  const filas = hoja.getLastRow() - 1;
  if (filas < 1) return 1;
  const ids = hoja.getRange(2, 1, filas, 1).getValues();
  let maximo = 0;
  ids.forEach(fila => {
    const id = String(fila[0]);
    if (id.indexOf(prefijo) === 0) {
      maximo = Math.max(maximo, Number(id.slice(prefijo.length)) || 0);
    }
  });
  return maximo + 1;
}