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
from Fitness.ai_analyzer import generate_performance_report

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
    counters[sid].start_game()  # Initialize game tracking

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
        processed_frame, player1_count, player2_count, player1_status, player2_status = jump_counter.process_frame(frame)
        
        # Flip the processed frame for mirror display
        processed_frame = cv2.flip(processed_frame, 1)
        
        # Redraw text on the correct side after flipping (text will be readable on left side)
        height, width = processed_frame.shape[:2]
        mid_point = width // 2
        
        # Redraw the vertical separator line after flipping
        cv2.line(processed_frame, (mid_point, 0), (mid_point, height), (255, 255, 255), 2)
        
        # Remove old backwards text by copying pixels from flipped original (without text)
        # Flip the original frame to match orientation
        flipped_original = cv2.flip(original_frame, 1)
        # Copy regions from the flipped original to cover where old text was
        processed_frame[0:125, :410] = flipped_original[0:125, :410]  # Left side
        processed_frame[0:125, width - 410:width] = flipped_original[0:125, width - 410:width]  # Right side
        
        # Draw Player 1 info on left side
        # Status text
        if "JUMPING JACK" in player1_status:
            color1 = (0, 255, 0)  # Green - full jumping jack position
        elif "Hands Up" in player1_status or "Legs Spread" in player1_status:
            color1 = (0, 200, 255)  # Cyan - partial position
        elif "Ready Position" in player1_status:
            color1 = (0, 165, 255)  # Orange - starting position
        else:
            color1 = (0, 0, 255)  # Red - no detection
        
        # Player 1 status with white outline
        status_text1 = player1_status.replace("Player 1: ", "")
        # Shorten long status messages for better display
        if len(status_text1) > 25:
            status_text1 = status_text1[:22] + "..."
        cv2.putText(processed_frame, status_text1, (10, 120), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 4, cv2.LINE_AA)  # White outline
        cv2.putText(processed_frame, status_text1, (10, 120), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, color1, 2, cv2.LINE_AA)  # Colored text
        
        # Player 1 count with white outline
        cv2.putText(processed_frame, f'P1: {player1_count}', (10, 60), 
                   cv2.FONT_HERSHEY_SIMPLEX, 1.5, (255, 255, 255), 5, cv2.LINE_AA)  # White outline
        cv2.putText(processed_frame, f'P1: {player1_count}', (10, 60), 
                   cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 255, 0), 3, cv2.LINE_AA)  # Green text
        
        # Draw Player 2 info on right side
        # Status text
        if "JUMPING JACK" in player2_status:
            color2 = (0, 255, 0)  # Green - full jumping jack position
        elif "Hands Up" in player2_status or "Legs Spread" in player2_status:
            color2 = (0, 200, 255)  # Cyan - partial position
        elif "Ready Position" in player2_status:
            color2 = (0, 165, 255)  # Orange - starting position
        else:
            color2 = (0, 0, 255)  # Red - no detection
        
        # Player 2 status with white outline (on right side)
        status_text2 = player2_status.replace("Player 2: ", "")
        # Shorten long status messages for better display
        if len(status_text2) > 25:
            status_text2 = status_text2[:22] + "..."
        text_size2 = cv2.getTextSize(status_text2, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)[0]
        text_x2 = mid_point + 10
        cv2.putText(processed_frame, status_text2, (text_x2, 120), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 4, cv2.LINE_AA)  # White outline
        cv2.putText(processed_frame, status_text2, (text_x2, 120), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, color2, 2, cv2.LINE_AA)  # Colored text
        
        # Player 2 count with white outline (on right side)
        text_size_count2 = cv2.getTextSize(f'P2: {player2_count}', cv2.FONT_HERSHEY_SIMPLEX, 1.5, 3)[0]
        cv2.putText(processed_frame, f'P2: {player2_count}', (text_x2, 60), 
                   cv2.FONT_HERSHEY_SIMPLEX, 1.5, (255, 255, 255), 5, cv2.LINE_AA)  # White outline
        cv2.putText(processed_frame, f'P2: {player2_count}', (text_x2, 60), 
                   cv2.FONT_HERSHEY_SIMPLEX, 1.5, (255, 0, 255), 3, cv2.LINE_AA)  # Magenta text

        # Encode processed frame to base64
        _, buffer = cv2.imencode('.jpg', processed_frame, [cv2.IMWRITE_JPEG_QUALITY, 30])
        encoded_frame = base64.b64encode(buffer).decode('utf-8')

        # Emit results back to client with both player scores
        await sio.emit('tracking_results', {
            'image': encoded_frame,
            'player1_count': player1_count,
            'player2_count': player2_count,
            'player1_status': player1_status,
            'player2_status': player2_status
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
