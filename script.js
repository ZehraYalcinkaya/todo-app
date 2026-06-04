// =============================================
// Supabase Yapılandırması
// =============================================
const SUPABASE_URL = "https://rzuspqlqfcbmqebgxyve.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6dXNwcWxxZmNibXFlYmd4eXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1OTE4MjQsImV4cCI6MjA5NjE2NzgyNH0.lL24vW6o4ACuFIvnuwfooFS6PNH9SZGNktZxmmjNl3Q";
const TABLE = "todos";

const headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

// =============================================
// REST API Yardımcıları
// =============================================
async function apiGet(filter = "") {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${TABLE}?order=created_at.asc${filter}`,
    { headers }
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiPost(body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data[0];
}

async function apiPatch(id, body) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${id}`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data[0];
}

async function apiDelete(id) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${id}`,
    { method: "DELETE", headers }
  );
  if (!res.ok) throw new Error(await res.text());
}

async function apiDeleteCompleted() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${TABLE}?completed=eq.true`,
    { method: "DELETE", headers }
  );
  if (!res.ok) throw new Error(await res.text());
}

// =============================================
// Durum & Elementler
// =============================================
let todos = [];
let currentFilter = "all";

const form = document.getElementById("todo-form");
const input = document.getElementById("todo-input");
const list = document.getElementById("todo-list");
const itemCount = document.getElementById("item-count");
const clearBtn = document.getElementById("clear-completed");
const filterBtns = document.querySelectorAll(".filter-btn");

// =============================================
// UI Yardımcıları
// =============================================
function setLoading(on) {
  form.querySelector("button").disabled = on;
  form.querySelector("button").textContent = on ? "..." : "Ekle";
}

function showError(msg) {
  const existing = document.querySelector(".error-banner");
  if (existing) existing.remove();
  const div = document.createElement("div");
  div.className = "error-banner";
  div.textContent = "⚠️ " + msg;
  list.before(div);
  setTimeout(() => div.remove(), 4000);
}

// =============================================
// Render
// =============================================
function render() {
  list.innerHTML = "";

  const filtered = todos.filter((t) => {
    if (currentFilter === "active") return !t.completed;
    if (currentFilter === "completed") return t.completed;
    return true;
  });

  if (filtered.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "Henüz görev yok.";
    list.appendChild(li);
  } else {
    filtered.forEach((todo) => {
      const li = document.createElement("li");
      li.className = "todo-item" + (todo.completed ? " completed" : "");

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = todo.completed;
      checkbox.addEventListener("change", () => toggleTodo(todo.id, !todo.completed));

      const span = document.createElement("span");
      span.className = "text";
      span.textContent = todo.text;

      const del = document.createElement("button");
      del.className = "delete-btn";
      del.innerHTML = "&times;";
      del.title = "Sil";
      del.addEventListener("click", () => deleteTodo(todo.id));

      li.append(checkbox, span, del);
      list.appendChild(li);
    });
  }

  const remaining = todos.filter((t) => !t.completed).length;
  itemCount.textContent = `${remaining} görev kaldı`;
}

// =============================================
// Supabase İşlemleri
// =============================================
async function loadTodos() {
  try {
    setLoading(true);
    todos = await apiGet();
    render();
  } catch (e) {
    showError("Görevler yüklenemedi: " + e.message);
  } finally {
    setLoading(false);
  }
}

async function addTodo(text) {
  try {
    setLoading(true);
    const newTodo = await apiPost({ text, completed: false });
    todos.push(newTodo);
    render();
  } catch (e) {
    showError("Görev eklenemedi: " + e.message);
  } finally {
    setLoading(false);
  }
}

async function toggleTodo(id, completed) {
  // Optimistik güncelleme
  todos = todos.map((t) => (t.id === id ? { ...t, completed } : t));
  render();
  try {
    await apiPatch(id, { completed });
  } catch (e) {
    // Geri al
    todos = todos.map((t) => (t.id === id ? { ...t, completed: !completed } : t));
    render();
    showError("Güncellenemedi: " + e.message);
  }
}

async function deleteTodo(id) {
  // Optimistik silme
  const backup = [...todos];
  todos = todos.filter((t) => t.id !== id);
  render();
  try {
    await apiDelete(id);
  } catch (e) {
    todos = backup;
    render();
    showError("Silinemedi: " + e.message);
  }
}

async function clearCompleted() {
  const backup = [...todos];
  todos = todos.filter((t) => !t.completed);
  render();
  try {
    await apiDeleteCompleted();
  } catch (e) {
    todos = backup;
    render();
    showError("Temizlenemedi: " + e.message);
  }
}

// =============================================
// Olaylar
// =============================================
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  await addTodo(text);
  input.focus();
});

clearBtn.addEventListener("click", clearCompleted);

filterBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    filterBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.filter;
    render();
  });
});

// =============================================
// Başlangıç — Supabase'den yükle
// =============================================
loadTodos();
