# AndroidStream 📱

Stream your Android emulator to any browser with real-time control. This project uses ADB to capture the screen and WebSockets to stream frames to a web interface, allowing for remote interaction (taps, swipes, typing).

## 🚀 Features
- **Real-time Streaming**: Low-latency screen capture via ADB.
- **Interactive Control**: Send taps, swipes, and key events directly from the browser.
- **Hardware Buttons**: On-screen buttons for Home, Back, Recents, Power, and Volume.
- **Terminal Aesthetic**: Sleek, glassmorphism design with action logs and stats.
- **Agent API**: Programmatic control via POST requests for automated testing or AI agents.

---

## ☁️ VPS Setup (Headless)

Setting up an Android Virtual Device (AVD) on a VPS can be challenging due to hardware virtualization (KVM) and display requirements.

### Step 1: Check KVM Support
```bash
egrep -c '(vmx|svm)' /proc/cpuinfo
```
*If output is **0**, KVM is not available. The AVD will run via software acceleration (slower).*

### Step 2: Install Required Packages
```bash
sudo apt update
sudo apt install -y qemu-kvm libvirt-daemon-system android-tools-adb unzip wget
```

### Step 3: Install Android SDK + Emulator
```bash
# Download command-line tools
wget https://dl.google.com/android/repository/commandlinetools-linux-latest.zip
unzip commandlinetools-linux-latest.zip -d ~/android-sdk/cmdline-tools/latest

# Set environment variables
export ANDROID_HOME=~/android-sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools
```

### Step 4: Create an AVD
```bash
# Install system image
sdkmanager "system-images;android-33;google_apis;x86_64"

# Create the AVD
avdmanager create avd -n myavd -k "system-images;android-33;google_apis;x86_64"
```

### Step 5: List & Run AVD
**List all available AVDs:**
```bash
emulator -list-avds
# or
~/android-sdk/cmdline-tools/latest/bin/avdmanager list avd
```

**Run headless (no display needed):**
```bash
emulator -avd myavd -no-window -no-audio -gpu swiftshader_indirect &
```

**Key Flags:**
- `-no-window`: No GUI (essential for VPS).
- `-no-audio`: Skip audio initialization.
- `-gpu swiftshader_indirect`: Use software rendering (for VPS without GPUs).
- `-no-snapshot`: Avoid startup issues.

**Verify it's running:**
```bash
adb devices
```

---

## 💻 Local Setup (Laptops with Android Studio)

If you have Android Studio installed, setting up is much simpler.

### 1. Create an AVD
1. Open **Android Studio**.
2. Go to **Tools -> Device Manager**.
3. Create a new Virtual Device (e.g., Pixel 6) and download a system image.

### 2. Start the Emulator
You can start it via the UI, or via CLI:
```bash
# List AVDs
emulator -list-avds

# Start the emulator
emulator -avd <avd_name>
```

### 3. Ensure Environment Variables are set
Add these to your `.bashrc`, `.zshrc`, or Windows Environment Variables:
- `ANDROID_HOME`: Path to your Android SDK (e.g., `~/Library/Android/sdk` on Mac or `C:\Users\<user>\AppData\Local\Android\Sdk` on Windows).
- Add `platform-tools` and `emulator` to your `PATH`.

---

## 🛠️ Running the Application

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start the Server**:
   ```bash
   npm start
   ```
   *By default, the server runs on port 3000.*

3. **Access the Web UI**:
   Open `http://localhost:3000` in your browser.

---

## 🐳 Docker Deployment
```bash
docker-compose up --build
```
*Ensure ADB is running on your host machine to allow the container to connect.*
