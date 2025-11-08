// ======== Elements ========
const startBtn = document.getElementById('startBtn');
const quitBtn = document.getElementById('quitBtn');
const instructionsBtn = document.getElementById('instructionsBtn');
const webcam = document.getElementById('webcam');
const processedImage = document.getElementById('processedImage');
const menu = document.getElementById('menu');
const game = document.getElementById('game');
const score1El = document.getElementById('score1');
const score2El = document.getElementById('score2');
const timerDisplay = document.getElementById('timer');
const musicToggleBtn = document.getElementById('musicToggleBtn');
const statusDisplay = document.getElementById('statusDisplay');
const trackingStatusDiv = document.getElementById('trackingStatus');

// ======== Popup Elements ========
const popup = document.getElementById('popup');
const winnerMessage = document.getElementById('winnerMessage');
const replayBtn = document.getElementById('replayBtn');
const popupQuitBtn = document.getElementById('popupQuitBtn');

// ======== Background Music ========
const menuMusic = new Audio('audio/menu_music.mp3');
const gameMusic = new Audio('audio/game_music.mp3');
menuMusic.loop = true;
gameMusic.loop = true;

let musicOn = false;
let player1Score = 0;
let player2Score = 0;
let socket;
let videoInterval;
const SERVER_URL = 'http://127.0.0.1:8000';
let gameTimer;
let timeLeft = 120;

// ======== Speech (TTS) Function ========
function speak(text) {
  const msg = new SpeechSynthesisUtterance(text);
  msg.rate = 1;
  msg.pitch = 1;
  msg.lang = 'en-US';
  window.speechSynthesis.speak(msg);
}

// ======== Webcam setup ========
async function startWebcam() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    webcam.srcObject = stream;
    webcam.onloadedmetadata = () => {
      console.log("📷 Camera stream loaded.");
      connectWebSocket();
    };
    speak("Let's start the fitness challenge!");
    return true;
  } catch (error) {
    console.error("❌ Camera error:", error);
    speak("Camera access denied. Please allow access to play the game.");
    alert("Camera access denied or unavailable.");
    return false;
  }
}

function connectWebSocket() {
  console.log("🔌 Attempting to connect to:", SERVER_URL);
  
  // Connect to the backend Socket.IO server
  socket = io(SERVER_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5
  });

  socket.on('connect', () => {
    console.log('✅ Connected to WebSocket server! Socket ID:', socket.id);
    startSendingVideoFrames();
    trackingStatusDiv.style.display = 'block';
    processedImage.style.display = 'block';
    webcam.style.display = 'none';
    statusDisplay.textContent = "Connected! Detecting person...";
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ Disconnected from WebSocket server. Reason:', reason);
    stopSendingVideoFrames();
    trackingStatusDiv.style.display = 'none';
    processedImage.style.display = 'none';
    webcam.style.display = 'block';
    statusDisplay.textContent = "Disconnected from server";
  });

  socket.on('tracking_results', (data) => {
    if (data.image) {
      processedImage.src = 'data:image/jpeg;base64,' + data.image;
    }
    score1El.textContent = data.count;
    statusDisplay.textContent = data.status;
  });

  socket.on('counter_reset', (data) => {
    console.log("🔄", data.message);
    score1El.textContent = 0;
    statusDisplay.textContent = "Counter Reset!";
  });

  socket.on('connect_error', (error) => {
    console.error("❌ WebSocket connection error:", error);
    console.error("Error details:", error.message);
    statusDisplay.textContent = "Error connecting to backend. Check console.";
    stopSendingVideoFrames();
    trackingStatusDiv.style.display = 'none';
    processedImage.style.display = 'none';
    webcam.style.display = 'block';
  });

  socket.on('error', (error) => {
    console.error("❌ Socket error:", error);
  });
}

function startSendingVideoFrames() {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  console.log("📹 Starting to send video frames...");

  videoInterval = setInterval(() => {
    if (webcam.readyState === webcam.HAVE_ENOUGH_DATA) {
      canvas.width = webcam.videoWidth;
      canvas.height = webcam.videoHeight;
      context.drawImage(webcam, 0, 0, canvas.width, canvas.height);
      const imageData = canvas.toDataURL('image/jpeg', 0.3);
      const base64Image = imageData.split(',')[1];

      if (socket && socket.connected) {
        socket.emit('video_frame', { image: base64Image });
      } else {
        console.warn("⚠️ Socket not connected, skipping frame");
      }
    }
  }, 100);
}

function stopSendingVideoFrames() {
  console.log("⏹️ Stopping video frames");
  clearInterval(videoInterval);
  if (socket) {
    socket.disconnect();
  }
}

// ======== Game Timer ========
function startTimer() {
  timeLeft = 120;
  clearInterval(gameTimer);
  timerDisplay.textContent = "2:00";
  timerDisplay.classList.remove("warning");

  gameTimer = setInterval(() => {
    timeLeft--;

    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerDisplay.textContent = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;

    if (timeLeft <= 10) {
      timerDisplay.classList.add("warning");
    }

    if (timeLeft <= 0) {
      clearInterval(gameTimer);
      timerDisplay.textContent = "0:00";
      timerDisplay.classList.remove("warning");
      timerDisplay.style.display = "none";

      let winnerText = "";
      if (player1Score > player2Score) {
        winnerText = "Congratulations Player 1!";
      } else if (player2Score > player1Score) {
        winnerText = "Congratulations Player 2!";
      } else {
        winnerText = "It's a tie!";
      }

      winnerMessage.textContent = winnerText;
      popup.style.display = "flex";
      speak(winnerText);
    }
  }, 1000);
}

// ======== Button events ========
startBtn.addEventListener('click', async () => {
  console.log("🎮 Start button clicked");
  const webcamGranted = await startWebcam();
  if (webcamGranted) {
    menu.style.display = 'none';
    game.style.display = 'flex';
    timerDisplay.style.display = "block";
    startTimer();

    if (musicOn) {
      menuMusic.pause();
      menuMusic.currentTime = 0;
      gameMusic.play();
    }
  }
});

instructionsBtn.addEventListener('click', () => {
  speak("Welcome to the Kids Fitness Battle! Two players stand in front of the camera. Perform the exercises shown, and every correct move earns you one point. After two minutes, the player with the most points wins!");
});

musicToggleBtn.addEventListener('click', () => {
  musicOn = !musicOn;
  musicToggleBtn.textContent = musicOn ? "🎵 Music: On" : "🎵 Music: Off";

  if (musicOn) {
    if (menu.style.display !== "none") {
      menuMusic.play();
    } else if (game.style.display !== "none") {
      gameMusic.play();
    }
  } else {
    menuMusic.pause();
    menuMusic.currentTime = 0;
    gameMusic.pause();
    gameMusic.currentTime = 0;
  }
});

quitBtn.addEventListener('click', () => {
  stopGame();
  game.style.display = 'none';
  menu.style.display = 'flex';

  if (musicOn) {
    gameMusic.pause();
    gameMusic.currentTime = 0;
    menuMusic.play();
  }

  speak("Game exited. Returning to the main menu.");
});

replayBtn.addEventListener('click', () => {
  popup.style.display = "none";
  player1Score = 0;
  player2Score = 0;
  score1El.textContent = 0;
  score2El.textContent = 0;

  if (socket && socket.connected) {
    socket.emit('reset_counter');
  }

  timerDisplay.style.display = "block";
  startTimer();
  speak("New round starting!");
});

popupQuitBtn.addEventListener('click', () => {
  stopGame();
  popup.style.display = "none";
  game.style.display = 'none';
  menu.style.display = 'flex';

  if (musicOn) {
    gameMusic.pause();
    gameMusic.currentTime = 0;
    menuMusic.play();
  }

  speak("Returning to the main menu.");
});

function stopGame() {
  const stream = webcam.srcObject;
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }

  player1Score = 0;
  player2Score = 0;
  score1El.textContent = 0;
  score2El.textContent = 0;

  clearInterval(gameTimer);
  stopSendingVideoFrames();

  timerDisplay.textContent = "2:00";
  timerDisplay.classList.remove("warning");
  timerDisplay.style.display = "none";

  processedImage.src = "";
  processedImage.style.display = 'none';
  statusDisplay.textContent = "Waiting for person...";
  trackingStatusDiv.style.display = 'none';
}
