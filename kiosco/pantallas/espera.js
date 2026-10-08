import { el, imagen } from '../../shared/dom.js';
import { t } from '../../shared/i18n.js';
import { DESPLAZAMIENTO_PAUSA_MS, DESPLAZAMIENTO_PX_S, ESPERA_REFRESCO_MS, RUTAS } from '../config.js';
import { irConFundido, pantallaActual } from '../navegacion.js';
import { consultarPendientes } from '../servicios/pendientes.js';

const SALTO_MAXIMO_S = 0.1;

let ciclo = 0;

function textoDoble(etiqueta, clase, clave) {
  return el(
    etiqueta,
    { clase },
    el('span', { clase: 'espera__es', texto: t(clave) }),
    el('span', { clase: 'espera__en', texto: t(clave + '_en') })
  );
}

function construirFondo() {
  const fondo = el('img', { clase: 'espera__fondo', src: RUTAS.portada, alt: '', draggable: 'false' });
  fondo.addEventListener('error', () => fondo.remove());
  return fondo;
}

function construirTarjeta(pedido) {
  const clave = pedido.preparando ? 'espera_preparando' : 'espera_cola';
  return el(
    'li',
    { clase: 'espera__tarjeta' + (pedido.preparando ? ' espera__tarjeta--preparando' : '') },
    el('span', { clase: 'espera__numero', texto: pedido.numero }),
    el(
      'span',
      { clase: 'espera__estado' },
      el('span', { clase: 'espera__estado-es', texto: t(clave) }),
      el('span', { clase: 'espera__estado-en', texto: t(clave + '_en') })
    )
  );
}

function construirTotal(clasePunto, cantidad, clave) {
  return el(
    'span',
    { clase: 'espera__total' },
    el('i', { clase: 'espera__punto ' + clasePunto, 'aria-hidden': 'true' }),
    cantidad,
    el('span', { texto: t(clave) })
  );
}

export function construirEspera() {
  const mio = ++ciclo;
  let cargado = false;
  let saliendo = false;
  let firma = '';
  let posicion = 0;
  let pausaHasta = performance.now() + DESPLAZAMIENTO_PAUSA_MS;
  let anterior = 0;

  const totalPreparando = el('b', { texto: '0' });
  const totalCola = el('b', { texto: '0' });
  const totales = el(
    'div',
    { clase: 'espera__totales' },
    construirTotal('espera__punto--preparando', totalPreparando, 'espera_preparando'),
    construirTotal('espera__punto--cola', totalCola, 'espera_total_cola')
  );
  totales.hidden = true;

  const lista = el('ul', { clase: 'espera__lista', 'aria-label': t('espera_titulo') });
  const ventana = el('div', { clase: 'espera__ventana' }, lista);
  ventana.hidden = true;

  const vacio = el(
    'div',
    { clase: 'espera__vacio' },
    el('div', { clase: 'espera__icono' }, imagen(RUTAS.iconoOrden, { clase: 'espera__icono-img', contener: true })),
    textoDoble('p', 'espera__vacio-texto', 'espera_vacio')
  );
  vacio.hidden = true;

  const bloque = el(
    'div',
    { clase: 'espera__bloque' },
    el(
      'div',
      { clase: 'espera__etiqueta' },
      el('span', { texto: t('espera_etiqueta') + ' · ' + t('espera_etiqueta_en') }),
      el(
        'span',
        { clase: 'espera__vivo' },
        el('i', { clase: 'espera__vivo-punto', 'aria-hidden': 'true' }),
        el('span', { texto: t('espera_vivo') })
      )
    ),
    textoDoble('h1', 'espera__titulo', 'espera_titulo'),
    el('div', { clase: 'espera__panel' }, totales, el('div', { clase: 'espera__zona' }, ventana, vacio))
  );
  bloque.hidden = true;

  const pie = el(
    'button',
    { type: 'button', clase: 'espera__pie' },
    el(
      'span',
      { clase: 'espera__toca' },
      el('span', { clase: 'espera__toca-es', texto: t('espera_toca') }),
      el('span', { clase: 'espera__toca-en', texto: t('espera_toca_en') })
    ),
    el('span', { clase: 'espera__flecha', 'aria-hidden': 'true' })
  );

  function despertar() {
    if (saliendo) return;
    saliendo = true;
    irConFundido('portada');
  }

  const pantalla = el(
    'section',
    { clase: 'pantalla pantalla--espera', onclick: despertar },
    construirFondo(),
    el('div', { clase: 'espera__velo' }),
    el(
      'div',
      { clase: 'espera' },
      imagen(RUTAS.logoBlanco, { clase: 'espera__logo', contener: true }),
      bloque,
      el('div', { clase: 'espera__pie-zona' }, pie)
    )
  );

  function activo() {
    return mio === ciclo && pantalla.isConnected && pantallaActual() === 'espera';
  }

  function pintar(pedidos) {
    cargado = true;
    bloque.hidden = false;
    const hay = pedidos.length > 0;
    totales.hidden = !hay;
    ventana.hidden = !hay;
    vacio.hidden = hay;
    if (!hay) {
      posicion = 0;
      firma = '';
      lista.replaceChildren();
      return;
    }
    const nuevaFirma = pedidos.map(pedido => pedido.numero + (pedido.preparando ? '*' : '')).join(',');
    if (nuevaFirma === firma) return;
    firma = nuevaFirma;
    const preparando = pedidos.filter(pedido => pedido.preparando).length;
    totalPreparando.textContent = String(preparando);
    totalCola.textContent = String(pedidos.length - preparando);
    lista.replaceChildren(...pedidos.map(construirTarjeta));
  }

  function paso(ahora) {
    if (!activo()) return;
    const maximo = ventana.scrollHeight - ventana.clientHeight;
    const delta = anterior ? Math.min((ahora - anterior) / 1000, SALTO_MAXIMO_S) : 0;
    anterior = ahora;
    ventana.classList.toggle('espera__ventana--desborda', maximo > 0);
    if (maximo <= 0) {
      posicion = 0;
      ventana.scrollTop = 0;
    } else if (ahora >= pausaHasta) {
      if (posicion >= maximo) {
        posicion = 0;
        ventana.scrollTop = 0;
        pausaHasta = ahora + DESPLAZAMIENTO_PAUSA_MS;
      } else {
        posicion = Math.min(maximo, posicion + delta * DESPLAZAMIENTO_PX_S);
        ventana.scrollTop = posicion;
        if (posicion >= maximo) pausaHasta = ahora + DESPLAZAMIENTO_PAUSA_MS;
      }
    }
    requestAnimationFrame(paso);
  }

  async function ciclar() {
    if (!activo()) return;
    const resultado = await consultarPendientes();
    if (!activo()) return;
    if (resultado.ok) pintar(resultado.pedidos);
    else if (!cargado) bloque.hidden = true;
    setTimeout(ciclar, ESPERA_REFRESCO_MS);
  }

  queueMicrotask(() => {
    ciclar();
    requestAnimationFrame(paso);
  });

  return pantalla;
}