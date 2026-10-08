import { sesion } from '../estado.js';

function buscarLinea(productoId) {
  return sesion.carrito.find(linea => linea.producto_id === productoId);
}

export function unidadesTotales() {
  return sesion.carrito.reduce((suma, linea) => suma + linea.cantidad, 0);
}

export function cantidadDe(productoId) {
  const linea = buscarLinea(productoId);
  return linea ? linea.cantidad : 0;
}

export function agregarAlCarrito(producto, limites) {
  if (producto.agotado) return 'agotado';
  const tope = Math.min(Number(producto.disponible_max), Number(limites.max_cantidad_producto));
  if (!(tope > cantidadDe(producto.producto_id))) return 'max_producto';
  if (!(unidadesTotales() < Number(limites.max_articulos))) return 'max_total';
  const linea = buscarLinea(producto.producto_id);
  if (linea) linea.cantidad += 1;
  else sesion.carrito.push({ producto_id: producto.producto_id, cantidad: 1 });
  return 'ok';
}