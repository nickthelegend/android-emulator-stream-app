# SPEC.md — Final Phase: The Voice Commander

## 1. Objective
Transform the AndroidStream app into a fully autonomous, voice-controlled AI agent capable of handling complex mobile workflows like booking tickets and selecting seats on a physical device.

## 2. Technical Stack
- **Voice**: Web Speech API (`window.webkitSpeechRecognition`).
- **Control**: AI Goal Swarm (LLM-driven interaction loop).
- **Latency**: Enforced 10s "Screen Refresh" intervals between autonomous moves.
- **Interactions**: ADB-based tap, swipe, and key events.

## 3. Core Features
### 3.1 Voice-to-Action
- [ ] Add Microphone icon to Chat Input.
- [ ] Implement Speech-to-Text that populates the input.
- [ ] **Instant Swarm**: Auto-start the Swarm mode once voice command finishes.

### 3.2 Complex Goal Swarm
- [ ] **Advanced Prompting**: Instruct LLM to identify grid-based elements (seats, date pickers, showtime lists).
- [ ] **State Resilience**: Maintain the objective across 10-20 cycles if necessary.
- [ ] **10s Interval**: Ensure the agent waits 10s after a click before capturing the next frame.

### 3.3 UI/UX Enhancements
- [ ] **Glow Feedback**: Microphone button glows when recording.
- [ ] **Countdown Overlay**: Show a "Next step in X seconds..." overlay on the stream canvas during the autonomous wait period.
- [ ] **Stop & Clear**: Immediate kill-switch for all loops and overlays.

## 4. Acceptance Criteria
- [ ] Speaking "Book a ticket for X" triggers the goal swarm.
- [ ] AI identifies and clicks a specific showtime.
- [ ] System waits exactly 10s between actions.
- [ ] Stop button kills all async timeouts.
