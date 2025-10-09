async function loadStatus() {
  const res = await fetch("/api/status");
  const data = await res.json();
  if (!data.currentUser) return (window.location.href = "/login");

  const socket = io();


  const user = data.currentUser.username;
  const role = data.currentUser.role;

  document.getElementById("user").textContent = user;
  document.getElementById("role").textContent = role;
  document.getElementById("uptime").textContent = data.uptime;
  document.getElementById("nodeVersion").textContent = data.nodeVersion;
  document.getElementById("platform").textContent = data.platform;

  if (role === "Owner") {
    document.getElementById("ownerPanel").style.display = "inline";
    document.getElementById("announcementEditor").style.display = "block";
     document.getElementById("ownerSocketPanel").style.display = "block";
       document.getElementById("logControls").style.display = "block"; // ✅ add this line
         document.getElementById("ownerControls").style.display = "block";

  }


}



// --- Announcements ---
async function loadAnnouncement() {
  const res = await fetch("/api/announcement");
  const data = await res.json();
  document.getElementById("announcement").innerHTML =
    `<strong>${data.title}</strong><br>${data.message}`;
}

document.getElementById("announceForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = document.getElementById("title").value;
  const message = document.getElementById("message").value;
  const res = await fetch("/api/announcement", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, message }),
  });
  if (res.ok) {
    alert("Announcement updated!");
    loadAnnouncement();
    e.target.reset();
  } else {
    alert("Error updating announcement");
  }
});

// --- Chatbot News ---
async function loadNews() {
  const res = await fetch("/api/news");
  const news = await res.json();
  const container = document.getElementById("newsContainer");
  container.innerHTML = "";
  news.forEach((n) => {
    const div = document.createElement("div");
    div.classList.add("news-item");
    div.innerHTML = `<a href="${n.link}" target="_blank">${n.title}</a>`;
    container.appendChild(div);
  });
}


// --- Init ---
loadStatus();
loadAnnouncement();
loadNews();
// --- System Monitor ---
async function loadSystem() {
  const res = await fetch("/api/system");
  const data = await res.json();

  document.getElementById("cpu").textContent = data.cpuPercent;
  document.getElementById("memUsed").textContent = data.memoryUsed;
  document.getElementById("memTotal").textContent = data.totalMem;
  document.getElementById("memFree").textContent = data.freeMem;
  document.getElementById("sysNodeVersion").textContent = data.nodeVersion;
  document.getElementById("sysPlatform").textContent = data.platform;
}

// --- Restart Button ---
document.getElementById("restartBtn")?.addEventListener("click", async () => {
  if (confirm("Are you sure you want to restart the server?")) {
    const res = await fetch("/api/restart", { method: "POST" });
    if (res.ok) {
      alert("Restarting server...");
      setTimeout(() => (window.location.href = "/login"), 2000);
    } else {
      alert("Error restarting server");
    }
  }
});

// --- Analytics ---
async function loadAnalytics() {
  const res = await fetch("/api/analytics");
  const data = await res.json();

  document.getElementById("activeUsers").textContent = data.activeUsers.length;
  document.getElementById("totalMessages").textContent = data.totalMessages;
  document.getElementById("analyticsUptime").textContent = data.uptime;
}

// --- Logs ---
async function loadLogs() {
  const res = await fetch("/api/logs");
  if (!res.ok) return; // ignore for non-owners
  const data = await res.json();
  document.getElementById("logs").textContent = data.logs.join("\n");
}

document.getElementById("clearLogsBtn")?.addEventListener("click", async () => {
  if (confirm("Clear all logs?")) {
    await fetch("/api/logs/clear", { method: "POST" });
    loadLogs();
  }
});

// Start updating analytics + logs
loadAnalytics();
// setInterval(loadAnalytics, 4000);
// setInterval(loadLogs, 4000);


// --- Init System Monitor ---
loadSystem();
setInterval(loadSystem, 3000);

setInterval(loadStatus, 1000);

async function loadLogsHistory() {
  const type = document.getElementById("logFilter").value;
  const res = await fetch(`/api/logs?type=${type}`);
  const logs = await res.json();

  const logList = document.getElementById("logList");
  logList.textContent = logs
    .map((l) => `[${new Date(l.time).toLocaleTimeString()}] (${l.type}) ${l.message}`)
    .join("\n");
}

document.getElementById("refreshLogs")?.addEventListener("click", loadLogsHistory);
document.getElementById("logFilter")?.addEventListener("change", loadLogsHistory);
document.getElementById("clearLogs")?.addEventListener("click", async () => {
  if (!confirm("Clear all logs?")) return;
  await fetch("/api/logs", { method: "DELETE" });
  alert("Logs cleared!");
  loadLogsHistory();
});

// Show Owner-only
if (role === "Owner") {
  document.getElementById("logHistory").style.display = "block";
  loadLogsHistory();
}


// --- Socket Owner Control ---
const broadcastBtn = document.getElementById("broadcastBtn");
const forceLogoutBtn = document.getElementById("forceLogoutBtn");

socket.on("activeUsers", (users) => {
  document.getElementById("activeUserCount").textContent = users.length;
  const list = document.getElementById("userList");
  list.innerHTML = "";
  users.forEach(u => {
    const li = document.createElement("li");
    li.textContent = u;
    list.appendChild(li);
  });
});

broadcastBtn?.addEventListener("click", () => {
  const msg = document.getElementById("broadcastMsg").value.trim();
  if (!msg) return alert("Enter a message first!");
  socket.emit("ownerBroadcast", msg);
  document.getElementById("broadcastMsg").value = "";
});

forceLogoutBtn?.addEventListener("click", () => {
  const user = document.getElementById("forceUser").value.trim();
  if (!user) return alert("Enter a username or 'all'");
  socket.emit("ownerForceLogout", user);
});
// --- Live Analytics ---
socket.on("analytics", (data) => {
  document.getElementById("activeUsers").textContent = data.activeUsers.length;
  document.getElementById("totalMessages").textContent = data.totalMessages;
  document.getElementById("analyticsUptime").textContent = data.uptime;
});

// --- Live Logs ---
socket.on("logUpdate", (log) => {
  const logsElem = document.getElementById("logs");
  if (!logsElem) return;
  logsElem.textContent += log + "\n";
  logsElem.scrollTop = logsElem.scrollHeight;
});

socket.on("broadcastMsg", (msg) => {
  alert("📢 Broadcast from Owner: " + msg);
});

socket.on("forceLogout", () => {
  alert("⚠️ You have been logged out by the Owner.");
  window.location.href = "/logout";
});

socket.on("forceLogoutUser", (targetUser) => {
  if (currentUsername === targetUser) {
    alert("⚠️ You have been logged out by the Owner.");
    window.location.href = "/logout";
  }
});
