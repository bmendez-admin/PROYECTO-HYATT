# Documentación técnica: Kiosco Hyatt Breathless

Actualizada al cierre de S2 · 01/10/2026

## 1. Arquitectura
- **Front:** HTML, CSS y JS (módulos ES) en GitHub Pages. Sin build.
- **Backend:** Apps Script (V8) vinculado a un Google Sheet de la cuenta de ADMIRA. Web app ejecutada como el propietario, con acceso "Cualquier persona". La URL tiene la forma `https://script.google.com/macros/s/<id>/exec`. Una URL con `/a/macros/<dominio>/` limita el acceso a la organización y no sirve.
- **Base de datos:** las 11 pestañas del Sheet (ver `PLANEACION.md` sección 4.1).

## 2. Estructura del repo
```
backend/  ApiEstado.gs · ApiKds.gs · ApiKiosco.gs · config.gs · DatosDemo.gs
          main.gs · pedidos.gs · seguridad.gs · setup.gs · utilidades.gs
docs/     PLANEACION.md · TECNICA.md
spike/    probador.html   (herramienta de pruebas; se retira al cerrar S3)
kiosco/ kds/ estado/ dashboard/ shared/ assets/
```
Los `.gs` del repo deben ser idénticos a los del editor de Apps Script.

## 3. Archivos del backend
| Archivo | Contenido |
|---|---|
| config | Hojas, encabezados, columnas de texto y fecha, roles, límites, estatus y constantes |
| utilidades | Errores, respuestas, lectura y escritura de hojas, validación, caché, lock y LOG |
| seguridad | Hash, tokens, validación, límite de frecuencia, `generarTokens` y `aplicarPin` |
| DatosDemo | Venues, menú de Bites, apellidos, chefs y generación de huéspedes |
| setup | `setup()`: crea o verifica pestañas, formato y datos demo (idempotente) |
| main | Lista blanca de acciones, autenticación, `doPost` y `doGet` |
| pedidos | Consultas de pedidos, items, chefs, búsqueda por `request_id` y número siguiente |
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
**Respuesta:** `{"ok":true,"data":{...}}` o `{"ok":false,"code":"E_...","data":{...}}`. Un `GET` solo responde `ping`.

| Acción | Rol | Entrada | Respuesta |
|---|---|---|---|
| ping | ninguno | — | Estado del servicio |
| catalogo | kiosco | — | Productos con `agotado`, `disponible_max` y etiquetas; datos del venue; límites; `hora_servidor` |
| validar_cuarto | kiosco | `cuarto` | Datos mínimos para confirmar identidad (id y nombre mostrado) |
| crear_pedido | kiosco | `request_id`, `huesped_id`, `items` | `{pedido_id, numero, duplicado}` |
| cola | kds | — | `pedidos` activos con items, chef y tiempos; `parametros` del semáforo y meta. Sin cuarto ni huésped |
| estado | estado | — | `en_proceso [{numero, estatus}]`, `listo [{numero, hora_completo}]`, `hora_servidor`, `listo_visible_min` |

**Códigos de error**
| Código | Cuándo |
|---|---|
| E_VALIDATION | Datos inválidos (tipo, longitud, cantidad fuera de límite) |
| E_AUTH | Token, rol o venue inválidos |
| E_CONFLICT | Transición o estado en conflicto |
| E_STOCK | Producto sin existencias. `data.productos` lista los ids afectados |
| E_NOT_FOUND | Cuarto inexistente o desocupado (mismo mensaje en ambos casos) |
| E_RATE | Demasiadas peticiones o 5 cuartos fallidos (bloqueo de 60 s) |
| E_INTERNAL | Error del servidor (detalle solo en LOG) |

Solo `E_AUTH` y `E_INTERNAL` se escriben en LOG.

## 5. Reglas de negocio implementadas
- Día operativo desde las 04:00 en la zona horaria de la sede. `pedido_id` = `<venue>-<yyyymmdd>-<nnn>`, y el número reinicia cada día operativo.
- Límites por pedido: 10 por producto, 20 artículos, 15 líneas. Sin tope de pedidos por cuarto.
- `crear_pedido` dentro del lock: revisa idempotencia por `request_id`, valida que el huésped esté ocupado, comprueba stock y escribe en este orden: PEDIDO_ITEMS, KDS (`pendiente`), INVENTARIO (`consumo`), DB (stock) y KIOSCO al final.
- Si algún producto no alcanza, responde `E_STOCK` y no escribe nada.
- Las horas viajan en UTC (ISO 8601). El cliente las convierte a hora local.
- `cola` incluye todos los pedidos activos, de cualquier día. `estado` solo los del día operativo actual.
- Un pedido aparece en `listo` si está `completo` y su `hora_completo` tiene menos de 10 min.

## 6. Seguridad
- Tokens por rol (`kiosco`, `kds`, `estado`) y venue, guardados como SHA-256 con sal en Script Properties (`TOK_<rol>_<venue>`).
- Límite por minuto por rol y venue: kiosco 60, kds 180, estado 90.
- Acciones solo desde una lista blanca. Validación de tipos y longitudes. Mapas sin prototipo.
- Columnas de texto en formato `@` y neutralización de valores que empiecen con `=`, `+`, `-` o `@` en LOG.
- Errores genéricos al cliente.

## 7. Concurrencia y rendimiento
- `LockService` en toda escritura, espera máxima de 30 s, `flush` antes de liberar.
- Caché de 3 s en `catalogo`, `cola` y `estado`, invalidada al crear un pedido. Latido de chef en `CacheService` (90 s).
- Mediciones: lecturas de 1–4.6 s, escrituras de 2.6–8.5 s, y hasta 17.8 s con 5 simultáneas (se turnan, unos 3 s cada una).
- El cliente debe reintentar con espera creciente ante respuestas HTML (404 intermitente de Google) y usar un tiempo máximo de 20 s por petición.

## 8. Operación
**Primera instalación**
1. Abrir el Apps Script del Sheet y pegar los `.gs` de `backend/`.
2. Ejecutar `setup()` (crea pestañas, formato y datos demo; se puede repetir sin duplicar).
3. Ejecutar `generarTokens()` y guardar en privado las líneas `rol | venue | token` del registro. Se muestran una sola vez.
4. Crear la propiedad `PIN_DASHBOARD` (6 dígitos) y ejecutar `aplicarPin()`. Guarda el hash y borra el PIN en texto.
5. Implementar como aplicación web: ejecutar como propietario, acceso "Cualquier persona".

**Publicar cambios del código**
Implementar → Administrar implementaciones → lápiz → Nueva versión. Así se conserva la misma URL.

**Probar con `spike/probador.html`**
1. Pegar la URL `/exec`, elegir la acción (se llenan el rol y un JSON de ejemplo) y pegar el token del rol.
2. Con `"request_id": "auto"` se genera un id nuevo en cada envío. Si aparece una página HTML, es el 404 intermitente: volver a enviar.
3. No recargar la página: se pierden los campos.

**Datos de prueba**
Los pedidos de prueba quedan en KIOSCO, KDS, PEDIDO_ITEMS e INVENTARIO, y descuentan stock en DB. Antes de la demo hay que limpiarlos y restaurar el stock (se contempla una función de reinicio en S3).

## 9. Limitaciones conocidas
- Sheets limita el volumen y la concurrencia. Las lecturas se alargan al crecer las filas.
- Token y PIN no son autenticación de personas. En producción se reemplazan por un backend real con JWT o cookies HttpOnly.
- Una falla a mitad de una escritura de `crear_pedido` puede dejar un pedido incompleto.
- La cola de cocina conserva pedidos de días anteriores hasta que se cierren.
- Cuotas de Apps Script según la edición de Workspace, sin confirmar.

## 10. Pendiente (S3)
- Turnos de chef y `cambiar_estatus` con sus transiciones.
- Inventario, relleno y reabasto.
- Login del dashboard con PIN, métricas y exportación.
- Cierre o vencimiento de pedidos de días anteriores.
- Función de reinicio de datos de prueba.