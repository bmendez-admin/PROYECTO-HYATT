import { el, imagen } from '../../shared/dom.js';
import { t } from '../../shared/i18n.js';
import { construirEncabezado } from '../componentes/encabezado.js';
import { RETORNO_TICKET_MS, RUTAS } from '../config.js';
import { reiniciarSesion, sesion } from '../estado.js';
import { ir, pantallaActual } from '../navegacion.js';

let temporizadorRetorno = null;

function finalizar() {
  clearTimeout(temporizadorRetorno);
  reiniciarSesion();
  ir('portada');
}

export function construirTicket() {
  clearTimeout(temporizadorRetorno);
  const generacion = sesion.generacion;
  temporizadorRetorno = setTimeout(() => {
    if (sesion.generacion !== generacion || pantallaActual() !== 'ticket') return;
    finalizar();
  }, RETORNO_TICKET_MS);

  const numero = sesion.ticket ? String(sesion.ticket.numero) : '';

  return el(
    'section',
    { clase: 'pantalla pantalla--ticket' },
    construirEncabezado(),
    el(
      'div',
      { clase: 'zona-contenido ticket' },
      imagen(RUTAS.iconoOrden, { clase: 'ticket__icono', contener: true }),
      el(
        'h1',
        { clase: 'ticket__titulo' },
        el('span', { texto: t('ticket_titulo_1') }),
        el('span', { texto: t('ticket_titulo_2') })
      ),
      el('p', { clase: 'ticket__numero', texto: numero }),
      el('p', { clase: 'ticket__mensaje', texto: t('ticket_mensaje') }),
      el('p', { clase: 'ticket__gracias', texto: t('ticket_gracias') }),
      el('button', {
        type: 'button',
        clase: 'boton ticket__finalizar',
        texto: t('ticket_finalizar'),
        onclick: finalizar
      })
    )
  );
}