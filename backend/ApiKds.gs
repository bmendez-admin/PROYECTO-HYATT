function consultarCola(cuerpo, contexto) {
  return conCache('cola_' + contexto.venueId, CACHE_LECTURA_SEG, () => construirCola(contexto.venueId));
}

function construirCola(venueId) {
  const venue = obtenerVenue(venueId);
  const pedidos = pedidosPorEstatus(venueId, [ESTATUS.PENDIENTE, ESTATUS.EN_PREPARACION, ESTATUS.COMPLETO])
    .sort((a, b) => a.hora_llegada - b.hora_llegada);
  const items = itemsDePedidos(pedidos.map(p => p.pedido_id));
  const chefs = nombresDeChefs();
  return {
    venue_id: venueId,
    hora_servidor: new Date().toISOString(),
    parametros: {
      semaforo_amarillo_min: Number(venue.semaforo_amarillo_min),
      semaforo_rojo_min: Number(venue.semaforo_rojo_min),
      meta_espera_min: Number(venue.meta_espera_min)
    },
    pedidos: pedidos.map(p => ({
      pedido_id: p.pedido_id,
      numero: Number(p.numero),
      estatus: p.estatus,
      hora_llegada: aIso(p.hora_llegada),
      hora_en_preparacion: aIso(p.hora_en_preparacion),
      hora_completo: aIso(p.hora_completo),
      chef_id: p.chef_id || '',
      chef_nombre: chefs[p.chef_id] || '',
      items: items[p.pedido_id] || []
    }))
  };
}