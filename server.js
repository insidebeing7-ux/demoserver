const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const Groq = require("groq-sdk");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors({
  origin: ["https://kairos-7t1.pages.dev"],
  credentials: true
}));

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// simple in-memory CSRF token (no sessions/DB needed)
let csrfTokens = new Set();

app.get("/csrf-token", (req, res) => {
  const token = crypto.randomBytes(24).toString("hex");
  csrfTokens.add(token);
  res.json({ csrfToken: token });
});

function requireCsrf(req, res, next) {
  const token = req.headers["x-csrf-token"];
  if (!token || !csrfTokens.has(token)) {
    return res.status(403).json({ message: "Invalid CSRF token" });
  }
  next();
}

const SITE_CONTEXT = `
Site name: Kairos (Kairos.chat)
What it is: An automated messaging app. It replies to chats for you when you're
busy, suggests smart context-aware replies, and can be customized to sound like you.

Sections:
- "home" (#home): Hero section.
- "about" (#about): How it works.
- "signup" (/signup): Create account.

Features: Auto Reply, AI Mode, Smart Suggestions, Your Voice Always, Stay in Control, Phone App (coming soon).
`;

app.post("/site-ai", requireCsrf, async (req, res) => {
  const text = (req.body.text || "").slice(0, 300);
  if (!text) {
    return res.json({ reply: "Ask me anything about Kairos!", action: null, target: null });
  }

  const system = `You are "Kairos Assistant", the helpful guide on the Kairos landing page.
Answer ONLY using this site info — never invent features or pages:
${SITE_CONTEXT}

If asked to navigate (e.g. "take me to sign up"), respond ONLY with:
{"reply": "<short sentence>", "action": "navigate", "target": "home" | "about" | "signup"}

Otherwise respond ONLY with:
{"reply": "<answer based only on SITE INFORMATION>", "action": null, "target": null}

No markdown, no extra text — JSON only.`;

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: system },
        { role: "user", content: text }
      ],
      temperature: 0.8,
      max_completion_tokens: 220,
      response_format: { type: "json_object" }
    });

    const parsed = JSON.parse(completion.choices[0].message.content.trim());
    parsed.action = parsed.action ?? null;
    parsed.target = parsed.target ?? null;
    res.json(parsed);
  } catch (err) {
    console.error("SITE AI ERROR:", err);
    res.status(500).json({ reply: "Sorry, I couldn't process that — try rephrasing.", action: null, target: null });
  }
});

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.listen(process.env.PORT || 5000, () => console.log("Server running"));
