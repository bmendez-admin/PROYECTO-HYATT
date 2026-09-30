# Documentación técnica: Kiosco de pedidos Hyatt Breathless

Actualizada al cierre de S1 · 30/09/2026

## Arquitectura
- Front estático (HTML, CSS y JS con módulos ES) en GitHub Pages, repo `bmendez-admin/PROYECTO-HYATT`, rama `main`.
- Backend: Google Sheets + Apps Script como aplicación web, en la cuenta de ADMIRA.
- Comunicación: `fetch` con `POST` y `Content-Type: text/plain;charset=utf-8`, cuerpo JSON. No hay preflight CORS. El `GET` solo se usa para `ping`.
- Respuestas: `{ok:true,...}` o `{ok:false,code}`.

## Estado actual del backend (spike de S1)
`backend/Code.gs` contiene el router y las acciones de prueba:

| Acción | Descripción |
|---|---|
| `ping` | Devuelve `hora_servidor` |
| `lock_test` | Incrementa un contador en la pestaña SPIKE bajo `LockService` (`tryLock` 30 s) y devuelve `valor` y `espera_ms` |
| `latido` | Guarda `chef_<nombre>` en `CacheService` por 90 s y lista los chefs vivos |
| `lectura` | Devuelve el contador con caché de 3 s |

Errores: `E_VALIDATION` (acción desconocida), `E_CONFLICT` (lock no obtenido), `E_INTERNAL` (excepción).

## Despliegue del Apps Script
1. Implementar → Nueva implementación → Aplicación web.
2. Ejecutar como: **Yo**. Quién tiene acceso: **Cualquier persona**.
3. Para cada cambio: Implementar → Administrar implementaciones → Editar → **Nueva versión**. No crear implementaciones nuevas: cambia la URL.
4. La URL `/exec` debe tener la forma `script.google.com/macros/s/.../exec`. Una URL con `/a/macros/<dominio>/` indica acceso restringido a la organización.

## Prueba de S1
- Página: `https://bmendez-admin.github.io/PROYECTO-HYATT/spike/`.
- Pegar la URL `/exec` en el campo (se borra al recargar). Los botones corren de uno en uno.
- El cliente reintenta hasta 4 veces con espera creciente y registra `intentos`. Si la línea de GET no muestra `intentos`, el navegador usa una versión vieja del archivo (recargar con Ctrl + Shift + R o añadir `?v=n` a la URL).

## Resultados
| Prueba | Resultado |
|---|---|
| POST y GET desde Pages | GET 824 ms, POST 479 ms |
| Acceso público desde incógnito | GET 1498 ms |
| Lock x10 | 10/10, consecutivas, sin repetidos, 10 s en total |
| Polling 3 clientes x 60 s | 36/36, 0 errores, mediana 1.4 s, máxima 9.4 s |
| Latido | Lectura entre llamadas correcta; expira a los 90 s |

## Reglas derivadas
- Un solo bloque de escritura dentro del lock, `tryLock` de 30 s.
- Cliente: tiempo límite 20 s, 3 reintentos con espera creciente, acciones bloqueadas mientras una está en curso.
- Las pantallas muestran la antigüedad del dato.
- `crear_pedido` es idempotente con `request_id`.

## Pendiente de documentar
Esquema final de pestañas, acciones por rol, seguridad (tokens y PIN) y despliegue en ADMIRA, que se documentan al cerrar S2, S3 y S10.