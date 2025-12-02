// ======== Elements ========
const startBtn = document.getElementById('startBtn');
const quitBtn = document.getElementById('quitBtn');
const instructionsBtn = document.getElementById('instructionsBtn');
const webcam = document.getElementById('webcam');
const processedImage1 = document.getElementById('processedImage1');
const processedImage2 = document.getElementById('processedImage2');
const menu = document.getElementById('menu');
const game = document.getElementById('game');
const instructions = document.getElementById('instructions');
const score1El = document.getElementById('score1');
const score2El = document.getElementById('score2');
const timerDisplay = document.getElementById('timer');
const roundIndicator = document.getElementById('roundIndicator');
const musicToggleBtn = document.getElementById('musicToggleBtn');
const backToMenuBtn = document.getElementById('backToMenuBtn');
const speakInstructionsBtn = document.getElementById('speakInstructionsBtn');

// ======== Round Popup Elements ========
const roundPopup = document.getElementById('roundPopup');
const roundMessage = document.getElementById('roundMessage');
const roundExercise = document.getElementById('roundExercise');
const continueBtn = document.getElementById('continueBtn');
const roundQuitBtn = document.getElementById('roundQuitBtn');
const roundDemoVideo = document.getElementById('roundDemoVideo');
const roundDemoVideoSource = document.getElementById('roundDemoVideoSource');

// ======== Winner Popup Elements ========
const popup = document.getElementById('popup');
const winnerMessage = document.getElementById('winnerMessage');
const replayBtn = document.getElementById('replayBtn');
const popupQuitBtn = document.getElementById('popupQuitBtn');

// ======== Background Music ========
const menuMusic = new Audio('audio/menu_music.mp3');
const gameMusic = new Audio('audio/game_music.mp3');
menuMusic.loop = true;
gameMusic.loop = true;

// ======== Game Sound Effects and Round Music ========
const hajimeSound = new Audio('audio/hajime.mp3'); // Plays when game starts
const jumpingJacksMusic = new Audio('audio/jumping_jacks_round.mp3');
const squatsMusic = new Audio('audio/squats_round.mp3');
const pushupsMusic = new Audio('audio/pushups_round.mp3');
jumpingJacksMusic.loop = true;
squatsMusic.loop = true;
pushupsMusic.loop = true;

// Keep track of currently playing round music
let currentRoundMusic = null;

// ======== Game State Variables ========
let musicOn = false;
let player1TotalScore = 0;
let player2TotalScore = 0;
let player1RoundScore = 0;
let player2RoundScore = 0;
let socket;
let videoInterval;
const SERVER_URL = 'http://127.0.0.1:8000';
let gameTimer;
let timeLeft = 30;
let currentRound = 0;

// ======== Round Configuration ========
const rounds = [
  {
    name: 'Jumping Jacks',
    duration: 60,
    exercise: 'jumping_jacks',
    videoPath: 'videos/jumping_jacks_demo.mp4',
    music: jumpingJacksMusic
  },
  {
    name: 'Squats',
    duration: 60,
    exercise: 'squats',
    videoPath: 'videos/squats_demo.mp4',
    music: squatsMusic
  },
  {
    name: 'Push-ups',
    duration: 60,
    exercise: 'pushups',
    videoPath: 'videos/pushups_demo.mp4',
    music: pushupsMusic
  }
];

// ======== Speech (TTS) Function ========
function speak(text, options = {}) {
  const msg = new SpeechSynthesisUtterance(text);

  // Enhanced voice settings for more natural, human-like speech
  msg.rate = options.rate || 0.95; // Slightly slower for clarity
  msg.pitch = options.pitch || 1.1; // Slightly higher pitch for friendliness
  msg.volume = options.volume || 1.0;
  msg.lang = 'en-US';

  // Try to use a more natural voice if available
  const voices = window.speechSynthesis.getVoices();
  // Prefer Google or Microsoft voices which sound more natural
  const preferredVoice = voices.find(voice =>
    voice.name.includes('Google') ||
    voice.name.includes('Microsoft') ||
    voice.name.includes('Natural') ||
    voice.name.includes('Enhanced')
  );

  if (preferredVoice) {
    msg.voice = preferredVoice;
  } else if (voices.length > 0) {
    // Fall back to first available English voice
    const englishVoice = voices.find(voice => voice.lang.startsWith('en'));
    if (englishVoice) {
      msg.voice = englishVoice;
    }
  }

  window.speechSynthesis.speak(msg);
}

function stopSpeech() {
  // Stop all speech synthesis
  window.speechSynthesis.cancel();
}

function speakAIReport(report) {
  // Stop any current speech
  window.speechSynthesis.cancel();

  // Wait a moment before starting
  setTimeout(() => {
    let speechQueue = [];

    // Game summary
    if (report.summary) {
      speechQueue.push(report.summary);
    }

    // Player 1 analysis
    if (report.player1) {
      const p1 = report.player1;
      let p1Speech = `Player 1 Analysis. ${p1.overall || ''} `;
      p1Speech += `Performance Score: ${Math.round(p1.score || 0)} out of 100. `;
      p1Speech += `Total Jumps: ${p1.stats?.total_jumps || 0}. `;
      p1Speech += `Jumps per minute: ${(p1.stats?.jumps_per_minute || 0).toFixed(1)}. `;
      p1Speech += `Consistency: ${(p1.stats?.consistency || 0).toFixed(1)} percent. `;

      if (p1.strengths && p1.strengths.length > 0) {
        p1Speech += `Strengths: ${p1.strengths.join('. ')}. `;
      }

      if (p1.improvements && p1.improvements.length > 0) {
        p1Speech += `Tips for improvement: ${p1.improvements.join('. ')}. `;
      }

      speechQueue.push(p1Speech);
    }

    // Player 2 analysis
    if (report.player2) {
      const p2 = report.player2;
      let p2Speech = `Player 2 Analysis. ${p2.overall || ''} `;
      p2Speech += `Performance Score: ${Math.round(p2.score || 0)} out of 100. `;
      p2Speech += `Total Jumps: ${p2.stats?.total_jumps || 0}. `;
      p2Speech += `Jumps per minute: ${(p2.stats?.jumps_per_minute || 0).toFixed(1)}. `;
      p2Speech += `Consistency: ${(p2.stats?.consistency || 0).toFixed(1)} percent. `;

      if (p2.strengths && p2.strengths.length > 0) {
        p2Speech += `Strengths: ${p2.strengths.join('. ')}. `;
      }

      if (p2.improvements && p2.improvements.length > 0) {
        p2Speech += `Tips for improvement: ${p2.improvements.join('. ')}. `;
      }

      speechQueue.push(p2Speech);
    }

    // Comparison
    if (report.comparison && report.comparison.length > 0) {
      speechQueue.push(`Comparison. ${report.comparison.join('. ')}.`);
    }

    // Speak each section sequentially using onend callback
    let currentIndex = 0;

    function speakNext() {
      if (currentIndex < speechQueue.length) {
        const msg = new SpeechSynthesisUtterance(speechQueue[currentIndex]);
        msg.rate = 0.9; // Slightly slower for better comprehension
        msg.pitch = 1;
        msg.lang = 'en-US';

        msg.onend = () => {
          currentIndex++;
          if (currentIndex < speechQueue.length) {
            // Small pause between sections
            setTimeout(speakNext, 500);
          }
        };

        window.speechSynthesis.speak(msg);
      }
    }

    speakNext();
  }, 1500); // Wait 1.5 seconds before starting (after winner announcement)
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

  socket = io(SERVER_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5
  });

  socket.on('connect', () => {
    console.log('✅ Connected to WebSocket server! Socket ID:', socket.id);
    startSendingVideoFrames();
  });

  socket.on('ai_report', (report) => {
    console.log('📊 Received AI report:', report);
    // Display the AI report immediately
    displayAIReport(report);
    // Scroll to top of popup to show winner message first
    const popupContent = document.querySelector('.popup-content');
    if (popupContent) {
      popupContent.scrollTop = 0;
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ Disconnected from WebSocket server. Reason:', reason);
    stopSendingVideoFrames();
  });

  socket.on('tracking_results', (data) => {
    // Display separate images for each player
    if (data.player1_image) {
      processedImage1.src = 'data:image/jpeg;base64,' + data.player1_image;
    }
    if (data.player2_image) {
      processedImage2.src = 'data:image/jpeg;base64,' + data.player2_image;
    }
    // Update both player scores from backend
    if (data.player1_count !== undefined) {
      player1RoundScore = data.player1_count;
    }
    if (data.player2_count !== undefined) {
      player2RoundScore = data.player2_count;
    }
    updateScoreDisplay();
  });

  socket.on('counter_reset', (data) => {
    console.log("🔄", data.message);
    player1RoundScore = 0;
    player2RoundScore = 0;
    updateScoreDisplay();
  });

  socket.on('connect_error', (error) => {
    console.error("❌ WebSocket connection error:", error);
    console.error("Error details:", error.message);
    stopSendingVideoFrames();
  });

  socket.on('error', (error) => {
    console.error("❌ Socket error:", error);
  });
}

function startSendingVideoFrames() {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  let isProcessing = false;
  let lastFrameTime = 0;
  const TARGET_FPS = 24; // Smooth 24 FPS
  const FRAME_INTERVAL = 1000 / TARGET_FPS; // ~42ms between frames
  const TARGET_WIDTH = 800; // Good balance between quality and speed

  console.log("📹 Starting to send video frames at", TARGET_FPS, "FPS...");

  function captureAndSendFrame() {
    const now = performance.now();
    
    // Skip if still processing or socket not connected
    if (isProcessing || !socket || !socket.connected || webcam.readyState !== webcam.HAVE_ENOUGH_DATA) {
      requestAnimationFrame(captureAndSendFrame);
      return;
    }

    // Throttle to target FPS
    if (now - lastFrameTime < FRAME_INTERVAL) {
      requestAnimationFrame(captureAndSendFrame);
      return;
    }

    isProcessing = true;
    lastFrameTime = now;
    
    try {
      // Calculate optimal dimensions maintaining aspect ratio
      const videoAspect = webcam.videoWidth / webcam.videoHeight;
      let width = TARGET_WIDTH;
      let height = Math.round(TARGET_WIDTH / videoAspect);
      
      // Set canvas size
      canvas.width = width;
      canvas.height = height;
      
      // Draw and resize in one step
      context.drawImage(webcam, 0, 0, width, height);
      
      // Use better quality (0.7 for good balance)
      const imageData = canvas.toDataURL('image/jpeg', 0.7);
      const base64Image = imageData.split(',')[1];

      if (socket && socket.connected) {
        socket.emit('video_frame', { image: base64Image });
      }
    } catch (error) {
      console.error("Error capturing frame:", error);
    } finally {
      isProcessing = false;
      requestAnimationFrame(captureAndSendFrame);
    }
  }

  // Start the capture loop
  captureAndSendFrame();
}

function stopSendingVideoFrames() {
  console.log("⏹️ Stopping video frames");
  clearInterval(videoInterval);
  if (socket) {
    socket.disconnect();
  }
}

function pauseSendingVideoFrames() {
  console.log("⏸️ Pausing video frames (keeping connection alive)");
  clearInterval(videoInterval);
  // Don't disconnect socket - we need it for AI report
}

// ======== Score Display Update ========
function updateScoreDisplay() {
  score1El.textContent = player1TotalScore + player1RoundScore;
  score2El.textContent = player2TotalScore + player2RoundScore;
}

// ======== Round Timer ========
function startRoundTimer() {
  const round = rounds[currentRound];
  timeLeft = round.duration;
  clearInterval(gameTimer);

  timerDisplay.textContent = `0:${timeLeft < 10 ? '0' : ''}${timeLeft}`;
  timerDisplay.classList.remove("warning");
  timerDisplay.style.display = "block";

  roundIndicator.textContent = `Round ${currentRound + 1}: ${round.name}`;
  roundIndicator.style.display = "block";

  // Notify backend that round has started
  if (socket && socket.connected) {
    socket.emit('game_start');
  }

  gameTimer = setInterval(() => {
    timeLeft--;

    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerDisplay.textContent = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;

    if (timeLeft <= 10) {
      timerDisplay.classList.add("warning");
    }

    if (timeLeft <= 0) {
      endRound();
    }
  }, 1000);
}

// ======== End Round ========
function endRound() {
  clearInterval(gameTimer);
  timerDisplay.classList.remove("warning");

  // Add round scores to total
  player1TotalScore += player1RoundScore;
  player2TotalScore += player2RoundScore;

  // Reset round scores
  player1RoundScore = 0;
  player2RoundScore = 0;

  // Reset backend counter
  if (socket && socket.connected) {
    socket.emit('reset_counter');
  }

  updateScoreDisplay();

  // Check if there are more rounds
  if (currentRound < rounds.length - 1) {
    showRoundTransition();
  } else {
    showWinnerPopup();
  }
}

// ======== Show Round Transition Popup ========
function showRoundTransition() {
  currentRound++;
  const nextRound = rounds[currentRound];

  timerDisplay.style.display = "none";
  roundIndicator.style.display = "none";

  // Stop current round music
  if (currentRoundMusic) {
    currentRoundMusic.pause();
    currentRoundMusic.currentTime = 0;
  }

  roundMessage.textContent = `Round ${currentRound + 1}`;
  roundExercise.textContent = `Next Exercise: ${nextRound.name}`;

  // Set video source for the next round
  roundDemoVideoSource.src = nextRound.videoPath;
  roundDemoVideo.load(); // Reload video with new source

  roundPopup.style.display = "flex";

  speak(`Round ${currentRound + 1}. Next exercise: ${nextRound.name}`);
}

// ======== Show Winner Popup ========
function showWinnerPopup() {
  pauseSendingVideoFrames();  // Stop sending frames but keep socket connected
  timerDisplay.style.display = "none";
  roundIndicator.style.display = "none";

  let winnerText = "";
  if (player1TotalScore > player2TotalScore) {
    winnerText = "🎉 Player 1 Wins! 🎉";
  } else if (player2TotalScore > player1TotalScore) {
    winnerText = "🎉 Player 2 Wins! 🎉";
  } else {
    winnerText = "🤝 It's a Tie! 🤝";
  }

  // Hide AI report initially, show loading message
  const aiReportDiv = document.getElementById('aiReport');
  aiReportDiv.style.display = 'block';
  document.getElementById('gameSummary').innerHTML = '<strong>⏳ Generating AI Analysis Report...</strong>';
  document.getElementById('player1Content').innerHTML = '';
  document.getElementById('player2Content').innerHTML = '';
  document.getElementById('comparison').innerHTML = '';

  winnerMessage.textContent = winnerText;
  popup.style.display = "flex";
  speak(winnerText);

  // Request AI analysis report immediately
  console.log('🔍 Checking socket connection...', {
    socketExists: !!socket,
    socketConnected: socket ? socket.connected : false,
    socketId: socket ? socket.id : null
  });

  if (socket && socket.connected) {
    console.log('📊 Requesting AI report...');
    socket.emit('game_end');

    // Set a timeout in case the report doesn't arrive
    setTimeout(() => {
      const aiReportDiv = document.getElementById('aiReport');
      const gameSummaryDiv = document.getElementById('gameSummary');
      if (aiReportDiv.style.display === 'block' && gameSummaryDiv.innerHTML.includes('Generating')) {
        gameSummaryDiv.innerHTML = '<strong>⚠️ AI report is taking longer than expected. Please check your connection.</strong>';
      }
    }, 10000); // 10 second timeout
  } else {
    console.error('❌ Socket not connected, cannot request AI report');
    console.error('Socket state:', socket);
    const gameSummaryDiv = document.getElementById('gameSummary');
    gameSummaryDiv.innerHTML = '<strong>❌ Error: Could not connect to server for AI analysis. Socket disconnected.</strong>';

    // Try to reconnect and request report
    if (socket) {
      console.log('🔄 Attempting to reconnect socket...');
      socket.connect();
      socket.once('connect', () => {
        console.log('✅ Reconnected! Requesting AI report...');
        socket.emit('game_end');
      });
    }
  }
}

// ======== AI Report Display ========
function displayAIReport(report) {
  console.log('📊 Displaying AI report:', report);

  const aiReportDiv = document.getElementById('aiReport');
  const gameSummaryDiv = document.getElementById('gameSummary');
  const player1ContentDiv = document.getElementById('player1Content');
  const player2ContentDiv = document.getElementById('player2Content');
  const comparisonDiv = document.getElementById('comparison');

  if (!report) {
    console.error('❌ No report data received');
    gameSummaryDiv.innerHTML = '<strong>❌ Error: No report data available.</strong>';
    return;
  }

  // Show AI report section
  aiReportDiv.style.display = 'block';

  try {
    // Display game summary
    if (report.summary) {
      gameSummaryDiv.innerHTML = `<strong>📊 ${report.summary}</strong>`;
    }

    // Display Player 1 analysis
    if (report.player1) {
      const p1 = report.player1;
      player1ContentDiv.innerHTML = `
        <p style="font-size: 1.1em; margin: 10px 0;"><strong>${p1.overall || 'Analysis'}</strong></p>
        <p style="margin: 5px 0;"><strong>Performance Score: ${p1.score || 0}/100</strong></p>
        <div style="margin: 10px 0;">
          <strong>📈 Stats:</strong>
          <ul style="margin: 5px 0; padding-left: 20px;">
            <li>Total Jumps: ${p1.stats?.total_jumps || 0}</li>
            <li>Jumps per Minute: ${p1.stats?.jumps_per_minute?.toFixed(1) || 0}</li>
            <li>Consistency: ${p1.stats?.consistency?.toFixed(1) || 0}%</li>
            <li>Activity Rate: ${p1.stats?.activity_rate?.toFixed(1) || 0}%</li>
          </ul>
        </div>
        ${p1.strengths && p1.strengths.length > 0 ? `<div style="margin: 10px 0;"><strong>✅ Strengths:</strong><ul style="margin: 5px 0; padding-left: 20px;">${p1.strengths.map(s => `<li>${s}</li>`).join('')}</ul></div>` : ''}
        ${p1.improvements && p1.improvements.length > 0 ? `<div style="margin: 10px 0;"><strong>💡 Tips for Improvement:</strong><ul style="margin: 5px 0; padding-left: 20px;">${p1.improvements.map(i => `<li>${i}</li>`).join('')}</ul></div>` : ''}
      `;
    }

    // Display Player 2 analysis
    if (report.player2) {
      const p2 = report.player2;
      player2ContentDiv.innerHTML = `
        <p style="font-size: 1.1em; margin: 10px 0;"><strong>${p2.overall || 'Analysis'}</strong></p>
        <p style="margin: 5px 0;"><strong>Performance Score: ${p2.score || 0}/100</strong></p>
        <div style="margin: 10px 0;">
          <strong>📈 Stats:</strong>
          <ul style="margin: 5px 0; padding-left: 20px;">
            <li>Total Jumps: ${p2.stats?.total_jumps || 0}</li>
            <li>Jumps per Minute: ${p2.stats?.jumps_per_minute?.toFixed(1) || 0}</li>
            <li>Consistency: ${p2.stats?.consistency?.toFixed(1) || 0}%</li>
            <li>Activity Rate: ${p2.stats?.activity_rate?.toFixed(1) || 0}%</li>
          </ul>
        </div>
        ${p2.strengths && p2.strengths.length > 0 ? `<div style="margin: 10px 0;"><strong>✅ Strengths:</strong><ul style="margin: 5px 0; padding-left: 20px;">${p2.strengths.map(s => `<li>${s}</li>`).join('')}</ul></div>` : ''}
        ${p2.improvements && p2.improvements.length > 0 ? `<div style="margin: 10px 0;"><strong>💡 Tips for Improvement:</strong><ul style="margin: 5px 0; padding-left: 20px;">${p2.improvements.map(i => `<li>${i}</li>`).join('')}</ul></div>` : ''}
      `;
    }

    // Display comparison
    if (report.comparison && report.comparison.length > 0) {
      comparisonDiv.innerHTML = `
        <strong>⚖️ Comparison:</strong>
        <ul style="margin: 5px 0; padding-left: 20px;">
          ${report.comparison.map(c => `<li>${c}</li>`).join('')}
        </ul>
      `;
    }

    // Scroll to top of popup to show winner message first
    const popupContent = document.querySelector('.popup-content');
    if (popupContent) {
      popupContent.scrollTop = 0;
    }

    // Read the AI report out loud using TTS
    speakAIReport(report);

    console.log('✅ AI report displayed successfully');
  } catch (error) {
    console.error('❌ Error displaying AI report:', error);
    gameSummaryDiv.innerHTML = `<strong>❌ Error displaying report: ${error.message}</strong>`;
  }
}

// ======== Button Events ========
startBtn.addEventListener('click', async () => {
  console.log("🎮 Start button clicked");
  const webcamGranted = await startWebcam();
  if (webcamGranted) {
    menu.style.display = 'none';
    game.style.display = 'flex';

    // Play Hajime sound when game starts
    if (musicOn) {
      menuMusic.pause();
      hajimeSound.play().catch(err => console.log("Error playing hajime sound:", err));
    }

    // Reset game state
    currentRound = 0;
    player1TotalScore = 0;
    player2TotalScore = 0;
    player1RoundScore = 0;
    player2RoundScore = 0;
    updateScoreDisplay();

    // Show round transition before first round with video
    roundMessage.textContent = "Get Ready!";
    roundExercise.textContent = `First Exercise: ${rounds[0].name}`;

    // Set video source for the round popup
    roundDemoVideoSource.src = rounds[0].videoPath;
    roundDemoVideo.load(); // Reload video with new source

    roundPopup.style.display = "flex";
    speak("Get ready for the first round!");

    if (musicOn) {
      menuMusic.pause();
      menuMusic.currentTime = 0;
      gameMusic.play();
    }
  }
});

instructionsBtn.addEventListener('click', () => {
  speak("Welcome to the Kids Fitness Battle! Two players compete in three rounds. Round 1: Jumping Jacks. Round 2: Squats. Round 3: Push-ups. Each round lasts 30 seconds. The player with the most total points wins!");
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
  stopSpeech(); // Stop AI analysis speech if playing
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

continueBtn.addEventListener('click', () => {
  roundPopup.style.display = "none";

  // Stop current round music if any
  if (currentRoundMusic) {
    currentRoundMusic.pause();
    currentRoundMusic.currentTime = 0;
  }

  // Start playing the music for this round
  if (musicOn && rounds[currentRound]) {
    currentRoundMusic = rounds[currentRound].music;
    currentRoundMusic.play().catch(err => console.log("Error playing round music:", err));
  }

  startRoundTimer();
});

roundQuitBtn.addEventListener('click', () => {
  roundPopup.style.display = "none";
  stopGame();
  game.style.display = 'none';
  menu.style.display = 'flex';

  if (musicOn) {
    gameMusic.pause();
    gameMusic.currentTime = 0;
    menuMusic.play();
  }

  speak("Returning to the main menu.");
});

replayBtn.addEventListener('click', () => {
  stopSpeech(); // Stop AI analysis speech if playing
  popup.style.display = "none";

  // Reset game state
  currentRound = 0;
  player1TotalScore = 0;
  player2TotalScore = 0;
  player1RoundScore = 0;
  player2RoundScore = 0;
  updateScoreDisplay();

  // Hide AI report
  document.getElementById('aiReport').style.display = 'none';

  if (socket && socket.connected) {
    socket.emit('reset_counter');
  }

  // Show round transition before first round
  roundMessage.textContent = "Get Ready!";
  roundExercise.textContent = `First Exercise: ${rounds[0].name}`;
  roundPopup.style.display = "flex";
  startSendingVideoFrames();  // Resume sending frames
  speak("New match starting!");
});

popupQuitBtn.addEventListener('click', () => {
  stopSpeech(); // Stop AI analysis speech if playing
  stopGame();
  popup.style.display = "none";
  game.style.display = 'none';
  menu.style.display = 'flex';

  // Stop round music if playing
  if (currentRoundMusic) {
    currentRoundMusic.pause();
    currentRoundMusic.currentTime = 0;
  }

  if (musicOn) {
    gameMusic.pause();
    gameMusic.currentTime = 0;
    menuMusic.play();
  }

  speak("Returning to the main menu.");
});

// ======== Instructions Page Navigation ========
instructionsBtn.addEventListener('click', () => {
  menu.style.display = 'none';
  instructions.style.display = 'flex';
});

backToMenuBtn.addEventListener('click', () => {
  stopSpeech(); // Stop TTS if playing
  instructions.style.display = 'none';
  menu.style.display = 'flex';
});

// ======== Speak Instructions Button ========
speakInstructionsBtn.addEventListener('click', () => {
  const instructionsText = `
    Welcome to Fit Ninjas! This is a fun exercise game for two players.
    The game has 3 rounds: Jumping Jacks, Squats, and Push-ups.
    Each round lasts 1 minute.
    Stand in front of the camera - Player 1 on the LEFT, Player 2 on the RIGHT.
    Perform the exercises correctly to earn points.
    The player with the most points at the end wins!
    Watch the demo videos below to learn proper form.
    Good luck and have fun!
  `;
  speak(instructionsText);
});

// ======== Ensure voices are loaded for better TTS ========
// Some browsers need this to load voices properly
if (speechSynthesis.onvoiceschanged !== undefined) {
  speechSynthesis.onvoiceschanged = () => {
    // Voices loaded, no action needed - they'll be used when speak() is called
  };
}

function stopGame() {
  stopSpeech(); // Stop any ongoing speech (AI analysis, etc.)

  const stream = webcam.srcObject;
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }

  player1TotalScore = 0;
  player2TotalScore = 0;
  player1RoundScore = 0;
  player2RoundScore = 0;
  currentRound = 0;
  updateScoreDisplay();

  clearInterval(gameTimer);
  stopSendingVideoFrames();

  timerDisplay.textContent = "0:30";
  timerDisplay.classList.remove("warning");
  timerDisplay.style.display = "none";
  roundIndicator.style.display = "none";

  processedImage1.src = "";
  processedImage2.src = "";
}
