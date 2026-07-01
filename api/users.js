const db = require("../lib/db");

module.exports = (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const exclude = String(req.query.exclude || "").trim().toLowerCase();
  const users = db
    .getUsers()
    .filter((u) => u.email !== exclude)
    .map(({ password, ...rest }) => rest);

  res.status(200).json({ users });
};
