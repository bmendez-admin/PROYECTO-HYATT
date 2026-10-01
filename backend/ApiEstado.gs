function consultarEstado(cuerpo, contexto) {
  return conCache('estado_' + contexto.venueId, CACHE_LECTURA_SEG, () => construirEstado(contexto.venueId));
}

function construirEstado(venueId) {
  const venue = obtenerVenue(venueId);
  const ahora = new Date();
  const prefijo = venueId + '-' + diaOperativo(ahora, venue) + '-';
  const limite = ahora.getTime() - LISTO_VISIBLE_MIN * 60000;
  const pedidos = pedidosPorEstatus(venueId, [ESTATUS.PENDIENTE, ESTATUS.EN_PREPARACION, ESTATUS.COMPLETO])
    .filter(p => String(p.pedido_id).indexOf(prefijo) === 0);

  const enProceso = pedidos
    .filter(p => p.estatus !== ESTATUS.COMPLETO)
    .map(p => ({ numero: Number(p.numero), estatus: p.estatus }))
    .sort((a, b) => a.numero - b.numero);

  const listo = pedidos
    .filter(p => p.estatus === ESTATUS.COMPLETO && p.hora_completo instanceof Date && p.hora_completo.getTime() >= limite)
    .sort((a, b) => b.hora_completo - a.hora_completo)
    .map(p => ({ numero: Number(p.numero), hora_completo: aIso(p.hora_completo) }));

  return {
    hora_servidor: ahora.toISOString(),
    listo_visible_min: LISTO_VISIBLE_MIN,
    en_proceso: enProceso,
    listo: listo
  };
}