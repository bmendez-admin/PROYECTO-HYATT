function validarCantidadReposicion(valor) {
  if (!Number.isInteger(valor) || valor < 1 || valor > CANTIDAD_MAX_REPOSICION) {
    throw new ErrorApi('E_VALIDATION', 'cantidad');
  }
  return valor;
}

function estadoDeStock(producto) {
  const stock = Number(producto.stock_actual);
  if (stock <= 0) return ESTADO_STOCK.AGOTADO;
  return stock <= Number(producto.stock_minimo) ? ESTADO_STOCK.BAJO : ESTADO_STOCK.OK;
}

function buscarProductoActivo(venueId, productoId) {
  const registro = leerFilasConPosicion(HOJAS.DB).find(
    p => p.datos.producto_id === productoId && p.datos.venue_id === venueId && p.datos.activo === true
  );
  if (!registro) throw new ErrorApi('E_NOT_FOUND', 'producto');
  return registro;
}

function consultarInventario(cuerpo, contexto) {
  return conCache('inventario_' + contexto.venueId, CACHE_LECTURA_SEG, () => construirInventario(contexto.venueId));
}

function construirInventario(venueId) {
  obtenerVenue(venueId);
  const ultimoRelleno = Object.create(null);
  leerTabla(HOJAS.INVENTARIO).forEach(m => {
    if (m.venue_id !== venueId || m.tipo !== 'relleno' || !esFecha(m.hora)) return;
    const previo = ultimoRelleno[m.producto_id];
    if (!previo || m.hora.getTime() > previo.getTime()) ultimoRelleno[m.producto_id] = m.hora;
  });
  const conSolicitud = Object.create(null);
  leerTabla(HOJAS.REABASTO).forEach(s => {
    if (s.venue_id === venueId && s.estatus === REABASTO_ESTATUS.PENDIENTE) conSolicitud[s.producto_id] = true;
  });
  const productos = leerTabla(HOJAS.DB)
    .filter(p => p.venue_id === venueId && p.activo === true)
    .sort((a, b) => Number(a.stock_actual) - Number(b.stock_actual) || Number(a.orden) - Number(b.orden))
    .map(p => ({
      producto_id: p.producto_id,
      categoria_es: p.categoria_es,
      categoria_en: p.categoria_en,
      nombre_es: p.nombre_es,
      nombre_en: p.nombre_en,
      stock_actual: Number(p.stock_actual),
      stock_minimo: Number(p.stock_minimo),
      estado: estadoDeStock(p),
      ultimo_relleno: aIso(ultimoRelleno[p.producto_id]),
      reabasto_pendiente: conSolicitud[p.producto_id] === true
    }));
  return { venue_id: venueId, hora_servidor: new Date().toISOString(), productos: productos };
}

function registrarRelleno(cuerpo, contexto) {
  const requestId = validarTexto(cuerpo.request_id, 64, /^[A-Za-z0-9_-]{8,64}$/);
  const productoId = validarTexto(cuerpo.producto_id, 40, /^[a-z0-9_-]+$/);
  const cantidad = validarCantidadReposicion(cuerpo.cantidad);
  const chef = validarChef(cuerpo);
  return conLock(() => aplicarRelleno(contexto.venueId, requestId, chef.chef_id, productoId, cantidad));
}

function aplicarRelleno(venueId, requestId, chefId, productoId, cantidad) {
  const movId = 'MOV-REL-' + requestId;
  const previo = leerTabla(HOJAS.INVENTARIO).find(m => m.mov_id === movId && m.venue_id === venueId);
  if (previo) {
    const actual = leerFilasConPosicion(HOJAS.DB).find(
      p => p.datos.producto_id === previo.producto_id && p.datos.venue_id === venueId
    );
    return {
      mov_id: movId,
      producto_id: previo.producto_id,
      cantidad: Number(previo.cantidad),
      stock_actual: actual ? Number(actual.datos.stock_actual) : Number(previo.stock_resultante),
      duplicado: true
    };
  }
  const venue = obtenerVenue(venueId);
  const ahora = new Date();
  cerrarVencidos(venueId, venue, ahora);
  exigirTurnoActivo(venueId, chefId);
  const producto = buscarProductoActivo(venueId, productoId);
  const nuevoStock = Number(producto.datos.stock_actual) + cantidad;

  agregarFilas(HOJAS.INVENTARIO, [[movId, venueId, productoId, 'relleno', cantidad, nuevoStock, ahora, 'chef:' + chefId]]);
  obtenerHoja(HOJAS.DB).getRange(producto.fila, indiceColumna(HOJAS.DB, 'stock_actual') + 1, 1, 1).setValues([[nuevoStock]]);
  invalidarCache(venueId);
  return { mov_id: movId, producto_id: productoId, cantidad: cantidad, stock_actual: nuevoStock, duplicado: false };
}

function solicitarReabasto(cuerpo, contexto) {
  const requestId = validarTexto(cuerpo.request_id, 64, /^[A-Za-z0-9_-]{8,64}$/);
  const productoId = validarTexto(cuerpo.producto_id, 40, /^[a-z0-9_-]+$/);
  const cantidad = validarCantidadReposicion(cuerpo.cantidad);
  const chef = validarChef(cuerpo);
  return conLock(() => registrarSolicitudReabasto(contexto.venueId, requestId, chef.chef_id, productoId, cantidad));
}

function registrarSolicitudReabasto(venueId, requestId, chefId, productoId, cantidad) {
  const solicitudId = 'REA-' + requestId;
  const solicitudes = leerTabla(HOJAS.REABASTO).filter(s => s.venue_id === venueId);
  const previa = solicitudes.find(s => s.solicitud_id === solicitudId);
  if (previa) {
    return {
      solicitud_id: solicitudId,
      producto_id: previa.producto_id,
      cantidad: Number(previa.cantidad),
      estatus: previa.estatus,
      duplicado: true
    };
  }
  const venue = obtenerVenue(venueId);
  const ahora = new Date();
  cerrarVencidos(venueId, venue, ahora);
  exigirTurnoActivo(venueId, chefId);
  buscarProductoActivo(venueId, productoId);
  const abierta = solicitudes.find(s => s.producto_id === productoId && s.estatus === REABASTO_ESTATUS.PENDIENTE);
  if (abierta) throw conflicto('solicitud_pendiente', { solicitud_id: abierta.solicitud_id });

  agregarFilas(HOJAS.REABASTO, [
    objetoAFila(HOJAS.REABASTO, {
      solicitud_id: solicitudId,
      venue_id: venueId,
      producto_id: productoId,
      cantidad: cantidad,
      chef_id: chefId,
      hora_solicitud: ahora,
      estatus: REABASTO_ESTATUS.PENDIENTE
    })
  ]);
  invalidarCache(venueId);
  return {
    solicitud_id: solicitudId,
    producto_id: productoId,
    cantidad: cantidad,
    estatus: REABASTO_ESTATUS.PENDIENTE,
    duplicado: false
  };
}