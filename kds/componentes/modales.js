import { el } from '../../shared/dom.js';
import { t } from '../../shared/i18n.js';
import { MOTIVOS_CANCELACION } from '../config.js';
import { construirAvatarChef } from './tarjeta-chef.js';

function construirModal(clase, ...contenido) {
  return el('div', { clase: 'modal', role: 'dialog', 'aria-modal': 'true' }, el('div', { clase: 'modal__tarjeta ' + clase }, ...contenido));
}

function construirOpcionPausa(tipo, deshabilitado, alElegir) {
  return el(
    'button',
    {
      type: 'button',
      clase: 'accion modal__opcion' + (tipo === 'comida' ? ' accion--oscura' : ''),
      disabled: deshabilitado,
      onclick: () => alElegir(tipo)
    },
    el('span', { clase: 'icono icono--break icono--grande', 'aria-hidden': 'true' }),
    el('span', { texto: t(tipo === 'comida' ? 'pausa_comida' : 'pausa_corto') })
  );
}

export function construirModalPausaSelector({ deshabilitado, alElegir, alCerrar }) {
  return construirModal(
    'modal__tarjeta--selector',
    el('h2', { clase: 'modal__titulo', texto: t('pausa_titulo') }),
    el(
      'div',
      { clase: 'modal__opciones' },
      construirOpcionPausa('corto', deshabilitado, alElegir),
      construirOpcionPausa('comida', deshabilitado, alElegir)
    ),
    el(
      'button',
      { type: 'button', clase: 'accion accion--secundaria', disabled: deshabilitado, onclick: alCerrar },
      el('span', { texto: t('pausa_cerrar') })
    )
  );
}

export function construirModalPausa({ chef, tipo, deshabilitado, alVolver }) {
  return construirModal(
    'modal__tarjeta--estado',
    construirAvatarChef(chef),
    el(
      'p',
      { clase: 'modal__texto' },
      t('pausa_esta_en') + ' ',
      el('strong', { texto: t(tipo === 'comida' ? 'pausa_comida' : 'pausa_corto') })
    ),
    el(
      'button',
      { type: 'button', clase: 'accion', disabled: deshabilitado, onclick: alVolver },
      el('span', { texto: t('pausa_volver') }),
      el('span', { clase: 'icono icono--avanzar', 'aria-hidden': 'true' })
    )
  );
}

export function construirModalCancelar({ pedido, motivo, deshabilitado, alElegir, alConfirmar, alVolver }) {
  return construirModal(
    'modal__tarjeta--cancelar',
    el('h2', { clase: 'modal__titulo', texto: t('cancelar_titulo') + ' ' + pedido.numero }),
    el('p', { clase: 'modal__subtitulo', texto: t('cancelar_motivo') }),
    el(
      'div',
      { clase: 'modal__motivos', role: 'group' },
      MOTIVOS_CANCELACION.map(clave =>
        el('button', {
          type: 'button',
          clase: 'modal__motivo' + (clave === motivo ? ' modal__motivo--activo' : ''),
          'aria-pressed': clave === motivo ? 'true' : 'false',
          disabled: deshabilitado,
          texto: t('motivo_' + clave),
          onclick: () => alElegir(clave)
        })
      )
    ),
    el(
      'div',
      { clase: 'modal__botones' },
      el(
        'button',
        { type: 'button', clase: 'accion accion--secundaria', disabled: deshabilitado, onclick: alVolver },
        el('span', { clase: 'icono icono--retroceder', 'aria-hidden': 'true' }),
        el('span', { texto: t('cancelar_volver') })
      ),
      el(
        'button',
        {
          type: 'button',
          clase: 'accion accion--peligro',
          disabled: deshabilitado || !motivo,
          onclick: () => alConfirmar(pedido)
        },
        el('span', { texto: t('cancelar_confirmar') }),
        el('span', { clase: 'icono icono--equis', 'aria-hidden': 'true' })
      )
    )
  );
}

export function construirModalFinalizar({ chef, deshabilitado, alConfirmar, alVolver }) {
  return construirModal(
    'modal__tarjeta--estado',
    construirAvatarChef(chef),
    el('h2', { clase: 'modal__titulo', texto: t('finalizar_titulo') }),
    el(
      'div',
      { clase: 'modal__botones' },
      el(
        'button',
        { type: 'button', clase: 'accion accion--secundaria', disabled: deshabilitado, onclick: alVolver },
        el('span', { clase: 'icono icono--retroceder', 'aria-hidden': 'true' }),
        el('span', { texto: t('finalizar_seguir') })
      ),
      el(
        'button',
        { type: 'button', clase: 'accion accion--oscura', disabled: deshabilitado, onclick: alConfirmar },
        el('span', { clase: 'icono icono--gorro', 'aria-hidden': 'true' }),
        el('span', { texto: t('principal_finalizar') })
      )
    )
  );
}

export function construirModalFinalizada({ alInicio }) {
  return construirModal(
    'modal__tarjeta--estado',
    el('div', { clase: 'modal__cuadro' }, el('span', { clase: 'icono icono--gorro icono--gigante', 'aria-hidden': 'true' })),
    el('h2', { clase: 'modal__titulo modal__titulo--mayus', texto: t('jornada_finalizada') }),
    el(
      'button',
      { type: 'button', clase: 'accion', onclick: alInicio },
      el('span', { texto: t('jornada_inicio') }),
      el('span', { clase: 'icono icono--avanzar', 'aria-hidden': 'true' })
    )
  );
}