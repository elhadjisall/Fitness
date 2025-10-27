import cv2
import mediapipe as mp
import numpy as np

class JumpingJackCounter:
    def __init__(self):
        # Initialize MediaPipe Pose
        self.mp_pose = mp.solutions.pose
        self.mp_drawing = mp.solutions.drawing_utils
        self.pose = self.mp_pose.Pose(
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        
        # Counter variables
        self.count = 0
        self.hands_up = False
        
    def are_hands_up(self, landmarks):
        """
        Check if both hands are raised above shoulders.
        Returns True if hands are up, False otherwise.
        """
        # Get relevant landmark positions
        left_wrist = landmarks[self.mp_pose.PoseLandmark.LEFT_WRIST.value]
        right_wrist = landmarks[self.mp_pose.PoseLandmark.RIGHT_WRIST.value]
        left_shoulder = landmarks[self.mp_pose.PoseLandmark.LEFT_SHOULDER.value]
        right_shoulder = landmarks[self.mp_pose.PoseLandmark.RIGHT_SHOULDER.value]
        
        # Check if both wrists are above shoulders
        left_hand_up = left_wrist.y < left_shoulder.y
        right_hand_up = right_wrist.y < right_shoulder.y
        
        return left_hand_up and right_hand_up
    
    def process_frame(self, frame):
        """
        Process a single frame and update the counter.
        """
        # Convert BGR to RGB
        image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        image.flags.writeable = False
        
        # Process the image and detect pose
        results = self.pose.process(image)
        
        # Convert back to BGR
        image.flags.writeable = True
        image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
        
        # Draw pose landmarks
        if results.pose_landmarks:
            self.mp_drawing.draw_landmarks(
                image,
                results.pose_landmarks,
                self.mp_pose.POSE_CONNECTIONS,
                self.mp_drawing.DrawingSpec(color=(0, 255, 0), thickness=2, circle_radius=2),
                self.mp_drawing.DrawingSpec(color=(0, 0, 255), thickness=2, circle_radius=2)
            )
            
            # Check hand position and count
            current_hands_up = self.are_hands_up(results.pose_landmarks.landmark)
            
            # Count when hands go from down to up
            if current_hands_up and not self.hands_up:
                self.count += 1
            
            self.hands_up = current_hands_up
            
            # Display status
            status = "HANDS UP! ✓" if self.hands_up else "Hands Down"
            color = (0, 255, 0) if self.hands_up else (0, 165, 255)
            cv2.putText(image, status, (10, 120), cv2.FONT_HERSHEY_SIMPLEX, 
                       1, color, 2, cv2.LINE_AA)
        else:
            # No pose detected
            cv2.putText(image, "No person detected", (10, 120), 
                       cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2, cv2.LINE_AA)
        
        # Display counter (large and prominent)
        cv2.rectangle(image, (5, 5), (400, 80), (0, 0, 0), -1)
        cv2.rectangle(image, (5, 5), (400, 80), (255, 255, 255), 2)
        cv2.putText(image, f'Count: {self.count}', (15, 60), 
                   cv2.FONT_HERSHEY_SIMPLEX, 2, (0, 255, 0), 3, cv2.LINE_AA)
        
        # Instructions at bottom
        cv2.putText(image, 'Q: Quit | R: Reset', (10, image.shape[0] - 20), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2, cv2.LINE_AA)
        
        return image
    
    def run(self):
        """
        Main loop to capture video and count jumping jacks.
        """
        # Try to find the built-in Mac camera (not Continuity Camera)
        cap = None
        
        # On macOS, try AVFoundation backend with different camera indices
        # The built-in camera is usually index 0 or 1
        for camera_index in [0, 1, 2]:
            print(f"Trying camera index {camera_index}...")
            test_cap = cv2.VideoCapture(camera_index, cv2.CAP_AVFOUNDATION)
            
            if test_cap.isOpened():
                # Try to read a test frame
                ret, frame = test_cap.read()
                if ret and frame is not None:
                    print(f"✓ Successfully opened camera {camera_index}")
                    cap = test_cap
                    break
                else:
                    test_cap.release()
            else:
                test_cap.release()
        
        if cap is None or not cap.isOpened():
            print("\nError: Could not open any webcam.")
            print("Troubleshooting:")
            print("  1. Make sure camera permissions are enabled")
            print("  2. Close other apps using the camera (FaceTime, Zoom, etc.)")
            print("  3. Disconnect iPhone if using Continuity Camera")
            return
        
        print("=" * 60)
        print("🏃 JUMPING JACK COUNTER (MediaPipe Edition)")
        print("=" * 60)
        print("\n📋 Instructions:")
        print("  1. Stand back so your full body is visible")
        print("  2. Raise both hands above your shoulders")
        print("  3. Each time you raise your hands = +1 count")
        print("\n⌨️  Controls:")
        print("  Q - Quit the program")
        print("  R - Reset counter to zero")
        print("\n💡 Tips:")
        print("  - Make sure your FULL BODY is visible")
        print("  - Use good lighting")
        print("  - Stand 5-8 feet from camera")
        print("  - Raise hands fully above shoulders")
        print("\n" + "=" * 60)
        print("Starting camera...\n")
        
        # Set camera resolution for better performance
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        
        while cap.isOpened():
            ret, frame = cap.read()
            
            if not ret:
                print("Error: Could not read frame.")
                break
            
            # Flip frame for mirror effect
            frame = cv2.flip(frame, 1)
            
            # Process the frame
            processed_frame = self.process_frame(frame)
            
            # Display the frame
            cv2.imshow('Jumping Jack Counter', processed_frame)
            
            # Handle key presses
            key = cv2.waitKey(1) & 0xFF
            if key == ord('q') or key == ord('Q'):
                break
            elif key == ord('r') or key == ord('R'):
                self.count = 0
                self.hands_up = False
                print(f"\n✓ Counter reset to 0")
        
        # Cleanup
        cap.release()
        cv2.destroyAllWindows()
        self.pose.close()
        
        print("\n" + "=" * 60)
        print(f"🎉 Final Score: {self.count} jumping jacks!")
        print("=" * 60)
        print("\nGreat workout! 💪\n")

def main():
    try:
        counter = JumpingJackCounter()
        counter.run()
    except KeyboardInterrupt:
        print("\n\nProgram interrupted by user.")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        print("Please make sure your webcam is properly connected.")
        print("Also ensure you're running this with Python 3.12 virtual environment:")
        print("  source venv/bin/activate")
        print("  python jumping_jack_counter.py")

if __name__ == "__main__":
    main()
