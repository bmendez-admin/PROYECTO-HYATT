const TEXTOS = {
  es: {
    titulo: 'Estado de pedidos',
    preparacion: 'En preparación',
    listo: 'Listo para recoger',
    paciencia: 'Gracias por tu paciencia',
    disfruta: 'Disfruta tu comida',
    vacio: 'Sin pedidos por ahora',
    mas: 'más',
    actualizando: 'Actualizando…',
    neutro: 'Estamos actualizando la información. Si tienes dudas, consulta con el personal.',
    sin_configurar: 'Esta pantalla no está configurada.',
    config_titulo: 'Esta pantalla no está configurada',
    config_detalle: 'Avisa a tu encargado para continuar.',
    am: 'a.m',
    pm: 'p.m'
  },
  en: {
    titulo: 'Order status',
    preparacion: 'Preparing',
    listo: 'Ready for pickup',
    paciencia: 'Thank you for your patience',
    disfruta: 'Enjoy your meal',
    vacio: 'No orders at the moment',
    mas: 'more',
    actualizando: 'Updating…',
    neutro: 'We are updating the information. If you have questions, please ask our staff.',
    sin_configurar: 'This screen is not configured.',
    config_titulo: 'This screen is not configured',
    config_detalle: 'Please ask your manager to continue.',
    am: 'a.m',
    pm: 'p.m'
  }
};

export function texto(clave, idioma) {
  return TEXTOS[idioma][clave];
}