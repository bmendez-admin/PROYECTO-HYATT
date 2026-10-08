import { ErrorRed, llamar } from '../../shared/api.js';
import { el, imagen } from '../../shared/dom.js';
import { t } from '../../shared/i18n.js';
import { construirEncabezado } from '../componentes/encabezado.js';
import { construirTeclado } from '../componentes/teclado.js';
import { RUTAS } from '../config.js';
import { reiniciarSesion, sesion } from '../estado.js';
import { ir, pantallaActual } from '../navegacion.js';

const PATRON_EDIFICIO = /^[A-Z0-9]{1,3}$/;
const PATRON_HABITACION = /^\d{3,4}$/;
const LONGITUD_MAXIMA = { edificio: 3, habitacion: 4 };
const ESPERA_LENTA_MS = 10000;

const ui = { generacion: -1, cargando: false, lento: false, error: '' };
let refs = null;
let temporizadorLento = null;

function restablecerUi() {
  clearTimeout(temporizadorLento);
  ui.generacion = sesion.generacion;
  ui.cargando = false;
  ui.lento = false;
  ui.error = '';
}

function datosValidos() {
  const datos = sesion.identificacion;
  return PATRON_EDIFICIO.test(datos.edificio) && PATRON_HABITACION.test(datos.habitacion);
}

function claveError(resultado) {
  if (resultado.ok) return '';
  if (resultado.code === 'E_NOT_FOUND' || resultado.code === 'E_VALIDATION') return 'err_no_coincide';
  if (resultado.code === 'E_RATE') return 'err_bloqueado';
  return 'err_general';
}

function claveErrorExcepcion(error) {
  if (error instanceof ErrorRed && error.tipo !== 'sin_url') return 'err_red';
  return 'err_general';
}

function pintarCampo(nombre) {
  const datos = sesion.identificacion;
  const campo = refs.campos[nombre];
  const valor = datos[nombre];
  campo.texto.textContent = valor || t(nombre === 'edificio' ? 'campo_edificio' : 'campo_habitacion');
  campo.texto.classList.toggle('campo__texto--valor', Boolean(valor));
  campo.boton.classList.toggle('campo--vacio', !valor);
  campo.boton.classList.toggle('campo--activo', datos.campoActivo === nombre);
  campo.boton.classList.toggle('campo--error', ui.error === 'err_no_coincide');
  campo.boton.disabled = ui.cargando || Boolean(datos.huesped);
}

function pintarNombre() {
  const huesped = sesion.identificacion.huesped;
  const texto = huesped ? t('reserva_a_nombre') + ' ' + huesped.nombre_display : t('campo_nombre');
  refs.nombre.textContent = texto;
  refs.nombre.classList.toggle('campo__texto--valor', Boolean(huesped));
}

function pintarMensaje() {
  const mensaje = refs.mensaje;
  let clave = '';
  let tipo = '';
  if (ui.error) {
    clave = ui.error;
    tipo = 'error';
  } else if (ui.cargando && ui.lento) {
    clave = 'verificando_lento';
    tipo = 'info';
  }
  mensaje.hidden = !clave;
  mensaje.textContent = clave ? t(clave) : '';
  mensaje.className = 'mensaje' + (tipo ? ' mensaje--' + tipo : '');
}

function pintarBotones() {
  const datos = sesion.identificacion;
  refs.noSoyYo.hidden = !datos.huesped || ui.cargando;
  refs.continuarTexto.textContent = ui.cargando ? t('verificando') : t('continuar');
  refs.chevron.hidden = ui.cargando;
  refs.continuar.disabled = ui.cargando || (!datos.huesped && !datosValidos());
}

function pintarTeclado() {
  const datos = sesion.identificacion;
  const requerido = datos.campoActivo && !datos.huesped && !ui.cargando ? datos.campoActivo : null;
  const modo = requerido === 'habitacion' ? 'numerico' : requerido === 'edificio' ? 'alfanumerico' : null;
  const actual = refs.acciones.querySelector('.teclado');
  if (actual && (!modo || actual.dataset.modo !== modo)) actual.remove();
  if (modo && !refs.acciones.querySelector('.teclado')) {
    refs.acciones.append(
      construirTeclado({
        modo,
        alTecla: escribir,
        alBorrar: borrar,
        alListo: cerrarTeclado
      })
    );
  }
}

function actualizar() {
  if (!refs || pantallaActual() !== 'identificacion') return;
  pintarCampo('edificio');
  pintarCampo('habitacion');
  pintarNombre();
  pintarMensaje();
  pintarBotones();
  pintarTeclado();
}

function abrirCampo(nombre) {
  const datos = sesion.identificacion;
  if (ui.cargando || datos.huesped) return;
  datos.campoActivo = nombre;
  ui.error = '';
  actualizar();
}

function escribir(caracter) {
  const datos = sesion.identificacion;
  const nombre = datos.campoActivo;
  if (!nombre || datos[nombre].length >= LONGITUD_MAXIMA[nombre]) return;
  datos[nombre] += caracter;
  ui.error = '';
  actualizar();
}

function borrar() {
  const datos = sesion.identificacion;
  const nombre = datos.campoActivo;
  if (!nombre) return;
  datos[nombre] = datos[nombre].slice(0, -1);
  ui.error = '';
  actualizar();
}

function cerrarTeclado() {
  const datos = sesion.identificacion;
  datos.campoActivo = datos.campoActivo === 'edificio' && !datos.habitacion ? 'habitacion' : null;
  actualizar();
}

async function validar() {
  const datos = sesion.identificacion;
  const generacion = sesion.generacion;
  datos.campoActivo = null;
  ui.cargando = true;
  ui.lento = false;
  ui.error = '';
  actualizar();
  clearTimeout(temporizadorLento);
  temporizadorLento = setTimeout(() => {
    if (sesion.generacion !== generacion || !ui.cargando) return;
    ui.lento = true;
    actualizar();
  }, ESPERA_LENTA_MS);
  let error = '';
  let huesped = null;
  try {
    const resultado = await llamar('validar_cuarto', { edificio: datos.edificio, cuarto: datos.habitacion });
    if (resultado.ok) huesped = resultado.data;
    else error = claveError(resultado);
  } catch (excepcion) {
    error = claveErrorExcepcion(excepcion);
  }
  clearTimeout(temporizadorLento);
  if (sesion.generacion !== generacion) return;
  ui.cargando = false;
  ui.lento = false;
  ui.error = error;
  if (huesped) {
    sesion.identificacion.huesped = { huesped_id: huesped.huesped_id, nombre_display: huesped.nombre_display };
  }
  actualizar();
}

function continuar() {
  const datos = sesion.identificacion;
  if (ui.cargando) return;
  if (datos.huesped) {
    sesion.huesped = { ...datos.huesped };
    ir('menu');
    return;
  }
  if (datosValidos()) validar();
}

function volverAPortada() {
  reiniciarSesion();
  ir('portada');
}

function noSoyYo() {
  const datos = sesion.identificacion;
  sesion.huesped = null;
  sesion.carrito = [];
  datos.huesped = null;
  datos.edificio = '';
  datos.habitacion = '';
  datos.campoActivo = null;
  ui.error = '';
  actualizar();
}

function construirFondo() {
  const fondo = el('img', {
    clase: 'ident__fondo',
    src: RUTAS.fondoIdentificacion,
    alt: '',
    draggable: 'false',
    'aria-hidden': 'true'
  });
  fondo.addEventListener('error', () => fondo.remove());
  return fondo;
}

function construirCampo(nombre, claseExtra) {
  const texto = el('span', { clase: 'campo__texto' });
  const boton = el(
    'button',
    {
      type: 'button',
      clase: 'campo ' + claseExtra,
      'aria-label': t(nombre === 'edificio' ? 'campo_edificio' : 'campo_habitacion'),
      onclick: () => abrirCampo(nombre)
    },
    texto,
    el('span', { clase: 'campo__cursor', 'aria-hidden': 'true' })
  );
  return { boton, texto };
}

export function construirIdentificacion() {
  if (ui.generacion !== sesion.generacion) restablecerUi();

  const edificio = construirCampo('edificio', 'ident__campo ident__campo--edificio');
  const habitacion = construirCampo('habitacion', 'ident__campo ident__campo--habitacion');
  const nombre = el('span', { clase: 'campo__texto' });
  const mensaje = el('p', { clase: 'mensaje', role: 'alert', hidden: true });
  const noSoyYoBoton = el('button', {
    type: 'button',
    clase: 'boton boton--secundario ident__no-soy-yo',
    texto: t('no_soy_yo'),
    hidden: true,
    onclick: noSoyYo
  });
  const continuarTexto = el('span', { texto: t('continuar') });
  const chevron = el('span', { clase: 'ident__chevron', 'aria-hidden': 'true' });
  const continuarBoton = el(
    'button',
    { type: 'button', clase: 'boton ident__continuar', onclick: continuar },
    continuarTexto,
    chevron
  );
  const acciones = el('div', { clase: 'zona-acciones' }, continuarBoton);

  const contenido = el(
    'div',
    {
      clase: 'zona-contenido',
      onclick: evento => {
        if (evento.target.closest('.campo')) return;
        const datos = sesion.identificacion;
        if (!datos.campoActivo) return;
        datos.campoActivo = null;
        actualizar();
      }
    },
    el(
      'h1',
      { clase: 'ident__titulo' },
      el('span', { clase: 'ident__titulo-1', texto: t('ident_titulo_1') }),
      el('span', { clase: 'ident__titulo-2', texto: t('ident_titulo_2') })
    ),
    imagen(RUTAS.iconoEdificio, { clase: 'ident__icono ident__icono--edificio', contener: true }),
    imagen(RUTAS.iconoHabitacion, { clase: 'ident__icono ident__icono--habitacion', contener: true }),
    imagen(RUTAS.iconoPersona, { clase: 'ident__icono ident__icono--persona', contener: true }),
    edificio.boton,
    habitacion.boton,
    el(
      'div',
      { clase: 'campo campo--solo-lectura ident__campo ident__campo--nombre', role: 'status' },
      nombre
    ),
    mensaje,
    noSoyYoBoton
  );

  refs = {
    campos: { edificio, habitacion },
    nombre,
    mensaje,
    noSoyYo: noSoyYoBoton,
    continuar: continuarBoton,
    continuarTexto,
    chevron,
    acciones
  };

  const pantalla = el(
    'section',
    { clase: 'pantalla pantalla--identificacion' },
    construirFondo(),
    construirEncabezado({ alVolver: volverAPortada }),
    contenido,
    acciones
  );

  queueMicrotask(actualizar);
  return pantalla;
}