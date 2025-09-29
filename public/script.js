// public/script.js
async function refreshStatus() {
  try {
    const res = await fetch('/status-data');
    if (!res.ok) throw new Error("Server not OK");
    const data = await res.json();

    // Update status indicator
    const indicator = document.getElementById('serverStatus');
    indicator.textContent = "🟢 Running";
    indicator.className = "status-indicator running";

    // Update stats
    document.getElementById('startedAt').textContent = data.startedAt;
    document.getElementById('serverTime').textContent = data.serverTime;
    document.getElementById('uptime').textContent = data.uptime.human;
    document.getElementById('nodeVersion').textContent = data.nodeVersion;
    document.getElementById('platform').textContent = data.platform;
    document.getElementById('hostname').textContent = data.hostname;
    document.getElementById('memory').textContent = data.memory;
    document.getElementById('version').textContent = data.version;
  } catch (err) {
    console.error("Failed to fetch status:", err);
    const indicator = document.getElementById('serverStatus');
    indicator.textContent = "🔴 Offline";
    indicator.className = "status-indicator offline";
  }
}

// Refresh every 5 seconds
setInterval(refreshStatus, 5000);

// Run once at page load
window.onload = refreshStatus;
