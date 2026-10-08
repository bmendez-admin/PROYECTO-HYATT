# Documentación técnica: Kiosco Hyatt Breathless

Actualizada al cierre de S5 · 08/10/2026

## 1. Arquitectura
- **Front:** HTML, CSS y JS (módulos ES) en GitHub Pages. Sin build.
- **Backend:** Apps Script (V8) vinculado a un Google Sheet de la cuenta de ADMIRA. Web app ejecutada como el propietario, con acceso "Cualquier persona". La URL tiene la forma `https://script.google.com/macros/s/<id>/exec`. Una URL con `/a/macros/<dominio>/` limita el acceso a la organización y no sirve.
- **Base de datos:** las 11 pestañas del Sheet (ver `PLANEACION.md` sección 4.1).

## 2. Estructura del repo
backend/ ApiEstado.gs · ApiKds.gs · ApiKiosco.gs · config.gs · DatosDemo.gs
Estatus.gs · Filas.gs · Inventario.gs · main.gs · pedidos.gs
seguridad.gs · setup.gs · Turnos.gs · utilidades.gs
docs/ PLANEACION.md · TECNICA.md
spike/ probador.html (herramienta de pruebas; se retira al cerrar S3c)
kiosco/ kds/ estado/ dashboard/ shared/ assets/

Los `.gs` del repo deben ser idénticos a los del editor de Apps Script.

## 3. Archivos del backend
| Archivo | Contenido |
|---|---|
| config | Hojas, encabezados, columnas de texto y fecha, roles, límites, estatus, turnos, estados de stock, estatus de reabasto, motivos de cancelación y constantes de tiempo (cierre a 12 h, ventana de revertir, ventana de repetición de `cerrar_turno`) |
| utilidades | Errores, respuestas, lectura y escritura de hojas, validación, caché (la invalidación incluye `inventario_<venue>`), lock y LOG |
| seguridad | Hash, tokens, validación, límite de frecuencia, `generarTokens` y `aplicarPin` |
| DatosDemo | Venues, menú de Bites, apellidos, chefs y generación de huéspedes |
| setup | `setup()` (crea o verifica pestañas, migra encabezados y siembra datos demo; idempotente) y `reiniciarDemo()` (solo desde el editor) |
| main | Lista blanca de acciones, autenticación, `doPost` y `doGet` (responde `E_METHOD`) |
| pedidos | Consultas de pedidos, items, chefs, búsqueda por `request_id` y número siguiente |
| Filas | Lectura y escritura de filas por posición, conversión fila-objeto, antigüedad de fechas |
| Turnos | `iniciar_turno`, `pausar_turno`, `reanudar_turno`, `cerrar_turno` (idempotentes) y sus validaciones |
| Estatus | `cambiar_estatus`, transiciones, idempotencia, devolución de stock y cierre automático de pedidos y turnos |
| Inventario | `inventario`, `registrar_relleno` y `solicitar_reabasto` |
| ApiKiosco | `catalogo`, `validar_cuarto`, `crear_pedido` |
| ApiKds | `cola` |
| ApiEstado | `estado` |

## 4. Contrato de la API
**Petición:** `POST` con `Content-Type: text/plain;charset=utf-8` y cuerpo JSON:
```json
{ "action": "crear_pedido", "rol": "kiosco", "venue_id": "bites", "token": "<token>",
  "request_id": "req...", "huesped_id": "H101",
  "items": [ { "producto_id": "bites-001", "cantidad": 2 } ] }
```
**Respuesta:** `{"ok":true,"data":{...}}` o `{"ok":false,"code":"E_...","data":{...}}`.

| Acción | Rol | Entrada | Respuesta |
|---|---|---|---|
| ping | ninguno | — | `{hora_servidor}` |
| catalogo | kiosco | — | Productos con `agotado`, `disponible_max` y etiquetas; datos del venue; límites; `hora_servidor` |
| validar_cuarto | kiosco | `cuarto` | Datos mínimos para confirmar identidad (id y nombre mostrado) |
| crear_pedido | kiosco | `request_id`, `huesped_id`, `items` | `{pedido_id, numero, duplicado}` |
| cola | kds | — | `{venue_id, hora_servidor, parametros{semaforo_amarillo_min, semaforo_rojo_min, meta_espera_min, turnos_activos_max}, chefs[{chef_id, nombre, turno: activo\|pausa\|ninguno}], pedidos[{pedido_id, numero, estatus, hora_llegada, hora_en_preparacion, hora_completo, chef_id, chef_nombre, items}]}`. Sin cuarto ni huésped |
| iniciar_turno | kds | `chef_id` | `{turno_id, chef_id, estado, hora_inicio, repetido}` |
| pausar_turno | kds | `chef_id` | `{turno_id, chef_id, estado, repetido}` |
| reanudar_turno | kds | `chef_id` | `{turno_id, chef_id, estado, repetido}` |
| cerrar_turno | kds | `chef_id` | `{turno_id, chef_id, estado, repetido}` |
| cambiar_estatus | kds | `pedido_id`, `transicion`, `chef_id`, `motivo` (solo `cancelar`) | `{pedido_id, estatus, chef_id, repetido}` |
| inventario | kds | — | `{venue_id, hora_servidor, productos[{producto_id, categoria_es, categoria_en, nombre_es, nombre_en, stock_actual, stock_minimo, estado: ok\|bajo\|agotado, ultimo_relleno (ISO o vacío), reabasto_pendiente}]}`, ordenados por stock ascendente y luego por `orden`. No exige turno |
| registrar_relleno | kds | `request_id`, `producto_id`, `cantidad` (entero 1–200), `chef_id` | `{mov_id, producto_id, cantidad, stock_actual, duplicado}` |
| solicitar_reabasto | kds | `request_id`, `producto_id`, `cantidad` (entero 1–200), `chef_id` | `{solicitud_id, producto_id, cantidad, estatus, duplicado}` |
| estado | estado, kiosco | — | `en_proceso [{numero, estatus}]`, `listo [{numero, hora_completo}]`, `hora_servidor`, `listo_visible_min` |

`transicion`: `tomar`, `completar`, `recibir`, `cancelar`, `liberar`, `revertir`. `motivo`: `sin_ingredientes`, `pedido_duplicado`, `huesped_cancelo`, `otro`.

**Códigos de error**
| Código | Cuándo |
|---|---|
| E_VALIDATION | Datos inválidos (tipo, longitud, cantidad fuera de límite, `transicion` o `motivo` fuera de la lista) |
| E_AUTH | Token, rol o venue inválidos, o rol sin permiso para la acción |
| E_CONFLICT | Transición o estado en conflicto. `data.razon` indica el motivo (ver abajo) |
| E_STOCK | Producto sin existencias. `data.productos` lista los ids afectados |
| E_NOT_FOUND | Cuarto inexistente o desocupado (mismo mensaje en ambos casos), pedido, chef o producto inexistente |
| E_RATE | Demasiadas peticiones o 5 cuartos fallidos (bloqueo de 60 s) |
| E_INTERNAL | Error del servidor (detalle solo en LOG) |
| E_METHOD | Petición GET al `/exec`. El servidor solo atiende POST. No se escribe en LOG. El cliente lo trata como señal de reintento |

Razones de `E_CONFLICT` (`data.razon`): `estatus` (con `data.estatus`), `otro_chef`, `fuera_de_ventana`, `sin_turno_activo`, `chef_con_turno`, `turnos_al_maximo`, `pedidos_en_preparacion`, `turno_no_pausado`, `sin_turno_abierto`, `solicitud_pendiente` (con `data.solicitud_id`).

Solo `E_AUTH` y `E_INTERNAL` se escriben en LOG.

## 5. Reglas de negocio implementadas
- Día operativo desde las 04:00 en la zona horaria de la sede. `pedido_id` = `<venue>-<yyyymmdd>-<nnn>`, y el número reinicia cada día operativo.
- Límites por pedido: 10 por producto, 20 artículos, 15 líneas. Sin tope de pedidos por cuarto.
- `crear_pedido` dentro del lock: revisa idempotencia por `request_id`, valida que el huésped esté ocupado, comprueba stock y escribe en este orden: PEDIDO_ITEMS, KDS (`pendiente`), INVENTARIO (`consumo`), DB (stock) y KIOSCO al final. Si algún producto no alcanza, responde `E_STOCK` y no escribe nada.
- Las horas viajan en UTC (ISO 8601). El cliente las convierte a hora local.
- `estado` muestra solo los pedidos del día operativo actual y no vencidos. Un pedido aparece en `listo` si está `completo` y su `hora_completo` tiene menos de 10 min.

**Turnos**
- Máximo `turnos_activos_max` (2) por venue, contando activos y en pausa. Un chef solo puede tener un turno abierto.
- `pausar_turno` y `cerrar_turno` se bloquean si el chef tiene pedidos en preparación.
- `minutos_pausa` acumula con 2 decimales. `hora_pausa` guarda el inicio de la pausa en curso.
- Un turno con más de `turno_vencido_horas` (12) se cierra solo con motivo `vencido`, y sus pedidos en preparación vuelven a `pendiente`.
- Idempotencia (responden `ok` con `repetido: true`, sin escribir): `iniciar_turno` con turno `activo` del chef en la misma sede; `pausar_turno` con el turno ya en `pausa`; `reanudar_turno` con el turno ya `activo`; `cerrar_turno` sin turno abierto cuando el último turno cerrado del chef en la sede tiene motivo `manual` y 5 minutos o menos (`TURNO_REPETIDO_SEG` = 300). Se siguen rechazando: `iniciar_turno` con turno en pausa o abierto en otra sede (`chef_con_turno`), `reanudar_turno` sin turno (`turno_no_pausado`), `cerrar_turno` sin cierre manual reciente (`sin_turno_abierto`, también tras un cierre por `vencido`) y el tope de turnos.

**Cambio de estatus (`cambiar_estatus`)**
- Toda transición se ejecuta bajo lock y exige turno activo del chef. Valida que el pedido exista y sea del venue.
- Reglas por transición en `PLANEACION.md` sección 4.2.
- Idempotencia: si el pedido ya está en el estado resultado de la transición (mismo chef; `recibir` cualquier chef; `cancelar` mismo motivo; `liberar` ya `pendiente`), responde `ok` con `repetido: true` sin escribir ni devolver stock.
- `cancelar` escribe primero la fila de KDS y después devuelve stock (INVENTARIO tipo `devolucion`, `mov_id` `MOV-DEV-<pedido>-<n>`, responsable `cancelacion:<pedido>`).

**Cierre automático**
- Pedidos con más de 12 h desde `hora_llegada`: `pendiente` y `en_preparacion` pasan a `cancelado` con motivo `cierre_automatico` y se devuelve su stock; `completo` pasa a `recibido`.
- Se ejecuta bajo lock al consultar `cola` y en cada acción de turno o estatus. Si falla al consultar `cola`, se registra en LOG como `E_INTERNAL` y la consulta continúa.

**Inventario y reabasto**
- `inventario` no exige turno. `estado` por producto: `agotado` con stock 0 o menos, `bajo` con stock menor o igual a `stock_minimo`, `ok` en otro caso. Solo productos activos de la sede. Caché de 3 s (`inventario_<venue>`), invalidada por pedidos, cancelaciones, rellenos y solicitudes.
- `registrar_relleno` exige turno activo del chef y una cantidad entera de 1 a 200. Dentro del lock revisa primero si existe el movimiento `MOV-REL-<request_id>` en INVENTARIO: si existe, responde `duplicado: true` con el stock actual, sin revisar el turno. Si no, escribe el movimiento (tipo `relleno`, responsable `chef:<chef_id>`, `stock_resultante`) y después el stock en DB, para que una falla a medias deje el stock corto y nunca de más.
- `solicitar_reabasto` exige turno activo del chef y una cantidad entera de 1 a 200. Revisa primero si existe `REA-<request_id>` (responde `duplicado: true`). Rechaza con `solicitud_pendiente` (y el `solicitud_id` abierto) si el producto ya tiene una solicitud con estatus `pendiente`. Escribe la fila en REABASTO con estatus `pendiente`. La atención (`atendido`) corresponde al dashboard (S3c).
- Producto inexistente, inactivo o de otra sede: `E_NOT_FOUND`.

## 6. Seguridad
- Tokens por rol (`kiosco`, `kds`, `estado`) y venue, guardados como SHA-256 con sal en Script Properties (`TOK_<rol>_<venue>`). No volver a ejecutar `generarTokens()` sin necesidad: rota todos los tokens.
- Límite por minuto por rol y venue: kiosco 60, kds 180, estado 90.
- Acciones solo desde una lista blanca, y cada acción declara los roles permitidos (el rol se comprueba antes que el token). Validación de tipos y longitudes. Mapas sin prototipo.
- `doGet` responde `E_METHOD`, nunca un éxito.
- Columnas de texto en formato `@` y neutralización de valores que empiecen con `=`, `+`, `-` o `@` en LOG.
- Errores genéricos al cliente.
- La acción `estado` está permitida para los roles `estado` y `kiosco` (lista blanca en `main.gs`). Solo expone número y estatus, sin datos del huésped.

## 7. Concurrencia y rendimiento
- `LockService` en toda escritura, espera máxima de 30 s, `flush` antes de liberar.
- Caché de 3 s en `catalogo`, `cola`, `estado` e `inventario`, invalidada al escribir. Latido de chef en `CacheService` (90 s).
- Mediciones: lecturas de 1–4.6 s, escrituras de 2.6–8.5 s, y hasta 17.8 s con 5 simultáneas (se turnan, unos 3 s cada una). El 02/10/2026 hubo picos de 15–25 s y 29 s en el primer `cola` tras días sin uso (cierre masivo). El 05/10/2026, desde el probador, de 4.4 a 20.1 s sin 404 y de 27.8 a 53.5 s con un reintento.
- **Reglas para el cliente:**
  - Hasta 3 reintentos con esperas de 1, 2 y 4 s ante respuestas que no sean JSON (404 intermitente de Google), `E_METHOD` o fallo de red, reenviando el mismo cuerpo y el mismo `request_id`. Tiempo máximo de 30 s por intento. Con un 404, una acción puede tardar cerca de un minuto: botones deshabilitados con estado de carga.
  - `llamar(accion, datos, {limiteTotalMs, alReintentar})` acota el tiempo total, reintentos incluidos: cada intento usa el menor entre 30 s y el tiempo restante, y no se reintenta si no alcanza. `crear_pedido` usa 60 s y la consulta de la pantalla de espera 12 s. `alReintentar(intento)` avisa de cada reintento.
  - Comprobar que `data` tenga la forma de lo que se pidió (por ejemplo `pedido_id` en `cambiar_estatus`).
  - `repetido: true` y `duplicado: true` son éxito.
  - Reintentar es seguro en todas las acciones: lecturas, `crear_pedido`, `cambiar_estatus`, turnos, relleno y reabasto son idempotentes. `validar_cuarto` también es seguro de reintentar, aunque cada fallo cuenta para el bloqueo de 5 cuartos.
- Frecuencia observada del 404 de Google el 05/10/2026: 3 de 7 envíos en la última tanda, todos recuperados por reintento. Las escrituras de la primera ejecución sí se aplican, por eso la idempotencia es obligatoria.

## 8. Operación
**Primera instalación**
1. Abrir el Apps Script del Sheet y pegar los `.gs` de `backend/`.
2. Ejecutar `setup()` (crea pestañas, formato y datos demo, y migra encabezados nuevos; se puede repetir sin duplicar).
3. Ejecutar `generarTokens()` y guardar en privado las líneas `rol | venue | token` del registro. Se muestran una sola vez.
4. Crear la propiedad `PIN_DASHBOARD` (6 dígitos) y ejecutar `aplicarPin()`. Guarda el hash y borra el PIN en texto.
5. Implementar como aplicación web: ejecutar como propietario, acceso "Cualquier persona".

**Publicar cambios del código**
Implementar → Administrar implementaciones → lápiz → Nueva versión. Así se conserva la misma URL. Para comprobar `doGet`, abrir la URL `/exec` en una pestaña: debe mostrar `{"ok":false,"code":"E_METHOD"}`.

**Reiniciar la demo**
Desde el editor, ejecutar `reiniciarDemo()`. Limpia KIOSCO, PEDIDO_ITEMS, KDS, TURNOS, REABASTO, INVENTARIO y DB y vuelve a sembrar datos demo con el stock inicial. No toca LOG ni los tokens. No es accesible por la API.

**Probar con `spike/probador.html`**
1. Pegar la URL `/exec`, elegir la acción (se llenan el rol y un JSON de ejemplo) y pegar el token del rol. Al cambiar de rol hay que cambiar también el token.
2. Con `"request_id": "auto"` se genera un id nuevo en cada envío. Para probar un reintento o una repetición, usar un valor fijo (por ejemplo `req-prueba-0001`). En `cambiar_estatus` usar el `pedido_id` del día.
3. El probador reintenta solo (3 veces, con esperas de 1, 2 y 4 s) si la respuesta no es JSON o es `E_METHOD`. Cada línea del registro muestra la duración y `reintentos: n`, y un contador resume envíos, envíos con reintento y reintentos totales. Si se agotan los reintentos, muestra una línea `ERROR` corta.
4. El cuadro de texto puede sobrescribir cualquier campo, incluida `action`. Al elegir otra acción en el desplegable, el cuadro vuelve a la plantilla de esa acción.
5. No recargar la página: se pierden los campos y el contador.

**Datos de prueba**
Los pedidos y movimientos de prueba quedan en KIOSCO, KDS, PEDIDO_ITEMS, INVENTARIO, REABASTO y TURNOS, y modifican el stock en DB. Antes de la demo, ejecutar `reiniciarDemo()`.

## 9. Limitaciones conocidas
- Sheets limita el volumen y la concurrencia. Las lecturas se alargan al crecer las filas (`inventario` lee toda la hoja INVENTARIO).
- Token y PIN no son autenticación de personas. En producción se reemplazan por un backend real con JWT o cookies HttpOnly.
- Una falla a mitad de una escritura de `crear_pedido`, de una cancelación o de un relleno puede dejar datos incompletos. La cancelación escribe KDS primero y el relleno escribe el movimiento primero, para no repetir el efecto ante un reintento.
- Google puede responder con un 404 intermitente en la redirección `script.googleusercontent.com/macros/echo`, después de que el script ya se ejecutó. No se puede suprimir desde el código: se mitiga con reintentos e idempotencia.
- `cerrar_turno` repetido solo se reconoce dentro de 5 minutos del cierre manual.
- Cuotas de Apps Script según la edición de Workspace, sin confirmar.

## 10. Pendiente
- **S3c (antes de S9):** login del dashboard con PIN (sesión de hasta 6 h, bloqueo de 5 min tras 5 intentos), `venues`, `metricas`, `exportar_pedidos` y `atender_reabasto`. Verificar antes que exista `PIN_HASH` en Propiedades del script.
- Retirar `spike/probador.html` al cerrar S3c.
- Probar en real `ping` aislado, y `pausar` y `reanudar` repetidos.
- Confirmar los parámetros propuestos de relleno y reabasto, y decidir la línea fija al pie de la pantalla de Estado.
- Comparar `ApiEstado.gs` del repo con la versión del editor.
- Optimizar `crear_pedido` (escritura por bloque): se observaron de 7 a 12 s con 13 unidades.
- Confirmar con el cliente la licencia web de la fuente Optima nova.

## Kiosco (frontend)

### Estructura
kiosco/ app.js · config.js · estado.js · navegacion.js · textos.js · index.html
componentes/ encabezado.js · teclado.js · tarjeta-producto.js · modal-producto.js
pantallas/ portada.js · identificacion.js · menu.js · orden.js · ticket.js · espera.js
servicios/ catalogo.js · carrito.js · pedido.js · pendientes.js · inactividad.js
estilos/ componentes.css · encabezado.css · portada.css · identificacion.css · teclado.css · menu.css · modal.css · orden.css · ticket.css · inactividad.css · espera.css

### Lienzo y reglas
- Lienzo fijo 1080×1920 escalado con `--escala`. Las pantallas con zonas tienen encabezado de 150 px, contenido y acciones de 300 px. Ticket y espera usan su propia distribución.
- Sin `innerHTML`: todo se construye con `shared/dom.js`. CSP por meta con `connect-src` solo a script.google.com y script.googleusercontent.com.
- Paleta oficial en `shared/tokens.css`: magenta #B0277F (acción), azul #0071CD, rojo #DF5757 (avisos y peligro), gris "Volver" #ACA39C, encabezado #F1F0EE, texto #2A2F43.
- Fuentes: Montserrat (texto) y Optima nova LT Demi Condensed (títulos, vía `--fuente-titulo`). Licencia web de Optima por confirmar con el cliente.
- Encabezado como componente (banda de 150 px con pestaña recortada por `clip-path`), con selector ESP/ENG y botón de volver opcional. El ticket usa el selector a la izquierda y el logo a la derecha, sin volver.
- Navegación (`navegacion.js`): `registrarPantalla`, `ir`, `irConFundido` (la pantalla anterior se desvanece encima de la nueva; sin animación con `prefers-reduced-motion`) y `pantallaActual`. Un cambio de idioma vuelve a pintar la pantalla actual.

### Sesión (`estado.js`)
`sesion` guarda `huesped`, `carrito` (`producto_id`, `cantidad`), `identificacion`, `pedido` (`request_id` y `firma`), `ticket` (`numero`) y `generacion`. `reiniciarSesion()` lo vacía todo, regresa el idioma a español y sube `generacion`, que invalida respuestas y temporizadores tardíos.

### Identificación
- `validar_cuarto` recibe `edificio` (1 a 3 caracteres alfanuméricos, mayúsculas en servidor) y `cuarto` (`^\d{3,4}$`). 5 fallos seguidos bloquean 60 s (E_RATE); no coincidencia, cuarto desocupado o inexistente devuelven el mismo E_NOT_FOUND.
- Fondo con foto (`assets/fondos/identificacion.jpg`) y respaldo blanco si falla. Campos de edificio y habitación centrados, teclado propio y confirmación del nombre en solo lectura.

### Catálogo y menú
- `servicios/catalogo.js`: caché en memoria con vigencia de 60 s y una sola petición en vuelo. Se precarga al tocar "Comenzar" y se refresca al entrar al menú si venció. `refrescarCatalogo()` fuerza una recarga (se usa tras `E_STOCK`).
- Esqueleto de carga (7 categorías y 6 tarjetas) y aviso de lentitud. Categorías derivadas de `categoria_es` en el orden del backend, con nombres por idioma.
- Fotos: campo `imagen` → `assets/productos/<imagen>.jpg` (`EXTENSION_PRODUCTO` en `kiosco/config.js`). Sin foto o con error, se muestra `platter.png` tenue.
- Aviso de producto agregado (azul) y avisos de límite o agotado (rojo). Los botones de producto agotado usan `aria-disabled` para poder avisar al tocarlos.

### Detalle del platillo
Modal con foto, nombre, descripción y botón Ordenar. Solo se cierra con su botón (tocar fuera no lo cierra). Con producto agotado, Ordenar avisa en rojo.

### Carrito y orden
- Carrito en `sesion.carrito`. Tope por producto: mínimo entre `disponible_max` y `limites.max_cantidad_producto`; tope total: `limites.max_articulos`; máximo de líneas: `MAX_LINEAS_PEDIDO` (15) en `kiosco/config.js`. Hoy 10, 20 y 15.
- `servicios/carrito.js`: `agregarAlCarrito`, `fijarCantidad`, `quitarLinea`, `cantidadDe`, `unidadesTotales`. Resultados: `ok`, `agotado`, `max_producto`, `max_total`, `max_lineas`, `eliminado`.
- Orden: cantidad editable con teclado numérico (2 dígitos; 0 elimina), quitar línea, lista con desplazamiento y mensaje de orden vacía.

### Envío del pedido
- `servicios/pedido.js`: `crear_pedido` con `request_id` ligado a huésped y carrito (`firma`). Si cualquiera cambia, se genera un `request_id` nuevo; si no, los reintentos reutilizan el mismo. Límite total de 60 s (`LIMITE_PEDIDO_MS`).
- La pantalla de orden muestra "Enviando…", bloquea la interfaz y, a los 15 s (`ESPERA_TRANQUILIZAR_MS`), un aviso de que el pedido sigue en proceso.
- Errores: red o tiempo agotado (mensaje con reintento), `E_STOCK` y `E_NOT_FOUND` (recarga el catálogo, quita o reduce líneas y avisa con los nombres; si no hay producto afectado, la habitación no se validó y Continuar se bloquea), `E_RATE` (esperar) y otros (mensaje general). `duplicado: true` es éxito.
- Éxito: vacía carrito y `sesion.pedido`, guarda `sesion.ticket` y abre el ticket.

### Ticket
Muestra el número del pedido. "Finalizar pedido" reinicia la sesión y vuelve a la portada. Sin toques, regresa solo a los 15 s (`RETORNO_TICKET_MS`).

### Inactividad
- `servicios/inactividad.js` revisa cada segundo contra la última interacción (toque o tecla) y reinicia el conteo al cambiar de pantalla.
- Portada: a los 30 s (`ESPERA_PORTADA_MS`) pasa a la pantalla de espera con fundido. Identificación, menú y orden: a los 2 minutos (`INACTIVIDAD_MS`) abre el aviso "¿Sigues ahí?" con cuenta regresiva de 10 s (`AVISO_INACTIVIDAD_S`). Solo "Seguir aquí" lo cierra; al llegar a 0 se reinicia la sesión y se vuelve a la portada. Ticket y espera no tienen conteo.
- `fijarPausaInactividad(true)` detiene el conteo mientras se envía un pedido.

### Pantalla de espera
- `servicios/pendientes.js` llama a `estado` con el rol `kiosco` (12 s de límite) y devuelve los números de `en_proceso` con una marca de "preparando" (`estatus` = `en_preparacion`).
- Se consulta cada 10 s (`ESPERA_REFRESCO_MS`) solo mientras la pantalla está visible y se repinta únicamente si la lista cambió. Una lista unida en dos columnas, con totales, tarjetas magenta (en preparación) y translúcidas (pendiente de preparar), todo bilingüe. El desplazamiento automático (45 px/s, pausa de 3 s) se activa solo si la lista no cabe. Sin pedidos muestra un mensaje. Sin conexión desde el inicio muestra solo el logo y la invitación. Un toque regresa a la portada.
- Fondo con la foto de la portada y un velo oscuro; si falla la foto, queda un fondo oscuro liso.

### Iconos
Iconos de diseño en PNG: `assets/iconos/{agregar,avanzar,edificio,eliminar,habitacion,persona,platter,retroceder}.png`. El chevron y la "X" de la orden se dibujan con CSS; `avanzar.png` no se usa.

## Pruebas
- Chromium con Playwright contra un backend simulado (`mock.js`); 65 comprobaciones en 4 suites (identificación y menú).
- Pruebas manuales en Chrome contra el backend real el 08/10/2026 para el modal, la orden, el envío con ticket, el aviso de proceso a los 15 s y la pantalla de espera. Pedidos de prueba: ejecutar `reiniciarDemo()` antes de la demo.