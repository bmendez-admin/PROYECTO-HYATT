function estaAbierto(estado) {
  return estado === TURNO.ACTIVO || estado === TURNO.PAUSA;
}

function validarChef(cuerpo) {
  const chefId = validarTexto(cuerpo.chef_id, 30, /^[a-z0-9_-]+$/);
  const chef = leerTabla(HOJAS.CHEFS).find(c => c.chef_id === chefId && c.activo === true);
  if (!chef) throw new ErrorApi('E_NOT_FOUND', 'chef');
  return chef;
}

function turnosAbiertosConPosicion() {
  return leerFilasConPosicion(HOJAS.TURNOS).filter(t => estaAbierto(t.datos.estado));
}

function turnoDelChef(venueId, chefId) {
  return turnosAbiertosConPosicion().find(t => t.datos.venue_id === venueId && t.datos.chef_id === chefId);
}

function minutosDePausa(turno, ahora) {
  const extra = turno.estado === TURNO.PAUSA ? antiguedadMs(turno.hora_pausa, ahora) / 60000 : 0;
  return Math.round((Number(turno.minutos_pausa || 0) + extra) * 100) / 100;
}

function exigirTurnoActivo(venueId, chefId) {
  const turno = turnoDelChef(venueId, chefId);
  if (!turno || turno.datos.estado !== TURNO.ACTIVO) {
    throw new ErrorApi('E_CONFLICT', 'sin turno activo', { razon: 'sin_turno_activo' });
  }
  return turno;
}

function exigirSinPedidosEnPreparacion(venueId, chefId) {
  const pendientes = leerTabla(HOJAS.KDS).filter(
    p => p.venue_id === venueId && p.estatus === ESTATUS.EN_PREPARACION && p.chef_id === chefId
  );
  if (pendientes.length) {
    throw new ErrorApi('E_CONFLICT', 'pedidos en preparacion', { razon: 'pedidos_en_preparacion' });
  }
}

function iniciarTurno(cuerpo, contexto) {
  const chef = validarChef(cuerpo);
  return conLock(() => {
    const venue = obtenerVenue(contexto.venueId);
    const ahora = new Date();
    cerrarVencidos(contexto.venueId, venue, ahora);
    const abiertos = turnosAbiertosConPosicion();
    if (abiertos.some(t => t.datos.chef_id === chef.chef_id)) {
      throw new ErrorApi('E_CONFLICT', 'chef con turno abierto', { razon: 'chef_con_turno' });
    }
    const delVenue = abiertos.filter(t => t.datos.venue_id === contexto.venueId);
    if (delVenue.length >= Number(venue.turnos_activos_max)) {
      throw new ErrorApi('E_CONFLICT', 'turnos al maximo', { razon: 'turnos_al_maximo' });
    }
    const turnoId =
      'TUR-' + contexto.venueId + '-' + Utilities.formatDate(ahora, venue.zona_horaria, 'yyyyMMddHHmmss') + '-' + chef.chef_id;
    agregarFilas(HOJAS.TURNOS, [
      objetoAFila(HOJAS.TURNOS, {
        turno_id: turnoId,
        venue_id: contexto.venueId,
        chef_id: chef.chef_id,
        hora_inicio: ahora,
        estado: TURNO.ACTIVO,
        minutos_pausa: 0
      })
    ]);
    invalidarCache(contexto.venueId);
    return { turno_id: turnoId, chef_id: chef.chef_id, estado: TURNO.ACTIVO, hora_inicio: ahora.toISOString() };
  });
}

function pausarTurno(cuerpo, contexto) {
  const chef = validarChef(cuerpo);
  return conLock(() => {
    const venue = obtenerVenue(contexto.venueId);
    const ahora = new Date();
    cerrarVencidos(contexto.venueId, venue, ahora);
    const turno = exigirTurnoActivo(contexto.venueId, chef.chef_id);
    exigirSinPedidosEnPreparacion(contexto.venueId, chef.chef_id);
    turno.datos.estado = TURNO.PAUSA;
    turno.datos.hora_pausa = ahora;
    escribirFila(HOJAS.TURNOS, turno.fila, turno.datos);
    invalidarCache(contexto.venueId);
    return { turno_id: turno.datos.turno_id, chef_id: chef.chef_id, estado: TURNO.PAUSA };
  });
}

function reanudarTurno(cuerpo, contexto) {
  const chef = validarChef(cuerpo);
  return conLock(() => {
    const venue = obtenerVenue(contexto.venueId);
    const ahora = new Date();
    cerrarVencidos(contexto.venueId, venue, ahora);
    const turno = turnoDelChef(contexto.venueId, chef.chef_id);
    if (!turno || turno.datos.estado !== TURNO.PAUSA) {
      throw new ErrorApi('E_CONFLICT', 'turno no pausado', { razon: 'turno_no_pausado' });
    }
    turno.datos.minutos_pausa = minutosDePausa(turno.datos, ahora);
    turno.datos.estado = TURNO.ACTIVO;
    turno.datos.hora_pausa = '';
    escribirFila(HOJAS.TURNOS, turno.fila, turno.datos);
    invalidarCache(contexto.venueId);
    return { turno_id: turno.datos.turno_id, chef_id: chef.chef_id, estado: TURNO.ACTIVO };
  });
}

function cerrarTurno(cuerpo, contexto) {
  const chef = validarChef(cuerpo);
  return conLock(() => {
    const venue = obtenerVenue(contexto.venueId);
    const ahora = new Date();
    cerrarVencidos(contexto.venueId, venue, ahora);
    const turno = turnoDelChef(contexto.venueId, chef.chef_id);
    if (!turno) throw new ErrorApi('E_CONFLICT', 'sin turno abierto', { razon: 'sin_turno_abierto' });
    exigirSinPedidosEnPreparacion(contexto.venueId, chef.chef_id);
    turno.datos.minutos_pausa = minutosDePausa(turno.datos, ahora);
    turno.datos.estado = TURNO.CERRADO;
    turno.datos.hora_fin = ahora;
    turno.datos.motivo_cierre = MOTIVO_TURNO_MANUAL;
    turno.datos.hora_pausa = '';
    escribirFila(HOJAS.TURNOS, turno.fila, turno.datos);
    invalidarCache(contexto.venueId);
    return { turno_id: turno.datos.turno_id, chef_id: chef.chef_id, estado: TURNO.CERRADO };
  });
}