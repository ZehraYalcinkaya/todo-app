// ============================================
// Supabase Yapılandırması
// ============================================
const SUPABASE_URL     = "https://rzuspqlqfcbmqebgxyve.supabase.co";
const SUPABASE_ANON    = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6dXNwcWxxZmNibXFlYmd4eXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1OTE4MjQsImV4cCI6MjA5NjE2NzgyNH0.lL24vW6o4ACuFIvnuwfooFS6PNH9SZGNktZxmmjNl3Q";
const AUTH_URL         = `${SUPABASE_URL}/auth/v1`;
const REST_URL         = `${SUPABASE_URL}/rest/v1/todos`;

// ============================================
// Durum
// ============================================
let session     = null;   // { access_token, user }
let todos       = [];
let currentFilter = "all";

// ============================================
// Auth Yardımcıları
// ============================================
function authHeaders() {
  return {
    "apikey":        SUPABASE_ANON,
    "Authorization": `Bearer ${session.access_token}`,
    "Content-Type":  "application/json",
    "Prefer":        "return=representation",
  };
}

async function signUp(email, password) {
  const res = await fetch(`${AUTH_URL}/signup`, {
    method: "POST",
    headers: { "apikey": SUPABASE_ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || data.message || "Kayıt başarısız");
  return data;
}

async function signIn(email, password) {
  const res = await fetch(`${AUTH_URL}/token?grant_type=password`, {
    method: "POST",
    headers: { "apikey": SUPABASE_ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || "Giriş başarısız");
  return data; // { access_token, refresh_token, user, ... }
}

async function signOut() {
  await fetch(`${AUTH_URL}/logout`, {
    method: "POST",
    headers: { "apikey": SUPABASE_ANON, "Authorization": `Bearer ${session.access_token}` },
  });
}

// ============================================
// REST API Yardımcıları
// ============================================
async function apiGet() {
  const res = await fetch(`${REST_URL}?order=created_at.asc`, { headers: authHeaders() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiPost(body) {
  const res = await fetch(REST_URL, {
    method: "POST", headers: authHeaders(),
    body: JSON.stringify({ ...body, user_id: session.user.id }),
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json())[0];
}

async function apiPatch(id, body) {
  const res = await fetch(`${REST_URL}?id=eq.${id}`, {
    method: "PATCH", headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json())[0];
}

async function apiDelete(id) {
  const res = await fetch(`${REST_URL}?id=eq.${id}`, {
    method: "DELETE", headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
}

async function apiDeleteCompleted() {
  const res = await fetch(`${REST_URL}?completed=eq.true`, {
    method: "DELETE", headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
}

// ============================================
// Ekranlar
// ============================================
function showApp(userData) {
  session = userData;
  localStorage.setItem("sb_session", JSON.stringify(userData));

  document.getElementById("auth-screen").classList.add("hidden");
  const appEl = document.getElementById("app-screen");
  appEl.classList.remove("hidden");

  document.getElementById("user-email-label").textContent = session.user.email;
  loadTodos();
}

function showAuth() {
  session = null;
  localStorage.removeItem("sb_session");
  todos = [];

  document.getElementById("app-screen").classList.add("hidden");
  document.getElementById("auth-screen").classList.remove("hidden");

  document.getElementById("login-error").textContent = "";
  document.getElementById("reg-error").textContent = "";
}

// ============================================
// Render
// ============================================
function render() {
  const list = document.getElementById("todo-list");
  list.innerHTML = "";

  const filtered = todos.filter(t => {
    if (currentFilter === "active")    return !t.completed;
    if (currentFilter === "completed") return  t.completed;
    return true;
  });

  if (filtered.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "Henüz görev yok.";
    list.appendChild(li);
  } else {
    filtered.forEach(todo => {
      const li = document.createElement("li");
      li.className = "todo-item" + (todo.completed ? " completed" : "");

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = todo.completed;
      cb.addEventListener("change", () => toggleTodo(todo.id, !todo.completed));

      const span = document.createElement("span");
      span.className = "text";
      span.textContent = todo.text;

      const del = document.createElement("button");
      del.className = "delete-btn";
      del.innerHTML = "&times;";
      del.title = "Sil";
      del.addEventListener("click", () => deleteTodo(todo.id));

      li.append(cb, span, del);
      list.appendChild(li);
    });
  }

  const remaining = todos.filter(t => !t.completed).length;
  document.getElementById("item-count").textContent = `${remaining} görev kaldı`;
}

function showError(msg) {
  const existing = document.querySelector(".error-banner");
  if (existing) existing.remove();
  const div = document.createElement("div");
  div.className = "error-banner";
  div.textContent = "⚠️ " + msg;
  document.getElementById("todo-list").before(div);
  setTimeout(() => div.remove(), 4000);
}

// ============================================
// Todo İşlemleri
// ============================================
async function loadTodos() {
  try {
    todos = await apiGet();
    render();
  } catch (e) { showError("Yüklenemedi: " + e.message); }
}

async function addTodo(text) {
  try {
    const t = await apiPost({ text, completed: false });
    todos.push(t);
    render();
  } catch (e) { showError("Eklenemedi: " + e.message); }
}

async function toggleTodo(id, completed) {
  todos = todos.map(t => t.id === id ? { ...t, completed } : t);
  render();
  try { await apiPatch(id, { completed }); }
  catch (e) {
    todos = todos.map(t => t.id === id ? { ...t, completed: !completed } : t);
    render(); showError("Güncellenemedi: " + e.message);
  }
}

async function deleteTodo(id) {
  const backup = [...todos];
  todos = todos.filter(t => t.id !== id);
  render();
  try { await apiDelete(id); }
  catch (e) { todos = backup; render(); showError("Silinemedi: " + e.message); }
}

async function clearCompleted() {
  const backup = [...todos];
  todos = todos.filter(t => !t.completed);
  render();
  try { await apiDeleteCompleted(); }
  catch (e) { todos = backup; render(); showError("Temizlenemedi: " + e.message); }
}

// ============================================
// Auth Olayları
// ============================================

// Sekme geçişi (data-tab özelliği olan filtre butonları)
document.querySelectorAll(".filter-btn[data-tab]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter-btn[data-tab]").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    document.getElementById("login-form").classList.toggle("hidden",    tab !== "login");
    document.getElementById("register-form").classList.toggle("hidden", tab !== "register");
    document.getElementById("login-error").textContent = "";
    document.getElementById("reg-error").textContent = "";
  });
});

// Giriş
document.getElementById("login-form").addEventListener("submit", async e => {
  e.preventDefault();
  const email    = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const btn      = document.getElementById("login-btn");
  const errEl    = document.getElementById("login-error");
  errEl.textContent = "";
  btn.disabled = true; btn.textContent = "Giriş yapılıyor…";
  try {
    const data = await signIn(email, password);
    showApp({ access_token: data.access_token, refresh_token: data.refresh_token, user: data.user });
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    btn.disabled = false; btn.textContent = "Giriş Yap";
  }
});

// Kayıt
document.getElementById("register-form").addEventListener("submit", async e => {
  e.preventDefault();
  const email  = document.getElementById("reg-email").value.trim();
  const pass1  = document.getElementById("reg-password").value;
  const pass2  = document.getElementById("reg-password2").value;
  const btn    = document.getElementById("reg-btn");
  const errEl  = document.getElementById("reg-error");
  errEl.textContent = "";

  if (pass1 !== pass2) { errEl.textContent = "Şifreler eşleşmiyor."; return; }

  btn.disabled = true; btn.textContent = "Kaydediliyor…";
  try {
    const data = await signUp(email, pass1);
    // Otomatik onaylı → hemen giriş yap
    const loginData = await signIn(email, pass1);
    showApp({ access_token: loginData.access_token, refresh_token: loginData.refresh_token, user: loginData.user });
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    btn.disabled = false; btn.textContent = "Kayıt Ol";
  }
});

// Çıkış
document.getElementById("logout-btn").addEventListener("click", async () => {
  try { await signOut(); } catch (_) {}
  showAuth();
});

// Todo form
document.getElementById("todo-form").addEventListener("submit", async e => {
  e.preventDefault();
  const text = document.getElementById("todo-input").value.trim();
  if (!text) return;
  document.getElementById("todo-input").value = "";
  await addTodo(text);
  document.getElementById("todo-input").focus();
});

document.getElementById("clear-completed").addEventListener("click", clearCompleted);

document.querySelectorAll(".filter-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.filter;
    render();
  });
});

// ============================================
// Başlangıç — oturumu geri yükle
// ============================================
(function init() {
  const saved = localStorage.getItem("sb_session");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.access_token && parsed.user) { showApp(parsed); return; }
    } catch (_) {}
  }
  showAuth();
})();
