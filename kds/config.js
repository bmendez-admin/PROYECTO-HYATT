export const ROL = 'kds';

export const LIENZO = { ancho: 1920, alto: 1080 };

export const RUTAS = {
  logoColor: '../assets/logo/logo-color.png',
  iconoBandeja: '../assets/iconos/platter.png',
  productos: '../assets/productos/',
  iconosChef: {
    h: { normal: '../assets/iconos/chef-h.png', activo: '../assets/iconos/chef-h-activo.png' },
    m: { normal: '../assets/iconos/chef-m.png', activo: '../assets/iconos/chef-m-activo.png' }
  }
};

export const EXTENSION_PRODUCTO = '.jpg';

export const PATRON_VENUE = /^[a-z0-9_-]{2,32}$/;
export const PATRON_TOKEN = /^[A-Za-z0-9_-]{8,128}$/;
export const PATRON_IMAGEN = /^[a-z0-9_-]{1,64}$/;

export const CODIGO_LONGITUD = 6;

export const SONDEO_MS = 5000;

export const LIMITE_COLA_MS = 12000;

export const LIMITE_TURNO_MS = 20000;

export const SIN_CONEXION_MS = 30000;

export const DURACION_AVISO_MS = 4000;

export const LIMITE_ITEMS_FILA = 4;

export const LIMITE_ITEMS_DESPACHO = 6;

export const CLAVE_CHEF = 'kds_chef_';

export const MOTIVOS_CANCELACION = ['sin_ingredientes', 'pedido_duplicado', 'huesped_cancelo', 'otro'];