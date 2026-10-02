# Documentación técnica: Kiosco Hyatt Breathless

Actualizada al cierre de S3a · 02/10/2026

## 1. Arquitectura
- **Front:** HTML, CSS y JS (módulos ES) en GitHub Pages. Sin build.
- **Backend:** Apps Script (V8) vinculado a un Google Sheet de la cuenta de ADMIRA. Web app ejecutada como el propietario, con acceso "Cualquier persona". La URL tiene la forma `https://script.google.com/macros/s/<id>/exec`. Una URL con `/a/macros/<dominio>/` limita el acceso a la organización y no sirve.
- **Base de datos:** las 11 pestañas del Sheet (ver `PLANEACION.md` sección 4.1).

## 2. Estructura del repo
```
backend/  ApiEstado.gs · ApiKds.gs · ApiKiosco.gs · config.gs · DatosDemo.gs
          Estatus.gs · Filas.gs · main.gs · pedidos.gs · seguridad.gs
          setup.gs · Turnos.gs · utilidades.gs
docs/     PLANEACION.md · TECNICA.md
spike/    probador.html   (herramienta de pruebas; se retira al cerrar S3)
kiosco/ kds/ estado/ dashboard/ shared/ assets/
```
Los `.gs` del repo deben ser idénticos a los del editor de Apps Script.

## 3. Archivos del backend
| Archivo | Contenido |
|---|---|
| config | Hojas, encabezados, columnas de texto y fecha, roles, límites, estatus, turnos, motivos de cancelación y constantes de cierre |
| utilidades | Errores, respuestas, lectura y escritura de hojas, validación, caché, lock y LOG |
| seguridad | Hash, tokens, validación, límite de frecuencia, `generarTokens` y `aplicarPin` |
| DatosDemo | Venues, menú de Bites, apellidos, chefs y generación de huéspedes |
| setup | `setup()` (crea o verifica pestañas, migra encabezados y siembra datos demo; idempotente) y `reiniciarDemo()` (solo desde el editor) |
| main | Lista blanca de acciones, autenticación, `doPost` y `doGet` |
| pedidos | Consultas de pedidos, items, chefs, búsqueda por `request_id` y número siguiente |
| Filas | Lectura y escritura de filas por posición, conversión fila-objeto, antigüedad de fechas |
| Turnos | `iniciar_turno`, `pausar_turno`, `reanudar_turno`, `cerrar_turno` y sus validaciones |
| Estatus | `cambiar_estatus`, transiciones, idempotencia, devolución de stock y cierre automático de pedidos y turnos |
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
| iniciar_turno | kds | `chef_id` | `{turno_id, chef_id, estado, hora_inicio}` |
| pausar_turno | kds | `chef_id` | `{turno_id, chef_id, estado}` |
| reanudar_turno | kds | `chef_id` | `{turno_id, chef_id, estado}` |
| cerrar_turno | kds | `chef_id` | `{turno_id, chef_id, estado}` |
| cambiar_estatus | kds | `pedido_id`, `transicion`, `chef_id`, `motivo` (solo `cancelar`) | `{pedido_id, estatus, chef_id, repetido}` |
| estado | estado | — | `en_proceso [{numero, estatus}]`, `listo [{numero, hora_completo}]`, `hora_servidor`, `listo_visible_min` |

`transicion`: `tomar`, `completar`, `recibir`, `cancelar`, `liberar`, `revertir`. `motivo`: `sin_ingredientes`, `pedido_duplicado`, `huesped_cancelo`, `otro`.

**Códigos de error**
| Código | Cuándo |
|---|---|
| E_VALIDATION | Datos inválidos (tipo, longitud, cantidad fuera de límite, `transicion` o `motivo` fuera de la lista) |
| E_AUTH | Token, rol o venue inválidos, o rol sin permiso para la acción |
| E_CONFLICT | Transición o estado en conflicto. `data.razon` indica el motivo (ver abajo) |
| E_STOCK | Producto sin existencias. `data.productos` lista los ids afectados |
| E_NOT_FOUND | Cuarto inexistente o desocupado (mismo mensaje en ambos casos), pedido o chef inexistente |
| E_RATE | Demasiadas peticiones o 5 cuartos fallidos (bloqueo de 60 s) |
| E_INTERNAL | Error del servidor (detalle solo en LOG) |

Razones de `E_CONFLICT` (`data.razon`): `estatus` (con `data.estatus`), `otro_chef`, `fuera_de_ventana`, `sin_turno_activo`, `chef_con_turno`, `turnos_al_maximo`, `pedidos_en_preparacion`, `turno_no_pausado`, `sin_turno_abierto`.

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

**Cambio de estatus (`cambiar_estatus`)**
- Toda transición se ejecuta bajo lock y exige turno activo del chef. Valida que el pedido exista y sea del venue.
- Reglas por transición en `PLANEACION.md` sección 4.2.
- Idempotencia: si el pedido ya está en el estado resultado de la transición (mismo chef; `recibir` cualquier chef; `cancelar` mismo motivo; `liberar` ya `pendiente`), responde `ok` con `repetido: true` sin escribir ni devolver stock.
- `cancelar` escribe primero la fila de KDS y después devuelve stock (INVENTARIO tipo `devolucion`, `mov_id` `MOV-DEV-<pedido>-<n>`, responsable `cancelacion:<pedido>`).

**Cierre automático**
- Pedidos con más de 12 h desde `hora_llegada`: `pendiente` y `en_preparacion` pasan a `cancelado` con motivo `cierre_automatico` y se devuelve su stock; `completo` pasa a `recibido`.
- Se ejecuta bajo lock al consultar `cola` y en cada acción de turno o estatus. Si falla al consultar `cola`, se registra en LOG como `E_INTERNAL` y la consulta continúa.

## 6. Seguridad
- Tokens por rol (`kiosco`, `kds`, `estado`) y venue, guardados como SHA-256 con sal en Script Properties (`TOK_<rol>_<venue>`).
- Límite por minuto por rol y venue: kiosco 60, kds 180, estado 90.
- Acciones solo desde una lista blanca, y cada acción declara los roles permitidos (el rol se comprueba antes que el token). Validación de tipos y longitudes. Mapas sin prototipo.
- Columnas de texto en formato `@` y neutralización de valores que empiecen con `=`, `+`, `-` o `@` en LOG.
- Errores genéricos al cliente.

## 7. Concurrencia y rendimiento
- `LockService` en toda escritura, espera máxima de 30 s, `flush` antes de liberar.
- Caché de 3 s en `catalogo`, `cola` y `estado`, invalidada al escribir. Latido de chef en `CacheService` (90 s).
- Mediciones: lecturas de 1–4.6 s, escrituras de 2.6–8.5 s, y hasta 17.8 s con 5 simultáneas (se turnan, unos 3 s cada una). El 02/10/2026 hubo picos de 15–25 s en lecturas y escrituras sueltas, y 29 s en el primer `cola` tras días sin uso (cierre masivo).
- **Reglas para el cliente:**
  - Tiempo máximo de 30 s por petición y reintento con espera creciente ante respuestas HTML (404 intermitente de Google).
  - Comprobar que `data` tenga la forma de lo que se pidió (por ejemplo `pedido_id` en `cambiar_estatus`). Google a veces entrega la respuesta de un GET en lugar de la real: es `{"ok":true,"data":{"hora_servidor":…}}` (el `ping` de `doGet`). Si no corresponde, se reintenta.
  - Los reintentos son seguros: `crear_pedido` por `request_id` y `cambiar_estatus` por idempotencia (`repetido: true` es éxito).

## 8. Operación
**Primera instalación**
1. Abrir el Apps Script del Sheet y pegar los `.gs` de `backend/`.
2. Ejecutar `setup()` (crea pestañas, formato y datos demo, y migra encabezados nuevos; se puede repetir sin duplicar).
3. Ejecutar `generarTokens()` y guardar en privado las líneas `rol | venue | token` del registro. Se muestran una sola vez.
4. Crear la propiedad `PIN_DASHBOARD` (6 dígitos) y ejecutar `aplicarPin()`. Guarda el hash y borra el PIN en texto.
5. Implementar como aplicación web: ejecutar como propietario, acceso "Cualquier persona".

**Publicar cambios del código**
Implementar → Administrar implementaciones → lápiz → Nueva versión. Así se conserva la misma URL.

**Reiniciar la demo**
Desde el editor, ejecutar `reiniciarDemo()`. Limpia KIOSCO, PEDIDO_ITEMS, KDS, TURNOS, REABASTO, INVENTARIO y DB y vuelve a sembrar datos demo con el stock inicial. No toca LOG ni los tokens. No es accesible por la API.

**Probar con `spike/probador.html`**
1. Pegar la URL `/exec`, elegir la acción (se llenan el rol y un JSON de ejemplo) y pegar el token del rol. Al cambiar de rol hay que cambiar también el token.
2. Con `"request_id": "auto"` se genera un id nuevo en cada envío. En `cambiar_estatus` usar el `pedido_id` del día.
3. Si aparece una página HTML, o una respuesta con solo `hora_servidor`, es el fallo intermitente de Google: volver a enviar. Las acciones con idempotencia no duplican efectos.
4. No recargar la página: se pierden los campos.

**Datos de prueba**
Los pedidos de prueba quedan en KIOSCO, KDS, PEDIDO_ITEMS e INVENTARIO, y descuentan stock en DB. Antes de la demo, ejecutar `reiniciarDemo()`.

## 9. Limitaciones conocidas
- Sheets limita el volumen y la concurrencia. Las lecturas se alargan al crecer las filas.
- Token y PIN no son autenticación de personas. En producción se reemplazan por un backend real con JWT o cookies HttpOnly.
- Una falla a mitad de una escritura de `crear_pedido` o de una cancelación puede dejar datos incompletos. La cancelación escribe KDS primero, para no devolver stock dos veces ante un reintento.
- `doGet` responde `ping` con `ok: true`. Como Google puede entregar esa respuesta en lugar de la de un POST, el cliente debe validar la forma de `data` (ver sección 7).
- Cuotas de Apps Script según la edición de Workspace, sin confirmar.

## 10. Pendiente (S3b)
- Decisión: cambiar `doGet` para que no responda `ok: true` y una respuesta de GET nunca se confunda con un éxito.
- Inventario, relleno y reabasto (`inventario`, `registrar_relleno`, `solicitar_reabasto`, `atender_reabasto`).
- Login del dashboard con PIN, `venues`, `metricas` y `exportar_pedidos`.
- Retirar `spike/probador.html` al cerrar S3.