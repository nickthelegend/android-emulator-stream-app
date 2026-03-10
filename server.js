const express = require('express');
const { exec } = require('child_process');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, perMessageDeflate: false });

const PORT = process.env.PORT || 3000;
const FRAME_RATE = parseInt(process.env.FRAME_RATE) || 10;
const FRAME_INTERVAL = 1000 / FRAME_RATE;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

let connectedClients = 0;
let streamInterval = null;
let lastFrame = null;
let emulatorStatus = 'unknown';
let isCapturing = false;

function adb(cmd) {
  return new Promise((resolve, reject) => {
    exec(`adb ${cmd}`, { encoding: 'buffer', maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout);
    });
  });
}

function adbText(cmd) {
  return new Promise((resolve, reject) => {
    exec(`adb ${cmd}`, (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout.trim());
    });
  });
}

async function checkEmulator() {
  try {
    const devices = await adbText('devices');
    emulatorStatus = (devices.includes('emulator') && devices.includes('device')) ? 'online' : 'offline';
  } catch { emulatorStatus = 'offline'; }
  return emulatorStatus;
}

async function captureFrame() {
  if (isCapturing) return null;
  isCapturing = true;
  try {
    const buffer = await adb('exec-out screencap -p');
    lastFrame = buffer.toString('base64');
    return lastFrame;
  } catch { return null; }
  finally { isCapturing = false; }
}

function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(msg); });
}

function startStream() {
  if (streamInterval) return;
  streamInterval = setInterval(async () => {
    if (wss.clients.size === 0) return;
    const frame = await captureFrame();
    if (frame) broadcast({ type: 'frame', data: frame });
  }, FRAME_INTERVAL);
  console.log(`🎬 Stream started at ${FRAME_RATE} fps`);
}

function stopStream() {
  if (streamInterval) { clearInterval(streamInterval); streamInterval = null; }
}

app.get('/api/status', async (req, res) => {
  const status = await checkEmulator();
  res.json({ emulator: status, clients: connectedClients, streaming: streamInterval !== null, frameRate: FRAME_RATE });
});

app.post('/api/agent', async (req, res) => {
  const { action, x, y, x2, y2, text, keycode, duration } = req.body;
  try {
    switch (action) {
      case 'tap':        await adbText(`shell input tap ${x} ${y}`); break;
      case 'swipe':      await adbText(`shell input swipe ${x} ${y} ${x2||x} ${y2||y} ${duration||300}`); break;
      case 'type':       await adbText(`shell input text "${text.replace(/ /g,'%s').replace(/['"]/g,'')}"`); break;
      case 'keyevent':   await adbText(`shell input keyevent ${keycode}`); break;
      case 'screenshot': return res.json({ success: true, frame: await captureFrame() });
      default:           return res.status(400).json({ error: 'Unknown action' });
    }
    res.json({ success: true, action });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/key/:key', async (req, res) => {
  const keymap = { home:3, back:4, menu:82, power:26, volumeup:24, volumedown:25, enter:66, del:67 };
  const keycode = keymap[req.params.key];
  if (!keycode) return res.status(400).json({ error: 'Unknown key' });
  await adbText(`shell input keyevent ${keycode}`);
  res.json({ success: true });
});

wss.on('connection', async (ws) => {
  connectedClients++;
  console.log(`👤 Client connected (${connectedClients} total)`);
  const status = await checkEmulator();
  ws.send(JSON.stringify({ type: 'status', emulator: status, clients: connectedClients }));
  if (lastFrame) ws.send(JSON.stringify({ type: 'frame', data: lastFrame }));
  startStream();

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw);
      switch (msg.type) {
        case 'tap':      await adbText(`shell input tap ${msg.x} ${msg.y}`); break;
        case 'swipe':    await adbText(`shell input swipe ${msg.x1} ${msg.y1} ${msg.x2} ${msg.y2} ${msg.duration||300}`); break;
        case 'type':     await adbText(`shell input text "${msg.text.replace(/ /g,'%s')}"`); break;
        case 'keyevent': await adbText(`shell input keyevent ${msg.keycode}`); break;
        case 'ping':     ws.send(JSON.stringify({ type: 'pong' })); break;
      }
    } catch (err) { ws.send(JSON.stringify({ type: 'error', message: err.message })); }
  });

  ws.on('close', () => {
    connectedClients--;
    if (connectedClients === 0) stopStream();
  });
});

server.listen(PORT, async () => {
  console.log(`\n🚀 AndroidStream server running on port ${PORT}`);
  console.log(`📱 Open: http://localhost:${PORT}\n`);
  await checkEmulator();
  console.log(`📟 Emulator status: ${emulatorStatus}`);
});
