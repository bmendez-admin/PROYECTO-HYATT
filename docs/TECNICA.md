# Documentación técnica: Kiosco Hyatt Breathless

Actualizada al cierre de la sesión del 20/10/2026 (migración del backend a Supabase)

## 1. Arquitectura
- **Front:** HTML, CSS y JS (módulos ES) en GitHub Pages. Sin build.
- **Backend (desde el 20/10/2026):** Supabase, proyecto `hyatt-breathless-demo`, región West US (Oregon), plan Free. Una Edge Function `api` (Deno, "Verify JWT" desactivado) en `https://<ref>.supabase.co/functions/v1/api` (`<ref>` = `hvglvkpxdfotxbkbdoaf`) que valida la entrada, autentica y llama a funciones SQL; una función SQL por acción, con el mismo contrato JSON que tenía Apps Script.
- **Base de datos:** Postgres de Supabase, 13 tablas (ver sección 3 y `PLANEACION.md` sección 4.6).
- **Respaldo:** el Apps Script vinculado a un Google Sheet de la cuenta de ADMIRA sigue desplegado y sin cambios (web app ejecutada como el propietario, con acceso "Cualquier persona", URL `https://script.google.com/macros/s/<id>/exec`; una URL con `/a/macros/<dominio>/` limita el acceso a la organización y no sirve). Para volver a él se cambia `API_URL` en `shared/config.js`.

## 2. Estructura del repo
supabase/ sql/ 01_esquema.sql · 02_semilla.sql · 03_etapa1.sql · 04_etapa2.sql
05_reiniciar_demo.sql · 06_etapa3a.sql · 07_etapa3b.sql · 08_etapa3c.sql
functions/api/ index.ts
backend/ (respaldo en Apps Script) ApiEstado.gs · ApiKds.gs · ApiKiosco.gs · config.gs · DatosDemo.gs
Estatus.gs · Filas.gs · Inventario.gs · main.gs · pedidos.gs
seguridad.gs · setup.gs · Turnos.gs · utilidades.gs
docs/ PLANEACION.md · TECNICA.md
spike/ probador.html (herramienta de pruebas; se retira al cerrar S3c)
kiosco/ kds/ estado/ dashboard/ shared/ assets/

Los archivos de `supabase/` deben ser idénticos a lo que está pegado en el panel de Supabase (SQL Editor y editor de la Edge Function). Los `.gs` del repo deben ser idénticos a los del editor de Apps Script.

## 3. Archivos del backend en Supabase
Los archivos SQL se ejecutan en orden en el SQL Editor. `01_esquema.sql` y `02_semilla.sql` se ejecutan una sola vez (crean las tablas y siembran los datos; repetirlos falla). Del `03` al `08` se pueden volver a ejecutar sin riesgo: reemplazan las funciones con `create or replace` y `06` recrea su índice.

| Archivo | Contenido |
|---|---|
| `01_esquema.sql` | Extensión `pgcrypto`, las 13 tablas (`venues`, `productos`, `huespedes`, `chefs`, `pedidos`, `pedido_items`, `contadores_pedido`, `inventario_mov`, `reabasto`, `turnos`, `log`, `tokens`, `limites`), índices, RLS, revocación de permisos a `anon` y `authenticated`, y `generar_tokens()` |
| `02_semilla.sql` | 3 venues, 25 productos de Bites, 40 huéspedes, 6 chefs (con hash bcrypt) y el movimiento `inicial` de cada producto |
| `03_etapa1.sql` | `api_iso`, `api_log`, `api_autenticar`, `api_catalogo`, `api_validar_cuarto`, `api_estado` |
| `04_etapa2.sql` | `api_dia_operativo`, `api_crear_pedido` |
| `05_reiniciar_demo.sql` | `reiniciar_demo()` |
| `06_etapa3a.sql` | Índice único de un turno abierto por chef, `api_conflicto`, `api_minutos_pausa`, `api_devolver_stock`, `api_cerrar_vencidos`, `api_verificar_codigo`, `api_cola`, `api_iniciar_turno`, `api_pausar_turno`, `api_reanudar_turno`, `api_cerrar_turno` |
| `07_etapa3b.sql` | `api_conflicto_estatus`, `api_cambiar_estatus` |
| `08_etapa3c.sql` | `api_inventario`, `api_registrar_relleno`, `api_solicitar_reabasto` |
| `functions/api/index.ts` | Edge Function: lista blanca de acciones con sus roles, validación de entrada, autenticación y límite de frecuencia, registro de `E_AUTH` y `E_INTERNAL`, CORS y manejo de OPTIONS y de métodos distintos de POST |

Todas las funciones SQL son `security definer`, con `search_path` fijo, y solo `service_role` tiene `execute`. Las tablas tienen RLS activo sin políticas.

### Respaldo en Apps Script

| Archivo | Contenido |
|---|---|
| config | Hojas, encabezados, columnas de texto y fecha, roles, límites, estatus, turnos, estados de stock, estatus de reabasto, motivos de cancelación y constantes de tiempo (cierre a 12 h, ventana de revertir, ventana de repetición de `cerrar_turno`) |
| utilidades | Errores, respuestas, lectura y escritura de hojas, validación, caché (la invalidación incluye `inventario_<venue>`), lock y LOG |
| seguridad | Hash, tokens, validación, límite de frecuencia, `generarTokens` y `aplicarPin` |
| DatosDemo | Venues, menú de Bites, apellidos, chefs y generación de huéspedes |
| setup | `setup()` (crea o verifica pestañas, migra encabezados y siembra datos demo; idempotente) `reiniciarDemo()` y `reiniciarChefs()` (solo desde el editor) |
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
**Petición:** `POST` con `Content-Type: text/plain;charset=utf-8` y cuerpo JSON a la URL de la Edge Function (o al `/exec` del respaldo). El contrato es el mismo en ambos backends; en Supabase la respuesta HTTP es siempre 200 y el cuerpo no puede superar 20 000 caracteres (`E_VALIDATION`):
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
| cola | kds | — | `{venue_id, hora_servidor, parametros{semaforo_amarillo_min, semaforo_rojo_min, meta_espera_min, turnos_activos_max}, chefs[{chef_id, nombre, avatar: h\|m, turno: activo\|pausa\|ninguno, pausa_tipo: corto\|comida\|vacío, pausa_desde (ISO o vacío)}], pedidos[{pedido_id, numero, estatus, hora_llegada, hora_en_preparacion, hora_completo, chef_id, chef_nombre, items[{producto_id, nombre_es, cantidad, imagen}]}]}`. `imagen` vacía si el producto no tiene foto. Sin cuarto ni huésped |
| iniciar_turno | kds | `chef_id`, `codigo` (6 dígitos). Código ausente o mal formado: `E_VALIDATION`; incorrecto: `E_NOT_FOUND`; 5 fallos del mismo chef: `E_RATE` por 60 s | `{turno_id, chef_id, estado, hora_inicio, repetido}` |
| pausar_turno | kds | `chef_id`, `tipo` opcional (`corto` por defecto, o `comida`; otro valor: `E_VALIDATION`) | `{turno_id, chef_id, estado, repetido, tipo}` |
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
| E_METHOD | Petición que no es POST (en Supabase, `OPTIONS` se responde con 204 para CORS; en Apps Script, un GET al `/exec`). No se escribe en LOG. El cliente lo trata como señal de reintento |

Razones de `E_CONFLICT` (`data.razon`): `estatus` (con `data.estatus`), `otro_chef`, `fuera_de_ventana`, `sin_turno_activo`, `chef_con_turno`, `turnos_al_maximo`, `pedidos_en_preparacion`, `turno_no_pausado`, `sin_turno_abierto`, `solicitud_pendiente` (con `data.solicitud_id`).

Solo `E_AUTH` y `E_INTERNAL` se escriben en LOG.

## 5. Reglas de negocio implementadas
- Día operativo desde las 04:00 en la zona horaria de la sede. `pedido_id` = `<venue>-<yyyymmdd>-<nnn>`, y el número reinicia cada día operativo.
- Límites por pedido: 10 por producto, 20 artículos, 15 líneas. Sin tope de pedidos por cuarto.
- `crear_pedido` revisa idempotencia por `request_id`, valida que el huésped esté ocupado, comprueba stock y escribe todo en una sola transacción: pedido (`pendiente`), items, movimientos `consumo` (`MOV-<pedido>-<n>`) y stock. Si algún producto no alcanza, responde `E_STOCK` con los ids afectados y no escribe nada. (En el respaldo de Apps Script se escribe por bloques, en este orden: PEDIDO_ITEMS, KDS, INVENTARIO, DB y KIOSCO al final.)
- Las horas viajan en UTC (ISO 8601). El cliente las convierte a hora local.
- `estado` muestra solo los pedidos del día operativo actual y no vencidos. Un pedido aparece en `listo` si está `completo` y su `hora_completo` tiene menos de 10 min.

**Turnos**
- Máximo `turnos_activos_max` (2) por venue, contando activos y en pausa. Un chef solo puede tener un turno abierto en toda la base: en Supabase lo garantiza un índice único (`turnos_chef_abierto_idx`).
- `pausar_turno` y `cerrar_turno` se bloquean si el chef tiene pedidos en preparación.
- `minutos_pausa` acumula con 2 decimales. `hora_pausa` guarda el inicio de la pausa en curso.
- Un turno con más de `turno_vencido_horas` (12) se cierra solo con motivo `vencido`, y sus pedidos en preparación vuelven a `pendiente`.
- Idempotencia (responden `ok` con `repetido: true`, sin escribir): `iniciar_turno` con turno `activo` del chef en la misma sede; `pausar_turno` con el turno ya en `pausa`; `reanudar_turno` con el turno ya `activo`; `cerrar_turno` sin turno abierto cuando el último turno cerrado del chef en la sede tiene motivo `manual` y 5 minutos o menos (`TURNO_REPETIDO_SEG` = 300). Se siguen rechazando: `iniciar_turno` con turno en pausa o abierto en otra sede (`chef_con_turno`), `reanudar_turno` sin turno (`turno_no_pausado`), `cerrar_turno` sin cierre manual reciente (`sin_turno_abierto`, también tras un cierre por `vencido`) y el tope de turnos.

**Cambio de estatus (`cambiar_estatus`)**
- Toda transición se ejecuta bajo lock y exige turno activo del chef. Valida que el pedido exista y sea del venue.
- Reglas por transición en `PLANEACION.md` sección 4.2.
- Idempotencia: si el pedido ya está en el estado resultado de la transición (mismo chef; `recibir` cualquier chef; `cancelar` mismo motivo; `liberar` ya `pendiente`), responde `ok` con `repetido: true` sin escribir ni devolver stock.
- `cancelar` cambia el pedido y devuelve el stock en la misma transacción (movimiento `devolucion`, `mov_id` `MOV-DEV-<pedido>-<línea>`, responsable `cancelacion:<pedido>`). Un cancelar repetido con el mismo motivo no vuelve a sumar.

**Cierre automático**
- Pedidos con más de 12 h desde `hora_llegada`: `pendiente` y `en_preparacion` pasan a `cancelado` con motivo `cierre_automatico` y se devuelve su stock; `completo` pasa a `recibido`.
- Se ejecuta con el venue bloqueado, en cada acción de turno, estatus, relleno o reabasto y, al consultar `cola`, solo si hay algo vencido. Un turno vencido cierra con `vencido` y libera sus pedidos en preparación a `pendiente`.

**Inventario y reabasto**
- `inventario` no exige turno. `estado` por producto: `agotado` con stock 0 o menos, `bajo` con stock menor o igual a `stock_minimo`, `ok` en otro caso. Solo productos activos de la sede. En Supabase no hay caché de servidor (en Apps Script, 3 s).
- `registrar_relleno` exige turno activo del chef y una cantidad entera de 1 a 200. Con el venue bloqueado revisa primero si existe el movimiento `MOV-REL-<request_id>` en INVENTARIO: si existe, responde `duplicado: true` con el stock actual, sin revisar el turno. Si no, escribe en una transacción el movimiento (tipo `relleno`, responsable `chef:<chef_id>`, `stock_resultante`) y el stock. (En Apps Script se escribe primero el movimiento y después el stock, para que una falla a medias deje el stock corto y nunca de más.)
- `solicitar_reabasto` exige turno activo del chef y una cantidad entera de 1 a 200. Revisa primero si existe `REA-<request_id>` (responde `duplicado: true`). Rechaza con `solicitud_pendiente` (y el `solicitud_id` abierto) si el producto ya tiene una solicitud con estatus `pendiente`. Inserta la solicitud en `reabasto` con estatus `pendiente`. La atención (`atendido`) corresponde al dashboard (S3c). Sin pantalla en el KDS por ahora: se probó con llamadas directas a la API.
- Producto inexistente, inactivo o de otra sede: `E_NOT_FOUND`.

## 6. Seguridad
- Tokens por rol (`kiosco`, `kds`, `estado`) y venue, guardados en la tabla `tokens` como SHA-256 de sal más token. `generar_tokens()` rota los 9 tokens y los devuelve una sola vez (guardarlos en privado y armar las URLs de ADMIRA). En el respaldo, `generarTokens()` hace lo mismo con Script Properties.
- Límite por minuto por rol y venue: kiosco 60, kds 180, estado 90 (tabla `limites` en Supabase).
- Códigos de chef con hash bcrypt (`pgcrypto`). Bloqueo de 60 s tras 5 fallos por venue y chef; el código incorrecto responde `E_NOT_FOUND` y el bloqueado `E_RATE`.
- RLS activo en todas las tablas sin políticas, sin permisos para `anon` ni `authenticated`. Solo la Edge Function (llave de servicio en sus variables de entorno) llega a la base.
- CORS abierto (`Access-Control-Allow-Origin: *`): decisión de demo. Para una implementación real, limitarlo al dominio definitivo.
- Acciones solo desde una lista blanca, y cada acción declara los roles permitidos (el rol se comprueba antes que el token). Validación de tipos y longitudes. Mapas sin prototipo.
- `doGet` responde `E_METHOD`, nunca un éxito.
- Columnas de texto en formato `@` y neutralización de valores que empiecen con `=`, `+`, `-` o `@` en LOG.
- Errores genéricos al cliente.
- La acción `estado` está permitida para los roles `estado` y `kiosco` (lista blanca en `main.gs`). Solo expone número y estatus, sin datos del huésped.

## 7. Concurrencia y rendimiento
- Supabase: bloqueo de fila del venue (`for update` sobre `venues`) en toda escritura y una transacción por acción. Sin caché de servidor. Los errores de negocio se devuelven como respuesta normal (sin `RAISE`) para no revertir los contadores de límite.
- Mediciones en Supabase (20/10/2026): catálogo 1.02 s en la primera carga, `validar_cuarto` 0.54 s, `estado` de 0.45 a 0.99 s, `crear_pedido` unos 1.3 s y llamadas de la cocina de 0.38 a 0.57 s.
- Respaldo en Apps Script: `LockService` en toda escritura (espera máxima de 30 s, `flush` antes de liberar), caché de 3 s en `catalogo`, `cola`, `estado` e `inventario`, y latido de chef en `CacheService` (90 s).
- Mediciones en Apps Script (histórico): lecturas de 1–4.6 s, escrituras de 2.6–8.5 s, y hasta 17.8 s con 5 simultáneas (se turnan, unos 3 s cada una). El 02/10/2026 hubo picos de 15–25 s y 29 s en el primer `cola` tras días sin uso (cierre masivo). El 05/10/2026, desde el probador, de 4.4 a 20.1 s sin 404 y de 27.8 a 53.5 s con un reintento.
- **Reglas para el cliente:**
  - Hasta 3 reintentos con esperas de 1, 2 y 4 s ante respuestas que no sean JSON (404 intermitente de Google), `E_METHOD` o fallo de red, reenviando el mismo cuerpo y el mismo `request_id`. Tiempo máximo de 30 s por intento. Con un 404, una acción puede tardar cerca de un minuto: botones deshabilitados con estado de carga.
  - `llamar(accion, datos, {limiteTotalMs, alReintentar})` acota el tiempo total, reintentos incluidos: cada intento usa el menor entre 30 s y el tiempo restante, y no se reintenta si no alcanza. `crear_pedido` usa 60 s y la consulta de la pantalla de espera 12 s. `alReintentar(intento)` avisa de cada reintento.
  - Comprobar que `data` tenga la forma de lo que se pidió (por ejemplo `pedido_id` en `cambiar_estatus`).
  - `repetido: true` y `duplicado: true` son éxito.
  - Reintentar es seguro en todas las acciones: lecturas, `crear_pedido`, `cambiar_estatus`, turnos, relleno y reabasto son idempotentes. `validar_cuarto` también es seguro de reintentar, aunque cada fallo cuenta para el bloqueo de 5 cuartos.
- Frecuencia observada del 404 de Google el 05/10/2026: 3 de 7 envíos en la última tanda, todos recuperados por reintento. Las escrituras de la primera ejecución sí se aplican, por eso la idempotencia es obligatoria.

## 8. Operación (Supabase)
**Primera instalación**
1. Crear el proyecto en Supabase (West US) y, en el SQL Editor, ejecutar en orden `01_esquema.sql` a `08_etapa3c.sql` (cada archivo en una pestaña nueva con **+**).
2. Ejecutar `select * from generar_tokens();` y guardar en privado las 9 filas `rol | venue | token`. Se muestran una sola vez y cada ejecución reemplaza las anteriores.
3. En Edge Functions crear la función `api`, pegar `functions/api/index.ts`, desactivar "Verify JWT" y desplegar.
4. Poner la URL `https://<ref>.supabase.co/functions/v1/api` en `shared/config.js` y agregar `https://<ref>.supabase.co` al `connect-src` de la CSP de `kiosco/index.html`, `kds/index.html` y `estado/index.html`.
5. Armar las URLs de contenido de ADMIRA con `?venue=bites&token=<token>`. Los tokens solo van en la URL, nunca en un archivo.

**Publicar cambios del código**
- SQL: pegar el archivo en el SQL Editor y ejecutar (las funciones se reemplazan con `create or replace`).
- Edge Function: reemplazar el código completo en el editor y pulsar **Deploy updates**, sin tocar "Verify JWT".
- Frontend: commit y push a `main`. GitHub Pages guarda los archivos hasta 10 minutos: para ver el cambio de inmediato, recarga forzada (Ctrl + Shift + R) o una URL con `?x=1`. Antes de cada push, `git grep` con los primeros caracteres de cada token: no debe haber resultados.

**Reiniciar la demo**
`select reiniciar_demo();` en el SQL Editor. Borra pedidos, items, contadores, reabasto, turnos y límites, elimina los movimientos que no son `inicial` y restaura el stock. No toca tokens, chefs ni LOG.

**Regenerar tokens**
`select * from generar_tokens();` rota los 9 tokens. Las URLs anteriores dejan de funcionar: actualizar las de ADMIRA. Hacerlo antes de un uso real o de mostrar el sistema fuera de ADMIRA.

**Probar inventario, relleno y reabasto (sin pantalla)**
Abrir la pantalla de cocina con su URL, entrar con un chef (turno activo) y, en la consola del navegador (F12), usar el token que ya viene en la URL de la página:
```js
const t = new URLSearchParams(location.search).get('token');
const url = 'https://<ref>.supabase.co/functions/v1/api';
const llamar = async (o) => (await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ rol: 'kds', venue_id: 'bites', token: t, ...o }) })).json();
await llamar({ action: 'inventario' });
await llamar({ action: 'registrar_relleno', request_id: 'relleno-prueba-0001', producto_id: 'bites-004', cantidad: 5, chef_id: 'chef-01' });
await llamar({ action: 'solicitar_reabasto', request_id: 'reabasto-prueba-0001', producto_id: 'bites-004', cantidad: 50, chef_id: 'chef-01' });
```
Al terminar, `select reiniciar_demo();`.

**Probar con `spike/probador.html`**
Sigue sirviendo con la URL de la Edge Function. Pegar la URL, elegir la acción (se llenan el rol y un JSON de ejemplo) y pegar el token del rol. Con `"request_id": "auto"` se genera un id nuevo en cada envío; para probar un reintento usar un valor fijo.

## 8b. Operación del respaldo (Apps Script)
**Primera instalación**
1. Abrir el Apps Script del Sheet y pegar los `.gs` de `backend/`.
2. Ejecutar `setup()` (crea pestañas, formato y datos demo, y migra encabezados nuevos; se puede repetir sin duplicar).
3. Ejecutar `generarTokens()` y guardar en privado las líneas `rol | venue | token` del registro. Se muestran una sola vez.
4. Crear la propiedad `PIN_DASHBOARD` (6 dígitos) y ejecutar `aplicarPin()`. Guarda el hash y borra el PIN en texto.
5. Implementar como aplicación web: ejecutar como propietario, acceso "Cualquier persona".

**Publicar cambios del código**
Implementar → Administrar implementaciones → lápiz → Nueva versión. Así se conserva la misma URL. Para comprobar `doGet`, abrir la URL `/exec` en una pestaña: debe mostrar `{"ok":false,"code":"E_METHOD"}`.

**Reiniciar la demo**
Desde el editor, ejecutar `reiniciarDemo()`. Limpia KIOSCO, PEDIDO_ITEMS, KDS, TURNOS, REABASTO, INVENTARIO, DB y CHEFS, vuelve a sembrar datos demo con el stock inicial y borra los bloqueos de cuarto y de chef. No toca LOG ni los tokens. No es accesible por la API.

**Reponer solo los chefs**
Ejecutar `setup()` y después `reiniciarChefs()`. Limpia TURNOS y CHEFS y siembra los 6 chefs demo (nombres, avatar y códigos en `DatosDemo.gs`). No toca pedidos ni stock. Necesario porque `setup()` no resiembra una hoja que ya tiene datos.

**Probar con `spike/probador.html` (respaldo)**
1. Pegar la URL `/exec`, elegir la acción (se llenan el rol y un JSON de ejemplo) y pegar el token del rol. Al cambiar de rol hay que cambiar también el token.
2. Con `"request_id": "auto"` se genera un id nuevo en cada envío. Para probar un reintento o una repetición, usar un valor fijo (por ejemplo `req-prueba-0001`). En `cambiar_estatus` usar el `pedido_id` del día.
3. El probador reintenta solo (3 veces, con esperas de 1, 2 y 4 s) si la respuesta no es JSON o es `E_METHOD`. Cada línea del registro muestra la duración y `reintentos: n`, y un contador resume envíos, envíos con reintento y reintentos totales. Si se agotan los reintentos, muestra una línea `ERROR` corta.
4. El cuadro de texto puede sobrescribir cualquier campo, incluida `action`. Al elegir otra acción en el desplegable, el cuadro vuelve a la plantilla de esa acción.
5. No recargar la página: se pierden los campos y el contador.

**Datos de prueba**
Los pedidos y movimientos de prueba quedan en KIOSCO, KDS, PEDIDO_ITEMS, INVENTARIO, REABASTO y TURNOS, y modifican el stock en DB. Antes de la demo, ejecutar `reiniciarDemo()`.

## 9. Limitaciones conocidas
- **Supabase (vigente):** plan Free (se pausa tras una semana sin actividad; verificar los límites vigentes, sobre todo las invocaciones mensuales de Edge Functions con las pantallas consultando cada 5 s). Sin caché de servidor. `pedidos`, `inventario_mov` y `log` crecen y habrá que archivarlos en una operación real. Los códigos de chef de demo están en `02_semilla.sql`.
- **Respaldo (Apps Script):** Sheets limita el volumen y la concurrencia. Las lecturas se alargan al crecer las filas (`inventario` lee toda la hoja INVENTARIO).
- Token y PIN no son autenticación de personas. En producción se reemplazan por un backend real con JWT o cookies HttpOnly, y el CORS se limita al dominio definitivo.
- Una falla a mitad de una escritura de `crear_pedido`, de una cancelación o de un relleno puede dejar datos incompletos. La cancelación escribe KDS primero y el relleno escribe el movimiento primero, para no repetir el efecto ante un reintento.
- Google puede responder con un 404 intermitente en la redirección `script.googleusercontent.com/macros/echo`, después de que el script ya se ejecutó. No se puede suprimir desde el código: se mitiga con reintentos e idempotencia.
- `cerrar_turno` repetido solo se reconoce dentro de 5 minutos del cierre manual.
- Cuotas de Apps Script según la edición de Workspace, sin confirmar.

## 10. Pendiente
- **Dashboard (S3c y S9) pospuesto** a después de la presentación.
- **Hecho (20/10/2026):** migración a Supabase, despliegue en ADMIRA y pruebas de punta a punta de los tres flujos. Ejecutar `git grep` de tokens antes de cada push.
- **Pantalla de inventario en el KDS:** el backend (`inventario`, `registrar_relleno`, `solicitar_reabasto`) ya existe y está probado, pero ninguna pantalla lo usa. Falta referencia visual y el punto de entrada en la cocina.
- **CORS:** limitarlo al dominio definitivo cuando haya una implementación real (hoy `*`).
- **Tokens:** regenerarlos con `generar_tokens()` antes de un uso real o fuera de ADMIRA (las URLs de prueba salieron en capturas).
- **Respaldo:** conservar el Apps Script hasta pasada la presentación; después archivarlo, no borrarlo.
- **Fotos del menú:** habrá cambios de fotos; la columna `imagen` de `productos` lleva el nombre sin extensión (`update productos set imagen = producto_id where imagen = '';` la llena con el id).
- **S3c (antes de S9):** login del dashboard con PIN, `venues`, `metricas`, `exportar_pedidos` y `atender_reabasto`, a construir sobre Supabase.
- Retirar `spike/probador.html` al cerrar S3c.
- Realtime como mejora futura (hoy consulta cada 5 s). Revisar los límites del plan Free si se agregan pantallas.
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
- Sin `innerHTML`: todo se construye con `shared/dom.js`. CSP por meta con `connect-src` a `https://<ref>.supabase.co`, más `script.google.com` y `script.googleusercontent.com` (se conservan para poder volver al respaldo).
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

## KDS (frontend)
- Lienzo fijo de 1920×1080 escalado con `--escala`. Módulos ES sin dependencias en `kds/`: `config.js`, `textos.js`, `servicios/` (cola, solicitudes, turnos, pedidos, semaforo, sonido), `componentes/` y `pantallas/`.
- Sesión por tablet en `localStorage` con la clave `kds_chef_<venue>`.
- Consulta de `cola` cada 5 s. Repintado por firma. La conciliación solo corre si la vista está sincronizada y no hay envío en curso. Sin conexión: error con más de 30 s sin éxito.
- Semáforo con los umbrales de `cola.parametros` (hoja VENUES). Sonido con Web Audio al llegar pedidos pendientes nuevos; requiere un primer toque en la pantalla.
- Panel del pedido activo con modos según los artículos: hasta 3 grande, hasta 6 medio, hasta 12 chico, más de 12 lista en dos columnas. Topes `LIMITE_ITEMS_FILA` (4) y `LIMITE_ITEMS_DESPACHO` (6) con "+ N más".
- Transiciones: tomar, completar, recibir, cancelar y liberar; pausa corta o de comida. Conflictos: "Otro responsable ya tomó el pedido N.".
- Iconos blancos aplicados con máscara CSS.

## Estado (frontend)
- Carpeta `estado/`, rol `estado`, lienzo fijo de 1920×1080, solo horizontal. URL con `venue` y `token` por parámetros; el token no se guarda en ningún archivo.
- `servicios/consulta.js` consulta `estado` cada 5 s (límite de 12 s). `servicios/tablero.js` guarda en memoria `saliendo` (números que dejan En proceso sin llegar a Listo, se desvanecen 10 s conservando su lugar) y `listoVisto` (nuevos en Listo, resaltados 8 s; la primera carga no resalta).
- Reconciliación del DOM por clave: solo mueve nodos si cambia el orden, para no reiniciar animaciones CSS. Las duraciones de animación están duplicadas en `estado.css` porque el CSS no lee `config.js`.
- Máximo de 8 tarjetas por bloque (2×4) con "+ N más / more". Reloj y fecha del dispositivo.
- Sin conexión: indicador a los 30 s ("Actualizando… / Updating…") y mensaje neutro a los 2 min. `E_AUTH` muestra "pantalla no configurada". Recarga automática cada 6 h. Respeta `prefers-reduced-motion`. Sin sonido.
- CSP: `connect-src` incluye `https://<ref>.supabase.co` (y los dominios de Google del respaldo).

## Recursos de diseño (15/10)
- Íconos en `assets/iconos/`: `edificio`, `habitacion`, `persona`, `platter`, `comanda` y `cat-desayunos`, `cat-entradas`, `cat-ensaladas`, `cat-carnes`, `cat-mariscos`, `cat-bebidas`, `cat-postres`. Rutas en `kiosco/config.js` (`RUTAS.iconoComanda`, `RUTAS.iconosCategoria`).
- Fotos en `assets/productos/` con el valor de `imagen` del catálogo más `.jpg`. El valor debe cumplir `PATRON_IMAGEN`. Si `imagen` viene vacío no se pide ningún archivo y se muestra el ícono de respaldo.
- La confirmación de orden usa el mismo encabezado que el menú (`construirEncabezadoMenu`).

## Rendimiento (diagnóstico del 15/10)
- Una llamada a `exec` tarda cerca de 2.4 s solo en red y redirección. Identificar, `crear_pedido` y los cambios de estatus del KDS se perciben lentos; `crear_pedido` llegó a 7–12 s.
- Causas: múltiples accesos a hojas por acción, candado compartido con las consultas periódicas del KDS, Estado y espera del kiosco, y reintentos ante el 404 de Google.
- Camino acordado: migrar a Supabase desde el 19/10.
- **Resultado (20/10/2026):** con Supabase, `crear_pedido` tarda unos 1.3 s (antes de 2 a 12 s), `validar_cuarto` 0.54 s, `estado` de 0.45 a 0.99 s y las llamadas de la cocina de 0.38 a 0.57 s. Ya no hay 404 intermitentes.

## Pruebas
- Supabase (19 y 20/10/2026): pruebas locales sobre Postgres 16 con un arnés en Node que simula la Edge Function (unas 40 comprobaciones de cola y turnos, 45 de `cambiar_estatus`, 27 de inventario, relleno y reabasto) y verificación manual de Bryan contra el proyecto real, las páginas de GitHub Pages y ADMIRA. Detalle en `PLANEACION.md`, sección 11 (S11).
- Chromium con Playwright contra un backend simulado (`mock.js`); 65 comprobaciones en 4 suites (identificación y menú).
- KDS y Estado: pruebas con Playwright contra un backend simulado y validación manual de Bryan contra el backend real el 13/10/2026 (KDS) y visual (Estado).
- Pruebas manuales en Chrome contra el backend real el 08/10/2026 para el modal, la orden, el envío con ticket, el aviso de proceso a los 15 s y la pantalla de espera. Pedidos de prueba: ejecutar `reiniciarDemo()` antes de la demo.

## KDS (backend, S6a)
- Código del chef: en Supabase se guarda con hash bcrypt y se compara en `api_verificar_codigo`; el bloqueo (`chef_bloqueo_<venue>_<chef>`, 5 fallos por 60 s) vive en la tabla `limites`. En el respaldo de Apps Script el código está en texto claro en la hoja CHEFS (demo, sin identificación real) y el bloqueo en CacheService (`Turnos.gs`).
- `TURNOS.tipo_pausa` se escribe al pausar y se limpia al reanudar, cerrar o vencer el turno.
- `cola` junta los items con la hoja DB para entregar `imagen`; las pruebas del backend cubren código, bloqueo, tipos de pausa, imagen y migración de encabezados.
- Reglas de pantalla ya acordadas: un pedido activo por chef, sin inventario ni botón "+" en el KDS.