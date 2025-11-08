# Jumping Jack Counter 🏃‍♂️

A web-based computer vision application that counts jumping jacks in real-time using your webcam! Built with Python backend (FastAPI + Socket.IO) and a modern web frontend.

## Features

- **Real-time pose detection** using MediaPipe
- **Automatic counting** when hands go up
- **Visual feedback** with skeleton overlay and live video feed
- **Web-based interface** - works in any modern browser
- **Real-time communication** via WebSockets
- **Simple controls** - reset counter or quit anytime

## Requirements

- **Python 3.12** (MediaPipe not yet compatible with Python 3.13+)
- Webcam
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Good lighting for best results

## Installation

1. Navigate to the project directory:
```bash
cd /Users/elhadjisall/Library/CloudStorage/OneDrive-UNBC/proj
```

2. Activate the virtual environment:
```bash
source venv/bin/activate
```

3. Install the required packages:
```bash
cd Fitness
pip install -r requirements.txt
```

## Running the Project

The project requires **two servers** to run simultaneously:

### Terminal 1 - Backend Server (FastAPI + Socket.IO)

Open a terminal and run:

```bash
cd /Users/elhadjisall/Library/CloudStorage/OneDrive-UNBC/proj
source venv/bin/activate
uvicorn Fitness.server:app --host 0.0.0.0 --port 8000 --reload
```

**Keep this terminal open!** You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

The `--reload` flag automatically restarts the server when you make code changes.

---

### Terminal 2 - Frontend Server (HTTP Server)

Open **another terminal window/tab** and run:

```bash
cd /Users/elhadjisall/Library/CloudStorage/OneDrive-UNBC/proj
python3 -m http.server 8001
```

**Keep this terminal open!** The server will start serving files.

---

## Usage

1. **Start both servers** (see instructions above)

2. **Open your browser** and navigate to:
   ```
   http://127.0.0.1:8001/Fitness/index.html
   ```
   Or:
   ```
   http://localhost:8001/Fitness/index.html
   ```

3. **Click "Start Game"** and allow camera access when prompted

4. **Stand in front of your webcam** where your full body is visible

5. **Start doing jumping jacks!** The counter will increment each time you raise your hands above your shoulders

6. **Controls:**
   - Click **"Quit Game"** to return to menu
   - Click **"Replay"** to reset the counter and start a new round
   - The game automatically ends after 2 minutes

## Quick Reference - All Commands

**Terminal 1 (Backend):**
```bash
cd /Users/elhadjisall/Library/CloudStorage/OneDrive-UNBC/proj
source venv/bin/activate
uvicorn Fitness.server:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 (Frontend):**
```bash
cd /Users/elhadjisall/Library/CloudStorage/OneDrive-UNBC/proj
python3 -m http.server 8001
```

**To stop the servers:** Press `CTRL + C` in each terminal window

## How It Works

### Architecture

The application uses a **client-server architecture** with real-time communication:

1. **Frontend (Browser):**
   - Captures video from the webcam
   - Sends video frames to the backend via WebSocket
   - Displays the processed video with skeleton overlay
   - Shows the count and status in real-time

2. **Backend (Python Server):**
   - Receives video frames via WebSocket (Socket.IO)
   - Processes frames using MediaPipe pose estimation
   - Detects 33 body landmarks in real-time
   - Tracks wrist and shoulder positions
   - Counts jumping jacks when both wrists move above shoulders
   - Sends processed frames and results back to the frontend

### Detection Logic

The program uses MediaPipe's pose estimation to detect 33 body landmarks in real-time. It specifically tracks:
- Left and right wrist positions
- Left and right shoulder positions

When both wrists move above the shoulders, it counts as one jumping jack.

### WebSocket Communication

- **WebSockets** enable real-time bidirectional communication
- Video frames are sent from browser to backend (~10 frames/second)
- Processed results are sent back immediately
- This allows for smooth, real-time tracking without page refreshes

## Tips for Best Results

- Stand 5-8 feet from the camera
- Ensure your full body is visible in the frame
- Use good lighting
- Wear contrasting clothing from your background
- Make sure to raise your hands fully above your shoulders

## Troubleshooting

### Server Issues

**Backend server won't start?**
- Make sure you're in the correct directory: `/Users/elhadjisall/Library/CloudStorage/OneDrive-UNBC/proj`
- Verify the virtual environment is activated: `source venv/bin/activate`
- Check if port 8000 is already in use (try a different port or stop the conflicting process)
- Ensure all dependencies are installed: `pip install -r Fitness/requirements.txt`

**Frontend server won't start?**
- Check if port 8001 is already in use
- Make sure you're in the project root directory

**WebSocket connection failed?**
- Verify both servers are running (backend on port 8000, frontend on port 8001)
- Check browser console (F12) for connection errors
- Ensure the backend URL in `script.js` matches your server: `http://127.0.0.1:8000`

### Camera Issues

**Webcam not working?**
- Check if another application is using the webcam
- Make sure you've granted camera permissions in your browser
- Try refreshing the page and allowing camera access again
- Check browser settings for camera permissions

**Camera shows black screen?**
- Verify camera permissions are granted
- Try a different browser
- Check if the camera works in other applications

### Detection Issues

**Counter not detecting?**
- Ensure your full body is visible in the frame
- Raise your hands fully above your shoulders
- Check lighting conditions (good lighting improves detection)
- Stand 5-8 feet from the camera
- Make sure you're facing the camera directly

**Low frame rate or laggy video?**
- Close other applications using the camera
- Check browser console for errors
- Verify both servers are running smoothly
- Try refreshing the page

## Technologies Used

### Backend
- **FastAPI**: Modern Python web framework for building APIs
- **Socket.IO**: Real-time bidirectional communication (WebSocket)
- **Uvicorn**: ASGI server for running FastAPI
- **OpenCV**: Image processing and video frame manipulation
- **MediaPipe**: Pose estimation and landmark detection
- **NumPy**: Numerical operations

### Frontend
- **HTML5**: Web page structure
- **CSS3**: Styling and layout
- **JavaScript**: Client-side logic and WebSocket communication
- **Socket.IO Client**: WebSocket client library
- **WebRTC**: Webcam access via `getUserMedia` API

## License

Free to use and modify!

