app.get("/csrf-token", (req, res) => {
  const token = crypto.randomBytes(24).toString("hex");
  req.session.csrfToken = token;
  res.json({ csrfToken: token });
});

function requireCsrf(req, res, next) {
  const sent = req.headers["x-csrf-token"];
  if (!sent || sent !== req.session.csrfToken) {
    return res.status(403).json({ message: "Invalid CSRF token" });
  }
  next();
}
