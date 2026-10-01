function consultarCola(cuerpo, contexto) {
  return conCache('cola_' + contexto.venueId, CACHE_LECTURA_SEG, () => construirCola(contexto.venueId));
}

function leerDatosCola(venueId) {
  return {
    pedidos: pedidosPorEstatus(venueId, [ESTATUS.PENDIENTE, ESTATUS.EN_PREPARACION, ESTATUS.COMPLETO]),
    turnos: leerTabla(HOJAS.TURNOS).filter(t => t.venue_id === venueId && estaAbierto(t.estado))
  };
}

function hayVencidos(datos, venue, ahora) {
  return datos.pedidos.some(p => pedidoVencido(p, ahora)) || datos.turnos.some(t => turnoVencido(t, venue, ahora));
}

function intentarCierreAutomatico(venueId, venue) {
  try {
    conLock(() => cerrarVencidos(venueId, venue, new Date()));
  } catch (error) {
    const detalle = error instanceof ErrorApi ? error.detalle || error.codigo : String(error && error.stack ? error.stack : error);
    registrarLog('cierre_automatico', 'sistema', venueId, 'E_INTERNAL', detalle);
  }
}

function construirCola(venueId) {
  const venue = obtenerVenue(venueId);
  const ahora = new Date();
  let datos = leerDatosCola(venueId);
  if (hayVencidos(datos, venue, ahora)) {
    intentarCierreAutomatico(venueId, venue);
    datos = leerDatosCola(venueId);
  }
  const pedidos = datos.pedidos.filter(p => !pedidoVencido(p, ahora)).sort((a, b) => a.hora_llegada - b.hora_llegada);
  const items = itemsDePedidos(pedidos.map(p => p.pedido_id));
  const listaChefs = leerTabla(HOJAS.CHEFS).filter(c => c.activo === true);
  const nombres = Object.create(null);
  listaChefs.forEach(c => {
    nombres[c.chef_id] = c.nombre;
  });
  return {
    venue_id: venueId,
    hora_servidor: ahora.toISOString(),
    parametros: {
      semaforo_amarillo_min: Number(venue.semaforo_amarillo_min),
      semaforo_rojo_min: Number(venue.semaforo_rojo_min),
      meta_espera_min: Number(venue.meta_espera_min),
      turnos_activos_max: Number(venue.turnos_activos_max)
    },
    chefs: listaChefs.map(c => {
      const turno = datos.turnos.find(t => t.chef_id === c.chef_id);
      return { chef_id: c.chef_id, nombre: c.nombre, turno: turno ? turno.estado : 'ninguno' };
    }),
    pedidos: pedidos.map(p => ({
      pedido_id: p.pedido_id,
      numero: Number(p.numero),
      estatus: p.estatus,
      hora_llegada: aIso(p.hora_llegada),
      hora_en_preparacion: aIso(p.hora_en_preparacion),
      hora_completo: aIso(p.hora_completo),
      chef_id: p.chef_id || '',
      chef_nombre: nombres[p.chef_id] || '',
      items: items[p.pedido_id] || []
    }))
  };
}