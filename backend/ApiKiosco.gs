function obtenerCatalogo(cuerpo, contexto) {
  return conCache('catalogo_' + contexto.venueId, CACHE_LECTURA_SEG, () => construirCatalogo(contexto.venueId));
}

function construirCatalogo(venueId) {
  const venue = obtenerVenue(venueId);
  const productos = leerTabla(HOJAS.DB)
    .filter(p => p.venue_id === venueId && p.activo === true)
    .sort((a, b) => a.orden - b.orden)
    .map(p => ({
      producto_id: p.producto_id,
      categoria_es: p.categoria_es,
      categoria_en: p.categoria_en,
      nombre_es: p.nombre_es,
      nombre_en: p.nombre_en,
      descripcion_es: p.descripcion_es,
      descripcion_en: p.descripcion_en,
      imagen: p.imagen,
      etiquetas: String(p.etiquetas).split(',').map(e => e.trim()).filter(Boolean),
      agotado: Number(p.stock_actual) <= 0,
      disponible_max: Math.max(0, Math.min(Number(p.stock_actual), LIMITES_PEDIDO.maxCantidadPorProducto))
    }));
  return {
    venue: {
      venue_id: venue.venue_id,
      nombre: venue.nombre,
      hora_apertura: venue.hora_apertura,
      hora_cierre: venue.hora_cierre
    },
    limites: {
      max_articulos: LIMITES_PEDIDO.maxArticulos,
      max_cantidad_producto: LIMITES_PEDIDO.maxCantidadPorProducto
    },
    productos: productos,
    hora_servidor: new Date().toISOString()
  };
}

function validarCuarto(cuerpo, contexto) {
  const cache = CacheService.getScriptCache();
  const claveBloqueo = 'cuarto_bloqueo_' + contexto.venueId;
  const claveFallos = 'cuarto_fallos_' + contexto.venueId;
  if (cache.get(claveBloqueo)) throw new ErrorApi('E_RATE', 'cuarto bloqueado');
  const edificio = validarTexto(typeof cuerpo.edificio === 'string' ? cuerpo.edificio : '', 3, /^[A-Za-z0-9]{1,3}$/).toUpperCase();
  const cuarto = validarTexto(typeof cuerpo.cuarto === 'string' ? cuerpo.cuarto : '', 4, /^\d{3,4}$/);
  const huesped = leerTabla(HOJAS.HUESPEDES).find(
    h => String(h.cuarto) === cuarto && String(h.edificio).trim().toUpperCase() === edificio && h.ocupado === true
  );
  if (!huesped) {
    const fallos = Number(cache.get(claveFallos) || 0) + 1;
    if (fallos >= BLOQUEO_CUARTO.maxFallos) {
      cache.put(claveBloqueo, '1', BLOQUEO_CUARTO.ventanaSeg);
      cache.remove(claveFallos);
    } else {
      cache.put(claveFallos, String(fallos), BLOQUEO_CUARTO.ventanaSeg);
    }
    throw new ErrorApi('E_NOT_FOUND', 'cuarto');
  }
  cache.remove(claveFallos);
  return { huesped_id: huesped.huesped_id, nombre_display: huesped.nombre_display };
}

function normalizarLineas(items) {
  if (!Array.isArray(items) || items.length === 0 || items.length > LIMITES_PEDIDO.maxLineas) {
    throw new ErrorApi('E_VALIDATION', 'items');
  }
  const acumulado = Object.create(null);
  items.forEach(item => {
    if (!item || typeof item !== 'object') throw new ErrorApi('E_VALIDATION', 'item');
    const productoId = validarTexto(item.producto_id, 40, /^[a-z0-9_-]+$/);
    if (!Number.isInteger(item.cantidad) || item.cantidad < 1) throw new ErrorApi('E_VALIDATION', 'cantidad');
    acumulado[productoId] = (acumulado[productoId] || 0) + item.cantidad;
  });
  const lineas = Object.keys(acumulado).map(productoId => ({ producto_id: productoId, cantidad: acumulado[productoId] }));
  const total = lineas.reduce((suma, linea) => suma + linea.cantidad, 0);
  if (total > LIMITES_PEDIDO.maxArticulos || lineas.some(l => l.cantidad > LIMITES_PEDIDO.maxCantidadPorProducto)) {
    throw new ErrorApi('E_VALIDATION', 'limites');
  }
  return lineas;
}

function crearPedido(cuerpo, contexto) {
  const requestId = validarTexto(cuerpo.request_id, 64, /^[A-Za-z0-9_-]{8,64}$/);
  const huespedId = validarTexto(cuerpo.huesped_id, 10, /^H\d{3,4}$/);
  const lineas = normalizarLineas(cuerpo.items);
  return conLock(() => registrarPedido(contexto.venueId, requestId, huespedId, lineas));
}

function registrarPedido(venueId, requestId, huespedId, lineas) {
  const existente = buscarPedidoPorRequest(venueId, requestId);
  if (existente) {
    return { pedido_id: existente.pedido_id, numero: existente.numero, duplicado: true };
  }
  const venue = obtenerVenue(venueId);
  const huesped = leerTabla(HOJAS.HUESPEDES).find(h => h.huesped_id === huespedId && h.ocupado === true);
  if (!huesped) throw new ErrorApi('E_NOT_FOUND', 'huesped');

  const hojaDb = obtenerHoja(HOJAS.DB);
  const encabezados = ENCABEZADOS.DB;
  const iProducto = encabezados.indexOf('producto_id');
  const iVenue = encabezados.indexOf('venue_id');
  const iNombre = encabezados.indexOf('nombre_es');
  const iStock = encabezados.indexOf('stock_actual');
  const iActivo = encabezados.indexOf('activo');
  const totalFilas = hojaDb.getLastRow() - 1;
  if (totalFilas < 1) throw new ErrorApi('E_NOT_FOUND', 'catalogo vacio');
  const valores = hojaDb.getRange(2, 1, totalFilas, encabezados.length).getValues();

  const ahora = new Date();
  const prefijo = venueId + '-' + diaOperativo(ahora, venue) + '-';
  const numero = siguienteNumero(prefijo);
  const pedidoId = prefijo + ('00' + numero).slice(-3);

  const faltantes = [];
  const items = [];
  const movimientos = [];
  lineas.forEach((linea, posicion) => {
    const fila = valores.find(f => f[iProducto] === linea.producto_id && f[iVenue] === venueId && f[iActivo] === true);
    if (!fila) throw new ErrorApi('E_NOT_FOUND', 'producto');
    if (Number(fila[iStock]) < linea.cantidad) {
      faltantes.push(linea.producto_id);
      return;
    }
    fila[iStock] = Number(fila[iStock]) - linea.cantidad;
    items.push([pedidoId, linea.producto_id, fila[iNombre], linea.cantidad]);
    movimientos.push([
      'MOV-' + pedidoId + '-' + (posicion + 1),
      venueId,
      linea.producto_id,
      'consumo',
      linea.cantidad,
      fila[iStock],
      ahora,
      'pedido:' + pedidoId
    ]);
  });
  if (faltantes.length) throw new ErrorApi('E_STOCK', 'stock insuficiente', { productos: faltantes });

  agregarFilas(HOJAS.PEDIDO_ITEMS, items);
  agregarFilas(HOJAS.KDS, [[pedidoId, numero, venueId, ahora, ESTATUS.PENDIENTE, '', '', '', '', '', '']]);
  agregarFilas(HOJAS.INVENTARIO, movimientos);
  hojaDb.getRange(2, iStock + 1, totalFilas, 1).setValues(valores.map(f => [f[iStock]]));
  agregarFilas(HOJAS.KIOSCO, [[pedidoId, numero, venueId, requestId, huespedId, huesped.cuarto, ahora]]);
  invalidarCache(venueId);

  return { pedido_id: pedidoId, numero: numero, duplicado: false };
}