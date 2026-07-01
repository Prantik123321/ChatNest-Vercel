# ChatNest

A WhatsApp-style messaging app: Node.js serverless functions on the backend,
plain HTML/CSS/JS on the frontend, and a **custom file-based database** — no
third-party database service anywhere.

## Project structure

```
chatnest/
├── index.html          Login/register + chat UI
├── styles.css           All styling (nest-inspired theme)
├── app.js                Frontend logic — talks to /api endpoints
├── api/
│   ├── register.js        POST — create an account
│   ├── login.js            POST — log in
│   ├── users.js             GET — list of registered people
│   ├── messages.js          GET/POST — a conversation thread
│   └── media.js              GET/POST — image attachments
├── lib/
│   └── db.js                Custom JSON file "database" (the whole point)
└── data/                     Where the database actually lives
    ├── users.json
    ├── messages/<chatId>.json
    └── media/<mediaId>.json
```

`lib/db.js` is the entire database: no ORM, no external service, just
Node's built-in `fs` module reading and writing JSON files, with a schema
and query logic I wrote specifically for this app (users, per-conversation
message threads, and a media store for attachments).

## Running it locally

```bash
npm install -g vercel   # if you don't have it already
cd chatnest
vercel dev
```

Then open the URL it prints (usually `http://localhost:3000`). Register a
second account in a private/incognito tab to message between two accounts.

A demo account is seeded automatically the first time the app runs:
**demo@chatnest.com / nestling6**

## Deploying to Vercel

```bash
vercel
```

Follow the prompts. No environment variables or build step are required —
this is a zero-config static site + serverless functions project.

## ⚠️ Read this before you rely on it in production

**On Vercel, this database will not persist reliably.** Serverless
functions can only write to `/tmp`, and `/tmp`:

- is wiped whenever a function has a "cold start"
- is **not shared** between different serverless instances handling your traffic

So in practice: it'll work fine for a demo, for testing, and for short
bursts of use, but registered accounts and messages can silently disappear,
and two people hitting different server instances may not even see each
other's messages consistently.

**If you self-host this instead** — a VPS, Render, Railway, Fly.io, or any
platform that gives you a persistent disk and a long-running Node
process — the exact same code will behave like a real, durable database,
because the files actually stick around between requests.

**If you want to keep deploying to Vercel with real persistence**, the
practical options are:
1. Attach a real database (Vercel Postgres, Vercel KV, or any hosted DB) —
   this means giving up the "no third-party database" constraint, but it's
   the standard, secure way to do this.
2. Self-host the Node server somewhere with persistent disk instead.

## Other things to know

- **Passwords are stored in plain text.** This is a prototype auth system,
  not a secure one. Don't reuse a real password when testing it.
- **Images are capped at 1.5MB** to stay well under serverless request
  size limits.
- **No real-time push** — the frontend polls every 3 seconds for new
  messages in the open chat, and every 6 seconds for the contact list.
  Good enough for a demo; a production app would use WebSockets or
  Server-Sent Events instead.
