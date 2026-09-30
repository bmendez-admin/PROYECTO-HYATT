# Planeación: Kiosco de pedidos Hyatt Breathless (demo con ruta a producto)

Versión 1.1 · 30/09/2026 · Regida por REQUISITOS_DE_PROMPT.md

## Control de cambios
| Versión | Fecha | Cambio |
|---|---|---|
| 1.0 | 29/09/2026 | Planeación cerrada |
| 1.1 | 30/09/2026 | S1 cerrada: resultados de pruebas técnicas, reglas de robustez del cliente y del lock, repo y despliegue, cronograma y riesgos actualizados |

## 1. Contexto y alcance
- **Cliente:** Breathless Resorts & Spas (Hyatt Inclusive Collection). Resort solo adultos, todo incluido.
- **Venue inicial:** Bites (Riviera Cancún, por confirmar). Modelo multi-venue: Bites, Barefoot Grill y The Nook Café.
- **Objetivo:** el huésped pide desde un kiosco, espera su número en una pantalla, el chef lo prepara desde una tablet, y un dashboard informa la operación.
- **Entregables:** 1 kiosco, 1 KDS (2 chefs simultáneos, 1 tablet cada uno), 1 pantalla de Estado y 1 dashboard.
- **Fuera de alcance:** pagos, notas por pedido, puntos o ranking de chefs, fotos de platillos, notificaciones externas (correo o WhatsApp), reinicio diario de stock.
- **Plazo:** 10 sesiones (máximo 2 semanas).
- **Documento para diseño:** brief compartido con el equipo de diseño (vistas, estados, restricciones y entregables).

## 2. Stack y despliegue
- HTML, CSS y JS modular (módulos ES nativos), sin build, alojado solo en GitHub Pages.
- Repo: `bmendez-admin/PROYECTO-HYATT`, rama `main`, Pages desde `/ (root)`. Sitio: `https://bmendez-admin.github.io/PROYECTO-HYATT/`.
- Cada app vive en su carpeta (`/kiosco/`, `/kds/`, `/estado/`, `/dashboard/`). La raíz no tiene `index.html`.
- Backend: Google Sheets + Apps Script en la cuenta de ADMIRA, aplicación web ejecutada como el propietario, con acceso "Cualquier persona".
- Cada cambio del Apps Script exige una **nueva versión** de la implementación existente (Implementar → Administrar implementaciones → Editar → Nueva versión). Así la URL `/exec` no cambia.
- Se ejecuta como contenido web en el reproductor de ADMIRA (Windows, Chrome). Kiosco táctil y tablets para KDS.
- Pantallas de 1920×1080 en horizontal y 1080×1920 en vertical. Tipografía Montserrat.
- Regla: cero `innerHTML` con datos del servidor. Todo se construye con `shared/dom.js`.
- URLs de contenido en ADMIRA con `?v=fecha` para forzar actualización.

```
backend/   Code.gs
docs/      PLANEACION.md · TECNICA.md
kiosco/  kds/  estado/  dashboard/   (index.html + main.js)
shared/    api.js · i18n.js · dom.js · tokens.css · components.css · fonts/
assets/    logo, imágenes
spike/     solo S1 (se elimina al cerrar S2)
```

## 3. Marca y datos de investigación
- **Concepto:** *Unlimited-Luxury®* y *Live in Full Color*. Tono sofisticado y desenfadado.
- **Logo:** wordmark "breathless" con espiral. Morado ≈ `#6E3282`, gris cálido ≈ `#ABA39C` (medidos del logo; no son códigos oficiales). El gris cálido **no se usa para texto** (contraste de unos 2.5:1).
- **Paleta:** base blanca y neutros cálidos, morado como acento. Acentos rosa, magenta y turquesa solo como dirección (no oficial).
- **Referencia de diseño:** Stripe y Apple. Carl's Jr y Lenovo solo como base funcional.
- **Menú:** no hay menú público. Demo propuesto por nosotros, marcado como demo.
- **Venues (horarios oficiales):** Barefoot Grill 12:00–17:00, Bites 11:00–16:00, The Nook Café 24 h.
- **Pendiente de terceros:** guía de marca, menú real y sede definitiva.

## 4. Backend y DB

### 4.1 Pestañas
| Pestaña | Campos clave |
|---|---|
| VENUES | venue_id, nombre, zona_horaria, hora_apertura, hora_cierre, activo y parámetros por venue |
| DB | producto_id, venue_id, categoria_es/en, nombre_es/en, descripcion_es/en, imagen (opcional), etiquetas, stock_actual, stock_minimo, activo, orden |
| HUESPEDES | huesped_id, cuarto, nombre_display, ocupado (datos fijos en la demo) |
| KIOSCO | pedido_id, numero, venue_id, request_id, huesped_id, cuarto, hora_creacion. Registro fijo |
| PEDIDO_ITEMS | pedido_id, producto_id, nombre_es, cantidad |
| KDS | pedido_id, numero, venue_id, hora_llegada, estatus, chef_id, hora_en_preparacion, hora_completo, hora_recibido, hora_cancelado, motivo_cancelacion |
| INVENTARIO | mov_id, venue_id, producto_id, tipo (inicial, relleno, consumo, devolucion, ajuste), cantidad, stock_resultante, hora, responsable |
| REABASTO | solicitud_id, venue_id, producto_id, cantidad, chef_id, hora_solicitud, estatus, atendido_por, hora_atencion |
| CHEFS | chef_id, nombre, activo |
| TURNOS | turno_id, venue_id, chef_id, hora_inicio, hora_fin, estado (activo, pausa, cerrado), minutos_pausa, motivo_cierre |
| LOG | timestamp, accion, rol, venue_id, codigo_error, detalle_interno |

- El estatus vive **solo en KDS**. KIOSCO puede mostrar una columna de solo lectura que lo consulta.
- Prioridad si hay que recortar: REABASTO y LOG se posponen primero.
- Número de pedido secuencial por venue y por día operativo. `pedido_id` = `<venue>-<yyyymmdd>-<nnn>`.
- La pestaña SPIKE de S1 se elimina al cerrar S2.

### 4.2 Estatus y transiciones
Estatus: `pendiente`, `en_preparacion`, `completo`, `recibido`, y `cancelado` (interno).

| Acción | Transición | Regla |
|---|---|---|
| tomar | pendiente → en_preparacion | Asigna chef, con lock |
| completar | en_preparacion → completo | El chef que lo tiene |
| recibir | completo → recibido | El chef |
| cancelar | pendiente o en_preparacion → cancelado | Motivo de lista fija, devuelve stock |
| liberar | en_preparacion → pendiente | Mismo chef |
| revertir | completo → en_preparacion | Mismo chef, dentro de 60 s |

Cualquier otra transición se rechaza.

### 4.3 API por rol
Respuesta: `{ok:true,data}` o `{ok:false,code}`. Códigos: E_VALIDATION, E_AUTH, E_CONFLICT, E_STOCK, E_NOT_FOUND, E_RATE, E_INTERNAL.

| Rol | Acciones |
|---|---|
| kiosco | `catalogo`, `validar_cuarto`, `crear_pedido` (con `request_id`) |
| kds | `cola`, `iniciar_turno`, `pausar_turno`, `reanudar_turno`, `cerrar_turno`, `cambiar_estatus`, `inventario`, `registrar_relleno`, `solicitar_reabasto` |
| estado | `estado` |
| dashboard (sesión por PIN) | `login_dashboard`, `venues`, `metricas`, `exportar_pedidos`, `atender_reabasto` |

### 4.4 Seguridad (OWASP, Zero Trust)
- Token por rol y venue en Script Properties, entregado en la URL de contenido de ADMIRA, no en el repo. Es control por dispositivo, no autenticación de personas.
- El dashboard usa PIN con hash y sal, sesión de hasta 6 h y bloqueo de 5 min tras 5 intentos. El PIN lo define el responsable directamente en el editor de Apps Script.
- El servidor solo recibe ids y cantidades y recalcula el resto. Lista blanca de acciones, validación de tipos y longitudes.
- Neutralización de textos que empiecen con `=`, `+`, `-` o `@`, tanto al guardar como al exportar.
- Errores genéricos al cliente, detalle en LOG.
- Nombre y cuarto nunca salen hacia KDS, Estado ni dashboard. La lista completa de huéspedes nunca llega al kiosco.
- La URL `/exec` es pública por diseño. La protección real son el token, la validación del servidor y el límite de frecuencia.
- Producción: reemplazar por un backend real con JWT o cookies HttpOnly.

### 4.5 Concurrencia, rendimiento y robustez (validado en S1)
- `LockService` en toda escritura, con `tryLock` de 30 s. Todas las escrituras de una operación se hacen en **un solo bloque** dentro del lock, sin pausas ni lecturas repetidas.
- `request_id` idempotente en `crear_pedido`, para que el reintento del cliente sea seguro.
- Cliente (`shared/api.js`): tiempo límite de 20 s por petición, hasta 3 reintentos con espera creciente y aleatoria. Una respuesta HTML o un error de red cuentan como fallo reintentable.
- Las pantallas muestran la antigüedad del dato ("actualizado hace X s") y toleran 1 a 2 s de retraso por llamada.
- Caché de servidor: 3 s en `cola` y `estado`, 30 s en `metricas`.
- Latido de chef en `CacheService` (90 s), no en el Sheet.
- Métricas agregadas en el servidor. Peticiones CORS normales en `text/plain`.
- El cliente bloquea las acciones mientras una está en curso, para evitar solapes y toques dobles.

## 5. Kiosco
- **Flujo:** Bienvenida (ES/EN) → Identificación → Menú → Resumen → Confirmación.
- **Identificación:** el huésped escribe su cuarto y confirma el nombre mostrado. Cuarto inexistente y desocupado dan el mismo mensaje, con bloqueo de 60 s tras 5 fallos.
- **Sesión:** aviso a los 60 s de inactividad y reinicio 10 s después. La confirmación regresa sola a Bienvenida a los 15 s.
- **Catálogo:** refresco cada 30 s dentro del menú. Producto agotado durante la compra: se avisa y se ajusta.
- **Diseño:** tarjetas tipográficas sin fotos, con espacio opcional para imagen. Objetivos táctiles de 72 px o más, texto base de 28 px o más, `aria-live` en el carrito, `prefers-reduced-motion`.
- **Menú demo Bites:**
  - Para compartir: guacamole con totopos, croquetas de jamón, papas bravas, tabla de quesos.
  - Del mar: ceviche de pescado, camarones al ajillo, tostada de atún.
  - Frescos: ensalada caprese, ensalada de quinoa.
  - Calientes: brochetas de pollo, empanadas de queso.
  - Dulces: churros con chocolate, panna cotta de frutos rojos.
  - Cada uno con nombre y descripción ES/EN. Etiquetas solo de demo.

## 6. KDS
- **Vista:** tres columnas (Pendientes, En preparación, Completos). Una acción principal por tarjeta: Tomar, Completar o Entregado. El chef trabaja solo con número y platillos.
- **Cancelar:** modal propio con motivo de lista fija.
- **Turnos:** el chef elige su nombre entre los no activos. Máximo 2 activos por venue. Pausa bloqueada si tiene pedidos en preparación (debe completarlos o liberarlos). Turnos vencidos se cierran solos.
- **Inventario:** panel ordenado por stock, con Relleno y Solicitar reabasto. Banner de alerta al llegar al mínimo, solo si hay chef con turno activo.
- **Resiliencia:** tiempos con hora del servidor, banner y acciones deshabilitadas tras 30 s sin conexión, aviso de conflicto si otro chef ya tomó el pedido. Sonido de pedido nuevo, habilitado al iniciar turno.

## 7. Estado de pedido
- **Pantalla pública sin interacción,** bilingüe permanente (ES y EN a la vez). Solo número, estatus y hora.
- **Dos bloques** (En proceso y Listo). En horizontal, En proceso a la izquierda y Listo a la derecha. En vertical, Listo arriba.
  - Pendiente: tarjeta apagada, solo contorno, etiqueta "En cola / Queued".
  - En preparación: tarjeta iluminada, etiqueta "Preparando / Preparing".
  - Completo: pasa al bloque Listo, resaltado unos 8 s.
- El gris de la tarjeta apagada debe cumplir 4.5:1 de contraste.
- **Orden:** número ascendente en En proceso, más reciente primero en Listo. Máximo de números por bloque con contador "+N".
- **Cancelado:** no se muestra. Un número que sale de En proceso sin llegar a Listo se desvanece en 10 s.
- **Listo:** se oculta a los 10 min si nadie marca Recibido (solo en pantalla).
- **Sin sonido.** Consulta cada 5 s. Sin conexión: indicador a los 30 s y mensaje neutro a los 2 min. Recarga automática cada 6 h.

## 8. Dashboard
- **Usuario:** encargado, en navegador de escritorio. Selector de venue (con "Todos") y de periodo (Hoy, Ayer, 7 días, personalizado).
- **Paneles:** KPIs (totales, recibidos, cancelados, en curso, espera promedio del huésped y % dentro de meta de 10 min), en vivo, pedidos por hora, productos más pedidos, mezcla por categoría, chefs (completados, tiempo de preparación, horas de turno), inventario (stock contra mínimo y último relleno), reabasto, actividad reciente.
- **Solo lectura, salvo `atender_reabasto`.** Sin datos personales en pantalla ni en el CSV. Consulta cada 30 s. Estados de carga, vacío y error, con el último dato y su hora.
- **Stock inicial:** se carga en el Sheet, sin reinicio diario. Los rellenos se registran desde el KDS.

## 9. Parámetros iniciales (ajustables)
| Parámetro | Valor | Estado |
|---|---|---|
| Día operativo inicia | 04:00 local | Propuesto |
| Zona horaria | America/Cancun (por venue) | Propuesto |
| Semáforo KDS (amarillo, rojo) | 5 y 10 min | Propuesto |
| Turnos activos máximos | 2 | Acordado |
| Pedidos activos por cuarto | 3 | Propuesto |
| Meta de espera del huésped | 10 min | Acordado |
| Listo visible en Estado | 10 min | Acordado |
| Cancelado se desvanece | 10 s | Acordado |
| Ventana de "revertir" | 60 s | Acordado |
| Turno vencido | 12 h | Propuesto |
| Latido de chef | 90 s | Validado en S1 |
| Consulta: KDS y Estado, dashboard, catálogo kiosco | 5 s, 30 s, 30 s | Validado en S1 |
| `tryLock` del servidor | 30 s | Validado en S1 |
| Tiempo límite y reintentos del cliente | 20 s y 3 reintentos | Acordado en S1 |

## 10. Cronograma
| Sesión | Entregable | Estado |
|---|---|---|
| S1 | Planeación y pruebas técnicas | Cerrada 30/09/2026 |
| S2 | Backend y DB, parte 1: esquema, datos demo y API de kiosco y Estado (`catalogo`, `validar_cuarto`, `crear_pedido`, `cola`, `estado`) | Siguiente |
| S3 | Backend y DB, parte 2: turnos, `cambiar_estatus`, inventario, reabasto, dashboard y seguridad | Pendiente |
| S4–S5 | Kiosco | Pendiente |
| S6–S7 | KDS | Pendiente |
| S8 | Estado | Pendiente |
| S9 | Dashboard | Pendiente |
| S10 | Seguridad, QA, despliegue en ADMIRA y documentación | Pendiente |

## 11. Resultados de las pruebas técnicas de S1
| # | Prueba | Resultado |
|---|---|---|
| 1 | POST `text/plain` desde GitHub Pages | Respuesta legible. GET 824 ms, POST 479 ms, sin reintentos |
| 2 | Acceso "Cualquier persona" | Confirmado, también desde ventana de incógnito (GET 1498 ms). La primera implementación había quedado con acceso solo de la organización |
| 3 | LockService con 10 solicitudes simultáneas | 10/10 exitosas, valores consecutivos y sin repetidos, esperas de 1.5 a 8.9 s, lote completo en 10 s |
| 4 | Polling con 3 clientes cada 5 s durante 60 s | 36/36 solicitudes, 0 errores, mediana 1.4 s, máxima 9.4 s |
| 5 | Latido en CacheService | Envío y lectura en llamadas separadas correctos; expira a los 90 s |

Hallazgos de la primera corrida (sin reintentos y con pruebas solapadas): respuestas HTML por 404 intermitentes en la redirección de Apps Script (`script.googleusercontent.com/macros/echo`) y latencias de hasta 28 s por saturación. Se mitigan con las reglas de la sección 4.5.

## 12. Riesgos
- Latencia base de 0.5 a 1.5 s por llamada, con picos de hasta 9 s en arranques simultáneos. Las pantallas deben tolerarlo.
- Redirección de Apps Script con 404 intermitente bajo carga (mitigación: reintentos).
- Escrituras en fila (unos 0.7 s cada una). Picos de muchos pedidos al mismo instante alargan la espera.
- Límite de ejecuciones simultáneas y cuotas diarias de Apps Script según la edición de Workspace (sin confirmar).
- La URL `/exec` es pública: depende del token, la validación y el límite de frecuencia.
- Crecimiento de filas en las pestañas: requerirá archivado si se usa fuera de la demo.
- Menú, logo y guía de marca reales aún pendientes.
- Token y PIN no sustituyen autenticación real (producción).
- Caché de GitHub Pages y del reproductor (mitigación: `?v=fecha`).
- Plan ajustado, sin colchón.
- Riesgo resuelto: la política de Workspace sí permite el acceso público.

## 13. Definition of Done por sección
- Casos de prueba de la sección pasan.
- Inputs inválidos y errores manejados, con estados de carga, error y vacío.
- Ningún `innerHTML` con datos, contraste verificado, sin datos personales fuera de su rol.
- Explicación de cambios, commit en Conventional Commits y documentación actualizada al cierre.