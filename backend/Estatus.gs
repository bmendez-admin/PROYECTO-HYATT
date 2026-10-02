const TRANSICIONES = Object.freeze(['tomar', 'completar', 'recibir', 'cancelar', 'liberar', 'revertir']);

function pedidoVencido(pedido, ahora) {
  return antiguedadMs(pedido.hora_llegada, ahora) >= PEDIDO_VENCE_HORAS * 3600000;
}

function turnoVencido(turno, venue, ahora) {
  return antiguedadMs(turno.hora_inicio, ahora) >= Number(venue.turno_vencido_horas) * 3600000;
}

function conflicto(razon, extra) {
  return new ErrorApi('E_CONFLICT', razon, Object.assign({ razon: razon }, extra || {}));
}

function transicionYaAplicada(transicion, pedido, chefId, motivo) {
  const delChef = pedido.chef_id === chefId;
  switch (transicion) {
    case 'tomar':
    case 'revertir':
      return pedido.estatus === ESTATUS.EN_PREPARACION && delChef;
    case 'completar':
      return pedido.estatus === ESTATUS.COMPLETO && delChef;
    case 'recibir':
      return pedido.estatus === ESTATUS.RECIBIDO;
    case 'cancelar':
      return pedido.estatus === ESTATUS.CANCELADO && pedido.motivo_cancelacion === motivo;
    case 'liberar':
      return pedido.estatus === ESTATUS.PENDIENTE;
    default:
      return false;
  }
}

function devolverStock(venueId, pedidoIds, ahora) {
  if (!pedidoIds.length) return;
  const conjunto = new Set(pedidoIds);
  const items = leerTabla(HOJAS.PEDIDO_ITEMS).filter(item => conjunto.has(item.pedido_id));
  if (!items.length) return;
  const hojaDb = obtenerHoja(HOJAS.DB);
  const iProducto = indiceColumna(HOJAS.DB, 'producto_id');
  const iVenue = indiceColumna(HOJAS.DB, 'venue_id');
  const iStock = indiceColumna(HOJAS.DB, 'stock_actual');
  const totalFilas = hojaDb.getLastRow() - 1;
  if (totalFilas < 1) return;
  const valores = hojaDb.getRange(2, 1, totalFilas, ENCABEZADOS.DB.length).getValues();
  const movimientos = [];
  items.forEach((item, posicion) => {
    const fila = valores.find(f => f[iProducto] === item.producto_id && f[iVenue] === venueId);
    if (!fila) return;
    fila[iStock] = Number(fila[iStock]) + Number(item.cantidad);
    movimientos.push([
      'MOV-DEV-' + item.pedido_id + '-' + (posicion + 1),
      venueId,
      item.producto_id,
      'devolucion',
      Number(item.cantidad),
      fila[iStock],
      ahora,
      'cancelacion:' + item.pedido_id
    ]);
  });
  agregarFilas(HOJAS.INVENTARIO, movimientos);
  hojaDb.getRange(2, iStock + 1, totalFilas, 1).setValues(valores.map(f => [f[iStock]]));
}

function cerrarTurnosVencidos(venueId, venue, ahora) {
  const vencidos = turnosAbiertosConPosicion().filter(
    t => t.datos.venue_id === venueId && turnoVencido(t.datos, venue, ahora)
  );
  if (!vencidos.length) return 0;
  const enPreparacion = leerFilasConPosicion(HOJAS.KDS).filter(
    p => p.datos.venue_id === venueId && p.datos.estatus === ESTATUS.EN_PREPARACION
  );
  vencidos.forEach(turno => {
    enPreparacion
      .filter(p => p.datos.chef_id === turno.datos.chef_id)
      .forEach(p => {
        p.datos.estatus = ESTATUS.PENDIENTE;
        p.datos.chef_id = '';
        p.datos.hora_en_preparacion = '';
        escribirFila(HOJAS.KDS, p.fila, p.datos);
      });
    turno.datos.minutos_pausa = minutosDePausa(turno.datos, ahora);
    turno.datos.estado = TURNO.CERRADO;
    turno.datos.hora_fin = ahora;
    turno.datos.motivo_cierre = MOTIVO_TURNO_VENCIDO;
    turno.datos.hora_pausa = '';
    escribirFila(HOJAS.TURNOS, turno.fila, turno.datos);
  });
  return vencidos.length;
}

function cerrarPedidosVencidos(venueId, ahora) {
  const activos = [ESTATUS.PENDIENTE, ESTATUS.EN_PREPARACION, ESTATUS.COMPLETO];
  const vencidos = leerFilasConPosicion(HOJAS.KDS).filter(
    p => p.datos.venue_id === venueId && activos.indexOf(p.datos.estatus) !== -1 && pedidoVencido(p.datos, ahora)
  );
  const cancelados = [];
  let recibidos = 0;
  vencidos.forEach(p => {
    if (p.datos.estatus === ESTATUS.COMPLETO) {
      p.datos.estatus = ESTATUS.RECIBIDO;
      p.datos.hora_recibido = ahora;
      recibidos++;
    } else {
      p.datos.estatus = ESTATUS.CANCELADO;
      p.datos.hora_cancelado = ahora;
      p.datos.motivo_cancelacion = MOTIVO_CIERRE_AUTOMATICO;
      cancelados.push(p.datos.pedido_id);
    }
    escribirFila(HOJAS.KDS, p.fila, p.datos);
  });
  devolverStock(venueId, cancelados, ahora);
  return { cancelados: cancelados.length, recibidos: recibidos };
}

function cerrarVencidos(venueId, venue, ahora) {
  const turnos = cerrarTurnosVencidos(venueId, venue, ahora);
  const pedidos = cerrarPedidosVencidos(venueId, ahora);
  if (turnos || pedidos.cancelados || pedidos.recibidos) invalidarCache(venueId);
  return { turnos: turnos, cancelados: pedidos.cancelados, recibidos: pedidos.recibidos };
}

function cambiarEstatus(cuerpo, contexto) {
  const pedidoId = validarTexto(cuerpo.pedido_id, 40, /^[a-z0-9_-]+-\d{8}-\d{3,}$/);
  const transicion = validarTexto(cuerpo.transicion, 20, /^[a-z]+$/);
  if (TRANSICIONES.indexOf(transicion) === -1) throw new ErrorApi('E_VALIDATION', 'transicion');
  const chef = validarChef(cuerpo);
  let motivo = '';
  if (transicion === 'cancelar') {
    motivo = validarTexto(cuerpo.motivo, 30, /^[a-z_]+$/);
    if (MOTIVOS_CANCELACION.indexOf(motivo) === -1) throw new ErrorApi('E_VALIDATION', 'motivo');
  }
  return conLock(() => aplicarTransicion(contexto.venueId, pedidoId, transicion, chef.chef_id, motivo));
}

function aplicarTransicion(venueId, pedidoId, transicion, chefId, motivo) {
  const venue = obtenerVenue(venueId);
  const ahora = new Date();
  cerrarVencidos(venueId, venue, ahora);
  exigirTurnoActivo(venueId, chefId);
  const registro = leerFilasConPosicion(HOJAS.KDS).find(p => p.datos.pedido_id === pedidoId);
  if (!registro || registro.datos.venue_id !== venueId) throw new ErrorApi('E_NOT_FOUND', 'pedido');

  const pedido = registro.datos;
  const estatus = pedido.estatus;
  const delChef = pedido.chef_id === chefId;
  const estatusActual = { estatus: estatus };
  if (transicionYaAplicada(transicion, pedido, chefId, motivo)) {
    return { pedido_id: pedidoId, estatus: estatus, chef_id: pedido.chef_id || '', repetido: true };
  }

  if (transicion === 'tomar') {
    if (estatus !== ESTATUS.PENDIENTE) throw conflicto('estatus', estatusActual);
    pedido.estatus = ESTATUS.EN_PREPARACION;
    pedido.chef_id = chefId;
    pedido.hora_en_preparacion = ahora;
  } else if (transicion === 'completar') {
    if (estatus !== ESTATUS.EN_PREPARACION) throw conflicto('estatus', estatusActual);
    if (!delChef) throw conflicto('otro_chef');
    pedido.estatus = ESTATUS.COMPLETO;
    pedido.hora_completo = ahora;
  } else if (transicion === 'recibir') {
    if (estatus !== ESTATUS.COMPLETO) throw conflicto('estatus', estatusActual);
    pedido.estatus = ESTATUS.RECIBIDO;
    pedido.hora_recibido = ahora;
  } else if (transicion === 'cancelar') {
    if (estatus !== ESTATUS.PENDIENTE && estatus !== ESTATUS.EN_PREPARACION) {
      throw conflicto('estatus', estatusActual);
    }
    if (estatus === ESTATUS.EN_PREPARACION && !delChef) throw conflicto('otro_chef');
    pedido.estatus = ESTATUS.CANCELADO;
    pedido.hora_cancelado = ahora;
    pedido.motivo_cancelacion = motivo;
  } else if (transicion === 'liberar') {
    if (estatus !== ESTATUS.EN_PREPARACION) throw conflicto('estatus', estatusActual);
    if (!delChef) throw conflicto('otro_chef');
    pedido.estatus = ESTATUS.PENDIENTE;
    pedido.chef_id = '';
    pedido.hora_en_preparacion = '';
  } else if (transicion === 'revertir') {
    if (estatus !== ESTATUS.COMPLETO) throw conflicto('estatus', estatusActual);
    if (!delChef) throw conflicto('otro_chef');
    if (antiguedadMs(pedido.hora_completo, ahora) > REVERTIR_SEG * 1000) throw conflicto('fuera_de_ventana');
    pedido.estatus = ESTATUS.EN_PREPARACION;
    pedido.hora_completo = '';
  }

  escribirFila(HOJAS.KDS, registro.fila, pedido);
  if (transicion === 'cancelar') devolverStock(venueId, [pedidoId], ahora);
  invalidarCache(venueId);
    return { pedido_id: pedidoId, estatus: pedido.estatus, chef_id: pedido.chef_id || '', repetido: false };
}