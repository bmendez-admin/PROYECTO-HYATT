const ACCIONES = {
  ping: {
    roles: null,
    ejecutar: () => ({ hora_servidor: new Date().toISOString() })
  },
  catalogo: {
    roles: ['kiosco'],
    ejecutar: (cuerpo, contexto) => obtenerCatalogo(cuerpo, contexto)
  },
  validar_cuarto: {
    roles: ['kiosco'],
    ejecutar: (cuerpo, contexto) => validarCuarto(cuerpo, contexto)
  },
  crear_pedido: {
    roles: ['kiosco'],
    ejecutar: (cuerpo, contexto) => crearPedido(cuerpo, contexto)
  },
  cola: {
    roles: ['kds'],
    ejecutar: (cuerpo, contexto) => consultarCola(cuerpo, contexto)
  },
  iniciar_turno: {
    roles: ['kds'],
    ejecutar: (cuerpo, contexto) => iniciarTurno(cuerpo, contexto)
  },
  pausar_turno: {
    roles: ['kds'],
    ejecutar: (cuerpo, contexto) => pausarTurno(cuerpo, contexto)
  },
  reanudar_turno: {
    roles: ['kds'],
    ejecutar: (cuerpo, contexto) => reanudarTurno(cuerpo, contexto)
  },
  cerrar_turno: {
    roles: ['kds'],
    ejecutar: (cuerpo, contexto) => cerrarTurno(cuerpo, contexto)
  },
  cambiar_estatus: {
    roles: ['kds'],
    ejecutar: (cuerpo, contexto) => cambiarEstatus(cuerpo, contexto)
  },
  inventario: {
    roles: ['kds'],
    ejecutar: (cuerpo, contexto) => consultarInventario(cuerpo, contexto)
  },
  registrar_relleno: {
    roles: ['kds'],
    ejecutar: (cuerpo, contexto) => registrarRelleno(cuerpo, contexto)
  },
  solicitar_reabasto: {
    roles: ['kds'],
    ejecutar: (cuerpo, contexto) => solicitarReabasto(cuerpo, contexto)
  },
  estado: {
    roles: ['estado'],
    ejecutar: (cuerpo, contexto) => consultarEstado(cuerpo, contexto)
  }
};

function autenticar(cuerpo, definicion, contexto) {
  try {
    contexto.rol = validarTexto(cuerpo.rol, 20, /^[a-z]+$/);
    contexto.venueId = validarTexto(cuerpo.venue_id, 30, /^[a-z0-9_-]+$/);
    const token = validarTexto(cuerpo.token, 128, /^[A-Za-z0-9]+$/);
    if (definicion.roles.indexOf(contexto.rol) === -1 || !validarToken(contexto.rol, contexto.venueId, token)) {
      throw new ErrorApi('E_AUTH', 'credenciales invalidas');
    }
  } catch (error) {
    if (error instanceof ErrorApi && error.codigo === 'E_VALIDATION') {
      throw new ErrorApi('E_AUTH', 'credenciales malformadas');
    }
    throw error;
  }
}

function ejecutarAccion(cuerpo, contexto) {
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) {
    throw new ErrorApi('E_VALIDATION', 'cuerpo');
  }
  contexto.accion = validarTexto(cuerpo.action, 40, /^[a-z_]+$/);
  if (!Object.prototype.hasOwnProperty.call(ACCIONES, contexto.accion)) {
    throw new ErrorApi('E_VALIDATION', 'accion desconocida');
  }
  const definicion = ACCIONES[contexto.accion];
  if (definicion.roles) {
    autenticar(cuerpo, definicion, contexto);
    limitarFrecuencia(contexto.rol + '_' + contexto.venueId, LIMITES_POR_MINUTO[contexto.rol] || 60);
  }
  return { ok: true, data: definicion.ejecutar(cuerpo, contexto) };
}

function procesar(textoCuerpo) {
  const contexto = { accion: '', rol: '', venueId: '' };
  try {
    let cuerpo;
    try {
      cuerpo = JSON.parse(textoCuerpo);
    } catch (errorJson) {
      throw new ErrorApi('E_VALIDATION', 'json');
    }
    return respuesta(ejecutarAccion(cuerpo, contexto));
  } catch (error) {
    const esApi = error instanceof ErrorApi;
    const codigo = esApi ? error.codigo : 'E_INTERNAL';
    const detalle = esApi ? error.detalle : String(error && error.stack ? error.stack : error);
    if (codigo === 'E_AUTH' || codigo === 'E_INTERNAL') {
      registrarLog(contexto.accion, contexto.rol, contexto.venueId, codigo, detalle);
    }
    const falla = { ok: false, code: codigo };
    if (esApi && error.datos !== undefined) falla.data = error.datos;
    return respuesta(falla);
  }
}

function doPost(e) {
  return procesar(e && e.postData ? e.postData.contents : '');
}

function doGet() {
  return respuesta({ ok: false, code: 'E_METHOD' });
}