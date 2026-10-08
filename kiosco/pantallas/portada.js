import { el, imagen } from '../../shared/dom.js';
import { t } from '../../shared/i18n.js';
import { construirSelectorIdioma } from '../componentes/selector-idioma.js';
import { RUTAS } from '../config.js';
import { ir } from '../navegacion.js';
import { cargarCatalogo } from '../servicios/catalogo.js';

export function construirPortada() {
  const comenzar = () => {
    cargarCatalogo();
    ir('identificacion');
  };
  return el(
    'section',
    { clase: 'pantalla pantalla--portada', onclick: comenzar },
    el(
      'div',
      { clase: 'zona-encabezado' },
      imagen(RUTAS.portada, { clase: 'portada__foto' }),
      construirSelectorIdioma('foto')
    ),
    el(
      'div',
      { clase: 'zona-contenido' },
      el('p', { clase: 'portada__bienvenida', texto: t('bienvenida') }),
      imagen(RUTAS.logoColor, { clase: 'portada__logo', contener: true, alt: 'Hyatt Breathless' }),
      el('h1', { clase: 'portada__titulo', texto: t('titulo_portada') })
    ),
    el(
      'div',
      { clase: 'zona-acciones' },
      el('button', {
        type: 'button',
        clase: 'boton portada__comenzar',
        texto: t('comenzar'),
        onclick: evento => {
          evento.stopPropagation();
          comenzar();
        }
      }),
      el('p', { clase: 'portada__ayuda', texto: t('ayuda_portada') })
    )
  );
}