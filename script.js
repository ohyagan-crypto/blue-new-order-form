const fallbackMenu = {
  mains: [
    { id: "main", name: "主餐", subs: [{ items: ["bento-a", "bento-b", "bento-c"] }] },
    { id: "drink", name: "飲品", subs: [{ items: ["tea", "coffee", "sparkling"] }] },
    { id: "addon", name: "加購", subs: [{ items: ["egg", "salad", "soup"] }] }
  ],
  items: [
    { id: "bento-a", name: "藍新招牌便當", price: "$120", description: "企業會議適合，附主菜、配菜與白飯。" },
    { id: "bento-b", name: "科技人輕食盒", price: "$110", description: "清爽低負擔，適合午間會議。" },
    { id: "bento-c", name: "主管精選餐盒", price: "$150", description: "升級主菜與季節配菜。" },
    { id: "tea", name: "冷泡茶", price: "$40", description: "無糖茶飲，可備註冰量。" },
    { id: "coffee", name: "美式咖啡", price: "$55", description: "熱飲或冰飲請於備註填寫。" },
    { id: "sparkling", name: "氣泡水", price: "$45", description: "清爽解膩。" },
    { id: "egg", name: "溫泉蛋", price: "$25", description: "可加在餐盒或單點。" },
    { id: "salad", name: "鮮蔬沙拉", price: "$60", description: "附和風醬。" },
    { id: "soup", name: "今日湯品", price: "$35", description: "依現場供應為準。" }
  ]
};

const state = {
  categories: [],
  itemsById: new Map(),
  activeCategory: "all",
  cart: new Map(),
  query: "",
  sort: "default"
};

const categoryTabs = document.querySelector("#categoryTabs");
const menuList = document.querySelector("#menuList");
const cartItems = document.querySelector("#cartItems");
const totalCount = document.querySelector("#totalCount");
const totalPrice = document.querySelector("#totalPrice");
const sourceState = document.querySelector("#sourceState");
const searchInput = document.querySelector("#searchInput");
const sortSelect = document.querySelector("#sortSelect");
const clearCart = document.querySelector("#clearCart");
const submitOrder = document.querySelector("#submitOrder");
const orderDialog = document.querySelector("#orderDialog");
const orderSummary = document.querySelector("#orderSummary");
const closeDialog = document.querySelector("#closeDialog");
const copySummary = document.querySelector("#copySummary");
const orderNote = document.querySelector("#orderNote");
const orderCode = document.querySelector("#orderCode");

function moneyToNumber(value) {
  const number = Number(String(value || "0").replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function formatMoney(value) {
  return `$${Number(value || 0).toLocaleString("zh-TW")}`;
}

function normalizeMenu(menu) {
  const rawItems = Array.isArray(menu.items) ? menu.items : [];
  const itemsById = new Map(rawItems.map((item) => {
    const price = moneyToNumber(item.price || item.originPrice);
    return [String(item.id), {
      id: String(item.id),
      name: item.name || "未命名餐點",
      price,
      description: item.description || item.hint || "可加入藍新科技訂單。",
      rawPrice: item.price || formatMoney(price)
    }];
  }));

  const categories = (Array.isArray(menu.mains) ? menu.mains : []).map((main) => {
    const ids = (main.subs || []).flatMap((sub) => sub.items || []).map(String).filter((id) => itemsById.has(id));
    return { id: String(main.id), name: main.name || "分類", itemIds: [...new Set(ids)] };
  }).filter((category) => category.itemIds.length);

  return { categories, itemsById };
}

function setMenu(menu, message) {
  const normalized = normalizeMenu(menu);
  state.categories = [{ id: "all", name: "全部", itemIds: [...normalized.itemsById.keys()] }, ...normalized.categories];
  state.itemsById = normalized.itemsById;
  state.activeCategory = "all";
  sourceState.textContent = message;
  render();
}

async function loadMenu() {
  setMenu(fallbackMenu, "已載入藍新科技示範菜單");
}

function visibleItems() {
  const category = state.categories.find((item) => item.id === state.activeCategory) || state.categories[0];
  const query = state.query.trim().toLowerCase();
  let items = (category?.itemIds || [])
    .map((id) => state.itemsById.get(id))
    .filter(Boolean)
    .filter((item) => !query || item.name.toLowerCase().includes(query) || item.description.toLowerCase().includes(query));

  if (state.sort === "name") {
    items = items.slice().sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
  }
  return items;
}

function renderTabs() {
  categoryTabs.innerHTML = "";
  state.categories.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tab${category.id === state.activeCategory ? " active" : ""}`;
    button.textContent = `${category.name} ${category.itemIds.length}`;
    button.addEventListener("click", () => {
      state.activeCategory = category.id;
      render();
    });
    categoryTabs.appendChild(button);
  });
}

function renderMenu() {
  const items = visibleItems();
  menuList.innerHTML = "";
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "cart-items empty";
    empty.textContent = "沒有符合的餐點";
    menuList.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "menu-item";
    card.innerHTML = `
      <div>
        <h3></h3>
        <p></p>
      </div>
      <div class="menu-meta">
        <span class="price"></span>
        <button class="add-button" type="button">加入</button>
      </div>
    `;
    card.querySelector("h3").textContent = item.name;
    card.querySelector("p").textContent = item.description;
    card.querySelector(".price").textContent = formatMoney(item.price);
    card.querySelector("button").addEventListener("click", () => addToCart(item.id));
    menuList.appendChild(card);
  });
}

function addToCart(id) {
  const item = state.itemsById.get(id);
  if (!item) return;
  const current = state.cart.get(id) || { item, qty: 0 };
  current.qty += 1;
  state.cart.set(id, current);
  renderCart();
}

function changeQty(id, delta) {
  const current = state.cart.get(id);
  if (!current) return;
  current.qty += delta;
  if (current.qty <= 0) state.cart.delete(id);
  renderCart();
}

function renderCart() {
  cartItems.innerHTML = "";
  const rows = [...state.cart.values()];
  if (!rows.length) {
    cartItems.className = "cart-items empty";
    cartItems.textContent = "尚未加入餐點";
  } else {
    cartItems.className = "cart-items";
    rows.forEach(({ item, qty }) => {
      const row = document.createElement("div");
      row.className = "cart-row";
      row.innerHTML = `
        <div>
          <h3></h3>
          <small></small>
        </div>
        <div class="qty">
          <button class="qty-button" type="button" aria-label="減少">-</button>
          <span></span>
          <button class="qty-button" type="button" aria-label="增加">+</button>
        </div>
      `;
      row.querySelector("h3").textContent = item.name;
      row.querySelector("small").textContent = `${formatMoney(item.price)} / 小計 ${formatMoney(item.price * qty)}`;
      row.querySelector("span").textContent = qty;
      const [minus, plus] = row.querySelectorAll("button");
      minus.addEventListener("click", () => changeQty(item.id, -1));
      plus.addEventListener("click", () => changeQty(item.id, 1));
      cartItems.appendChild(row);
    });
  }

  const count = rows.reduce((sum, row) => sum + row.qty, 0);
  const total = rows.reduce((sum, row) => sum + row.qty * row.item.price, 0);
  totalCount.textContent = count;
  totalPrice.textContent = formatMoney(total);
}

function buildSummary() {
  const rows = [...state.cart.values()];
  if (!rows.length) return "目前尚未加入餐點。";
  const lines = [
    "藍新科技點餐單",
    `訂單代號：${orderCode.textContent}`,
    "",
    ...rows.map(({ item, qty }) => `- ${item.name} x ${qty}，小計 ${formatMoney(item.price * qty)}`),
    "",
    `品項數：${rows.reduce((sum, row) => sum + row.qty, 0)}`,
    `總金額：${formatMoney(rows.reduce((sum, row) => sum + row.qty * row.item.price, 0))}`,
    `備註：${orderNote.value.trim() || "無"}`
  ];
  return lines.join("\n");
}

function render() {
  renderTabs();
  renderMenu();
  renderCart();
}

searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  renderMenu();
});

sortSelect.addEventListener("change", (event) => {
  state.sort = event.target.value;
  renderMenu();
});

clearCart.addEventListener("click", () => {
  state.cart.clear();
  renderCart();
});

submitOrder.addEventListener("click", () => {
  orderSummary.textContent = buildSummary();
  orderDialog.showModal();
});

closeDialog.addEventListener("click", () => orderDialog.close());

copySummary.addEventListener("click", async () => {
  const text = orderSummary.textContent;
  await navigator.clipboard.writeText(text);
  copySummary.textContent = "已複製";
  setTimeout(() => {
    copySummary.textContent = "複製摘要";
  }, 1200);
});

loadMenu();
