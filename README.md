# Sistema Digital para Restaurantes

## 1. Objetivos Principales
- **Digitalizar y optimizar:** transformar los procesos manuales del restaurante en flujos digitales eficientes.
- **Eficiencia y control:** mejorar la velocidad de operación y ofrecer supervisión completa del negocio.
- **Rentabilidad:** ayudar a los dueños a operar con mayor eficiencia y aumentar la rentabilidad.

## 2. Roles y Accesos
Cada rol ingresa con un PIN de 4 dígitos y tiene acceso acorde a sus funciones.
- **Mesero:** toma de pedidos.
- **Cajero:** gestiona pagos y cierre de caja.
- **Gerente/Dueño:** supervisión, control y análisis en tiempo real.

## 3. Flujo de Operación (POS)
### Gestión de mesas
- Mapa con estados visuales: rojo (ocupada), verde (disponible), amarillo (reservada).
- Asignación de mesas ingresando el número de personas al seleccionar una mesa libre.

### Toma de pedidos
- Interfaz con categorías de productos a la izquierda, productos seleccionados en el centro y resumen a la derecha.
- Cálculo automático de subtotal, impuesto al consumo, propina voluntaria y total.
- Botón **"Enviar a cocina"** que comunica el pedido a N8N, valida productos, calcula el total y guarda el pedido como "pendiente".

### Gestión de pagos (Cajero/Gerente)
- Pantalla dedicada con métodos: efectivo, tarjeta de débito/crédito y QR.
- Campo para porcentaje de propinas y descuentos.
- Cálculo automático del cambio, evitando errores humanos.
- Validación que impide cerrar la ventana si el pago es insuficiente.
- Finalización del pago, liberación de mesa e impresión de factura/recibo.

## 4. Centro de Control para Dueños (Dashboard)
- Acceso móvil en tiempo real para monitorear el negocio desde cualquier lugar.
- KPIs y gráficos interactivos: ventas actuales, productos más vendidos por categoría y horas pico de venta.
- Desarrollo asistido por IA y conectado a agentes inteligentes de N8N.

## 5. N8N como Cerebro Digital
N8N coordina la automatización mediante agentes que operan como departamentos del restaurante.

### Sistema de Turnos Inteligente (RRHH)
- Reloj que se ejecuta cada 15 minutos.
- Consulta la base de datos de personal, detecta tardanzas o ausencias.
- Envía alertas por correo a gerencia si hay incidencias.

### Control de Inventario Inteligente (Operaciones)
- Ejecución periódica cada ciertas horas.
- Revisa niveles de stock en la base de datos.
- Prepara y envía reportes por correo si hay faltantes.

### Agentes de Respuesta Instantánea (Atención al Cliente/Ventas)
- **APIs del POS:** gestionan las funciones principales del POS.
- **API Menú:** recibe solicitudes vía webhook, busca productos en la base de datos y los envía al POS.
- **Agente de Pedidos:** recibe productos vía webhook, obtiene precios, calcula el total y guarda el pedido con detalles en la base de datos.
- **Agente de Pagos:** recibe la señal de pago, actualiza el estado del pedido a pagado y registra el pago.
- **APIs del Dashboard:** cada gráfico consulta la base de datos según la pregunta recibida vía webhook.

### Agente de Cierre Inteligente (Finanzas/Análisis)
- Ejecutado a una hora específica (ej. 22:00).
- Recolecta datos diarios: ventas, gastos, pagos, rendimiento y órdenes de compra.
- Empaqueta la información, la envía a una IA externa para análisis estratégico.
- Genera un reporte visual con cierre de caja, desglose de pagos, rendimiento, producto destacado, oportunidades de mejora y alertas críticas, enviándolo por email.
- Operación continua 24/7 mediante N8N Cloud.

## 6. Tecnologías Implicadas
- **Front-end:** interfaces y dashboard desarrollados con apoyo de IA.
- **Back-end/Automatización:** flujos con N8N (on-premise o N8N Cloud).
- **Base de datos:** almacena pedidos, productos, inventario, pagos y personal.
- **Inteligencia artificial:** análisis estratégico del reporte de cierre.
- **Comunicación:** webhooks para APIs del POS y dashboard, emails para alertas y reportes.
