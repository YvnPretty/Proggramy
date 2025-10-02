const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, "public");

const employees = [
  { id: 1, name: "Ana", role: "Mesera", pin: "1234" },
  { id: 2, name: "Luis", role: "Cajero", pin: "5678" },
  { id: 3, name: "Paula", role: "Gerente", pin: "4321" },
];

const tables = [
  { id: 1, name: "Mesa 1", seats: 2, status: "disponible" },
  { id: 2, name: "Mesa 2", seats: 4, status: "disponible" },
  { id: 3, name: "Mesa 3", seats: 2, status: "disponible" },
  { id: 4, name: "Mesa 4", seats: 6, status: "disponible" },
  { id: 5, name: "Terraza", seats: 4, status: "disponible" },
];

const categories = [
  { id: "bebidas", name: "Bebidas" },
  { id: "entradas", name: "Entradas" },
  { id: "platos", name: "Platos Fuertes" },
  { id: "postres", name: "Postres" },
];

const products = [
  { id: "latte", name: "Latte de Vainilla", price: 55, categoryId: "bebidas" },
  { id: "capuccino", name: "Capuccino", price: 52, categoryId: "bebidas" },
  { id: "limonada", name: "Limonada", price: 35, categoryId: "bebidas" },
  { id: "americano", name: "Café Americano", price: 28, categoryId: "bebidas" },
  { id: "brownie", name: "Brownie", price: 48, categoryId: "postres" },
  { id: "cheesecake", name: "Cheesecake", price: 62, categoryId: "postres" },
  { id: "ensalada", name: "Ensalada Fresca", price: 68, categoryId: "entradas" },
  { id: "nachos", name: "Nachos", price: 64, categoryId: "entradas" },
  { id: "pasta", name: "Pasta al Pesto", price: 98, categoryId: "platos" },
  { id: "burger", name: "Hamburguesa Artesanal", price: 110, categoryId: "platos" },
  { id: "tacos", name: "Tacos de Costilla", price: 95, categoryId: "platos" },
];

const inventory = products.reduce((acc, product) => {
  const baseStock = 10;
  acc[product.id] = { name: product.name, stock: baseStock, min: 3 };
  return acc;
}, {});

inventory.cheesecake.stock = 2;
inventory.americano.stock = 15;
inventory.latte.stock = 12;
inventory.nachos.stock = 5;
inventory.cheesecake.min = 2;
inventory.nachos.min = 4;

let orderCounter = 1;
let paymentCounter = 1;
let orders = [];
const payments = [];
const sseClients = new Set();

function cloneTables() {
  return tables.map((table) => ({ ...table }));
}

function cloneOrders() {
  return orders.map((order) => ({
    ...order,
    items: order.items.map((item) => ({ ...item })),
  }));
}

function cloneInventory() {
  return Object.fromEntries(
    Object.entries(inventory).map(([id, entry]) => [id, { ...entry }])
  );
}

function buildDashboard() {
  const totalSales = payments.reduce((sum, payment) => sum + payment.total, 0);
  const openOrders = orders.filter((order) => order.status === "pendiente").length;
  const paidOrders = orders.filter((order) => order.status === "pagado");
  const averageTicket = paidOrders.length
    ? paidOrders.reduce((sum, order) => sum + order.total, 0) / paidOrders.length
    : 0;

  const productSales = new Map();
  paidOrders.forEach((order) => {
    order.items.forEach((item) => {
      const current = productSales.get(item.productId) || 0;
      productSales.set(item.productId, current + item.quantity);
    });
  });

  const topProducts = Array.from(productSales.entries())
    .map(([productId, quantity]) => ({
      productId,
      quantity,
      name: products.find((product) => product.id === productId)?.name || productId,
    }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  return {
    totalSales,
    openOrders,
    averageTicket,
    topProducts,
  };
}

function buildSnapshot() {
  return {
    tables: cloneTables(),
    inventory: cloneInventory(),
    orders: cloneOrders(),
    dashboard: buildDashboard(),
  };
}

function broadcast(event, payload) {
  const message = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  sseClients.forEach((res) => {
    res.write(message);
  });
}

function broadcastSnapshot() {
  broadcast("snapshot", buildSnapshot());
}

function broadcastHeartbeat() {
  broadcast("heartbeat", { now: new Date().toISOString() });
}

setInterval(broadcastHeartbeat, 15000);

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache",
  });
  res.end(JSON.stringify(data));
}

async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk.toString("utf8");
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function handleEvents(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write(": initial\n\n");
  res.write(`event: snapshot\ndata: ${JSON.stringify(buildSnapshot())}\n\n`);
  res.write(`event: heartbeat\ndata: ${JSON.stringify({ now: new Date().toISOString() })}\n\n`);

  sseClients.add(res);
  req.on("close", () => {
    sseClients.delete(res);
  });
}

function handleLogin(req, res, body) {
  const { pin } = body || {};
  const employee = employees.find((candidate) => candidate.pin === pin);
  if (!employee) {
    sendJson(res, 401, { message: "PIN incorrecto" });
    return;
  }
  sendJson(res, 200, { employee });
}

function handleLogout(_req, res) {
  res.writeHead(204);
  res.end();
}

function handleCategories(_req, res) {
  sendJson(res, 200, { categories });
}

function handleProducts(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const categoria = url.searchParams.get("categoria");
  const filtered = categoria
    ? products.filter((product) => product.categoryId === categoria)
    : products;
  sendJson(res, 200, { products: filtered });
}

function handleTables(_req, res) {
  sendJson(res, 200, { tables: cloneTables() });
}

function handleInventory(_req, res) {
  sendJson(res, 200, { inventory: cloneInventory() });
}

function handleOrders(_req, res) {
  sendJson(res, 200, { orders: cloneOrders() });
}

function handleSnapshot(_req, res) {
  sendJson(res, 200, buildSnapshot());
}

function handleCreateOrder(_req, res, body) {
  const { tableId, employeeId, items } = body || {};
  if (!tableId || !employeeId || !Array.isArray(items) || !items.length) {
    sendJson(res, 400, { message: "Faltan datos para registrar el pedido" });
    return;
  }

  const table = tables.find((candidate) => candidate.id === tableId);
  if (!table) {
    sendJson(res, 404, { message: "Mesa no encontrada" });
    return;
  }

  const detailedItems = [];
  for (const item of items) {
    const product = products.find((candidate) => candidate.id === item.productId);
    if (!product) {
      sendJson(res, 404, { message: `Producto no encontrado: ${item.productId}` });
      return;
    }
    const quantity = Number.parseInt(item.quantity, 10) || 0;
    if (quantity <= 0) {
      sendJson(res, 400, { message: "Cantidad inválida en el pedido" });
      return;
    }
    const inventoryEntry = inventory[product.id];
    if (!inventoryEntry || inventoryEntry.stock < quantity) {
      sendJson(res, 409, { message: `Sin stock suficiente para ${product.name}` });
      return;
    }
    inventoryEntry.stock -= quantity;
    detailedItems.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity,
      subtotal: product.price * quantity,
    });
  }

  const total = detailedItems.reduce((sum, item) => sum + item.subtotal, 0);
  const order = {
    id: orderCounter++,
    tableId,
    employeeId,
    status: "pendiente",
    createdAt: new Date().toISOString(),
    items: detailedItems,
    total,
  };
  orders.push(order);
  table.status = "ocupada";

  broadcastSnapshot();
  sendJson(res, 201, buildSnapshot());
}

function handlePayment(_req, res, body) {
  const { tableId, method = "efectivo", tip = 0 } = body || {};
  const table = tables.find((candidate) => candidate.id === tableId);
  if (!table) {
    sendJson(res, 404, { message: "Mesa no encontrada" });
    return;
  }

  const pendingOrders = orders.filter(
    (order) => order.tableId === tableId && order.status === "pendiente"
  );
  if (!pendingOrders.length) {
    sendJson(res, 400, { message: "No hay pedidos pendientes" });
    return;
  }

  const tipValue = Number.parseFloat(tip) || 0;
  if (tipValue < 0) {
    sendJson(res, 400, { message: "La propina no puede ser negativa" });
    return;
  }

  const total = pendingOrders.reduce((sum, order) => sum + order.total, 0);
  pendingOrders.forEach((order) => {
    order.status = "pagado";
    order.paidAt = new Date().toISOString();
  });
  table.status = "disponible";

  payments.push({
    id: paymentCounter++,
    tableId,
    method,
    total,
    tip: tipValue,
    createdAt: new Date().toISOString(),
  });

  broadcastSnapshot();
  sendJson(res, 200, buildSnapshot());
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".ico":
      return "image/x-icon";
    default:
      return "application/octet-stream";
  }
}

function serveStatic(req, res, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const decodedPath = decodeURIComponent(safePath);
  const absolutePath = path.join(publicDir, decodedPath);
  if (!absolutePath.startsWith(publicDir)) {
    return false;
  }

  let finalPath = absolutePath;
  if (fs.existsSync(finalPath) && fs.statSync(finalPath).isDirectory()) {
    finalPath = path.join(finalPath, "index.html");
  }

  if (!fs.existsSync(finalPath)) {
    return false;
  }

  const stream = fs.createReadStream(finalPath);
  stream.on("error", () => {
    res.writeHead(500);
    res.end("Error interno");
  });
  res.writeHead(200, { "Content-Type": getContentType(finalPath) });
  stream.pipe(res);
  return true;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const { pathname } = url;

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  if (pathname === "/api/events" && req.method === "GET") {
    handleEvents(req, res);
    return;
  }

  if (pathname === "/api/login" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      handleLogin(req, res, body);
    } catch (error) {
      sendJson(res, 400, { message: "JSON inválido" });
    }
    return;
  }

  if (pathname === "/api/logout" && req.method === "POST") {
    handleLogout(req, res);
    return;
  }

  if (pathname === "/api/categorias" && req.method === "GET") {
    handleCategories(req, res);
    return;
  }

  if (pathname === "/api/productos" && req.method === "GET") {
    handleProducts(req, res);
    return;
  }

  if (pathname === "/api/mesas" && req.method === "GET") {
    handleTables(req, res);
    return;
  }

  if (pathname === "/api/inventario" && req.method === "GET") {
    handleInventory(req, res);
    return;
  }

  if (pathname === "/api/pedidos" && req.method === "GET") {
    handleOrders(req, res);
    return;
  }

  if (pathname === "/api/pedidos" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      handleCreateOrder(req, res, body);
    } catch (error) {
      sendJson(res, 400, { message: "JSON inválido" });
    }
    return;
  }

  if (pathname === "/api/pagos" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      handlePayment(req, res, body);
    } catch (error) {
      sendJson(res, 400, { message: "JSON inválido" });
    }
    return;
  }

  if (pathname === "/api/snapshot" && req.method === "GET") {
    handleSnapshot(req, res);
    return;
  }

  if (req.method === "GET") {
    if (serveStatic(req, res, pathname)) {
      return;
    }
    const fallbackPath = path.join(publicDir, "index.html");
    const stream = fs.createReadStream(fallbackPath);
    stream.on("error", () => {
      res.writeHead(500);
      res.end("Error interno");
    });
    res.writeHead(200, { "Content-Type": getContentType(fallbackPath) });
    stream.pipe(res);
    return;
  }

  sendJson(res, 404, { message: "No encontrado" });
});

server.listen(PORT, () => {
  console.log(`POS demo server running on http://localhost:${PORT}`);
});
