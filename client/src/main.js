// ── State ──────────────────────────────────────────────────────────────────
const state = {
  ws: null,
  connected: false,
  frozen: false,
  mode: 'tap',
  frames: 0,
  taps: 0,
  lastFrameTime: 0,
  fpsHistory: [],
  swipeStart: null,
  imgW: 360,
  imgH: 780,
  swarmActive: false,
  swarmTimeout: null,
  swarmGoal: "",
  pingTime: 0
};

const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
const wrapper = document.getElementById('canvasWrapper');
const overlay = document.getElementById('swipeOverlay');

// ── WebSocket ──────────────────────────────────────────────────────────────
function connect() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  // Use relative path for WebSocket so Vite proxy picks it up
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  state.ws = new WebSocket(wsUrl);

  state.ws.onopen = () => {
    state.connected = true;
    log('info', 'Connected to server');
    startPing();
    document.getElementById('loadingOverlay').style.display = 'none';
  };

  state.ws.onclose = () => {
    state.connected = false;
    updateStatus('offline', 'Disconnected');
    log('error', 'Connection lost — retrying...');
    setTimeout(connect, 2000);
  };

  state.ws.onerror = () => log('error', 'WebSocket error');

  state.ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);

    if (msg.type === 'frame' && !state.frozen) {
      renderFrame(msg.data);
    }

    if (msg.type === 'status') {
      updateStatus(msg.emulator === 'online' ? 'online' : 'offline',
        msg.emulator === 'online' ? 'Emulator Online' : 'Emulator Offline');
      document.getElementById('clientCount').textContent = `${msg.clients} client${msg.clients !== 1 ? 's' : ''}`;
    }

    if (msg.type === 'pong') {
      const ping = Date.now() - state.pingTime;
      document.getElementById('pingMs').textContent = ping;
      document.getElementById('pingChip').style.display = '';
    }
  };
}

function send(data) {
  if (state.ws?.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify(data));
  }
}

// ── Render Frame ───────────────────────────────────────────────────────────
function renderFrame(base64) {
  const img = new Image();
  img.onload = () => {
    if (img.width !== state.imgW || img.height !== state.imgH) {
      state.imgW = img.width;
      state.imgH = img.height;
      canvas.width = img.width;
      canvas.height = img.height;
      document.getElementById('statRes').textContent =
        img.width > 999 ? `${(img.width / 1000).toFixed(1)}K` : img.width;
    }
    ctx.drawImage(img, 0, 0);

    const now = Date.now();
    if (state.lastFrameTime) {
      const fps = 1000 / (now - state.lastFrameTime);
      state.fpsHistory.push(fps);
      if (state.fpsHistory.length > 10) state.fpsHistory.shift();
      const avgFps = state.fpsHistory.reduce((a, b) => a + b) / state.fpsHistory.length;
      document.getElementById('statFps').textContent = avgFps.toFixed(1);
    }
    state.lastFrameTime = now;
    state.frames++;
    document.getElementById('statFrames').textContent =
      state.frames > 999 ? `${(state.frames / 1000).toFixed(1)}K` : state.frames;
  };
  img.src = 'data:image/png;base64,' + base64;
}

// ── Interaction Logic ─────────────────────────────────────────────────────
function getCanvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: Math.floor((e.clientX - rect.left) * scaleX),
    y: Math.floor((e.clientY - rect.top) * scaleY)
  };
}

canvas.addEventListener('click', (e) => {
  if (state.mode !== 'tap') return;
  const { x, y } = getCanvasCoords(e);
  send({ type: 'tap', x, y });
  state.taps++;
  document.getElementById('statTaps').textContent = state.taps;
  log('tap', `Tap (${x}, ${y})`);
  spawnRipple(e.offsetX, e.offsetY);
});

overlay.addEventListener('mousedown', (e) => {
  const { x, y } = getCanvasCoords(e);
  state.swipeStart = { x, y, cx: e.offsetX, cy: e.offsetY };
});

overlay.addEventListener('mouseup', (e) => {
  if (!state.swipeStart) return;
  const { x, y } = getCanvasCoords(e);
  send({ type: 'swipe', x1: state.swipeStart.x, y1: state.swipeStart.y, x2: x, y2: y, duration: 300 });
  log('swipe', `Swipe (${state.swipeStart.x},${state.swipeStart.y}) → (${x},${y})`);
  state.swipeStart = null;
});

function spawnRipple(x, y) {
  const r = document.createElement('div');
  r.className = 'click-ripple';
  r.style.left = x + 'px';
  r.style.top = y + 'px';
  wrapper.appendChild(r);
  setTimeout(() => r.remove(), 500);
}

function sendKey(keycode) {
  send({ type: 'keyevent', keycode });
  const names = { 3: 'Home', 4: 'Back', 26: 'Power', 24: 'Vol+', 25: 'Vol-', 66: 'Enter', 67: 'Delete', 82: 'Menu', 187: 'Recents' };
  log('key', `Key: ${names[keycode] || keycode}`);
}

function sendText() {
  const text = document.getElementById('typeText').value.trim();
  if (!text) return;
  send({ type: 'type', text });
  log('tap', `Type: "${text.substring(0, 20)}${text.length > 20 ? '...' : ''}"`);
  document.getElementById('typeText').value = '';
}

function doSwipe(dir) {
  const w = state.imgW, h = state.imgH;
  const cx = w / 2, cy = h / 2;
  const map = {
    up: { x1: cx, y1: cy + 200, x2: cx, y2: cy - 200 },
    down: { x1: cx, y1: cy - 200, x2: cx, y2: cy + 200 },
    left: { x1: cx + 200, y1: cy, x2: cx - 200, y2: cy },
    right: { x1: cx - 200, y1: cy, x2: cx + 200, y2: cy }
  };
  const s = map[dir];
  send({ type: 'swipe', ...s, duration: 400 });
  log('swipe', `Swipe ${dir}`);
}

function setMode(mode) {
  state.mode = mode;
  document.getElementById('modeTap').classList.toggle('active', mode === 'tap');
  document.getElementById('modeSwipe').classList.toggle('active', mode === 'swipe');
  overlay.classList.toggle('active', mode === 'swipe');
  canvas.style.cursor = mode === 'swipe' ? 'crosshair' : 'crosshair';
  log('info', `Mode: ${mode}`);
}

function toggleFreeze() {
  state.frozen = !state.frozen;
  document.getElementById('freezeBtn').classList.toggle('active', state.frozen);
  document.getElementById('freezeBtn').textContent = state.frozen ? '▶ Resume' : '⏸ Freeze';
  log('info', state.frozen ? 'Stream frozen' : 'Stream resumed');
}

function takeScreenshot() {
  const link = document.createElement('a');
  link.download = `screenshot-${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  log('info', 'Screenshot saved');
}

function updateStatus(status, text) {
  const dot = document.getElementById('emuDot');
  dot.className = 'status-dot ' + status;
  document.getElementById('emuStatus').textContent = text;
}

function startPing() {
  setInterval(() => {
    state.pingTime = Date.now();
    send({ type: 'ping' });
  }, 3000);
}

function log(type, msg) {
  addChatMessage('log', msg);
}

// ── AI Analysis ────────────────────────────────────────────────────────────
async function analyzeScreen() {
  addChatMessage('ai', "Analyzing screen for clickable elements...");
  document.querySelectorAll('.ai-box').forEach(b => b.remove());

  try {
    const res = await fetch('/api/ai/detect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: "detect all clickable elements like buttons, icons, or input fields. For each element, tell me what it is and its bounding box." })
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    addChatMessage('ai', data.output);

    try {
      const boxesStr = data.boxes || "[]";
      const boxes = typeof boxesStr === 'string' ? JSON.parse(boxesStr.replace(/'/g, '"')) : boxesStr;

      boxes.forEach((box, i) => {
        if (Array.isArray(box) && box.length === 4) {
          createAIBox(box, i);
        }
      });
      log('info', `AI detected ${boxes.length} elements`);
    } catch (e) { console.error('Failed to parse boxes:', e); }

  } catch (err) {
    log('error', `AI Failed: ${err.message}`);
    addChatMessage('ai', `Error: ${err.message}`);
  }
}

function createAIBox(box, index) {
  const [xmin, ymin, xmax, ymax] = box;
  const width = xmax - xmin;
  const height = ymax - ymin;
  const cx = Math.floor((xmin + width / 2) / 1000 * state.imgW);
  const cy = Math.floor((ymin + height / 2) / 1000 * state.imgH);

  const el = document.createElement('div');
  el.className = 'ai-box';
  el.style.position = 'absolute';
  el.style.border = '2px solid var(--accent2)';
  el.style.background = 'rgba(14, 165, 233, 0.1)';
  el.style.left = (xmin / 10) + '%';
  el.style.top = (ymin / 10) + '%';
  el.style.width = (width / 10) + '%';
  el.style.height = (height / 10) + '%';
  el.style.cursor = 'pointer';
  el.style.zIndex = '100';
  el.title = `Click to tap element #${index + 1}`;

  el.onclick = (e) => {
    e.stopPropagation();
    send({ type: 'tap', x: cx, y: cy });
    log('tap', `AI Tap on element #${index + 1} at (${cx}, ${cy})`);
    spawnRipple(e.pageX - canvas.getBoundingClientRect().left, e.pageY - canvas.getBoundingClientRect().top);
  };

  wrapper.appendChild(el);
}

function clearAIBoxes() {
  document.querySelectorAll('.ai-box').forEach(b => b.remove());
  log('info', 'AI overlays cleared');
}

async function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;

  const lowerText = text.toLowerCase();
  const actionKeywords = ['click', 'tap', 'open', 'add', 'put', 'buy', 'select', 'press', 'go', 'hit', 'book', 'order', 'reserve', 'find', 'search', 'get', 'show', 'navigate'];
  const isActionRequest = actionKeywords.some(kw => lowerText.includes(kw));

  addChatMessage('user', text);
  input.value = '';

  const loadingMsg = addChatMessage('thinking', '<div class="spinner"></div> AI is thinking...', true);

  try {
    const res = await fetch('/api/ai/detect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: text })
    });
    const data = await res.json();
    loadingMsg.remove();

    if (data.success) {
      const aiOutput = String(data.output);
      addChatMessage('ai', aiOutput);

      let boxes = [];
      if (data.boxes) {
        try {
          boxes = typeof data.boxes === 'string' ? JSON.parse(data.boxes.replace(/'/g, '"')) : data.boxes;
        } catch (e) { }
      }

      if (!boxes || boxes.length === 0) {
        const regex = /\[(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\]/g;
        let match;
        while ((match = regex.exec(aiOutput)) !== null) {
          boxes.push([parseInt(match[1]), parseInt(match[2]), parseInt(match[3]), parseInt(match[4])]);
        }
      }

      if (boxes && boxes.length > 0) {
        boxes.forEach((box, i) => {
          if (Array.isArray(box) && box.length === 4) createAIBox(box, i);
        });

        if (isActionRequest && !state.swarmActive) {
          addChatMessage('ai', "I've identified the target. Starting autonomous swarm to complete your goal...");
          state.swarmGoal = text;
          toggleSwarm(); // Start the loop
        }
      }
    } else {
      addChatMessage('ai', "Error: " + data.error);
    }
  } catch (err) {
    addChatMessage('ai', "Failed to connect to AI agent.");
  }
}

function addChatMessage(type, text, isRaw = false) {
  const container = document.getElementById('chatMessages');
  const msg = document.createElement('div');
  msg.className = `chat-msg ${type}`;
  if (isRaw) {
    msg.innerHTML = text;
  } else {
    msg.textContent = text;
  }
  container.appendChild(msg);
  container.scrollTop = container.scrollHeight;
  return msg;
}

// ── Swarm Mode ────────────────────────────────────────────────────────────
async function toggleSwarm() {
  if (!state.swarmActive) {
    const goal = document.getElementById('chatInput').value.trim();
    if (!goal) {
      addChatMessage('ai', "Goal required: Type what you want me to do in the input box, then click GOAL SWARM.");
      return;
    }
    state.swarmGoal = goal;
    addChatMessage('user', `Executing Goal: ${goal}`);
    document.getElementById('chatInput').value = '';
  }

  state.swarmActive = !state.swarmActive;
  const btn = document.getElementById('swarmBtn');
  btn.textContent = state.swarmActive ? '🛑 STOP AGENT' : '🤖 GOAL SWARM';
  btn.classList.toggle('active', state.swarmActive);

  if (state.swarmActive) {
    log('info', `Autonomous Agent started for: ${state.swarmGoal}`);
    addChatMessage('ai', `I am now working on: "${state.swarmGoal}". This process is fully autonomous.`);
    runSwarmCycle();
  } else {
    log('info', 'Autonomous Agent stopped');
    addChatMessage('ai', "Task stopped.");
    if (state.swarmTimeout) clearTimeout(state.swarmTimeout);
  }
}

async function runSwarmCycle() {
  if (!state.swarmActive) return;

  const loadingMsg = addChatMessage('thinking', '<div class="spinner"></div> Agent is executing...', true);

  try {
    const prompt = `User Objective: "${state.swarmGoal}". Based on the current screen, identify the single best next action to reach this goal. If an interaction is needed, return the bounding box [xmin, ymin, xmax, ymax] for the element. If the objective is complete, include "TASK COMPLETED" in your response.`;

    const res = await fetch('/api/ai/detect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: prompt })
    });
    const data = await res.json();
    loadingMsg.remove();

    if (data.success && state.swarmActive) {
      const aiOutput = String(data.output);
      addChatMessage('ai', `[Step] ${aiOutput}`);

      // Clear previous boxes
      document.querySelectorAll('.ai-box').forEach(b => b.remove());

      if (aiOutput.includes("TASK COMPLETED")) {
        addChatMessage('ai', "🚀 Objective finished! Stopping agent.");
        toggleSwarm();
        return;
      }

      let boxes = [];
      if (data.boxes) {
        try {
          boxes = typeof data.boxes === 'string' ? JSON.parse(data.boxes.replace(/'/g, '"')) : data.boxes;
        } catch (e) { }
      }

      if (!boxes || boxes.length === 0) {
        const regex = /\[(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\]/g;
        let match;
        while ((match = regex.exec(aiOutput)) !== null) {
          boxes.push([parseInt(match[1]), parseInt(match[2]), parseInt(match[3]), parseInt(match[4])]);
        }
      }

      if (boxes && boxes.length > 0) {
        boxes.forEach((box, i) => {
          if (Array.isArray(box) && box.length === 4) createAIBox(box, i);
        });

        const box = boxes[0];
        const width = box[2] - box[0];
        const height = box[3] - box[1];
        const cx = Math.floor((box[0] + width / 2) / 1000 * state.imgW);
        const cy = Math.floor((box[1] + height / 2) / 1000 * state.imgH);

        log('info', `Agent Tap: (${cx}, ${cy})`);
        send({ type: 'tap', x: cx, y: cy });

        addChatMessage('log', `Waiting 10s for screen update...`);
        state.swarmTimeout = setTimeout(runSwarmCycle, 10000);
      } else {
        addChatMessage('ai', "Looking for next path... retrying in 5s.");
        state.swarmTimeout = setTimeout(runSwarmCycle, 5000);
      }
    }
  } catch (err) {
    if (loadingMsg) loadingMsg.remove();
    addChatMessage('ai', `Agent Error: ${err.message}. Retrying...`);
    state.swarmTimeout = setTimeout(runSwarmCycle, 10000);
  }
}

// ── Event Listeners ──
window.addEventListener('load', () => {
  connect();

  document.getElementById('screenshotBtn').onclick = takeScreenshot;
  document.getElementById('freezeBtn').onclick = toggleFreeze;
  document.getElementById('homeBtn').onclick = () => sendKey(3);
  document.getElementById('swarmBtn').onclick = toggleSwarm;
  document.getElementById('analyzeBtn').onclick = analyzeScreen;
  document.getElementById('sendChatBtn').onclick = sendChatMessage;
  document.getElementById('chatInput').onkeydown = (e) => {
    if (e.key === 'Enter') sendChatMessage();
  };

  document.getElementById('modeTap').onclick = () => setMode('tap');
  document.getElementById('modeSwipe').onclick = () => setMode('swipe');

  document.getElementById('swipeUpBtn').onclick = () => doSwipe('up');
  document.getElementById('swipeDownBtn').onclick = () => doSwipe('down');
  document.getElementById('swipeLeftBtn').onclick = () => doSwipe('left');
  document.getElementById('swipeRightBtn').onclick = () => doSwipe('right');
  document.getElementById('clearBoxesBtn').onclick = clearAIBoxes;

  document.getElementById('fpsSlider').oninput = (e) => {
    const val = e.target.value;
    document.getElementById('fpsVal').textContent = val;
    send({ type: 'set_fps', value: val });
  };

  document.getElementById('sendTextBtn').onclick = sendText;

  document.getElementById('keyGrid').querySelectorAll('.key-btn').forEach(btn => {
    const key = btn.getAttribute('data-key');
    btn.onclick = () => sendKey(key);
  });
});
