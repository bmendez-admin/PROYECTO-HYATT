import { el } from '../../shared/dom.js';
import { t } from '../../shared/i18n.js';

const FILAS_ALFANUMERICO = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
];

const FILAS_NUMERICO = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9']
];

export function construirTeclado({ modo, alTecla, alBorrar, alListo }) {
  const tecla = (texto, clase, accion) =>
    el('button', { type: 'button', clase: 'tecla ' + clase, texto, onclick: accion });
  const caracter = valor => tecla(valor, '', () => alTecla(valor));
  const borrar = clase => tecla(t('teclado_borrar'), 'tecla--borrar ' + clase, alBorrar);
  const listo = clase => tecla(t('teclado_listo'), 'tecla--listo ' + clase, alListo);
  const fila = (...teclas) => el('div', { clase: 'teclado__fila' }, teclas);

  if (modo === 'numerico') {
    return el(
      'div',
      { clase: 'teclado teclado--numerico', 'data-modo': 'numerico', role: 'group' },
      FILAS_NUMERICO.map(valores => fila(valores.map(caracter))),
      fila(borrar(''), caracter('0'), listo(''))
    );
  }

  return el(
    'div',
    { clase: 'teclado teclado--alfanumerico', 'data-modo': 'alfanumerico', role: 'group' },
    fila(FILAS_ALFANUMERICO[0].map(caracter)),
    fila(FILAS_ALFANUMERICO[1].map(caracter)),
    fila(FILAS_ALFANUMERICO[2].map(caracter)),
    fila(FILAS_ALFANUMERICO[3].map(caracter), borrar('tecla--ancha')),
    fila(listo('tecla--listo-ancha'))
  );
}