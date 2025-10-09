// server.js
require("dotenv").config();
const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const os = require("os");
const path = require("path");
const fs = require("fs");
const osUtils = require("os-utils");
const http = require("http");
const { Server } = require("socket.io");
const logsFile = path.join(__dirname, "data", "logs.json");




const app = express();
const PORT = process.env.PORT || 3000;
const startedAt = Date.now();
// Create server
const server = http.createServer(app);
const io = new Server(server);


let totalMessages = 0;
let activeUsers = new Set();



app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// --- Sessions ---
app.use(
  session({
    secret: process.env.SESSION_SECRET || "defaultsecret",
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 }, // 1 hour
  })
);

// --- Helpers ---
function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${d}d ${h}h ${m}m ${s}s`;
}

function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.session.user) return res.redirect("/login");
    if (req.session.user.role !== role)
      return res.status(403).send("Access Denied");
    next();
  };
}

function addLog(message, type = "info") {
  const entry = {
    time: new Date().toISOString(),
    message,
    type,
  };

  console.log(`[${type.toUpperCase()}] ${message}`);
  systemLogs.push(entry);

  if (systemLogs.length > 200) systemLogs.shift(); // limit file size
  saveLogs(systemLogs);

  io.emit("logUpdate", entry);
}


function broadcastUpdate() {
  const uptimeSeconds = Math.floor((Date.now() - startedAt) / 1000);
  io.emit("analytics", {
    activeUsers: Array.from(activeUsers),
    totalMessages,
    uptime: formatUptime(uptimeSeconds),
  });
}
function loadLogs() {
  try {
    const raw = fs.readFileSync(logsFile, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
}

function saveLogs(logs) {
  fs.writeFileSync(logsFile, JSON.stringify(logs, null, 2));
}

let systemLogs = loadLogs();



// --- Routes ---
app.get("/login", (req, res) => {
  if (req.session.user) return res.redirect("/dashboard");
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;

  const users = [
    { username: process.env.OWNER_USERNAME, password: process.env.OWNER_PASSWORD, role: "Owner" },
    { username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD, role: "Admin" },
  ];

  const found = users.find((u) => u.username === username && u.password === password);
  if (found) {
    req.session.user = { username: found.username, role: found.role };
    return res.redirect("/dashboard");
  }
  res.send("<script>alert('Invalid credentials!');window.location='/login'</script>");
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

broadcastUpdate();


// Protected
app.get("/dashboard", requireLogin, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "dashboard.html"))
);
app.get("/status", requireLogin, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "status.html"))
);

app.get("/api/status", requireLogin, (req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - startedAt) / 1000);
  const currentUser = req.session.user;
  res.json({
    startedAt: new Date(startedAt).toLocaleString(),
    currentTime: new Date().toLocaleString(),
    uptime: formatUptime(uptimeSeconds),
    nodeVersion: process.version,
    platform: os.platform(),
    currentUser,
  });
});

// --- System Metrics ---
app.get("/api/system", requireLogin, async (req, res) => {
  osUtils.cpuUsage((cpuPercent) => {
    const memoryUsed = process.memoryUsage().rss / 1024 / 1024; // in MB
    const totalMem = os.totalmem() / 1024 / 1024; // in MB
    const freeMem = os.freemem() / 1024 / 1024; // in MB
    const uptimeSeconds = Math.floor((Date.now() - startedAt) / 1000);

    res.json({
      cpuPercent: (cpuPercent * 100).toFixed(1),
      memoryUsed: memoryUsed.toFixed(1),
      totalMem: totalMem.toFixed(1),
      freeMem: freeMem.toFixed(1),
      uptime: formatUptime(uptimeSeconds),
      nodeVersion: process.version,
      platform: os.platform(),
    });
  });
});

// --- Analytics ---
app.get("/api/analytics", requireLogin, (req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - startedAt) / 1000);
  res.json({
    activeUsers: Array.from(activeUsers),
    totalMessages,
    uptime: formatUptime(uptimeSeconds),
  });
});

// --- Logs (Owner only) ---
app.get("/api/logs", requireLogin, (req, res) => {
  const { type } = req.query;
  let filtered = systemLogs;
  if (type && type !== "all") {
    filtered = systemLogs.filter((l) => l.type === type);
  }
  res.json(filtered);
});

app.delete("/api/logs", requireRole("Owner"), (req, res) => {
  systemLogs = [];
  saveLogs(systemLogs);
  addLog("🧹 Owner cleared all logs", "system");
  res.json({ success: true });
});

// --- Restart Server (Owner Only) ---
app.post("/api/restart", requireRole("Owner"), (req, res) => {
  console.log("⚙️ Restart triggered by Owner...");
  res.json({ restarting: true });
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});

// --- Announcements ---
const ANNOUNCE_PATH = path.join(__dirname, "data", "announcements.json");

app.get("/api/announcement", requireLogin, (req, res) => {
  const data = fs.existsSync(ANNOUNCE_PATH)
    ? JSON.parse(fs.readFileSync(ANNOUNCE_PATH, "utf-8"))
    : { title: "No announcements", message: "" };
  res.json(data);
});

app.post("/api/announcement", requireRole("Owner"), (req, res) => {
  const { title, message } = req.body;
  fs.writeFileSync(ANNOUNCE_PATH, JSON.stringify({ title, message }, null, 2));
  res.json({ success: true });
});

// --- Chatbot/AI News ---
app.get("/api/news", requireLogin, async (req, res) => {
  // Demo news items – replace later with a live news API if you want
  const news = [
    { title: "OpenAI releases GPT-5 improvements", link: "https://openai.com/blog" },
    { title: "Chatbots now assist 80% of ecommerce sites", link: "https://techcrunch.com" },
    { title: "Voice-enabled bots are the next frontier", link: "https://thenextweb.com" },
  ];
  res.json(news);
});

// Owner-only secret page
app.get("/owner/secret", requireRole("Owner"), (req, res) =>
  res.send("<h2>Welcome Owner 👑 — secret data visible only to you!</h2>")
);



io.on("connection", (socket) => {
  console.log("🔌 Client connected:", socket.id);

  // Send current users
  io.emit("activeUsers", Array.from(activeUsers));

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
    io.emit("activeUsers", Array.from(activeUsers));
  });

  // Owner Broadcast
  socket.on("ownerBroadcast", (msg) => {
    console.log("📢 Owner broadcast:", msg);
    io.emit("broadcastMsg", msg);
    addLog(`📢 Owner Broadcast: ${msg}`);
  });

  // Force Logout
  socket.on("ownerForceLogout", (user) => {
    if (user === "all") {
      io.emit("forceLogout");
      addLog("⚠️ Owner forced logout for all users");
    } else {
      io.emit("forceLogoutUser", user);
      addLog(`⚠️ Owner forced logout: ${user}`);
    }
  });
});

// --- Start ---
server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});