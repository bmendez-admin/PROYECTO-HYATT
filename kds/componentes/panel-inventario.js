import { el, imagen } from '../../shared/dom.js';
import { t } from '../../shared/i18n.js';
import { EXTENSION_PRODUCTO, PATRON_IMAGEN, RUTAS } from '../config.js';
import { categoriasDe, estadoDe, ordenarPorUrgencia, resumenInventario } from '../servicios/inventario.js';

const FILTROS = [
  { estado: '', clave: 'inventario_total', contador: 'total' },
  { estado: 'agotado', clave: 'inventario_agotados', contador: 'agotado' },
  { estado: 'bajo', clave: 'inventario_bajos', contador: 'bajo' },
  { estado: 'ok', clave: 'inventario_ok', contador: 'ok' }
];

function textoHace(marca, ahora) {
  const hora = Date.parse(marca);
  if (!Number.isFinite(hora)) return '';
  const minutos = Math.max(0, Math.floor((ahora - hora) / 60000));
  if (minutos < 1) return t('hace_momento');
  if (minutos < 60) return t('hace') + ' ' + minutos + ' ' + t('hace_min');
  if (minutos < 1440) return t('hace') + ' ' + Math.floor(minutos / 60) + ' ' + t('hace_horas');
  return t('hace') + ' ' + Math.floor(minutos / 1440) + ' ' + t('hace_dias');
}

function construirFoto(producto) {
  const clase = 'fila-inv__foto';
  if (typeof producto.imagen !== 'string' || !PATRON_IMAGEN.test(producto.imagen)) {
    return el('div', { clase: clase + ' fila-inv__foto--vacia' });
  }
  return imagen(RUTAS.productos + producto.imagen + EXTENSION_PRODUCTO, { clase });
}

function construirFila(producto, { deshabilitado, ahora, alRellenar, alReabastecer }) {
  const estado = estadoDe(producto);
  const relleno = typeof producto.ultimo_relleno === 'string' ? textoHace(producto.ultimo_relleno, ahora) : '';
  const pendiente = producto.reabasto_pendiente === true;
  const detalle = [producto.categoria_es, relleno ? t('inventario_ultimo_relleno') + ' ' + relleno : ''].filter(Boolean).join(' · ');
  return el(
    'article',
    { clase: 'fila-inv fila-inv--' + estado },
    construirFoto(producto),
    el(
      'div',
      { clase: 'fila-inv__nombre' },
      el('h3', { clase: 'fila-inv__titulo', texto: producto.nombre_es }),
      el('p', { clase: 'fila-inv__detalle', texto: detalle })
    ),
    el(
      'div',
      { clase: 'fila-inv__stock' },
      el('span', { clase: 'fila-inv__cantidad', texto: String(producto.stock_actual) }),
      el('span', { clase: 'fila-inv__minimo', texto: t('inventario_minimo') + ' ' + producto.stock_minimo })
    ),
    el('span', { clase: 'fila-inv__estado fila-inv__estado--' + estado, texto: t('estado_' + estado) }),
    el('button', {
      type: 'button',
      clase: 'accion accion--chica ' + (pendiente ? 'accion--secundaria' : 'accion--contorno'),
      disabled: deshabilitado || pendiente,
      title: pendiente ? t('inventario_reabasto_pendiente') : null,
      texto: pendiente ? t('inventario_pendiente') : t('inventario_reabasto'),
      onclick: () => alReabastecer(producto)
    }),
    el('button', {
      type: 'button',
      clase: 'accion accion--chica',
      disabled: deshabilitado,
      texto: t('inventario_relleno'),
      onclick: () => alRellenar(producto)
    })
  );
}

function construirFiltro({ estado, clave, contador }, resumen, total, filtroEstado, alFiltrarEstado) {
  const activo = filtroEstado === estado;
  const numero = contador === 'total' ? total : resumen[contador];
  return el(
    'button',
    {
      type: 'button',
      clase: 'inventario__filtro' + (activo ? ' inventario__filtro--activo' : ''),
      'aria-pressed': activo ? 'true' : 'false',
      onclick: () => alFiltrarEstado(estado)
    },
    el('span', { clase: 'inventario__filtro-texto', texto: t(clave) }),
    el('span', { clase: 'inventario__filtro-numero inventario__filtro-numero--' + (estado || 'todos'), texto: String(numero) })
  );
}

function construirChip(texto, activo, alElegir) {
  return el('button', {
    type: 'button',
    clase: 'inventario__chip' + (activo ? ' inventario__chip--activo' : ''),
    'aria-pressed': activo ? 'true' : 'false',
    texto,
    onclick: alElegir
  });
}

function construirCuerpo({ productos, error, filtroEstado, filtroCategoria, deshabilitado, ahora, alRellenar, alReabastecer, alReintentar }) {
  if (!productos) {
    if (!error) return el('p', { clase: 'inventario__mensaje', texto: t('inventario_cargando') });
    return el(
      'div',
      { clase: 'inventario__mensaje inventario__mensaje--error' },
      el('p', { texto: t('inventario_error') }),
      el('button', { type: 'button', clase: 'accion accion--chica', texto: t('reintentar'), onclick: alReintentar })
    );
  }
  const visibles = ordenarPorUrgencia(productos).filter(
    producto =>
      (!filtroEstado || estadoDe(producto) === filtroEstado) &&
      (!filtroCategoria || producto.categoria_es === filtroCategoria)
  );
  if (!visibles.length) return el('p', { clase: 'inventario__mensaje', texto: t('inventario_vacio') });
  return el(
    'div',
    { clase: 'inventario__lista' },
    visibles.map(producto => construirFila(producto, { deshabilitado, ahora, alRellenar, alReabastecer }))
  );
}

export function construirPanelInventario(opciones) {
  const { productos, filtroEstado, filtroCategoria, pedidosEnFila, alFiltrarEstado, alFiltrarCategoria, alCerrar } = opciones;
  const resumen = resumenInventario(productos);
  const total = productos ? productos.length : 0;
  const categorias = productos ? categoriasDe(productos) : [];
  return el(
    'section',
    { clase: 'inventario' },
    el(
      'aside',
      { clase: 'inventario__lateral' },
      el('h2', { clase: 'inventario__titulo', texto: t('inventario_titulo') }),
      el(
        'div',
        { clase: 'inventario__filtros' },
        FILTROS.map(filtro => construirFiltro(filtro, resumen, total, filtroEstado, alFiltrarEstado))
      ),
      el(
        'button',
        { type: 'button', clase: 'accion accion--secundaria inventario__volver', onclick: alCerrar },
        el('span', { clase: 'icono icono--retroceder', 'aria-hidden': 'true' }),
        el('span', { texto: t('inventario_volver') }),
        pedidosEnFila > 0
          ? el('span', { clase: 'inventario__en-fila', texto: String(pedidosEnFila), 'aria-label': t('inventario_en_fila') })
          : null
      )
    ),
    el(
      'div',
      { clase: 'inventario__principal' },
      el(
        'nav',
        { clase: 'inventario__categorias' },
        categorias.length
          ? [
              construirChip(t('inventario_todas'), filtroCategoria === '', () => alFiltrarCategoria('')),
              categorias.map(categoria =>
                construirChip(categoria, filtroCategoria === categoria, () =>
                  alFiltrarCategoria(filtroCategoria === categoria ? '' : categoria)
                )
              )
            ]
          : null
      ),
      construirCuerpo(opciones)
    )
  );
}