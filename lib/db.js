/**
 * ChatNest custom database layer.
 *
 * This is a hand-built, file-based JSON "database" — no third-party
 * database service is used. Collections:
 *   data/users.json              -> [ { id, name, email, password, color } ]
 *   data/messages/<chatId>.json  -> [ { id, from, text, mediaId, time, status } ]
 *   data/media/<mediaId>.json    -> { dataUrl, name, size, type }
 *
 * IMPORTANT: On Vercel, serverless functions can only write to /tmp, and
 * /tmp is wiped between cold starts and is NOT shared across instances.
 * That means on Vercel this data will NOT persist reliably in production.
 * Locally, or on a normal Node server / VPS with a persistent disk, this
 * data persists exactly like a real file-based database. See README.md.
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = process.env.VERCEL
  ? "/tmp/chatnest-data"
  : path.join(process.cwd(), "data");

const USERS_FILE = path.join(DATA_DIR, "users.json");
const MESSAGES_DIR = path.join(DATA_DIR, "messages");
const MEDIA_DIR = path.join(DATA_DIR, "media");

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(MESSAGES_DIR)) fs.mkdirSync(MESSAGES_DIR, { recursive: true });
  if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

function readJSON(file, fallback) {
  try {
    ensureDirs();
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, "utf8");
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function writeJSON(file, data) {
  ensureDirs();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function safeChatKey(email) {
  // Keep filenames filesystem-safe.
  return String(email).replace(/[^a-zA-Z0-9@._-]/g, "_");
}

function chatIdFor(a, b) {
  return [safeChatKey(a), safeChatKey(b)].sort().join("__");
}

const DEMO_USER = {
  id: 0,
  name: "Demo User",
  email: "demo@chatnest.com",
  password: "nestling6",
  color: "#4A7C59",
};

module.exports = {
  chatIdFor,

  getUsers() {
    const users = readJSON(USERS_FILE, null);
    if (users === null) {
      writeJSON(USERS_FILE, [DEMO_USER]);
      return [DEMO_USER];
    }
    return users;
  },

  saveUsers(users) {
    writeJSON(USERS_FILE, users);
  },

  getMessages(chatId) {
    return readJSON(path.join(MESSAGES_DIR, `${chatId}.json`), []);
  },

  saveMessages(chatId, messages) {
    writeJSON(path.join(MESSAGES_DIR, `${chatId}.json`), messages);
  },

  getMedia(id) {
    return readJSON(path.join(MEDIA_DIR, `${id}.json`), null);
  },

  saveMedia(id, payload) {
    writeJSON(path.join(MEDIA_DIR, `${id}.json`), payload);
  },
};
