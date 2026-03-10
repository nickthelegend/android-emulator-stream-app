# ROADMAP.md

## Final Phase: The Voice Commander & Complex Swarm

### 🏗️ 1. Infrastructure (Voice Integration)
- [ ] Add `<button id="micBtn">🎤</button>` to `client/index.html`.
- [ ] Implement `webkitSpeechRecognition` in `client/src/main.js`.
- [ ] Connect voice output directly to `toggleSwarm`.

### 🧠 2. Agent Reasoning (Goal-Based Complex Tasks)
- [ ] Update `runSwarmCycle` prompt to prioritize grid identification (seats).
- [ ] Implement enforced `10,000ms` wait after `send({ type: 'tap' ... })`.
- [ ] Add `updateCountdown(10)` method to show visual wait in UI.

### 🎨 3. UI/UX Final Polish
- [ ] Glow effect for Microphone.
- [ ] Countdown overlay on stream canvas.
- [ ] State-persistent Goal display (so the goal is shown on screen while swarm is active).

### ✅ 4. Verification
- [ ] Verify voice identifies specific showtimes.
- [ ] Verify agent reaches a "Payment/OTP" gate successfully.
