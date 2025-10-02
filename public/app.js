const API_BASE = "";

const state = {
  employee: null,
  tables: [],
  categories: [],
  products: [],
  inventory: {},
  orders: [],
  dashboard: null,
  activeCategoryId: null,
  selectedTableId: null,
  cart: [],
  paymentMethod: "efectivo",
  tipAmount: "",
  message: null,
  isLoading: false,
  lastHeartbeat: null,
};

let events = null;

const app = document.getElementById("app");

function setMessage(text, type = "info") {
  state.message = text ? { text, type } : null;
  render();
  if (text) {
    setTimeout(() => {
      if (state.message && state.message.text === text) {
        state.message = null;
        render();
      }
    }, 3200);
  }
}

function setLoading(isLoading) {
  state.isLoading = isLoading;
  render();
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    credentials: "same-origin",
    ...options,
  });

  if (!response.ok) {
    let errorMessage = response.statusText;
    try {
      const payload = await response.json();
      if (payload && payload.message) {
        errorMessage = payload.message;
      }
    } catch (err) {
      // ignore json parsing errors
    }
    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function applySnapshot(snapshot = {}) {
  if (snapshot.tables) {
    state.tables = snapshot.tables;
  }
  if (snapshot.inventory) {
    state.inventory = snapshot.inventory;
  }
  if (snapshot.orders) {
    state.orders = snapshot.orders;
  }
  if (snapshot.dashboard) {
    state.dashboard = snapshot.dashboard;
  }
  render();
}

async function loadInitialData() {
  try {
    setLoading(true);
    const [categoriesPayload, snapshot] = await Promise.all([
      api("/api/categorias"),
      api("/api/snapshot"),
    ]);

    state.categories = categoriesPayload.categories || [];
    state.activeCategoryId = state.categories[0]?.id ?? null;
    applySnapshot(snapshot);
    if (state.activeCategoryId) {
      const productsPayload = await api(
        `/api/productos?categoria=${encodeURIComponent(state.activeCategoryId)}`
      );
      state.products = productsPayload.products || [];
    }
    startEventStream();
  } catch (error) {
    console.error(error);
    setMessage(error.message || "No se pudo cargar la información inicial", "error");
  } finally {
    setLoading(false);
  }
}

function startEventStream() {
  if (typeof EventSource === "undefined") {
    console.warn("EventSource no está disponible en este navegador");
    return;
  }
  if (events) {
    events.close();
  }
  events = new EventSource("/api/events");
  events.addEventListener("snapshot", (evt) => {
    const data = JSON.parse(evt.data);
    applySnapshot(data);
  });
  events.addEventListener("heartbeat", (evt) => {
    try {
      const data = JSON.parse(evt.data);
      state.lastHeartbeat = data.now;
      render();
    } catch (error) {
      console.warn("No se pudo interpretar el heartbeat", error);
    }
  });
  events.onerror = () => {
    events.close();
    setTimeout(startEventStream, 3000);
  };
}

function getTableById(id) {
  return state.tables.find((table) => table.id === id) || null;
}

function getInventoryEntry(productId) {
  return state.inventory[productId] || { name: productId, stock: 0, min: 0 };
}

function getPendingOrdersForTable(tableId) {
  return state.orders.filter(
    (order) => order.tableId === tableId && order.status === "pendiente"
  );
}

function getCartTotal() {
  return state.cart.reduce((total, item) => total + item.price * item.quantity, 0);
}

async function handleLogin(pin) {
  try {
    setLoading(true);
    const payload = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ pin }),
    });
    state.employee = payload.employee;
    setMessage(`¡Bienvenido, ${state.employee.name}!`, "success");
    await loadInitialData();
  } catch (error) {
    console.error(error);
    setMessage(error.message || "PIN incorrecto", "error");
  } finally {
    setLoading(false);
  }
}

async function handleLogout() {
  try {
    await api("/api/logout", { method: "POST" });
  } catch (error) {
    console.warn("Error al cerrar sesión", error);
  }
  if (events) {
    events.close();
    events = null;
  }
  Object.assign(state, {
    employee: null,
    tables: [],
    products: [],
    categories: [],
    inventory: {},
    orders: [],
    dashboard: null,
    activeCategoryId: null,
    selectedTableId: null,
    cart: [],
    paymentMethod: "efectivo",
    tipAmount: "",
    lastHeartbeat: null,
  });
  render();
}

async function selectCategory(categoryId) {
  if (categoryId === state.activeCategoryId) return;
  state.activeCategoryId = categoryId;
  state.products = [];
  render();
  try {
    const payload = await api(
      `/api/productos?categoria=${encodeURIComponent(categoryId)}`
    );
    state.products = payload.products || [];
    render();
  } catch (error) {
    console.error(error);
    setMessage("No se pudieron cargar los productos", "error");
  }
}

function selectTable(tableId) {
  state.selectedTableId = tableId;
  render();
}

function addItemToCart(product) {
  const entry = getInventoryEntry(product.id);
  const currentQuantity =
    state.cart.find((item) => item.id === product.id)?.quantity ?? 0;
  if (currentQuantity + 1 > entry.stock) {
    setMessage("Sin stock disponible para este producto", "error");
    return;
  }
  const existing = state.cart.find((item) => item.id === product.id);
  if (existing) {
    existing.quantity += 1;
  } else {
    state.cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      quantity: 1,
    });
  }
  render();
}

function updateCartQuantity(productId, delta) {
  const item = state.cart.find((entry) => entry.id === productId);
  if (!item) return;
  const entry = getInventoryEntry(productId);
  const newQuantity = item.quantity + delta;
  if (newQuantity <= 0) {
    state.cart = state.cart.filter((entry) => entry.id !== productId);
  } else if (newQuantity > entry.stock) {
    setMessage("La cantidad supera el stock disponible", "error");
    return;
  } else {
    item.quantity = newQuantity;
  }
  render();
}

function clearCart() {
  state.cart = [];
  render();
}

async function submitOrder() {
  if (!state.selectedTableId) {
    setMessage("Selecciona una mesa antes de enviar", "error");
    return;
  }
  if (!state.cart.length) {
    setMessage("Agrega productos al carrito", "error");
    return;
  }
  try {
    setLoading(true);
    const payload = await api("/api/pedidos", {
      method: "POST",
      body: JSON.stringify({
        tableId: state.selectedTableId,
        employeeId: state.employee.id,
        items: state.cart.map((item) => ({
          productId: item.id,
          quantity: item.quantity,
        })),
      }),
    });
    clearCart();
    applySnapshot(payload);
    setMessage("Pedido enviado a cocina", "success");
  } catch (error) {
    console.error(error);
    setMessage(error.message || "No se pudo registrar el pedido", "error");
  } finally {
    setLoading(false);
  }
}

async function registerPayment() {
  if (!state.selectedTableId) {
    setMessage("Selecciona una mesa", "error");
    return;
  }
  const pendingOrders = getPendingOrdersForTable(state.selectedTableId);
  if (!pendingOrders.length) {
    setMessage("No hay pedidos pendientes para cobrar", "info");
    return;
  }
  const tipValue = Number.parseFloat(state.tipAmount || "0");
  if (Number.isNaN(tipValue) || tipValue < 0) {
    setMessage("Ingresa una propina válida", "error");
    return;
  }
  try {
    setLoading(true);
    const payload = await api("/api/pagos", {
      method: "POST",
      body: JSON.stringify({
        tableId: state.selectedTableId,
        method: state.paymentMethod,
        tip: tipValue,
      }),
    });
    state.tipAmount = "";
    applySnapshot(payload);
    setMessage("Pago registrado", "success");
  } catch (error) {
    console.error(error);
    setMessage(error.message || "No se pudo registrar el pago", "error");
  } finally {
    setLoading(false);
  }
}

function render() {
  app.innerHTML = "";
  if (state.message) {
    const alert = document.createElement("div");
    alert.className = `alert ${state.message.type}`;
    alert.textContent = state.message.text;
    app.appendChild(alert);
  }

  if (state.isLoading) {
    const loading = document.createElement("p");
    loading.textContent = "Cargando...";
    loading.style.marginBottom = "1rem";
    app.appendChild(loading);
  }

  if (!state.employee) {
    renderLogin();
  } else {
    renderPOS();
  }
}

function renderLogin() {
  const card = document.createElement("section");
  card.className = "login-card";

  const title = document.createElement("h1");
  title.textContent = "POS Inteligente";

  const subtitle = document.createElement("p");
  subtitle.textContent = "Ingresa tu PIN para comenzar";

  const pinDisplay = document.createElement("div");
  pinDisplay.className = "pin-display";
  const pinDots = [];
  for (let i = 0; i < 4; i++) {
    const dot = document.createElement("span");
    dot.className = "pin-dot";
    pinDisplay.appendChild(dot);
    pinDots.push(dot);
  }

  const keypad = document.createElement("div");
  keypad.className = "pin-grid";
  let pinValue = "";

  const updateDots = () => {
    pinDots.forEach((dot, index) => {
      dot.classList.toggle("filled", index < pinValue.length);
    });
  };

  const handleDigit = (digit) => {
    if (digit === "back") {
      pinValue = pinValue.slice(0, -1);
      updateDots();
      return;
    }
    if (pinValue.length === 4) return;
    pinValue += digit;
    updateDots();
    if (pinValue.length === 4) {
      handleLogin(pinValue);
      pinValue = "";
      setTimeout(updateDots, 0);
    }
  };

  [1, 2, 3, 4, 5, 6, 7, 8, 9, "back", 0].forEach((value) => {
    const button = document.createElement("button");
    button.textContent = value === "back" ? "←" : value;
    button.addEventListener("click", () => handleDigit(String(value)));
    keypad.appendChild(button);
  });

  card.append(title, subtitle, pinDisplay, keypad);
  app.appendChild(card);
}

function renderPOS() {
  const shell = document.createElement("div");
  shell.className = "pos-shell";

  const header = document.createElement("header");
  header.className = "pos-header";

  const heading = document.createElement("h1");
  heading.textContent = "Panel de operaciones";
  header.appendChild(heading);

  const badge = document.createElement("div");
  badge.className = "user-badge";
  badge.innerHTML = `
    <div>
      <div>${state.employee.name}</div>
      <small>${state.employee.role}</small>
    </div>
  `;

  if (state.lastHeartbeat) {
    const status = document.createElement("small");
    status.textContent = `Actualizado: ${new Date(
      state.lastHeartbeat
    ).toLocaleTimeString()}`;
    status.style.display = "block";
    status.style.color = "#cbd5f5";
    badge.appendChild(status);
  }

  const logout = document.createElement("button");
  logout.className = "secondary-button";
  logout.textContent = "Cerrar sesión";
  logout.addEventListener("click", handleLogout);

  const headerActions = document.createElement("div");
  headerActions.style.display = "flex";
  headerActions.style.gap = "0.75rem";
  headerActions.append(badge, logout);

  header.appendChild(headerActions);
  shell.appendChild(header);

  const layout = document.createElement("section");
  layout.className = "layout";

  layout.appendChild(renderTablesCard());
  layout.appendChild(renderCatalogCard());
  layout.appendChild(renderCartCard());
  layout.appendChild(renderDashboardCard());

  shell.appendChild(layout);
  app.appendChild(shell);
}

function renderTablesCard() {
  const card = document.createElement("article");
  card.className = "card";

  const title = document.createElement("h2");
  title.className = "section-title";
  title.textContent = "Mesas";
  card.appendChild(title);

  const grid = document.createElement("div");
  grid.className = "table-grid";

  state.tables.forEach((table) => {
    const button = document.createElement("button");
    button.className = `table-button ${table.status}`;
    if (table.id === state.selectedTableId) {
      button.classList.add("activa");
    }
    const pending = getPendingOrdersForTable(table.id).length;
    button.innerHTML = `
      <strong>${table.name}</strong>
      <small>${table.seats} lugares</small>
      <small>${table.status}</small>
      ${
        pending
          ? `<span class="order-chip">${pending} pendiente${
              pending > 1 ? "s" : ""
            }</span>`
          : ""
      }
    `;
    button.addEventListener("click", () => selectTable(table.id));
    grid.appendChild(button);
  });

  card.appendChild(grid);
  return card;
}

function renderCatalogCard() {
  const card = document.createElement("article");
  card.className = "card";

  const title = document.createElement("h2");
  title.className = "section-title";
  title.textContent = "Catálogo";
  card.appendChild(title);

  const categoryList = document.createElement("div");
  categoryList.className = "category-list";

  state.categories.forEach((category) => {
    const button = document.createElement("button");
    button.className = "category-button";
    if (category.id === state.activeCategoryId) {
      button.classList.add("activa");
    }
    button.textContent = category.name;
    button.addEventListener("click", () => selectCategory(category.id));
    categoryList.appendChild(button);
  });

  card.appendChild(categoryList);

  const productList = document.createElement("div");
  productList.className = "product-list";

  if (!state.products.length) {
    const empty = document.createElement("p");
    empty.textContent = "Sin productos para esta categoría";
    productList.appendChild(empty);
  }

  state.products.forEach((product) => {
    const cardItem = document.createElement("div");
    cardItem.className = "product-card";

    const name = document.createElement("h3");
    name.textContent = product.name;
    cardItem.appendChild(name);

    const price = document.createElement("p");
    price.textContent = `$${product.price.toFixed(2)}`;
    cardItem.appendChild(price);

    const stockInfo = document.createElement("small");
    const entry = getInventoryEntry(product.id);
    stockInfo.textContent = `Stock: ${entry.stock}`;
    cardItem.appendChild(stockInfo);

    const addButton = document.createElement("button");
    addButton.textContent = "Agregar";
    addButton.addEventListener("click", () => addItemToCart(product));
    cardItem.appendChild(addButton);

    productList.appendChild(cardItem);
  });

  card.appendChild(productList);
  return card;
}

function renderCartCard() {
  const card = document.createElement("article");
  card.className = "card";

  const title = document.createElement("h2");
  title.className = "section-title";
  title.textContent = "Pedido actual";
  card.appendChild(title);

  const tableInfo = document.createElement("p");
  const table = state.selectedTableId ? getTableById(state.selectedTableId) : null;
  tableInfo.textContent = table
    ? `${table.name} · ${table.status}`
    : "Selecciona una mesa";
  card.appendChild(tableInfo);

  const list = document.createElement("div");
  list.className = "cart-list";

  if (!state.cart.length) {
    const empty = document.createElement("p");
    empty.textContent = "Aún no hay productos";
    list.appendChild(empty);
  }

  state.cart.forEach((item) => {
    const row = document.createElement("div");
    row.className = "cart-item";

    const info = document.createElement("div");
    info.innerHTML = `<strong>${item.name}</strong><small>$${item.price.toFixed(
      2
    )}</small>`;

    const actions = document.createElement("div");
    actions.className = "cart-actions";

    const remove = document.createElement("button");
    remove.textContent = "-";
    remove.addEventListener("click", () => updateCartQuantity(item.id, -1));

    const qty = document.createElement("span");
    qty.textContent = item.quantity;

    const add = document.createElement("button");
    add.textContent = "+";
    add.addEventListener("click", () => updateCartQuantity(item.id, 1));

    actions.append(remove, qty, add);
    row.append(info, actions);
    list.appendChild(row);
  });

  card.appendChild(list);

  const footer = document.createElement("div");
  footer.className = "cart-footer";

  const total = document.createElement("strong");
  total.textContent = `Total: $${getCartTotal().toFixed(2)}`;
  footer.appendChild(total);

  const send = document.createElement("button");
  send.className = "primary-button";
  send.textContent = "Enviar a cocina";
  send.disabled = !state.cart.length || state.isLoading;
  send.addEventListener("click", submitOrder);
  footer.appendChild(send);

  const clear = document.createElement("button");
  clear.className = "secondary-button";
  clear.textContent = "Limpiar";
  clear.disabled = !state.cart.length;
  clear.addEventListener("click", clearCart);
  footer.appendChild(clear);

  card.appendChild(footer);
  return card;
}

function renderDashboardCard() {
  const card = document.createElement("article");
  card.className = "card";

  const title = document.createElement("h2");
  title.className = "section-title";
  title.textContent = "Cobro e inventario";
  card.appendChild(title);

  const paymentSection = document.createElement("div");
  paymentSection.className = "cart-footer";

  const methodLabel = document.createElement("label");
  methodLabel.textContent = "Método de pago";
  const methodSelect = document.createElement("select");
  methodSelect.className = "tip-input";
  [
    { id: "efectivo", label: "Efectivo" },
    { id: "tarjeta", label: "Tarjeta" },
    { id: "transferencia", label: "Transferencia" },
  ].forEach((option) => {
    const opt = document.createElement("option");
    opt.value = option.id;
    opt.textContent = option.label;
    if (option.id === state.paymentMethod) {
      opt.selected = true;
    }
    methodSelect.appendChild(opt);
  });
  methodSelect.addEventListener("change", (event) => {
    state.paymentMethod = event.target.value;
  });

  const tipLabel = document.createElement("label");
  tipLabel.textContent = "Propina";
  const tipInput = document.createElement("input");
  tipInput.type = "number";
  tipInput.min = "0";
  tipInput.step = "0.5";
  tipInput.value = state.tipAmount;
  tipInput.className = "tip-input";
  tipInput.placeholder = "0.00";
  tipInput.addEventListener("input", (event) => {
    state.tipAmount = event.target.value;
  });

  const totalPending = getPendingOrdersForTable(state.selectedTableId || 0).reduce(
    (sum, order) => sum + order.total,
    0
  );

  const pendingLabel = document.createElement("p");
  pendingLabel.textContent = `Pendiente por cobrar: $${totalPending.toFixed(2)}`;

  const payButton = document.createElement("button");
  payButton.className = "primary-button";
  payButton.textContent = "Registrar pago";
  payButton.disabled = !state.selectedTableId || totalPending <= 0 || state.isLoading;
  payButton.addEventListener("click", registerPayment);

  paymentSection.append(
    methodLabel,
    methodSelect,
    tipLabel,
    tipInput,
    pendingLabel,
    payButton
  );

  card.appendChild(paymentSection);

  const inventorySection = document.createElement("div");
  inventorySection.className = "inventory-list";

  const inventoryEntries = Object.entries(state.inventory).sort(
    ([_aId, a], [_bId, b]) => a.stock - b.stock
  );

  inventoryEntries.forEach(([productId, entry]) => {
    const row = document.createElement("div");
    row.className = "inventory-row";
    if (entry.stock <= entry.min) {
      row.classList.add("low");
    }
    const name = entry.name || productId;
    row.innerHTML = `
      <span>${name}</span>
      <strong>${entry.stock}</strong>
    `;
    inventorySection.appendChild(row);
  });

  card.appendChild(inventorySection);

  if (state.dashboard) {
    const metrics = document.createElement("div");
    metrics.className = "dashboard-grid";

    [
      {
        label: "Ventas del día",
        value: `$${state.dashboard.totalSales.toFixed(2)}`,
      },
      {
        label: "Pedidos abiertos",
        value: state.dashboard.openOrders,
      },
      {
        label: "Ticket promedio",
        value: `$${state.dashboard.averageTicket.toFixed(2)}`,
      },
    ].forEach((metric) => {
      const box = document.createElement("div");
      box.className = "metric";
      box.innerHTML = `<span>${metric.label}</span><strong>${metric.value}</strong>`;
      metrics.appendChild(box);
    });

    const history = document.createElement("div");
    history.className = "order-history";
    state.orders
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .forEach((order) => {
        const chip = document.createElement("div");
        chip.className = "order-chip";
        chip.textContent = `Mesa ${order.tableId} · ${order.status} · $${order.total.toFixed(
          2
        )}`;
        history.appendChild(chip);
      });

    if (state.dashboard.topProducts?.length) {
      const topList = document.createElement("div");
      topList.className = "inventory-list";
      const heading = document.createElement("h3");
      heading.textContent = "Top productos";
      topList.appendChild(heading);

      state.dashboard.topProducts.forEach((product) => {
        const row = document.createElement("div");
        row.className = "inventory-row";
        row.innerHTML = `
          <span>${product.name}</span>
          <strong>${product.quantity}</strong>
        `;
        topList.appendChild(row);
      });

      card.appendChild(topList);
    }

    card.appendChild(metrics);
    card.appendChild(history);
  }

  return card;
}

render();
