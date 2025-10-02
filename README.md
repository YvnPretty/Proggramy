# Demo de POS inteligente con API en vivo

Este repositorio contiene una demostración lista para ejecutar de un punto de venta (POS) que combina un frontend interactivo con un backend ligero en Node.js. Así puedes validar el flujo completo —login por PIN, mesas, pedidos, pagos, inventario y métricas— trabajando contra endpoints reales sin necesidad de provisionar tu propia base de datos todavía.

## Características principales

- **Autenticación por PIN** para tres roles de ejemplo (mesera, cajero y gerente).
- **API REST y stream de eventos (SSE)** para mantener el estado sincronizado entre el servidor y el navegador.
- **Gestión de mesas y pedidos** en vivo, con control de stock al momento de enviar órdenes a cocina.
- **Registro de pagos** que cierra las mesas, guarda la propina y actualiza las métricas.
- **Dashboard operativo** con ventas del día, pedidos abiertos y top de productos vendidos.

Toda la información se mantiene en memoria dentro del servidor para simplificar la prueba de concepto. Puedes modificar los datos iniciales en `server.js` o sustituirlos por tus propios servicios/BD cuando lo necesites.

## Requisitos

- Node.js 18 o superior. No se necesitan dependencias externas.

## Cómo ejecutar la demo

```bash
# Inicia el backend + frontend estático
node server.js
```

Abre tu navegador en [http://localhost:3000](http://localhost:3000) y utiliza cualquiera de los siguientes PIN para ingresar:

- `1234` · Ana (Mesera)
- `5678` · Luis (Cajero)
- `4321` · Paula (Gerente)

Una vez autenticado podrás:

1. Seleccionar mesas y ver su estado actualizado.
2. Agregar productos al carrito, validar stock y enviar pedidos a cocina.
3. Registrar pagos por mesa y observar cómo cambian las métricas en tiempo real gracias al stream de eventos.

## Estructura del proyecto

- `server.js`: API HTTP + flujo SSE con el estado del POS.
- `package.json`: scripts mínimos para ejecutar el servidor.
- `public/index.html`: punto de entrada del frontend.
- `public/app.js`: lógica de la interfaz que consume los endpoints y escucha los eventos en vivo.
- `public/styles.css`: estilos responsivos para login, layout del POS y dashboard.

## ¿Listo para conectarlo a tu stack?

- Reemplaza la lógica en memoria de `server.js` por consultas a tu base de datos o a workflows de N8N.
- Mantén las rutas (`/api/*`) o adapta el frontend para apuntar a tus nuevos endpoints.
- Extiende el stream SSE para incluir notificaciones adicionales (por ejemplo, alertas de inventario crítico o pedidos listos).

Con esta base podrás iterar rápidamente sobre la integración con servicios externos y validar la experiencia completa antes de invertir en la infraestructura definitiva.

## ¿Cómo publicarlo en tu propio repositorio Git?

1. **Crea un repositorio remoto.** En GitHub, GitLab u otro proveedor, genera un repositorio vacío (por ejemplo, `pos-demo`). Copia la URL SSH o HTTPS que te entregan.
2. **Inicializa el repositorio local (si aún no lo está).** Este proyecto ya contiene un directorio `.git`, pero si partes desde otra carpeta ejecuta `git init` para comenzar a versionar.
3. **Asocia el remoto.** Desde la raíz del proyecto ejecuta:
   ```bash
   git remote add origin <URL_DEL_REPOSITORIO>
   ```
   Si el remoto ya existe y solo quieres actualizarlo, usa `git remote set-url origin <URL>`. Verifica con `git remote -v`.
4. **Confirma los cambios.** Asegúrate de tener tu código listo y confirmado:
   ```bash
   git add .
   git commit -m "feat: primera versión del POS demo"
   ```
5. **Publica la rama.** Envía tu rama actual (por ejemplo `main` o `work`) al remoto:
   ```bash
   git push -u origin main
   ```
   Si trabajas con otra rama, reemplaza `main` por su nombre.
6. **Comparte o despliega.** Una vez que el repositorio está en Git, puedes clonar desde cualquier equipo o conectar servicios de despliegue (Railway, Render, Fly.io, etc.) que ejecuten `node server.js` para servir la demo en línea.

Con este flujo tendrás tu copia del proyecto bajo control de versiones y lista para colaborar o desplegar donde prefieras.
