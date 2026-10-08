import { el } from '../../shared/dom.js';
import { cambiarIdioma, idiomaActual, t } from '../../shared/i18n.js';

export function construirSelectorIdioma(variante) {
  const boton = (codigo, claveTexto) =>
    el('button', {
      type: 'button',
      clase: 'selector-idioma__boton',
      'aria-pressed': idiomaActual() === codigo ? 'true' : 'false',
      lang: codigo,
      texto: t(claveTexto),
      onclick: evento => {
        evento.stopPropagation();
        cambiarIdioma(codigo);
      }
    });
  return el(
    'div',
    {
      clase: 'selector-idioma selector-idioma--' + variante,
      role: 'group',
      'aria-label': t('idioma_etiqueta'),
      onclick: evento => evento.stopPropagation()
    },
    boton('es', 'idioma_es'),
    boton('en', 'idioma_en')
  );
}