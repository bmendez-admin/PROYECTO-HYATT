const PROPIEDADES_PROHIBIDAS = new Set(['innerhtml', 'outerhtml', 'srcdoc', 'style']);

function agregarHijos(nodo, hijos) {
  hijos.flat(Infinity).forEach(hijo => {
    if (hijo === null || hijo === undefined || hijo === false) return;
    nodo.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
  });
}

export function el(etiqueta, propiedades = {}, ...hijos) {
  const nodo = document.createElement(etiqueta);
  Object.entries(propiedades).forEach(([nombre, valor]) => {
    if (valor === undefined || valor === null || valor === false) return;
    const clave = nombre.toLowerCase();
    if (PROPIEDADES_PROHIBIDAS.has(clave)) throw new Error('propiedad no permitida: ' + nombre);
    if (nombre === 'clase') nodo.className = valor;
    else if (nombre === 'texto') nodo.textContent = valor;
    else if (clave.startsWith('on') && typeof valor === 'function') nodo.addEventListener(clave.slice(2), valor);
    else nodo.setAttribute(nombre, valor === true ? '' : String(valor));
  });
  agregarHijos(nodo, hijos);
  return nodo;
}

export function imagen(ruta, opciones = {}) {
  const clases = ['imagen', opciones.clase, opciones.contener ? 'imagen--contener' : ''].filter(Boolean).join(' ');
  const contenedor = el('div', { clase: clases });
  const img = el('img', { src: ruta, alt: opciones.alt || '', draggable: 'false' });
  img.addEventListener('error', () => {
    img.remove();
    contenedor.classList.add('imagen--faltante');
    contenedor.append(el('span', { clase: 'imagen__ruta', texto: ruta.replace(/^(\.\.\/)+/, '') }));
  });
  contenedor.append(img);
  return contenedor;
}