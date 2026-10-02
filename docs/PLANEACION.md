# Planeación: Kiosco de pedidos Hyatt Breathless (demo con ruta a producto)

Versión 1.3 · 02/10/2026 · Regida por REQUISITOS_DE_PROMPT.md

## 1. Contexto y alcance
- **Cliente:** Breathless Resorts & Spas (Hyatt Inclusive Collection). Resort solo adultos, todo incluido.
- **Venue inicial:** Bites (Riviera Cancún, por confirmar). Modelo multi-venue: Bites, Barefoot Grill y The Nook Café.
- **Objetivo:** el huésped pide desde un kiosco, espera su número en una pantalla, el chef lo prepara desde una tablet, y un dashboard informa la operación.
- **Entregables:** 1 kiosco, 1 KDS (2 chefs simultáneos, 1 tablet cada uno), 1 pantalla de Estado y 1 dashboard.
- **Fuera de alcance:** pagos, notas por pedido, puntos o ranking de chefs, fotos de platillos, notificaciones externas (correo o WhatsApp), reinicio diario de stock.
- **Plazo:** 10 sesiones (máximo 2 semanas).

## 2. Stack y despliegue
- HTML, CSS y JS modular (módulos ES nativos), sin build, alojado solo en GitHub Pages (repo `bmendez-admin/PROYECTO-HYATT`, rama `main`, Pages desde la raíz).
- Backend: Google Sheets + Apps Script en la cuenta de ADMIRA. Web app ejecutada como el propietario, con acceso "Cualquier persona".
- Se ejecuta como contenido web en el reproductor de ADMIRA (Windows, Chrome). Kiosco táctil y tablets para KDS.
- Pantallas de 1920×1080 en horizontal y 1080×1920 en vertical. Tipografía Montserrat.
- Regla: cero `innerHTML` con datos del servidor. Todo se construye con `shared/dom.js`.
- URLs de contenido en ADMIRA con `?v=fecha` para forzar actualización.

```
backend/ docs/ kiosco/ kds/ estado/ dashboard/ shared/ assets/ spike/
shared/  api.js · i18n.js · dom.js · tokens.css · components.css · fonts/
```

## 3. Marca y datos de investigación
- **Concepto:** *Unlimited-Luxury®* y *Live in Full Color*. Tono sofisticado y desenfadado.
- **Logo:** wordmark "breathless" con espiral. Morado ≈ `#6E3282`, gris cálido ≈ `#ABA39C` (medidos del logo; no son códigos oficiales). El gris cálido **no se usa para texto** (contraste de unos 2.5:1).
- **Paleta:** base blanca y neutros cálidos, morado como acento. Acentos rosa, magenta y turquesa solo como dirección (no oficial).
- **Referencia de diseño:** Stripe y Apple. Carl's Jr y Lenovo solo como base funcional.
- **Menú:** no hay menú público. Demo propuesto por nosotros, marcado como demo.
- **Venues (horarios oficiales):** Barefoot Grill 12:00–17:00, Bites 11:00–16:00, The Nook Café 24 h. En la demo no se bloquean pedidos fuera de horario.
- **Pendiente de terceros:** guía de marca, menú real y sede definitiva.

## 4. Backend y DB

### 4.1 Pestañas
| Pestaña | Campos clave |
|---|---|
| VENUES | venue_id, nombre, zona_horaria, hora_apertura, hora_cierre, dia_operativo_inicio, turnos_activos_max, turno_vencido_horas, semaforo_amarillo_min, semaforo_rojo_min, meta_espera_min, activo |
| DB | producto_id, venue_id, categoria_es/en, nombre_es/en, descripcion_es/en, imagen (opcional), etiquetas, stock_actual, stock_minimo, activo, orden |
| HUESPEDES | huesped_id, cuarto, edificio, piso, nombre_display, ocupado (datos fijos en la demo) |
| KIOSCO | pedido_id, numero, venue_id, request_id, huesped_id, cuarto, hora_creacion. Registro fijo |
| PEDIDO_ITEMS | pedido_id, producto_id, nombre_es, cantidad |
| KDS | pedido_id, numero, venue_id, hora_llegada, estatus, chef_id, hora_en_preparacion, hora_completo, hora_recibido, hora_cancelado, motivo_cancelacion |
| INVENTARIO | mov_id, venue_id, producto_id, tipo (inicial, relleno, consumo, devolucion, ajuste), cantidad, stock_resultante, hora, responsable |
| REABASTO | solicitud_id, venue_id, producto_id, cantidad, chef_id, hora_solicitud, estatus, atendido_por, hora_atencion |
| CHEFS | chef_id, nombre, activo |
| TURNOS | turno_id, venue_id, chef_id, hora_inicio, hora_fin, estado (activo, pausa, cerrado), minutos_pausa, motivo_cierre (manual, vencido), hora_pausa |
| LOG | timestamp, accion, rol, venue_id, codigo_error, detalle_interno |

- El estatus vive **solo en KDS**.
- Prioridad si hay que recortar: REABASTO y LOG se posponen primero.
- Número de pedido secuencial por venue y por día operativo. `pedido_id` = `<venue>-<yyyymmdd>-<nnn>`.
- El stock se descuenta al crear el pedido (INVENTARIO tipo `consumo`, responsable `pedido:<id>`) y se devuelve si se cancela (tipo `devolucion`, responsable `cancelacion:<id>`).
- Datos demo: 3 venues (zona `America/Cancun`), menú solo para Bites (13 productos), 40 cuartos en 2 edificios de 4 pisos con 5 cuartos por piso (50 % ocupados, apellidos ficticios) y 3 chefs.

### 4.2 Estatus y transiciones
Estatus: `pendiente`, `en_preparacion`, `completo`, `recibido`, y `cancelado` (interno).

| Acción | Transición | Regla |
|---|---|---|
| tomar | pendiente → en_preparacion | Asigna al chef, con lock |
| completar | en_preparacion → completo | El chef que lo tiene |
| recibir | completo → recibido | Cualquier chef con turno activo |
| cancelar | pendiente o en_preparacion → cancelado | Motivo de lista fija, devuelve stock. En preparación, solo el chef que lo tiene |
| liberar | en_preparacion → pendiente | Mismo chef |
| revertir | completo → en_preparacion | Mismo chef, dentro de 60 s |

Cualquier otra transición se rechaza con `E_CONFLICT`.

Reglas:
- Toda transición exige que el chef tenga un turno **activo**. En pausa o sin turno se rechaza (`sin_turno_activo`).
- **Motivos de cancelación:** Sin ingredientes, Pedido duplicado, Huésped canceló, Otro. Existe además `cierre_automatico`, solo interno.
- **Idempotencia:** si el pedido ya quedó como la transición lo pide (mismo chef, mismo estado resultante), el servidor responde `ok` con `repetido: true` y no escribe nada. Protege ante respuestas perdidas de Google. Cancelar con otro motivo sobre un pedido ya cancelado sí es conflicto.
- **Cierre automático de pedidos:** a las 12 h de `hora_llegada`, un pedido `pendiente` o `en_preparacion` pasa a `cancelado` con motivo `cierre_automatico` y se devuelve su stock. Un pedido `completo` pasa a `recibido` (sin devolver stock). Se ejecuta al consultar `cola` y en cada acción de turno o estatus. Los pedidos vencidos no aparecen en la cola ni en Estado.
- **Turnos:** máximo 2 por venue, contando los activos y los pausados. Un chef solo puede tener un turno abierto. Pausar o cerrar se bloquea si el chef tiene pedidos en preparación (`pedidos_en_preparacion`). Los minutos de pausa se acumulan en `minutos_pausa`. Un turno de más de 12 h se cierra solo (`vencido`) y libera sus pedidos en preparación a `pendiente`.

### 4.3 API por rol
Respuesta: `{ok:true,data}` o `{ok:false,code[,data]}`. Códigos: E_VALIDATION, E_AUTH, E_CONFLICT, E_STOCK, E_NOT_FOUND, E_RATE, E_INTERNAL.

| Rol | Acciones | Estado |
|---|---|---|
| sin rol | `ping` | Hecho (S2) |
| kiosco | `catalogo`, `validar_cuarto`, `crear_pedido` (con `request_id`) | Hecho (S2) |
| kds | `cola` | Hecho (S2) |
| kds | `iniciar_turno`, `pausar_turno`, `reanudar_turno`, `cerrar_turno`, `cambiar_estatus` | Hecho (S3a) |
| kds | `inventario`, `registrar_relleno`, `solicitar_reabasto` | Pendiente (S3b) |
| estado | `estado` | Hecho (S2) |
| dashboard (sesión por PIN) | `login_dashboard`, `venues`, `metricas`, `exportar_pedidos`, `atender_reabasto` | Pendiente (S3b) |

### 4.4 Seguridad (OWASP, Zero Trust)
- Token por rol y venue. Se guarda como hash SHA-256 con sal en Script Properties; el valor real se muestra una sola vez al generarlo y se entrega en la URL de contenido de ADMIRA, no en el repo. Es control por dispositivo, no autenticación de personas.
- Límite de frecuencia por rol y venue, por minuto (kiosco 60, kds 180, estado 90).
- `validar_cuarto`: 5 fallos bloquean 60 s (`E_RATE`). Cuarto inexistente y desocupado dan el mismo `E_NOT_FOUND`.
- El dashboard usa PIN con hash y sal, sesión de hasta 6 h y bloqueo de 5 min tras 5 intentos.
- El servidor solo recibe ids y cantidades y recalcula el resto. Lista blanca de acciones, validación de tipos y longitudes.
- Columnas de texto en formato `@` y neutralización de textos que empiecen con `=`, `+`, `-` o `@`, tanto al guardar como al exportar.
- Errores genéricos al cliente. Se registran en LOG solo `E_AUTH` y `E_INTERNAL`.
- Nombre y cuarto nunca salen hacia KDS, Estado ni dashboard. La lista completa de huéspedes nunca llega al kiosco.
- Producción: reemplazar por un backend real con JWT o cookies HttpOnly.

### 4.5 Concurrencia y rendimiento
- `LockService` en toda escritura (espera máxima 30 s). `request_id` idempotente en `crear_pedido`; `cambiar_estatus` idempotente por estado.
- Escritura en un solo bloque dentro del lock, con `flush` antes de soltarlo.
- Caché de servidor: 3 s en `catalogo`, `cola` y `estado` (se invalida al escribir), 30 s en `metricas`.
- Latido de chef en `CacheService` (90 s), no en el Sheet.
- Métricas agregadas en el servidor. Peticiones CORS normales en `text/plain`.
- Cliente: reintentos con espera creciente ante respuestas HTML (404 intermitente de Google) y tiempo máximo de 30 s por petición. Además, debe comprobar que la respuesta tenga la forma esperada para lo que pidió, porque Google puede entregar la respuesta de un GET (`ping`) en lugar de la real.

## 5. Kiosco
- **Flujo:** Bienvenida (ES/EN) → Identificación → Menú → Resumen → Confirmación.
- **Identificación:** el huésped escribe su cuarto y confirma el nombre mostrado. Cuarto inexistente y desocupado dan el mismo mensaje, con bloqueo de 60 s tras 5 fallos.
- **Pedidos:** sin tope de pedidos activos por cuarto (todo incluido). Límites por pedido: 10 por producto, 20 artículos y 15 líneas.
- **Sesión:** aviso a los 60 s de inactividad y reinicio 10 s después. La confirmación regresa sola a Bienvenida a los 15 s.
- **Catálogo:** refresco cada 30 s dentro del menú. Producto agotado durante la compra: se avisa y se ajusta (`E_STOCK` devuelve los productos afectados).
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
- **Cancelar:** modal propio con motivo de lista fija (Sin ingredientes, Pedido duplicado, Huésped canceló, Otro).
- **Turnos:** el chef elige su nombre entre los no activos. Máximo 2 por venue (activos y en pausa). Pausa y cierre bloqueados si tiene pedidos en preparación (debe completarlos o liberarlos). Turnos vencidos (12 h) se cierran solos.
- **Inventario:** panel ordenado por stock, con Relleno y Solicitar reabasto. Banner de alerta al llegar al mínimo, solo si hay chef con turno activo.
- **Resiliencia:** tiempos con hora del servidor, banner y acciones deshabilitadas tras 30 s sin conexión, aviso de conflicto si otro chef ya tomó el pedido. Reintento seguro ante respuestas perdidas (`repetido: true` se trata como éxito). Sonido de pedido nuevo, habilitado al iniciar turno.
- **Pedidos de días anteriores:** resuelto. Se cierran solos a las 12 h (ver 4.2).

## 7. Estado de pedido
- **Pantalla pública sin interacción,** bilingüe permanente (ES y EN a la vez). Solo número, estatus y hora.
- **Dos bloques** (En proceso y Listo). En horizontal, En proceso a la izquierda y Listo a la derecha. En vertical, Listo arriba.
  - Pendiente: tarjeta apagada, solo contorno, etiqueta "En cola / Queued".
  - En preparación: tarjeta iluminada, etiqueta "Preparando / Preparing".
  - Completo: pasa al bloque Listo, resaltado unos 8 s.
- El gris de la tarjeta apagada debe cumplir 4.5:1 de contraste.
- **Orden:** número ascendente en En proceso, más reciente primero en Listo. Máximo de números por bloque con contador "+N".
- **Alcance de datos:** solo muestra pedidos del día operativo actual y que no estén vencidos.
- **Cancelado:** no se muestra. Un número que sale de En proceso sin llegar a Listo se desvanece en 10 s.
- **Listo:** se oculta a los 10 min si nadie marca Recibido (solo en pantalla).
- **Sin sonido.** Consulta cada 5 s. Sin conexión: indicador a los 30 s y mensaje neutro a los 2 min. Recarga automática cada 6 h.
- **Por decidir:** línea fija al pie "Si tu número desaparece, consulta con el personal / If your number disappears, please ask our staff".

## 8. Dashboard
- **Usuario:** encargado, en navegador de escritorio. Selector de venue (con "Todos") y de periodo (Hoy, Ayer, 7 días, personalizado).
- **Paneles:** KPIs (totales, recibidos, cancelados, en curso, espera promedio del huésped y % dentro de meta de 10 min), en vivo, pedidos por hora, productos más pedidos, mezcla por categoría, chefs (completados, tiempo de preparación, horas de turno), inventario (stock contra mínimo y último relleno), reabasto, actividad reciente.
- **Solo lectura, salvo `atender_reabasto`.** Sin datos personales en pantalla ni en el CSV. Consulta cada 30 s. Estados de carga, vacío y error, con el último dato y su hora.
- **Stock inicial:** se carga en el Sheet, sin reinicio diario. Los rellenos se registran desde el KDS.

## 9. Parámetros (ajustables)
| Parámetro | Valor | Estado |
|---|---|---|
| Día operativo inicia | 04:00 en la zona de la sede | Propuesto |
| Semáforo KDS (amarillo, rojo) | 5 y 10 min | Propuesto |
| Turnos activos máximos | 2 (cuentan activos y en pausa) | Acordado |
| Tope de pedidos por cuarto | Ninguno (todo incluido). Protección: límite de frecuencia por dispositivo | Acordado |
| Límites por pedido | 10 por producto, 20 artículos, 15 líneas | Propuesto (implementado) |
| Horario de servicio | No se bloquean pedidos fuera de horario | Vigente en la demo |
| Meta de espera del huésped | 10 min | Acordado |
| Listo visible en Estado | 10 min | Acordado |
| Cancelado se desvanece | 10 s | Acordado |
| Ventana de "revertir" | 60 s | Acordado |
| Cierre automático de pedidos | 12 h desde la llegada | Acordado |
| Turno vencido | 12 h | Propuesto (implementado) |
| Motivos de cancelación | Sin ingredientes, Pedido duplicado, Huésped canceló, Otro | Acordado |
| Latido de chef | 90 s | Propuesto |
| Consulta: KDS y Estado, dashboard, catálogo kiosco | 5 s, 30 s, 30 s | Propuesto |
| Tiempo máximo por petición del cliente | 30 s | Propuesto |

Los parámetros por venue (turnos, semáforo, meta, turno vencido, día operativo) viven en la pestaña VENUES.

## 10. Cronograma
| Sesión | Entregable | Estado |
|---|---|---|
| S1 | Planeación y pruebas técnicas | Cerrada |
| S2 | Backend parte 1: esquema, datos demo, seguridad, API de kiosco, cola y estado | Cerrada |
| S3a | Backend parte 2a: turnos, cambio de estatus, cierre automático a 12 h, reinicio de demo | Cerrada |
| S3b | Backend parte 2b: inventario, relleno, reabasto, login y métricas del dashboard, exportar | Pendiente |
| S4–S5 | Kiosco | Pendiente |
| S6–S7 | KDS | Pendiente |
| S8 | Estado | Pendiente |
| S9 | Dashboard | Pendiente |
| S10 | Seguridad, QA, despliegue en ADMIRA y documentación | Pendiente |

## 11. Pruebas técnicas
**S1 (cerrada)**
1. POST `text/plain` desde GitHub Pages con respuesta legible: validado.
2. Despliegue con acceso "Cualquier persona" en la cuenta de ADMIRA: validado. Un despliegue limitado a la organización da "Failed to fetch".
3. `LockService` con peticiones simultáneas: serializa las escrituras.
4. Latencia: 0.5–1.5 s en lecturas, con 404 intermitente de Google bajo concurrencia (se resuelve con reintentos).
5. Latido en `CacheService`: adoptado.
- Anomalía: en una prueba con el cliente antiguo, dos respuestas `ok` llegaron sin `valor` (probablemente el mismo fenómeno del GET descrito en S3a).

**S2 (cerrada)**
- `ping`, autenticación incorrecta (`E_AUTH`), catálogo de 13 productos.
- `validar_cuarto`: cuarto ocupado, desocupado (`E_NOT_FOUND`) y bloqueo tras 5 fallos (`E_RATE`).
- `crear_pedido`: pedido nuevo, reenvío con el mismo `request_id` (`duplicado: true`, sin filas nuevas), 5 simultáneos con números consecutivos, cantidad 11 (`E_VALIDATION`), cuarto desocupado (`E_NOT_FOUND`) y sin existencias (`E_STOCK`).
- `cola` sin datos del huésped. `estado` solo con el día actual y con `listo` visible tras marcar un pedido completo.
- Latencias: lecturas de 1–4.6 s, escrituras de 2.6–8.5 s, y hasta 17.8 s con 5 simultáneas.

**S3a (cerrada)**
- Simulador: 28 comprobaciones del flujo completo y 12 de idempotencia.
- Cierre automático a 12 h en vivo: pedidos pendientes cancelados con `cierre_automatico`, `completo` pasado a `recibido`, turnos cerrados como `vencido` y devolución de stock con saldos correctos. `cola` ya no trae los pedidos vencidos.
- Turnos: dos abiertos y el tercero rechazado (`turnos_al_maximo`), `sin_turno_activo`, pausa y reanudar con `minutos_pausa`, `turno_no_pausado`, cierre manual (`manual`), `sin_turno_abierto`, y pausa y cierre bloqueados con pedido en preparación.
- Estatus: `tomar` y conflicto por estatus, `otro_chef`, `completar`, `revertir` dentro de 60 s y `fuera_de_ventana`, `liberar`, `recibir`, `cancelar` con devolución única de stock, y conflicto al cancelar con otro motivo.
- Validación y permisos: `motivo` y `transicion` inválidos (`E_VALIDATION`), rol sin permiso (`E_AUTH`, queda en LOG).
- Idempotencia: reintentos de `tomar` y `cancelar` devuelven `ok` con `repetido: true`.
- `estado`: un pedido pasa de `en_proceso` a `listo` y desaparece al marcarlo recibido.
- `reiniciarDemo()`: limpia los datos y restaura stock e inventario inicial.
- Anomalía: tres respuestas `ok` con el cuerpo de `ping` (de `doGet`) después de 404 de Google, sin cambios en los datos. Se atribuye a la entrega por GET de Google; por eso el cliente debe validar la forma de la respuesta.
- Latencias: escrituras de 3–5 s habituales, con picos de 15–25 s. El primer `cola` tras días sin uso, con cierre masivo, tardó 29 s.

## 12. Riesgos
- Política de Workspace que bloquee el acceso público al Apps Script (validado en S1, vigilar cambios).
- Cuotas de Apps Script según la edición de Workspace (sin confirmar).
- Latencia de escritura (unos 3 s, con picos de 15 a 25 s) y serialización: con varios kioscos a la vez puede notarse.
- Falla a mitad de una escritura de `crear_pedido` o de una cancelación puede dejar datos incompletos (poco probable, mitigado con idempotencia y orden de escritura).
- Google responde 404 intermitente en la redirección: el cliente debe reintentar siempre.
- Google puede entregar en su lugar la respuesta de un GET (`ping`), que parece un éxito: el cliente debe validar que la respuesta corresponda a lo pedido.
- LOG puede llenarse con llamadas de token inválido.
- Las lecturas se alargan al crecer las filas: habrá que archivar.
- Menú, logo y guía de marca reales aún pendientes.
- Token y PIN no sustituyen autenticación real (producción).
- Sheets como base limita volumen y concurrencia.
- Caché de GitHub Pages y del reproductor.
- Plan ajustado, sin colchón.

## 13. Definition of Done por sección
- Casos de prueba de la sección pasan.
- Inputs inválidos y errores manejados, con estados de carga, error y vacío.
- Ningún `innerHTML` con datos, contraste verificado, sin datos personales fuera de su rol.
- Explicación de cambios, commit en Conventional Commits y documentación actualizada al cierre.