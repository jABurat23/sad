// server.js
const express = require('express');
const os = require('os');
const packageJson = require('./package.json');

const app = express();
const PORT = process.env.PORT || 3000;
const startedAt = Date.now();

app.use(express.static('public'));

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  seconds -= days * 86400;
  const hours = Math.floor(seconds / 3600);
  seconds -= hours * 3600;
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${days}d ${hours}h ${minutes}m ${secs}s`;
}

app.get('/', (req, res) => {
  res.send('<h2>Chatbot server running. Go to <a href="/status">/status</a> to view status page.</h2>');
});

// HTML status page
app.get('/status', (req, res) => {
  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <title>Chatbot Server Status</title>
    <link rel="stylesheet" href="/style.css">
  </head>
  <body>
    <div class="container">
      <h1>🤖 Chatbot Server Status</h1>
      <div id="serverStatus" class="status-indicator">Checking...</div>
      <div class="status">
        <p><strong>Started At:</strong> <span id="startedAt">loading...</span></p>
        <p><strong>Current Time:</strong> <span id="serverTime">loading...</span></p>
        <p><strong>Uptime:</strong> <span id="uptime">loading...</span></p>
        <p><strong>Node Version:</strong> <span id="nodeVersion">loading...</span></p>
        <p><strong>Platform:</strong> <span id="platform">loading...</span></p>
        <p><strong>Hostname:</strong> <span id="hostname">loading...</span></p>
        <p><strong>Memory Used:</strong> <span id="memory">loading...</span></p>
        <p><strong>Version:</strong> <span id="version">loading...</span></p>
      </div>
      <footer>
        &copy; ${new Date().getFullYear()} Chatbot Project
      </footer>
    </div>
    <script src="/script.js"></script>
  </body>
  </html>
  `;
  res.send(html);
});

// JSON data endpoint
app.get('/status-data', (req, res) => {
  const uptimeSeconds = process.uptime();
  const mem = process.memoryUsage();

  res.json({
    startedAt: new Date(startedAt).toLocaleString(),
    serverTime: new Date().toLocaleString(),
    uptime: {
      seconds: Number(uptimeSeconds.toFixed(2)),
      human: formatUptime(uptimeSeconds)
    },
    nodeVersion: process.version,
    platform: `${process.platform} (${os.type()})`,
    hostname: os.hostname(),
    memory: `${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`,
    version: packageJson.version || null
  });
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
