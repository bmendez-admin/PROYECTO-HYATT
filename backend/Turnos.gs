function estaAbierto(estado) {
  return estado === TURNO.ACTIVO || estado === TURNO.PAUSA;
}

function validarChef(cuerpo) {
  const chefId = validarTexto(cuerpo.chef_id, 30, /^[a-z0-9_-]+$/);
  const chef = leerTabla(HOJAS.CHEFS).find(c => c.chef_id === chefId && c.activo === true);
  if (!chef) throw new ErrorApi('E_NOT_FOUND', 'chef');
  return chef;
}

function verificarCodigo(chef, cuerpo, contexto) {
  const cache = CacheService.getScriptCache();
  const sufijo = contexto.venueId + '_' + chef.chef_id;
  const claveBloqueo = 'chef_bloqueo_' + sufijo;
  const claveFallos = 'chef_fallos_' + sufijo;
  if (cache.get(claveBloqueo)) throw new ErrorApi('E_RATE', 'chef bloqueado');
  const codigo = validarTexto(cuerpo.codigo, 6, /^\d{6}$/);
  if (String(chef.codigo).trim() !== codigo) {
    const fallos = Number(cache.get(claveFallos) || 0) + 1;
    if (fallos >= BLOQUEO_CHEF.maxFallos) {
      cache.put(claveBloqueo, '1', BLOQUEO_CHEF.ventanaSeg);
      cache.remove(claveFallos);
    } else {
      cache.put(claveFallos, String(fallos), BLOQUEO_CHEF.ventanaSeg);
    }
    throw new ErrorApi('E_NOT_FOUND', 'chef');
  }
  cache.remove(claveFallos);
}

function validarTipoPausa(cuerpo) {
  if (cuerpo.tipo === undefined) return 'corto';
  if (typeof cuerpo.tipo !== 'string' || TIPOS_PAUSA.indexOf(cuerpo.tipo) === -1) throw new ErrorApi('E_VALIDATION', 'tipo');
  return cuerpo.tipo;
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

function cierreManualReciente(venueId, chefId, ahora) {
  const ultimo = leerTabla(HOJAS.TURNOS)
    .filter(t => t.venue_id === venueId && t.chef_id === chefId && t.estado === TURNO.CERRADO && esFecha(t.hora_fin))
    .sort((a, b) => b.hora_fin - a.hora_fin)[0];
  const reciente =
    ultimo && ultimo.motivo_cierre === MOTIVO_TURNO_MANUAL && antiguedadMs(ultimo.hora_fin, ahora) <= TURNO_REPETIDO_SEG * 1000;
  return reciente ? ultimo : null;
}

function respuestaTurno(turno, estado, repetido) {
  return { turno_id: turno.turno_id, chef_id: turno.chef_id, estado: estado, repetido: repetido };
}

function respuestaInicio(turno, repetido) {
  return Object.assign(respuestaTurno(turno, TURNO.ACTIVO, repetido), { hora_inicio: aIso(turno.hora_inicio) });
}

function iniciarTurno(cuerpo, contexto) {
  const chef = validarChef(cuerpo);
  verificarCodigo(chef, cuerpo, contexto);
  return conLock(() => {
    const venue = obtenerVenue(contexto.venueId);
    const ahora = new Date();
    cerrarVencidos(contexto.venueId, venue, ahora);
    const abiertos = turnosAbiertosConPosicion();
    const propio = abiertos.find(t => t.datos.chef_id === chef.chef_id);
    if (propio) {
      if (propio.datos.venue_id === contexto.venueId && propio.datos.estado === TURNO.ACTIVO) {
        return respuestaInicio(propio.datos, true);
      }
      throw new ErrorApi('E_CONFLICT', 'chef con turno abierto', { razon: 'chef_con_turno' });
    }
    const delVenue = abiertos.filter(t => t.datos.venue_id === contexto.venueId);
    if (delVenue.length >= Number(venue.turnos_activos_max)) {
      throw new ErrorApi('E_CONFLICT', 'turnos al maximo', { razon: 'turnos_al_maximo' });
    }
    const turno = {
      turno_id:
        'TUR-' + contexto.venueId + '-' + Utilities.formatDate(ahora, venue.zona_horaria, 'yyyyMMddHHmmss') + '-' + chef.chef_id,
      venue_id: contexto.venueId,
      chef_id: chef.chef_id,
      hora_inicio: ahora,
      estado: TURNO.ACTIVO,
      minutos_pausa: 0
    };
    agregarFilas(HOJAS.TURNOS, [objetoAFila(HOJAS.TURNOS, turno)]);
    invalidarCache(contexto.venueId);
    return respuestaInicio(turno, false);
  });
}

function pausarTurno(cuerpo, contexto) {
  const chef = validarChef(cuerpo);
  const tipo = validarTipoPausa(cuerpo);
  return conLock(() => {
    const venue = obtenerVenue(contexto.venueId);
    const ahora = new Date();
    cerrarVencidos(contexto.venueId, venue, ahora);
    const abierto = turnoDelChef(contexto.venueId, chef.chef_id);
    if (abierto && abierto.datos.estado === TURNO.PAUSA) {
      return Object.assign(respuestaTurno(abierto.datos, TURNO.PAUSA, true), { tipo: abierto.datos.tipo_pausa || 'corto' });
    }
    const turno = exigirTurnoActivo(contexto.venueId, chef.chef_id);
    exigirSinPedidosEnPreparacion(contexto.venueId, chef.chef_id);
    turno.datos.estado = TURNO.PAUSA;
    turno.datos.hora_pausa = ahora;
    turno.datos.tipo_pausa = tipo;
    escribirFila(HOJAS.TURNOS, turno.fila, turno.datos);
    invalidarCache(contexto.venueId);
    return Object.assign(respuestaTurno(turno.datos, TURNO.PAUSA, false), { tipo: tipo });
  });
}

function reanudarTurno(cuerpo, contexto) {
  const chef = validarChef(cuerpo);
  return conLock(() => {
    const venue = obtenerVenue(contexto.venueId);
    const ahora = new Date();
    cerrarVencidos(contexto.venueId, venue, ahora);
    const turno = turnoDelChef(contexto.venueId, chef.chef_id);
    if (turno && turno.datos.estado === TURNO.ACTIVO) return respuestaTurno(turno.datos, TURNO.ACTIVO, true);
    if (!turno || turno.datos.estado !== TURNO.PAUSA) {
      throw new ErrorApi('E_CONFLICT', 'turno no pausado', { razon: 'turno_no_pausado' });
    }
    turno.datos.minutos_pausa = minutosDePausa(turno.datos, ahora);
    turno.datos.estado = TURNO.ACTIVO;
    turno.datos.hora_pausa = '';
    turno.datos.tipo_pausa = '';
    escribirFila(HOJAS.TURNOS, turno.fila, turno.datos);
    invalidarCache(contexto.venueId);
    return respuestaTurno(turno.datos, TURNO.ACTIVO, false);
  });
}

function cerrarTurno(cuerpo, contexto) {
  const chef = validarChef(cuerpo);
  return conLock(() => {
    const venue = obtenerVenue(contexto.venueId);
    const ahora = new Date();
    cerrarVencidos(contexto.venueId, venue, ahora);
    const turno = turnoDelChef(contexto.venueId, chef.chef_id);
    if (!turno) {
      const cerrado = cierreManualReciente(contexto.venueId, chef.chef_id, ahora);
      if (cerrado) return respuestaTurno(cerrado, TURNO.CERRADO, true);
      throw new ErrorApi('E_CONFLICT', 'sin turno abierto', { razon: 'sin_turno_abierto' });
    }
    exigirSinPedidosEnPreparacion(contexto.venueId, chef.chef_id);
    turno.datos.minutos_pausa = minutosDePausa(turno.datos, ahora);
    turno.datos.estado = TURNO.CERRADO;
    turno.datos.hora_fin = ahora;
    turno.datos.motivo_cierre = MOTIVO_TURNO_MANUAL;
    turno.datos.hora_pausa = '';
    turno.datos.tipo_pausa = '';
    escribirFila(HOJAS.TURNOS, turno.fila, turno.datos);
    invalidarCache(contexto.venueId);
    return respuestaTurno(turno.datos, TURNO.CERRADO, false);
  });
}