import sys
sys.path.append('.')

import cv2
import numpy as np
import base64
import socketio
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from Fitness.jumping_jack_counter import JumpingJackCounter

# Initialize FastAPI app
app = FastAPI()

# Add CORS middleware - be more permissive for testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for testing
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Socket.IO with CORS
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins="*",  # Allow all origins for testing
    logger=True,
    engineio_logger=True
)

socket_app = socketio.ASGIApp(sio, socketio_path='socket.io')
app.mount('/socket.io', socket_app)

# Dictionary to store counter instances per session
counters = {}

@app.get("/")
async def read_root():
    return {"message": "Jumping Jack Counter Backend"}

@sio.on('connect')
async def connect(sid, environ):
    print(f"✅ Client connected: {sid}")
    counters[sid] = JumpingJackCounter()

@sio.on('disconnect')
async def disconnect(sid):
    print(f"❌ Client disconnected: {sid}")
    if sid in counters:
        del counters[sid]

@sio.on('video_frame')
async def handle_video_frame(sid, data):
    try:
        if sid not in counters:
            counters[sid] = JumpingJackCounter()
        
        jump_counter = counters[sid]
        
        # Decode base64 image
        if 'image' not in data:
            print("No 'image' key in data")
            return
            
        img_data = base64.b64decode(data['image'])
        np_arr = np.frombuffer(img_data, dtype=np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if frame is None:
            print("Failed to decode frame from client.")
            return

        # Save original frame before processing (for pixel copying later)
        original_frame = frame.copy()
        
        # Process the frame normally (MediaPipe expects normal orientation)
        processed_frame, count, status = jump_counter.process_frame(frame)
        
        # Flip the processed frame for mirror display
        processed_frame = cv2.flip(processed_frame, 1)
        
        # Redraw text on the correct side after flipping (text will be readable on left side)
        height, width = processed_frame.shape[:2]
        
        # Remove old backwards text on right side by copying pixels from flipped original (without text)
        # Flip the original frame to match orientation
        flipped_original = cv2.flip(original_frame, 1)
        # Copy a region from the flipped original to cover where old text was (restores video pixels)
        processed_frame[0:125, width - 410:width] = flipped_original[0:125, width - 410:width]
        
        # Status text on left side (readable, no black background)
        if status == "Ready":
            color = (0, 255, 0)
        elif status == "Hands Up!":
            color = (0, 165, 255)
        else:
            color = (0, 0, 255)
        
        # Draw text with white outline for visibility
        cv2.putText(processed_frame, status, (10, 120), 
                   cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 4, cv2.LINE_AA)  # White outline
        cv2.putText(processed_frame, status, (10, 120), 
                   cv2.FONT_HERSHEY_SIMPLEX, 1, color, 2, cv2.LINE_AA)  # Colored text
        
        # Count text on left side (no black box, just text with outline)
        cv2.putText(processed_frame, f'Count: {count}', (10, 60), 
                   cv2.FONT_HERSHEY_SIMPLEX, 2, (255, 255, 255), 5, cv2.LINE_AA)  # White outline
        cv2.putText(processed_frame, f'Count: {count}', (10, 60), 
                   cv2.FONT_HERSHEY_SIMPLEX, 2, (0, 255, 0), 3, cv2.LINE_AA)  # Green text

        # Encode processed frame to base64
        _, buffer = cv2.imencode('.jpg', processed_frame, [cv2.IMWRITE_JPEG_QUALITY, 30])
        encoded_frame = base64.b64encode(buffer).decode('utf-8')

        # Emit results back to client
        await sio.emit('tracking_results', {
            'image': encoded_frame,
            'count': count,
            'status': status
        }, room=sid)

    except Exception as e:
        print(f"❌ Error processing video frame: {e}")
        import traceback
        traceback.print_exc()

@sio.on('reset_counter')
async def handle_reset_counter(sid):
    if sid in counters:
        counters[sid].reset_counter()
        await sio.emit('counter_reset', {'message': 'Counter has been reset.'}, room=sid)
        print(f"🔄 Counter reset by client {sid}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
