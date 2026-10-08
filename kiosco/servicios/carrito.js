import { MAX_LINEAS_PEDIDO } from '../config.js';
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

export function quitarLinea(productoId) {
  sesion.carrito = sesion.carrito.filter(linea => linea.producto_id !== productoId);
}

export function agregarAlCarrito(producto, limites) {
  if (producto.agotado) return 'agotado';
  const tope = Math.min(Number(producto.disponible_max), Number(limites.max_cantidad_producto));
  if (!(tope > cantidadDe(producto.producto_id))) return 'max_producto';
  if (!(unidadesTotales() < Number(limites.max_articulos))) return 'max_total';
  const linea = buscarLinea(producto.producto_id);
  if (!linea && sesion.carrito.length >= MAX_LINEAS_PEDIDO) return 'max_lineas';
  if (linea) linea.cantidad += 1;
  else sesion.carrito.push({ producto_id: producto.producto_id, cantidad: 1 });
  return 'ok';
}

export function fijarCantidad(producto, cantidad, limites) {
  const nueva = Math.floor(Number(cantidad));
  if (!Number.isFinite(nueva) || nueva <= 0) {
    quitarLinea(producto.producto_id);
    return 'eliminado';
  }
  const actual = cantidadDe(producto.producto_id);
  if (producto.agotado && nueva > actual) return 'agotado';
  const tope = Math.min(Number(producto.disponible_max), Number(limites.max_cantidad_producto));
  if (!(nueva <= tope)) return 'max_producto';
  if (!(unidadesTotales() - actual + nueva <= Number(limites.max_articulos))) return 'max_total';
  const linea = buscarLinea(producto.producto_id);
  if (linea) linea.cantidad = nueva;
  else sesion.carrito.push({ producto_id: producto.producto_id, cantidad: nueva });
  return 'ok';
}