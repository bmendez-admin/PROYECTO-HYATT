import { CLAVE_CHEF } from './config.js';

export const sesion = {
  venueId: '',
  chef: null,
  candidato: null
};

function claveAlmacen() {
  return CLAVE_CHEF + sesion.venueId;
}

function normalizarChef(chef) {
  return { chef_id: chef.chef_id, nombre: chef.nombre, avatar: chef.avatar === 'm' ? 'm' : 'h' };
}

function guardarChef(chefId) {
  try {
    if (chefId) window.localStorage.setItem(claveAlmacen(), chefId);
    else window.localStorage.removeItem(claveAlmacen());
  } catch (error) {
    return;
  }
}

export function configurarSesion(venueId) {
  sesion.venueId = venueId;
}

export function chefGuardado() {
  try {
    return window.localStorage.getItem(claveAlmacen()) || '';
  } catch (error) {
    return '';
  }
}

export function elegirCandidato(chef) {
  sesion.candidato = normalizarChef(chef);
}

export function iniciarSesionChef(chef) {
  sesion.chef = normalizarChef(chef);
  sesion.candidato = null;
  guardarChef(chef.chef_id);
}

export function cerrarSesionChef() {
  sesion.chef = null;
  sesion.candidato = null;
  guardarChef('');
}