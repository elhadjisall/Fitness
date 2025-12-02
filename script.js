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
    trackingStatusDiv.style.display = 'none';
    processedImage.style.display = 'none';
    webcam.style.display = 'block';
    statusDisplay.textContent = "Disconnected from server";
  });

  socket.on('tracking_results', (data) => {
    if (data.image) {
      processedImage.src = 'data:image/jpeg;base64,' + data.image;
    }
    // Update both player scores from backend
    if (data.player1_count !== undefined) {
      player1Score = data.player1_count;
      score1El.textContent = player1Score;
    }
    if (data.player2_count !== undefined) {
      player2Score = data.player2_count;
      score2El.textContent = player2Score;
    }
    // Update status display with both players' status
    if (data.player1_status && data.player2_status) {
      const status1 = data.player1_status.replace("Player 1: ", "");
      const status2 = data.player2_status.replace("Player 2: ", "");
      statusDisplay.textContent = `P1: ${status1} | P2: ${status2}`;
    } else if (data.player1_status) {
      statusDisplay.textContent = data.player1_status;
    }
  });

  socket.on('counter_reset', (data) => {
    console.log("🔄", data.message);
    player1Score = 0;
    player2Score = 0;
    score1El.textContent = 0;
    score2El.textContent = 0;
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

function pauseSendingVideoFrames() {
  console.log("⏸️ Pausing video frames (keeping connection alive)");
  clearInterval(videoInterval);
  // Don't disconnect socket - we need it for AI report
}

// ======== Game Timer ========
function startTimer() {
  timeLeft = 120;
  clearInterval(gameTimer);
  timerDisplay.textContent = "2:00";
  timerDisplay.classList.remove("warning");
  
  // Notify backend that game has started
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
      clearInterval(gameTimer);
      pauseSendingVideoFrames();  // Stop sending frames but keep socket connected
      timerDisplay.textContent = "0:00";
      timerDisplay.classList.remove("warning");
      timerDisplay.style.display = "none";

      // Determine winner based on actual scores
      let winnerText = "";
      if (player1Score > player2Score) {
        winnerText = `Player 1 Wins! Score: ${player1Score} - ${player2Score}`;
      } else if (player2Score > player1Score) {
        winnerText = `Player 2 Wins! Score: ${player1Score} - ${player2Score}`;
      } else {
        winnerText = `It's a tie! Score: ${player1Score} - ${player2Score}`;
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
  }, 1000);
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

replayBtn.addEventListener('click', () => {
  stopSpeech(); // Stop AI analysis speech if playing
  popup.style.display = "none";
  player1Score = 0;
  player2Score = 0;
  score1El.textContent = 0;
  score2El.textContent = 0;
  
  // Hide AI report
  document.getElementById('aiReport').style.display = 'none';

  if (socket && socket.connected) {
    socket.emit('reset_counter');
  }

  timerDisplay.style.display = "block";
  startSendingVideoFrames();  // Resume sending frames
  startTimer();
  speak("New round starting!");
});

popupQuitBtn.addEventListener('click', () => {
  stopSpeech(); // Stop AI analysis speech if playing
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
  stopSpeech(); // Stop any ongoing speech (AI analysis, etc.)
  
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
