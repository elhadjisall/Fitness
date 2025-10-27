# Jumping Jack Counter 🏃‍♂️

A simple computer vision program that counts jumping jacks in real-time using your webcam!

## Features

- **Real-time pose detection** using MediaPipe
- **Automatic counting** when hands go up
- **Visual feedback** with skeleton overlay
- **Simple controls** - reset counter or quit anytime

## Requirements

- **Python 3.12** (MediaPipe not yet compatible with Python 3.13+)
- Webcam
- Good lighting for best results

## Installation

1. Create a virtual environment with Python 3.12 (already done in this project):
```bash
python3.12 -m venv venv
```

2. Activate the virtual environment:
```bash
source venv/bin/activate
```

3. Install the required packages:
```bash
pip install -r requirements.txt
```

## Usage

### Option 1: Using the run script (easiest)
```bash
./run.sh
```

### Option 2: Manual activation
1. Make sure the virtual environment is activated:
```bash
source venv/bin/activate
```

2. Run the program:
```bash
python jumping_jack_counter.py
```

3. Stand in front of your webcam where your full body is visible

4. Start doing jumping jacks! The counter will increment each time you raise your hands above your shoulders

5. Controls:
   - Press **Q** to quit
   - Press **R** to reset the counter

## How It Works

The program uses MediaPipe's pose estimation to detect 33 body landmarks in real-time. It specifically tracks:
- Left and right wrist positions
- Left and right shoulder positions

When both wrists move above the shoulders, it counts as one jumping jack.

## Tips for Best Results

- Stand 5-8 feet from the camera
- Ensure your full body is visible in the frame
- Use good lighting
- Wear contrasting clothing from your background
- Make sure to raise your hands fully above your shoulders

## Troubleshooting

**Webcam not working?**
- Check if another application is using the webcam
- Make sure you've granted camera permissions

**Counter not detecting?**
- Ensure your full body is visible
- Raise your hands fully above your shoulders
- Check lighting conditions

**Low frame rate?**
- Close other applications
- Try lowering video resolution (modify the code if needed)

## Technologies Used

- **OpenCV**: Video capture and display
- **MediaPipe**: Pose estimation and landmark detection
- **NumPy**: Numerical operations

## License

Free to use and modify!

