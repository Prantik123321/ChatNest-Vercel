const db = require("../lib/db");

const MAX_BYTES = 1.5 * 1024 * 1024;

module.exports = (req, res) => {
  if (req.method === "POST") {
    const { dataUrl, name, size, type } = req.body || {};
    if (!dataUrl || !type || !String(type).startsWith("image/")) {
      return res.status(400).json({ error: "Only image attachments are supported." });
    }
    if (size && size > MAX_BYTES) {
      return res.status(413).json({ error: "Image is too large — keep attachments under 1.5MB." });
    }
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    db.saveMedia(id, { dataUrl, name, size, type });
    return res.status(200).json({ id });
  }

  if (req.method === "GET") {
    const { id } = req.query;
    const media = db.getMedia(id);
    if (!media) return res.status(404).json({ error: "Not found" });
    return res.status(200).json(media);
  }

  res.status(405).json({ error: "Method not allowed" });
};
