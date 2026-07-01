const db = require("../lib/db");

const COLORS = ["#84A98C", "#E07A5F", "#4A7C59", "#B08968", "#6B8F71"];

module.exports = (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name, email, password } = req.body || {};

  if (!name || !name.trim() || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password are required." });
  }
  const normalizedEmail = String(email).trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: "Password should be at least 6 characters." });
  }

  const users = db.getUsers();
  if (users.some((u) => u.email === normalizedEmail)) {
    return res.status(409).json({ error: "An account with that email already exists." });
  }

  const user = {
    id: Date.now(),
    name: name.trim(),
    email: normalizedEmail,
    password,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  };
  users.push(user);
  db.saveUsers(users);

  const { password: _pw, ...publicUser } = user;
  res.status(200).json({ user: publicUser });
};
