let contexto = null;

export function prepararSonido() {
  try {
    const Constructor = window.AudioContext || window.webkitAudioContext;
    if (!Constructor) return;
    if (!contexto) contexto = new Constructor();
    if (contexto.state === 'suspended') contexto.resume();
  } catch (error) {
    contexto = null;
  }
}

function tono(frecuencia, inicio, duracion) {
  const oscilador = contexto.createOscillator();
  const ganancia = contexto.createGain();
  oscilador.type = 'sine';
  oscilador.frequency.value = frecuencia;
  ganancia.gain.setValueAtTime(0.0001, inicio);
  ganancia.gain.exponentialRampToValueAtTime(0.25, inicio + 0.02);
  ganancia.gain.exponentialRampToValueAtTime(0.0001, inicio + duracion);
  oscilador.connect(ganancia);
  ganancia.connect(contexto.destination);
  oscilador.start(inicio);
  oscilador.stop(inicio + duracion + 0.02);
}

export function sonarPedidoNuevo() {
  prepararSonido();
  if (!contexto || contexto.state !== 'running') return;
  const inicio = contexto.currentTime;
  tono(880, inicio, 0.18);
  tono(1175, inicio + 0.22, 0.26);
}