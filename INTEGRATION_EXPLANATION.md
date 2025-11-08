# Integration Explanation: Frontend ↔ Backend Real-Time Video Processing

## Overview
This project connects a web frontend (HTML/CSS/JavaScript) with a Python backend (FastAPI + MediaPipe) to perform real-time jumping jack detection and counting using computer vision.

---

## Architecture Diagram

```
┌─────────────────┐         WebSocket          ┌──────────────────┐
│                 │    (Socket.IO)              │                  │
│   Frontend       │ ◄─────────────────────►    │   Backend        │
│   (Browser)      │        Real-time           │   (Python)       │
│                 │        Communication        │                  │
│  - HTML/CSS/JS  │                             │  - FastAPI       │
│  - Webcam API   │                             │  - Socket.IO     │
│  - Socket.IO    │                             │  - MediaPipe     │
│    Client       │                             │  - OpenCV        │
└─────────────────┘                             └──────────────────┘
```

---

## Part 1: Backend Setup (Python)

### 1.1 Technologies Used
- **FastAPI**: Modern Python web framework (like Flask but faster, with automatic API docs)
- **python-socketio**: WebSocket library for real-time bidirectional communication
- **MediaPipe**: Google's framework for pose estimation (tracks body landmarks)
- **OpenCV (cv2)**: Computer vision library for image processing
- **NumPy**: For efficient array operations
- **Uvicorn**: ASGI server to run FastAPI

### 1.2 Backend Flow (`server.py`)

```python
# 1. Initialize FastAPI app
app = FastAPI()

# 2. Add CORS middleware (allows frontend to connect)
app.add_middleware(CORSMiddleware, allow_origins=["*"])

# 3. Initialize Socket.IO server
sio = socketio.AsyncServer(async_mode='asgi')
socket_app = socketio.ASGIApp(sio, socketio_path='socket.io')
app.mount('/socket.io', socket_app)  # Mount at /socket.io endpoint

# 4. Create counter instance per client session
counters = {}  # Stores one JumpingJackCounter per client
```

### 1.3 WebSocket Event Handlers

```python
@sio.on('connect')
async def connect(sid, environ):
    # When client connects, create a counter for them
    counters[sid] = JumpingJackCounter()
    print(f"✅ Client connected: {sid}")

@sio.on('video_frame')
async def handle_video_frame(sid, data):
    # 1. Receive base64 encoded image from frontend
    img_data = base64.b64decode(data['image'])
    
    # 2. Convert to numpy array, then OpenCV image
    np_arr = np.frombuffer(img_data, dtype=np.uint8)
    frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    
    # 3. Process with MediaPipe (detect pose, count jumping jacks)
    processed_frame, count, status = jump_counter.process_frame(frame)
    
    # 4. Flip frame for mirror effect, redraw text
    processed_frame = cv2.flip(processed_frame, 1)
    # ... redraw text on correct side ...
    
    # 5. Encode processed frame back to base64
    _, buffer = cv2.imencode('.jpg', processed_frame, [cv2.IMWRITE_JPEG_QUALITY, 30])
    encoded_frame = base64.b64encode(buffer).decode('utf-8')
    
    # 6. Send results back to client
    await sio.emit('tracking_results', {
        'image': encoded_frame,
        'count': count,
        'status': status
    }, room=sid)
```

### 1.4 Why Base64 Encoding?
- **Problem**: Can't send binary image data directly through JSON/WebSocket text messages
- **Solution**: Convert image to base64 string (text representation of binary)
- **Flow**: Image → JPEG bytes → base64 string → send → decode → image

---

## Part 2: Frontend Setup (JavaScript)

### 2.1 Technologies Used
- **Socket.IO Client**: JavaScript library to connect to Socket.IO server
- **Webcam API**: `navigator.mediaDevices.getUserMedia()` to access camera
- **HTML5 Canvas**: To capture frames from video stream
- **Base64 Encoding**: To send images as text

### 2.2 Frontend Flow (`script.js`)

```javascript
// 1. Initialize Socket.IO client
const SERVER_URL = 'http://127.0.0.1:8000';
socket = io(SERVER_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true
});

// 2. Access webcam
async function startWebcam() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    webcam.srcObject = stream;
    webcam.onloadedmetadata = () => {
        connectWebSocket();  // Connect to backend when camera ready
    };
}

// 3. Send video frames continuously
function startSendingVideoFrames() {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    videoInterval = setInterval(() => {
        // Capture frame from video element
        canvas.width = webcam.videoWidth;
        canvas.height = webcam.videoHeight;
        context.drawImage(webcam, 0, 0, canvas.width, canvas.height);
        
        // Convert to base64 JPEG
        const imageData = canvas.toDataURL('image/jpeg', 0.3);  // 0.3 = quality
        const base64Image = imageData.split(',')[1];  // Remove "data:image/jpeg;base64," prefix
        
        // Send to backend
        if (socket && socket.connected) {
            socket.emit('video_frame', { image: base64Image });
        }
    }, 100);  // Send 10 frames per second
}

// 4. Receive processed results
socket.on('tracking_results', (data) => {
    // Display processed image with pose landmarks
    processedImage.src = 'data:image/jpeg;base64,' + data.image;
    
    // Update count and status
    score1El.textContent = data.count;
    statusDisplay.textContent = data.status;
});
```

---

## Part 3: Communication Flow

### Step-by-Step Data Flow

```
1. User clicks "Start Game"
   ↓
2. Frontend requests camera access
   ↓
3. Camera stream starts → Connect to Socket.IO
   ↓
4. Frontend captures frame every 100ms:
   - Video element → Canvas → JPEG → Base64
   ↓
5. Emit 'video_frame' event:
   socket.emit('video_frame', { image: base64String })
   ↓
6. Backend receives frame:
   - Decode base64 → OpenCV image
   ↓
7. Process with MediaPipe:
   - Detect pose landmarks
   - Track jumping jack movement
   - Draw landmarks on image
   - Count jumping jacks
   ↓
8. Encode back to base64:
   - Processed image → JPEG → Base64
   ↓
9. Emit 'tracking_results' back:
   await sio.emit('tracking_results', { image, count, status })
   ↓
10. Frontend receives results:
    - Update image display
    - Update count/status text
```

---

## Part 4: Key Concepts

### 4.1 WebSocket vs HTTP
- **HTTP**: Request → Response (one-way, client initiates)
- **WebSocket**: Bidirectional, persistent connection (real-time)
- **Socket.IO**: Wrapper around WebSocket with fallback to polling, auto-reconnection

### 4.2 Why Socket.IO?
- Handles connection issues automatically
- Falls back to polling if WebSocket unavailable
- Easy reconnection logic
- Room-based messaging (per client session)

### 4.3 Base64 Encoding Details
```javascript
// Frontend: Image → Base64
canvas.toDataURL('image/jpeg', quality)
// Returns: "data:image/jpeg;base64,/9j/4AAQSkZJRg..."

// Backend: Base64 → Image
base64.b64decode(string)  // Get bytes
np.frombuffer(bytes, dtype=np.uint8)  // NumPy array
cv2.imdecode(array, cv2.IMREAD_COLOR)  // OpenCV image
```

### 4.4 Per-Session State Management
```python
# Each client gets their own counter instance
counters = {}  # {session_id: JumpingJackCounter}

@sio.on('connect')
async def connect(sid, environ):
    counters[sid] = JumpingJackCounter()  # New counter per client

@sio.on('video_frame')
async def handle_video_frame(sid, data):
    jump_counter = counters[sid]  # Use this client's counter
    # Process with their counter...
```

---

## Part 5: Video Processing Pipeline

### 5.1 MediaPipe Processing (`jumping_jack_counter.py`)
```python
def process_frame(self, frame):
    # 1. Convert BGR to RGB (MediaPipe expects RGB)
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    
    # 2. Process with MediaPipe Pose
    results = self.pose.process(rgb_frame)
    
    # 3. Draw landmarks on image
    if results.pose_landmarks:
        mp_drawing.draw_landmarks(...)
    
    # 4. Track jumping jack movement
    # - Detect hands up/down
    # - Count complete cycles
    
    return image, count, status
```

### 5.2 Image Flipping (Mirror Effect)
```python
# Original: Text drawn on left, MediaPipe landmarks on left
processed_frame = jump_counter.process_frame(frame)

# Flip horizontally for mirror view
processed_frame = cv2.flip(processed_frame, 1)
# Now: Original text on left → appears on right (backwards)
#      MediaPipe landmarks flipped (mirrored)

# Redraw text on left side (now readable)
cv2.putText(processed_frame, status, (10, 120), ...)
```

---

## Part 6: Why This Architecture?

### Advantages:
1. **Real-time**: WebSocket enables low-latency communication (~100ms)
2. **Scalable**: Can handle multiple clients (one counter per session)
3. **Separation**: Frontend handles UI, backend handles heavy computation
4. **Flexibility**: Easy to change backend algorithm without touching frontend

### Trade-offs:
- **Base64 Overhead**: ~33% larger than binary, but easier to work with
- **Frame Rate**: Limited by network/processing (10 FPS in this case)
- **Quality**: JPEG compression (quality 0.3) balances size vs quality

---

## Part 7: Server Setup

### Backend Server (Port 8000)
```bash
cd /path/to/proj
source venv/bin/activate
uvicorn Fitness.server:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend Server (Port 8001)
```bash
cd /path/to/proj
python3 -m http.server 8001
```

### CORS Configuration
```python
# Backend must allow frontend origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8001", "http://127.0.0.1:8001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## Part 8: Common Issues & Solutions

### Issue 1: CORS Errors
**Symptom**: Browser blocks connection  
**Solution**: Configure CORS middleware in FastAPI

### Issue 2: Module Import Errors
**Symptom**: `ModuleNotFoundError: No module named 'Fitness'`  
**Solution**: Run `uvicorn` from parent directory (`proj/`), not `Fitness/`

### Issue 3: Text Appears Backwards
**Symptom**: Text mirrored after flipping video  
**Solution**: Redraw text after flipping, not before

### Issue 4: Connection Refused
**Symptom**: `ERR_CONNECTION_REFUSED`  
**Solution**: Ensure backend server is running, check port matches

---

## Part 9: Learning Resources

1. **FastAPI**: https://fastapi.tiangolo.com/
2. **Socket.IO**: https://socket.io/docs/v4/
3. **MediaPipe**: https://mediapipe.dev/
4. **WebRTC/Webcam API**: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia

---

## Summary

This integration creates a **real-time video processing pipeline**:
1. **Frontend captures** video frames from webcam
2. **Converts to base64** for transmission
3. **Sends via WebSocket** (Socket.IO) to backend
4. **Backend processes** with MediaPipe/OpenCV
5. **Returns processed frame** + data (count, status)
6. **Frontend displays** results and updates UI

The key technologies: **WebSocket** for real-time, **Base64** for image transmission, **MediaPipe** for pose detection, and **per-session state** for multi-user support.

