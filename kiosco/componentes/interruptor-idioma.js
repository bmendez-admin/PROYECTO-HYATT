import { el } from '../../shared/dom.js';
import { cambiarIdioma, idiomaActual, t } from '../../shared/i18n.js';

export function construirInterruptorIdioma() {
  const ingles = idiomaActual() === 'en';
  return el(
    'button',
    {
      type: 'button',
      clase: 'interruptor-idioma' + (ingles ? ' interruptor-idioma--en' : ''),
      role: 'switch',
      'aria-checked': ingles ? 'true' : 'false',
      'aria-label': t('idioma_etiqueta'),
      onclick: evento => {
        evento.stopPropagation();
        cambiarIdioma(ingles ? 'es' : 'en');
      }
    },
    el('span', { clase: 'interruptor-idioma__texto', texto: t(ingles ? 'idioma_en' : 'idioma_es') }),
    el(
      'span',
      { clase: 'interruptor-idioma__pista', 'aria-hidden': 'true' },
      el('span', { clase: 'interruptor-idioma__perilla' })
    )
  );
}