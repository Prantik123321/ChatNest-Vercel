const db = require("../lib/db");

module.exports = (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Enter your email and password." });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const users = db.getUsers();
  const user = users.find((u) => u.email === normalizedEmail);

  if (!user || user.password !== password) {
    return res.status(401).json({ error: "That email or password doesn't match our records." });
  }

  const { password: _pw, ...publicUser } = user;
  res.status(200).json({ user: publicUser });
};
