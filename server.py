import sys
sys.path.append('.')

import cv2
import numpy as np
import base64
import socketio
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from jumping_jack_counter import JumpingJackCounter
from ai_analyzer import generate_performance_report

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
# Track processing state to skip frames if processing is slow
processing_state = {}

@app.get("/")
async def read_root():
    return {"message": "Jumping Jack Counter Backend"}

@sio.on('connect')
async def connect(sid, environ):
    print(f"✅ Client connected: {sid}")
    counters[sid] = JumpingJackCounter()
    counters[sid].start_game()  # Initialize game tracking

@sio.on('disconnect')
async def disconnect(sid):
    print(f"❌ Client disconnected: {sid}")
    if sid in counters:
        del counters[sid]
    if sid in processing_state:
        del processing_state[sid]

@sio.on('video_frame')
async def handle_video_frame(sid, data):
    try:
        # Skip frame if still processing previous one (frame dropping for smoothness)
        if sid in processing_state and processing_state[sid]:
            return
        
        if sid not in counters:
            counters[sid] = JumpingJackCounter()
        
        processing_state[sid] = True
        jump_counter = counters[sid]
        
        # Decode base64 image
        if 'image' not in data:
            print("No 'image' key in data")
            processing_state[sid] = False
            return
            
        img_data = base64.b64decode(data['image'])
        np_arr = np.frombuffer(img_data, dtype=np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if frame is None:
            print("Failed to decode frame from client.")
            processing_state[sid] = False
            return

        # Resize frame for faster processing (MediaPipe works well on 640-800px width)
        PROCESSING_WIDTH = 640
        height, width = frame.shape[:2]
        if width > PROCESSING_WIDTH:
            scale = PROCESSING_WIDTH / width
            new_width = PROCESSING_WIDTH
            new_height = int(height * scale)
            frame = cv2.resize(frame, (new_width, new_height), interpolation=cv2.INTER_AREA)

        # Process the frame normally (MediaPipe expects normal orientation)
        processed_frame, player1_count, player2_count, player1_status, player2_status = jump_counter.process_frame(frame)

        # Split the processed frame into two halves
        height, width = processed_frame.shape[:2]
        mid_point = width // 2

        # Extract individual player frames (before flipping)
        player1_frame_raw = processed_frame[:, mid_point:]  # Right half (will be Player 1 after flip)
        player2_frame_raw = processed_frame[:, :mid_point]  # Left half (will be Player 2 after flip)

        # Flip both frames for mirror display
        player1_frame = cv2.flip(player1_frame_raw, 1)
        player2_frame = cv2.flip(player2_frame_raw, 1)

        # Draw Player 1 info on their frame
        if "JUMPING JACK" in player1_status:
            color1 = (0, 255, 0)  # Green - full jumping jack position
        elif "Hands Up" in player1_status or "Legs Spread" in player1_status:
            color1 = (0, 200, 255)  # Cyan - partial position
        elif "Ready Position" in player1_status:
            color1 = (0, 165, 255)  # Orange - starting position
        else:
            color1 = (0, 0, 255)  # Red - no detection

        status_text1 = player1_status.replace("Player 1: ", "")
        if len(status_text1) > 25:
            status_text1 = status_text1[:22] + "..."
        cv2.putText(player1_frame, status_text1, (10, 120),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 4, cv2.LINE_AA)
        cv2.putText(player1_frame, status_text1, (10, 120),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, color1, 2, cv2.LINE_AA)
        cv2.putText(player1_frame, f'Count: {player1_count}', (10, 60),
                   cv2.FONT_HERSHEY_SIMPLEX, 1.5, (255, 255, 255), 5, cv2.LINE_AA)
        cv2.putText(player1_frame, f'Count: {player1_count}', (10, 60),
                   cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 255, 0), 3, cv2.LINE_AA)

        # Draw Player 2 info on their frame
        if "JUMPING JACK" in player2_status:
            color2 = (0, 255, 0)  # Green - full jumping jack position
        elif "Hands Up" in player2_status or "Legs Spread" in player2_status:
            color2 = (0, 200, 255)  # Cyan - partial position
        elif "Ready Position" in player2_status:
            color2 = (0, 165, 255)  # Orange - starting position
        else:
            color2 = (0, 0, 255)  # Red - no detection

        status_text2 = player2_status.replace("Player 2: ", "")
        if len(status_text2) > 25:
            status_text2 = status_text2[:22] + "..."
        cv2.putText(player2_frame, status_text2, (10, 120),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 4, cv2.LINE_AA)
        cv2.putText(player2_frame, status_text2, (10, 120),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, color2, 2, cv2.LINE_AA)
        cv2.putText(player2_frame, f'Count: {player2_count}', (10, 60),
                   cv2.FONT_HERSHEY_SIMPLEX, 1.5, (255, 255, 255), 5, cv2.LINE_AA)
        cv2.putText(player2_frame, f'Count: {player2_count}', (10, 60),
                   cv2.FONT_HERSHEY_SIMPLEX, 1.5, (255, 0, 255), 3, cv2.LINE_AA)

        # Resize frames for display (optimize for transmission)
        DISPLAY_WIDTH = 640
        DISPLAY_HEIGHT = 480
        player1_frame_resized = cv2.resize(player1_frame, (DISPLAY_WIDTH, DISPLAY_HEIGHT), interpolation=cv2.INTER_AREA)
        player2_frame_resized = cv2.resize(player2_frame, (DISPLAY_WIDTH, DISPLAY_HEIGHT), interpolation=cv2.INTER_AREA)

        # Encode both frames to base64 with better quality
        _, buffer1 = cv2.imencode('.jpg', player1_frame_resized, [cv2.IMWRITE_JPEG_QUALITY, 75])
        encoded_frame1 = base64.b64encode(buffer1).decode('utf-8')

        _, buffer2 = cv2.imencode('.jpg', player2_frame_resized, [cv2.IMWRITE_JPEG_QUALITY, 75])
        encoded_frame2 = base64.b64encode(buffer2).decode('utf-8')

        # Emit results back to client with separate images for each player
        await sio.emit('tracking_results', {
            'player1_image': encoded_frame1,
            'player2_image': encoded_frame2,
            'player1_count': player1_count,
            'player2_count': player2_count,
            'player1_status': player1_status,
            'player2_status': player2_status
        }, room=sid)
        
        processing_state[sid] = False

    except Exception as e:
        print(f"❌ Error processing video frame: {e}")
        import traceback
        traceback.print_exc()
        if sid in processing_state:
            processing_state[sid] = False

@sio.on('reset_counter')
async def handle_reset_counter(sid):
    if sid in counters:
        counters[sid].reset_counter()
        await sio.emit('counter_reset', {'message': 'Counter has been reset.'}, room=sid)
        print(f"🔄 Counter reset by client {sid}")

@sio.on('game_start')
async def handle_game_start(sid):
    """Handle game start event"""
    if sid in counters:
        counters[sid].start_game()
        print(f"🎮 Game started for client {sid}")

@sio.on('game_end')
async def handle_game_end(sid):
    """Handle game end event and generate AI performance report"""
    if sid not in counters:
        return
    
    try:
        jump_counter = counters[sid]
        # Get performance data
        performance_data = jump_counter.get_performance_data()
        
        # Generate AI analysis report
        ai_report = generate_performance_report(performance_data)
        
        # Send report to client
        await sio.emit('ai_report', ai_report, room=sid)
        print(f"📊 AI report generated and sent to client {sid}")
        
    except Exception as e:
        print(f"❌ Error generating AI report: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
