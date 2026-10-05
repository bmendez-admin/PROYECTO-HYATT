const HOJAS = Object.freeze({
  VENUES: 'VENUES',
  DB: 'DB',
  HUESPEDES: 'HUESPEDES',
  KIOSCO: 'KIOSCO',
  PEDIDO_ITEMS: 'PEDIDO_ITEMS',
  KDS: 'KDS',
  INVENTARIO: 'INVENTARIO',
  REABASTO: 'REABASTO',
  CHEFS: 'CHEFS',
  TURNOS: 'TURNOS',
  LOG: 'LOG'
});

const ENCABEZADOS = Object.freeze({
  VENUES: ['venue_id', 'nombre', 'zona_horaria', 'hora_apertura', 'hora_cierre', 'dia_operativo_inicio', 'turnos_activos_max', 'turno_vencido_horas', 'semaforo_amarillo_min', 'semaforo_rojo_min', 'meta_espera_min', 'activo'],
  DB: ['producto_id', 'venue_id', 'categoria_es', 'categoria_en', 'nombre_es', 'nombre_en', 'descripcion_es', 'descripcion_en', 'imagen', 'etiquetas', 'stock_actual', 'stock_minimo', 'activo', 'orden'],
  HUESPEDES: ['huesped_id', 'cuarto', 'edificio', 'piso', 'nombre_display', 'ocupado'],
  KIOSCO: ['pedido_id', 'numero', 'venue_id', 'request_id', 'huesped_id', 'cuarto', 'hora_creacion'],
  PEDIDO_ITEMS: ['pedido_id', 'producto_id', 'nombre_es', 'cantidad'],
  KDS: ['pedido_id', 'numero', 'venue_id', 'hora_llegada', 'estatus', 'chef_id', 'hora_en_preparacion', 'hora_completo', 'hora_recibido', 'hora_cancelado', 'motivo_cancelacion'],
  INVENTARIO: ['mov_id', 'venue_id', 'producto_id', 'tipo', 'cantidad', 'stock_resultante', 'hora', 'responsable'],
  REABASTO: ['solicitud_id', 'venue_id', 'producto_id', 'cantidad', 'chef_id', 'hora_solicitud', 'estatus', 'atendido_por', 'hora_atencion'],
  CHEFS: ['chef_id', 'nombre', 'activo'],
  TURNOS: ['turno_id', 'venue_id', 'chef_id', 'hora_inicio', 'hora_fin', 'estado', 'minutos_pausa', 'motivo_cierre', 'hora_pausa'],
  LOG: ['timestamp', 'accion', 'rol', 'venue_id', 'codigo_error', 'detalle_interno']
});

const COLUMNAS_TEXTO = Object.freeze({
  VENUES: ['venue_id', 'zona_horaria', 'hora_apertura', 'hora_cierre', 'dia_operativo_inicio'],
  DB: ['producto_id', 'venue_id', 'etiquetas'],
  HUESPEDES: ['huesped_id', 'cuarto', 'edificio', 'nombre_display'],
  KIOSCO: ['pedido_id', 'venue_id', 'request_id', 'huesped_id', 'cuarto'],
  PEDIDO_ITEMS: ['pedido_id', 'producto_id', 'nombre_es'],
  KDS: ['pedido_id', 'venue_id', 'estatus', 'chef_id', 'motivo_cancelacion'],
  INVENTARIO: ['mov_id', 'venue_id', 'producto_id', 'tipo', 'responsable'],
  REABASTO: ['solicitud_id', 'venue_id', 'producto_id', 'chef_id', 'estatus', 'atendido_por'],
  CHEFS: ['chef_id', 'nombre'],
  TURNOS: ['turno_id', 'venue_id', 'chef_id', 'estado', 'motivo_cierre'],
  LOG: ['accion', 'rol', 'venue_id', 'codigo_error', 'detalle_interno']
});

const COLUMNAS_FECHA = Object.freeze({
  KIOSCO: ['hora_creacion'],
  KDS: ['hora_llegada', 'hora_en_preparacion', 'hora_completo', 'hora_recibido', 'hora_cancelado'],
  INVENTARIO: ['hora'],
  REABASTO: ['hora_solicitud', 'hora_atencion'],
  TURNOS: ['hora_inicio', 'hora_fin', 'hora_pausa'],
  LOG: ['timestamp']
});

const ROLES_CON_TOKEN = Object.freeze(['kiosco', 'kds', 'estado']);

const LIMITES_POR_MINUTO = Object.freeze({
  kiosco: 60,
  kds: 180,
  estado: 90
});

const ESTATUS = Object.freeze({
  PENDIENTE: 'pendiente',
  EN_PREPARACION: 'en_preparacion',
  COMPLETO: 'completo',
  RECIBIDO: 'recibido',
  CANCELADO: 'cancelado'
});

const LIMITES_PEDIDO = Object.freeze({
  maxCantidadPorProducto: 10,
  maxArticulos: 20,
  maxLineas: 15
});

const TURNO = Object.freeze({
  ACTIVO: 'activo',
  PAUSA: 'pausa',
  CERRADO: 'cerrado'
});

const ESTADO_STOCK = Object.freeze({
  OK: 'ok',
  BAJO: 'bajo',
  AGOTADO: 'agotado'
});

const REABASTO_ESTATUS = Object.freeze({
  PENDIENTE: 'pendiente'
});

const CANTIDAD_MAX_REPOSICION = 200;

const MOTIVOS_CANCELACION = Object.freeze(['sin_ingredientes', 'pedido_duplicado', 'huesped_cancelo', 'otro']);
const MOTIVO_CIERRE_AUTOMATICO = 'cierre_automatico';
const MOTIVO_TURNO_MANUAL = 'manual';
const MOTIVO_TURNO_VENCIDO = 'vencido';

const PEDIDO_VENCE_HORAS = 12;
const REVERTIR_SEG = 60;
const TURNO_REPETIDO_SEG = 300;
const LISTO_VISIBLE_MIN = 10;
const CACHE_LECTURA_SEG = 3;
const LOCK_ESPERA_MS = 30000;

const BLOQUEO_CUARTO = Object.freeze({
  maxFallos: 5,
  ventanaSeg: 60
});