const db = require("../lib/db");

module.exports = (req, res) => {
  if (req.method === "GET") {
    const { a, b, viewer } = req.query;
    if (!a || !b) {
      return res.status(400).json({ error: "Both participants (a, b) are required." });
    }
    const chatId = db.chatIdFor(a, b);
    let messages = db.getMessages(chatId);

    if (viewer) {
      let changed = false;
      messages = messages.map((m) => {
        if (m.from !== viewer && m.status !== "read") {
          changed = true;
          return { ...m, status: "read" };
        }
        return m;
      });
      if (changed) db.saveMessages(chatId, messages);
    }

    return res.status(200).json({ chatId, messages });
  }

  if (req.method === "POST") {
    const { a, b, message } = req.body || {};
    if (!a || !b || !message || !message.from) {
      return res.status(400).json({ error: "a, b, and a message with a from field are required." });
    }
    const chatId = db.chatIdFor(a, b);
    const messages = db.getMessages(chatId);
    const newMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      from: message.from,
      text: message.text || "",
      mediaId: message.mediaId || null,
      time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      status: "sent",
    };
    messages.push(newMessage);
    db.saveMessages(chatId, messages);
    return res.status(200).json({ chatId, message: newMessage });
  }

  res.status(405).json({ error: "Method not allowed" });
};
