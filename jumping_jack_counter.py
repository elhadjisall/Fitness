import cv2
import mediapipe as mp
import numpy as np
import time
from collections import deque

class JumpingJackCounter:
    def __init__(self):
        # Initialize MediaPipe Pose - use separate instances for better isolation
        self.mp_pose = mp.solutions.pose
        self.mp_drawing = mp.solutions.drawing_utils
        # Create separate pose detectors for each player to avoid cross-contamination
        self.pose_player1 = self.mp_pose.Pose(
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        self.pose_player2 = self.mp_pose.Pose(
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        
        # Counter variables for Player 1 (left side) and Player 2 (right side)
        self.player1_count = 0
        self.player1_hands_up = False
        self.player1_legs_spread = False
        self.player1_in_jumping_jack_position = False  # Both hands up AND legs spread
        self.player2_count = 0
        self.player2_hands_up = False
        self.player2_legs_spread = False
        self.player2_in_jumping_jack_position = False  # Both hands up AND legs spread
        
        # Performance tracking for AI analysis
        self.game_start_time = None
        self.player1_jump_times = []  # Timestamps of each jump
        self.player2_jump_times = []
        self.player1_hands_up_duration = 0.0  # Total time hands were up
        self.player2_hands_up_duration = 0.0
        self.player1_last_hands_up_time = None
        self.player2_last_hands_up_time = None
        self.player1_total_frames = 0
        self.player2_total_frames = 0
        self.player1_active_frames = 0  # Frames where player was detected
        self.player2_active_frames = 0
        
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
    
    def are_legs_spread(self, landmarks):
        """
        Check if legs are spread outward (jumping jack position).
        Returns True if legs are spread, False if legs are together.
        """
        # Get relevant landmark positions for legs
        left_hip = landmarks[self.mp_pose.PoseLandmark.LEFT_HIP.value]
        right_hip = landmarks[self.mp_pose.PoseLandmark.RIGHT_HIP.value]
        left_ankle = landmarks[self.mp_pose.PoseLandmark.LEFT_ANKLE.value]
        right_ankle = landmarks[self.mp_pose.PoseLandmark.RIGHT_ANKLE.value]
        
        # Calculate the distance between hips and ankles
        # In a jumping jack, the ankles should be further apart than the hips
        hip_distance = abs(left_hip.x - right_hip.x)
        ankle_distance = abs(left_ankle.x - right_ankle.x)
        
        # Legs are spread if ankle distance is significantly greater than hip distance
        # Also check if ankles are visible (z < 0 means closer to camera, more reliable)
        legs_are_spread = ankle_distance > (hip_distance * 1.3)  # 30% wider at ankles
        
        # Additional check: ensure both ankles are detected (visibility > 0.5)
        left_ankle_visible = left_ankle.visibility > 0.5
        right_ankle_visible = right_ankle.visibility > 0.5
        
        return legs_are_spread and left_ankle_visible and right_ankle_visible
    
    def is_pose_in_half(self, landmarks, half_width, is_left_half):
        """
        Check if the detected pose is actually in the correct half of the frame.
        This prevents cross-contamination when a person is near the middle.
        """
        # Get the center point of the pose (average of shoulders)
        left_shoulder = landmarks[self.mp_pose.PoseLandmark.LEFT_SHOULDER.value]
        right_shoulder = landmarks[self.mp_pose.PoseLandmark.RIGHT_SHOULDER.value]
        
        # Calculate center x coordinate (in normalized coordinates, 0-1)
        center_x = (left_shoulder.x + right_shoulder.x) / 2.0
        
        # For left half, center should be in left portion (0 to 0.6 of half width)
        # For right half, center should be in right portion (0.4 to 1.0 of half width)
        if is_left_half:
            return center_x < 0.6  # Pose center should be in left 60% of left half
        else:
            return center_x > 0.4  # Pose center should be in right 60% of right half
    
    def start_game(self):
        """Initialize game start time for performance tracking"""
        self.game_start_time = time.time()
        self.player1_jump_times = []
        self.player2_jump_times = []
        self.player1_hands_up_duration = 0.0
        self.player2_hands_up_duration = 0.0
        self.player1_total_frames = 0
        self.player2_total_frames = 0
        self.player1_active_frames = 0
        self.player2_active_frames = 0
    
    def process_frame(self, frame):
        """
        Process a single frame and update counters for both players.
        Splits the frame into left and right halves to track 2 people separately.
        Returns the processed image, player counts, and statuses.
        """
        current_time = time.time()
        if self.game_start_time is None:
            self.start_game()
        
        height, width = frame.shape[:2]
        mid_point = width // 2
        
        # Split frame into left and right halves
        # NOTE: After flipping in server.py, left becomes right and right becomes left
        # So we assign Player 1 to right half and Player 2 to left half here
        # so that after flipping, Player 1 appears on left and Player 2 on right
        left_frame = frame[:, :mid_point]
        right_frame = frame[:, mid_point:]
        
        # Process both halves - SWAPPED assignments to account for flip
        player1_image, player1_count, player1_status, player1_detected = self._process_half_frame(right_frame, 1, False, current_time)
        player2_image, player2_count, player2_status, player2_detected = self._process_half_frame(left_frame, 2, True, current_time)
        
        # Update frame counts
        self.player1_total_frames += 1
        self.player2_total_frames += 1
        if player1_detected:
            self.player1_active_frames += 1
        if player2_detected:
            self.player2_active_frames += 1
        
        # Combine the processed halves back together (Player 1 on right, Player 2 on left before flip)
        combined_image = np.hstack([player2_image, player1_image])
        
        # Draw a vertical line to separate the two players
        cv2.line(combined_image, (mid_point, 0), (mid_point, height), (255, 255, 255), 2)
        
        return combined_image, player1_count, player2_count, player1_status, player2_status
    
    def get_performance_data(self):
        """Get performance metrics for AI analysis"""
        game_duration = time.time() - self.game_start_time if self.game_start_time else 0
        
        # Calculate average time between jumps
        def calculate_avg_jump_interval(jump_times):
            if len(jump_times) < 2:
                return 0
            intervals = [jump_times[i] - jump_times[i-1] for i in range(1, len(jump_times))]
            return sum(intervals) / len(intervals) if intervals else 0
        
        # Calculate consistency (lower std dev = more consistent)
        def calculate_consistency(jump_times):
            if len(jump_times) < 2:
                return 100  # Perfect consistency if only one jump
            intervals = [jump_times[i] - jump_times[i-1] for i in range(1, len(jump_times))]
            if not intervals:
                return 100
            mean_interval = sum(intervals) / len(intervals)
            variance = sum((x - mean_interval) ** 2 for x in intervals) / len(intervals)
            std_dev = variance ** 0.5
            # Convert to consistency score (0-100, higher is better)
            # Lower std dev relative to mean = higher consistency
            if mean_interval == 0:
                return 0
            consistency = max(0, 100 - (std_dev / mean_interval * 100))
            return min(100, consistency)
        
        p1_avg_interval = calculate_avg_jump_interval(self.player1_jump_times)
        p2_avg_interval = calculate_avg_jump_interval(self.player2_jump_times)
        p1_consistency = calculate_consistency(self.player1_jump_times)
        p2_consistency = calculate_consistency(self.player2_jump_times)
        
        # Calculate jumps per minute
        p1_jumps_per_min = (self.player1_count / game_duration * 60) if game_duration > 0 else 0
        p2_jumps_per_min = (self.player2_count / game_duration * 60) if game_duration > 0 else 0
        
        # Calculate activity rate (percentage of time player was detected)
        p1_activity_rate = (self.player1_active_frames / self.player1_total_frames * 100) if self.player1_total_frames > 0 else 0
        p2_activity_rate = (self.player2_active_frames / self.player2_total_frames * 100) if self.player2_total_frames > 0 else 0
        
        return {
            'game_duration': game_duration,
            'player1': {
                'count': self.player1_count,
                'jumps_per_minute': p1_jumps_per_min,
                'avg_jump_interval': p1_avg_interval,
                'consistency': p1_consistency,
                'activity_rate': p1_activity_rate,
                'hands_up_duration': self.player1_hands_up_duration
            },
            'player2': {
                'count': self.player2_count,
                'jumps_per_minute': p2_jumps_per_min,
                'avg_jump_interval': p2_avg_interval,
                'consistency': p2_consistency,
                'activity_rate': p2_activity_rate,
                'hands_up_duration': self.player2_hands_up_duration
            }
        }
    
    def _process_half_frame(self, half_frame, player_num, is_left_half, current_time):
        """
        Process a half frame (left or right) for a single player.
        Returns processed image, count, status, and detection flag.
        """
        # Convert BGR to RGB
        image = cv2.cvtColor(half_frame, cv2.COLOR_BGR2RGB)
        image.flags.writeable = False
        
        # Use the appropriate pose detector for this player
        if player_num == 1:
            results = self.pose_player1.process(image)
            count = self.player1_count
            hands_up = self.player1_hands_up
            legs_spread = self.player1_legs_spread
            in_jumping_jack = self.player1_in_jumping_jack_position
            last_hands_up_time = self.player1_last_hands_up_time
        else:
            results = self.pose_player2.process(image)
            count = self.player2_count
            hands_up = self.player2_hands_up
            legs_spread = self.player2_legs_spread
            in_jumping_jack = self.player2_in_jumping_jack_position
            last_hands_up_time = self.player2_last_hands_up_time
        
        # Convert back to BGR
        image.flags.writeable = True
        image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
        
        half_width = half_frame.shape[1]
        current_status = f"Player {player_num}: No person detected"
        color = (0, 0, 255)  # Red for no detection
        detected = False
        
        # Draw pose landmarks and process
        if results.pose_landmarks:
            # Validate that the pose is actually in the correct half
            if not self.is_pose_in_half(results.pose_landmarks.landmark, half_width, is_left_half):
                # Pose detected but not in correct half - ignore it
                current_status = f"Player {player_num}: No person detected"
                return image, count, current_status, False
            
            detected = True
            # Use different colors for each player
            if player_num == 1:
                landmark_color = (0, 255, 0)  # Green for Player 1
                connection_color = (0, 200, 0)
            else:
                landmark_color = (255, 0, 255)  # Magenta for Player 2
                connection_color = (200, 0, 200)
            
            self.mp_drawing.draw_landmarks(
                image,
                results.pose_landmarks,
                self.mp_pose.POSE_CONNECTIONS,
                self.mp_drawing.DrawingSpec(color=landmark_color, thickness=2, circle_radius=2),
                self.mp_drawing.DrawingSpec(color=connection_color, thickness=2, circle_radius=2)
            )
            
            # Check hand and leg positions
            current_hands_up = self.are_hands_up(results.pose_landmarks.landmark)
            current_legs_spread = self.are_legs_spread(results.pose_landmarks.landmark)
            
            # Full jumping jack position: both hands up AND legs spread
            current_jumping_jack_position = current_hands_up and current_legs_spread
            
            # Track hands up duration
            if current_hands_up:
                if last_hands_up_time is None:
                    last_hands_up_time = current_time
                else:
                    # Accumulate time hands have been up
                    time_delta = current_time - last_hands_up_time
                    if player_num == 1:
                        self.player1_hands_up_duration += time_delta
                    else:
                        self.player2_hands_up_duration += time_delta
                    last_hands_up_time = current_time
            else:
                last_hands_up_time = None
            
            # Count when transitioning from starting position to jumping jack position
            # Starting position: NOT in jumping jack (hands down OR legs together)
            # Jumping jack position: hands up AND legs spread
            # Count when we transition from NOT in jumping jack to IN jumping jack
            if current_jumping_jack_position and not in_jumping_jack:
                # Increment count for this specific player
                if player_num == 1:
                    self.player1_count += 1
                    count = self.player1_count
                    self.player1_hands_up = current_hands_up
                    self.player1_legs_spread = current_legs_spread
                    self.player1_in_jumping_jack_position = current_jumping_jack_position
                    self.player1_jump_times.append(current_time)
                    self.player1_last_hands_up_time = current_time
                else:
                    self.player2_count += 1
                    count = self.player2_count
                    self.player2_hands_up = current_hands_up
                    self.player2_legs_spread = current_legs_spread
                    self.player2_in_jumping_jack_position = current_jumping_jack_position
                    self.player2_jump_times.append(current_time)
                    self.player2_last_hands_up_time = current_time
            else:
                # Just update the states (no count increment)
                if player_num == 1:
                    self.player1_hands_up = current_hands_up
                    self.player1_legs_spread = current_legs_spread
                    self.player1_in_jumping_jack_position = current_jumping_jack_position
                    count = self.player1_count
                    self.player1_last_hands_up_time = last_hands_up_time
                else:
                    self.player2_hands_up = current_hands_up
                    self.player2_legs_spread = current_legs_spread
                    self.player2_in_jumping_jack_position = current_jumping_jack_position
                    count = self.player2_count
                    self.player2_last_hands_up_time = last_hands_up_time
            
            # Update status based on full body position
            if current_jumping_jack_position:
                current_status = f"Player {player_num}: JUMPING JACK! ✓"
                color = (0, 255, 0)  # Green
            elif current_hands_up and not current_legs_spread:
                current_status = f"Player {player_num}: Hands Up, Legs Together"
                color = (0, 200, 255)  # Cyan
            elif not current_hands_up and current_legs_spread:
                current_status = f"Player {player_num}: Legs Spread, Hands Down"
                color = (0, 200, 255)  # Cyan
            else:
                current_status = f"Player {player_num}: Ready Position"
                color = (0, 165, 255)  # Orange
        
        # Draw status text (will be redrawn by server.py after flipping)
        # We don't draw count here as server.py will handle it
        
        return image, count, current_status, detected
    
    def reset_counter(self):
        """Reset both players' counters and performance data"""
        self.player1_count = 0
        self.player1_hands_up = False
        self.player1_legs_spread = False
        self.player1_in_jumping_jack_position = False
        self.player2_count = 0
        self.player2_hands_up = False
        self.player2_legs_spread = False
        self.player2_in_jumping_jack_position = False
        self.start_game()  # Reset performance tracking

# The main function and direct execution block are removed as this file is now imported by the server.
# def main():
#     try:
#         counter = JumpingJackCounter()
#         counter.run()
#     except KeyboardInterrupt:
#         print("\n\nProgram interrupted by user.")
#     except Exception as e:
#         print(f"\n❌ Error: {e}")
#         print("Please make sure your webcam is properly connected.")
#         print("Also ensure you're running this with Python 3.12 virtual environment:")
#         print("  source venv/bin/activate")
#         print("  python jumping_jack_counter.py")

# if __name__ == "__main__":
#     main()
