/* ChatNest frontend — plain JS, talks to the /api serverless functions. */

const AVATAR_COLORS = ["#84A98C", "#E07A5F", "#4A7C59", "#B08968", "#6B8F71"];
const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;

let currentUser = JSON.parse(localStorage.getItem("chatnest_user") || "null");
let directory = [];
let previews = {};
let activeEmail = null;
let messages = [];
let mediaCache = {};
let messagePollTimer = null;
let directoryPollTimer = null;

/* ---------- helpers ---------- */
function initials(name) {
  return (name || "?")
    .replace(/[^\w\s]/g, "")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function avatarEl(contact, size) {
  const el = document.createElement("div");
  el.className = "avatar " + size;
  el.style.background = contact.color || "#84A98C";
  el.textContent = initials(contact.name);
  return el;
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

/* ---------- auth screen ---------- */
const authScreen = document.getElementById("auth-screen");
const appScreen = document.getElementById("app-screen");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");

document.querySelectorAll(".auth-tab").forEach((tab) => {
  tab.addEventListener("click", () => switchAuthMode(tab.dataset.mode));
});
document.querySelectorAll("[data-switch]").forEach((el) => {
  el.addEventListener("click", () => switchAuthMode(el.dataset.switch));
});

function switchAuthMode(mode) {
  document.querySelectorAll(".auth-tab").forEach((t) => t.classList.toggle("active", t.dataset.mode === mode));
  loginForm.classList.toggle("hidden", mode !== "login");
  registerForm.classList.toggle("hidden", mode !== "register");
  document.getElementById("login-error").textContent = "";
  document.getElementById("register-error").textContent = "";
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("login-error");
  const btn = document.getElementById("login-btn");
  errEl.textContent = "";
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  btn.disabled = true;
  btn.textContent = "Logging in…";
  try {
    const { user } = await api("/api/login", { method: "POST", body: { email, password } });
    setCurrentUser(user);
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = "Log in";
  }
});

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("register-error");
  const btn = document.getElementById("register-btn");
  errEl.textContent = "";
  const name = document.getElementById("register-name").value.trim();
  const email = document.getElementById("register-email").value.trim();
  const password = document.getElementById("register-password").value;
  const confirm = document.getElementById("register-confirm").value;
  if (password !== confirm) {
    errEl.textContent = "Passwords don't match.";
    return;
  }
  btn.disabled = true;
  btn.textContent = "Creating account…";
  try {
    const { user } = await api("/api/register", { method: "POST", body: { name, email, password } });
    setCurrentUser(user);
  } catch (err) {
    errEl.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = "Create account";
  }
});

function setCurrentUser(user) {
  currentUser = user;
  localStorage.setItem("chatnest_user", JSON.stringify(user));
  showApp();
}

function logout() {
  currentUser = null;
  activeEmail = null;
  localStorage.removeItem("chatnest_user");
  clearInterval(messagePollTimer);
  clearInterval(directoryPollTimer);
  authScreen.classList.remove("hidden");
  appScreen.classList.add("hidden");
  loginForm.reset();
  registerForm.reset();
}
document.getElementById("logout-btn").addEventListener("click", logout);

/* ---------- app screen ---------- */
function showApp() {
  authScreen.classList.add("hidden");
  appScreen.classList.remove("hidden");

  document.getElementById("me-avatar").replaceWith(withId(avatarEl(currentUser, "small"), "me-avatar"));
  document.getElementById("me-name").textContent = currentUser.name;
  document.getElementById("me-email").textContent = currentUser.email;

  loadDirectory();
  directoryPollTimer = setInterval(loadDirectory, 6000);
}

function withId(el, id) {
  el.id = id;
  return el;
}

async function loadDirectory() {
  try {
    const { users } = await api(`/api/users?exclude=${encodeURIComponent(currentUser.email)}`);
    directory = users;
    await Promise.all(
      directory.map(async (u) => {
        try {
          const { messages: msgs } = await api(
            `/api/messages?a=${encodeURIComponent(currentUser.email)}&b=${encodeURIComponent(u.email)}`
          );
          const last = msgs[msgs.length - 1];
          previews[u.email] = last
            ? { text: last.mediaId ? "📷 Photo" : last.text, time: last.time, from: last.from }
            : null;
        } catch {
          previews[u.email] = null;
        }
      })
    );
    renderContactList();
  } catch {
    /* silent — will retry on next poll */
  }
}

function renderContactList() {
  const list = document.getElementById("contact-list");
  const query = document.getElementById("search-input").value.toLowerCase();
  const filtered = directory.filter((c) => c.name.toLowerCase().includes(query));
  list.innerHTML = "";

  if (filtered.length === 0) {
    const note = document.createElement("div");
    note.className = "empty-note";
    note.textContent = directory.length === 0
      ? "No one else has registered yet — open ChatNest in another tab and create a second account to try messaging."
      : `No people match "${query}"`;
    list.appendChild(note);
    return;
  }

  filtered.forEach((c) => {
    const item = document.createElement("div");
    item.className = "contact-item" + (c.email === activeEmail ? " active" : "");
    item.appendChild(avatarEl(c, "medium"));

    const text = document.createElement("div");
    text.className = "contact-text";
    const p = previews[c.email];
    text.innerHTML = `
      <div class="contact-row">
        <span class="contact-name"></span>
        <span class="contact-time">${p ? p.time : ""}</span>
      </div>
      <div class="contact-preview"></div>
    `;
    text.querySelector(".contact-name").textContent = c.name;
    text.querySelector(".contact-preview").textContent = p
      ? (p.from === currentUser.email ? "You: " : "") + p.text
      : "Say hello 👋";

    item.appendChild(text);
    item.addEventListener("click", () => openChat(c.email));
    list.appendChild(item);
  });
}

document.getElementById("search-input").addEventListener("input", renderContactList);

function openChat(email) {
  activeEmail = email;
  const contact = directory.find((c) => c.email === email);
  if (!contact) return;

  document.getElementById("chat-empty").classList.add("hidden");
  document.getElementById("chat-active").classList.remove("hidden");
  document.getElementById("sidebar").style.display = window.innerWidth <= 680 ? "none" : "flex";

  document.getElementById("active-avatar").replaceWith(withId(avatarEl(contact, "medium"), "active-avatar"));
  document.getElementById("active-name").textContent = contact.name;
  document.getElementById("active-email").textContent = contact.email;

  renderContactList();
  clearInterval(messagePollTimer);
  loadMessages();
  messagePollTimer = setInterval(loadMessages, 3000);
}

document.getElementById("back-btn").addEventListener("click", () => {
  document.getElementById("sidebar").style.display = "flex";
  document.getElementById("chat-active").classList.add("hidden");
  document.getElementById("chat-empty").classList.remove("hidden");
});

async function loadMessages() {
  if (!activeEmail) return;
  try {
    const { messages: msgs } = await api(
      `/api/messages?a=${encodeURIComponent(currentUser.email)}&b=${encodeURIComponent(activeEmail)}&viewer=${encodeURIComponent(currentUser.email)}`
    );
    messages = msgs;

    const missingIds = [...new Set(msgs.filter((m) => m.mediaId).map((m) => m.mediaId))].filter((id) => !mediaCache[id]);
    if (missingIds.length) {
      await Promise.all(
        missingIds.map(async (id) => {
          try {
            const media = await api(`/api/media?id=${encodeURIComponent(id)}`);
            mediaCache[id] = media;
          } catch {
            /* ignore missing media */
          }
        })
      );
    }
    renderMessages();
  } catch {
    /* silent — will retry on next poll */
  }
}

function renderMessages() {
  const box = document.getElementById("messages");
  const wasAtBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 20;
  box.innerHTML = "";

  if (messages.length === 0) {
    const contact = directory.find((c) => c.email === activeEmail);
    const empty = document.createElement("div");
    empty.className = "empty-thread";
    empty.textContent = `No messages yet — say hello to ${contact ? contact.name.split(" ")[0] : "them"} 🌿`;
    box.appendChild(empty);
    return;
  }

  messages.forEach((m) => {
    const row = document.createElement("div");
    row.className = "msg-row " + (m.from === currentUser.email ? "me" : "them");

    const bubble = document.createElement("div");
    bubble.className = "bubble";

    if (m.mediaId) {
      const media = mediaCache[m.mediaId];
      if (media) {
        const img = document.createElement("img");
        img.src = media.dataUrl;
        img.alt = media.name || "attachment";
        bubble.appendChild(img);
      } else {
        const loading = document.createElement("div");
        loading.className = "media-loading";
        loading.textContent = "⏳";
        bubble.appendChild(loading);
      }
    }

    if (m.text) {
      const textEl = document.createElement("div");
      textEl.className = "bubble-text";
      textEl.textContent = m.text;
      bubble.appendChild(textEl);
    }

    const meta = document.createElement("div");
    meta.className = "bubble-meta";
    meta.innerHTML = `<span>${m.time}</span>`;
    if (m.from === currentUser.email) {
      const tick = document.createElement("span");
      tick.textContent = m.status === "read" ? "✓✓" : "✓";
      tick.style.color = m.status === "read" ? "#4A7C59" : "#A79E8F";
      meta.appendChild(tick);
    }
    bubble.appendChild(meta);

    row.appendChild(bubble);
    box.appendChild(row);
  });

  if (wasAtBottom) box.scrollTop = box.scrollHeight;
}

/* ---------- sending ---------- */
const draftInput = document.getElementById("draft-input");
const sendBtn = document.getElementById("send-btn");
const bannerEl = document.getElementById("banner");
const bannerText = document.getElementById("banner-text");

document.getElementById("banner-close").addEventListener("click", () => bannerEl.classList.add("hidden"));

function showBanner(text) {
  bannerText.textContent = text;
  bannerEl.classList.remove("hidden");
}

draftInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
});
sendBtn.addEventListener("click", () => sendMessage());

async function sendMessage(extra = {}) {
  const text = draftInput.value.trim();
  if (!text && !extra.mediaId) return;
  if (!activeEmail) return;

  sendBtn.disabled = true;
  try {
    await api("/api/messages", {
      method: "POST",
      body: { a: currentUser.email, b: activeEmail, message: { from: currentUser.email, text, ...extra } },
    });
    draftInput.value = "";
    await loadMessages();
    await loadDirectory();
  } catch (err) {
    showBanner(err.message || "Couldn't send — try again.");
  } finally {
    sendBtn.disabled = false;
  }
}

/* ---------- attachments ---------- */
const fileInput = document.getElementById("file-input");
document.getElementById("attach-btn").addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  fileInput.value = "";
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    showBanner("Only image attachments are supported right now.");
    return;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    showBanner("That image is too large — keep attachments under 1.5MB.");
    return;
  }

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  try {
    const { id } = await api("/api/media", {
      method: "POST",
      body: { dataUrl, name: file.name, size: file.size, type: file.type },
    });
    mediaCache[id] = { dataUrl, name: file.name, size: file.size, type: file.type };
    await sendMessage({ mediaId: id });
  } catch (err) {
    showBanner(err.message || "Couldn't upload that image.");
  }
});

/* ---------- boot ---------- */
if (currentUser) {
  showApp();
}
