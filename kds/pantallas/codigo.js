import { el } from '../../shared/dom.js';
import { t } from '../../shared/i18n.js';
import { construirMarcoAcceso } from '../componentes/marco-acceso.js';
import { construirAvatarChef } from '../componentes/tarjeta-chef.js';
import { CODIGO_LONGITUD } from '../config.js';
import { iniciarSesionChef, sesion } from '../estado.js';
import { ir } from '../navegacion.js';
import { claveErrorTurno, iniciarTurno } from '../servicios/turnos.js';

const DIGITOS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function construirCodigo() {
  const chef = sesion.candidato;
  if (!chef) {
    queueMicrotask(() => ir('chefs'));
    return el('section', { clase: 'pantalla' });
  }

  let codigo = '';
  let enviando = false;

  const marco = construirMarcoAcceso();
  const casillas = Array.from({ length: CODIGO_LONGITUD }, () => el('span', { clase: 'codigo__casilla' }));
  const mensaje = el('p', { clase: 'codigo__mensaje', role: 'alert' });
  const tecla = (texto, clase, accion) =>
    el('button', { type: 'button', clase: 'codigo__tecla ' + clase, texto, onclick: accion });

  const volver = el(
    'button',
    {
      type: 'button',
      clase: 'acceso__boton acceso__boton--secundario codigo__volver',
      onclick: () => ir('chefs')
    },
    el('span', { clase: 'acceso__icono acceso__icono--atras', 'aria-hidden': 'true' }),
    el('span', { texto: t('codigo_volver') })
  );
  const botonesDigito = [...DIGITOS, '0'].map(digito => tecla(digito, '', () => agregar(digito)));
  const borrarTecla = tecla(t('teclado_borrar'), 'codigo__tecla--borrar', borrar);
  const continuarTecla = tecla(t('codigo_continuar'), 'codigo__tecla--continuar', continuar);

  function pintar() {
    casillas.forEach((casilla, indice) => {
      casilla.className =
        'codigo__casilla' +
        (indice < codigo.length ? ' codigo__casilla--llena' : '') +
        (indice === codigo.length && !enviando ? ' codigo__casilla--actual' : '');
    });
    continuarTecla.textContent = enviando ? t('codigo_verificando') : t('codigo_continuar');
    continuarTecla.disabled = enviando || codigo.length !== CODIGO_LONGITUD;
    borrarTecla.disabled = enviando || codigo.length === 0;
    volver.disabled = enviando;
    botonesDigito.forEach(boton => {
      boton.disabled = enviando;
    });
  }

  function agregar(digito) {
    if (enviando || codigo.length >= CODIGO_LONGITUD) return;
    codigo += digito;
    mensaje.textContent = '';
    pintar();
  }

  function borrar() {
    if (enviando || codigo.length === 0) return;
    codigo = codigo.slice(0, -1);
    mensaje.textContent = '';
    pintar();
  }

  async function continuar() {
    if (enviando || codigo.length !== CODIGO_LONGITUD) return;
    enviando = true;
    mensaje.textContent = '';
    pintar();
    const resultado = await iniciarTurno(chef.chef_id, codigo);
    enviando = false;
    if (resultado.ok) {
      iniciarSesionChef(chef);
      ir('principal');
      return;
    }
    codigo = '';
    mensaje.textContent = t(claveErrorTurno(resultado));
    pintar();
  }

  function alTeclear(evento) {
    if (!marco.nodo.isConnected) {
      document.removeEventListener('keydown', alTeclear);
      return;
    }
    if (/^[0-9]$/.test(evento.key)) {
      agregar(evento.key);
    } else if (evento.key === 'Backspace') {
      borrar();
    } else if (evento.key === 'Enter') {
      evento.preventDefault();
      continuar();
    }
  }
  document.addEventListener('keydown', alTeclear);

  marco.tarjeta.append(
    el(
      'div',
      { clase: 'codigo' },
      el('div', { clase: 'codigo__chef' }, construirAvatarChef(chef), volver),
      el(
        'div',
        { clase: 'codigo__entrada' },
        el('p', { clase: 'codigo__pedir', texto: t('codigo_pedir') }),
        el('div', { clase: 'codigo__casillas', role: 'group', 'aria-label': t('codigo_pedir') }, casillas),
        mensaje,
        el(
          'div',
          { clase: 'codigo__teclado' },
          botonesDigito.slice(0, 9),
          borrarTecla,
          botonesDigito[9],
          continuarTecla
        )
      )
    )
  );
  pintar();
  return marco.nodo;
}