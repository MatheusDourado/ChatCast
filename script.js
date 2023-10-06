let audioContext;
let analyser;
let isRecognizing = false;
let isSpeaking = false;

function initialize() {
    document.getElementById('startButton').style.display = 'none';  // Esconde o botão
    document.getElementById('audioVisualizer').style.display = 'block'; // Mostra o canvas

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();

    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);
            recognition.start();
            draw();
        })
        .catch(err => {
            console.error('Erro ao acessar o microfone:', err);
        });
}

const canvas = document.getElementById('audioVisualizer');
canvas.width = 480;
canvas.height = 240;
const canvasContext = canvas.getContext('2d');

const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.lang = 'pt-BR';
recognition.interimResults = false;

recognition.onresult = (event) => {
    const transcript = event.results[event.results.length - 1][0].transcript;
    console.log(transcript);
    speak(transcript);
};

recognition.onend = () => {
    isRecognizing = false;
    if (!isSpeaking) {
        recognition.start();
    }
};

function draw() {
    if (isSpeaking) {
        drawLoading();
        requestAnimationFrame(draw);
        return;
    }

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(dataArray);

    canvasContext.fillStyle = 'white';
    canvasContext.fillRect(0, 0, canvas.width, canvas.height);
    canvasContext.lineWidth = 2;
    canvasContext.strokeStyle = 'black';
    canvasContext.beginPath();

    const sliceWidth = canvas.width / dataArray.length;
    let x = 0;

    for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * canvas.height / 2;

        if (i === 0) {
            canvasContext.moveTo(x, y);
        } else {
            canvasContext.lineTo(x, y);
        }

        x += sliceWidth;
    }

    canvasContext.lineTo(canvas.width, canvas.height / 2);
    canvasContext.stroke();

    requestAnimationFrame(draw);
}

let pulseTimestamp = 0;

function drawLoading() {
    canvasContext.fillStyle = 'white';
    canvasContext.fillRect(0, 0, canvas.width, canvas.height);

    let numberOfDots = 8;
    let circlePathRadius = 50;
    let dotRadius = 8;
    let angleStep = 2 * Math.PI / numberOfDots;
    let centerX = canvas.width / 2;
    let centerY = canvas.height / 2;

    for (let i = 0; i < numberOfDots; i++) {
        let angle = pulseTimestamp * 0.05 + i * angleStep; 
        let x = centerX + circlePathRadius * Math.sin(angle);
        let y = centerY + circlePathRadius * Math.cos(angle);
        let alpha = 0.2 + (Math.sin(pulseTimestamp * 0.1 + i * angleStep) + 1) * 0.4;

        canvasContext.beginPath();
        canvasContext.arc(x, y, dotRadius, 0, 2 * Math.PI);
        canvasContext.fillStyle = `rgba(0, 0, 0, ${alpha})`;
        canvasContext.fill();
    }

    pulseTimestamp += 1;
}

function speak(message) {
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = 'pt-BR';

    utterance.onstart = () => {
        isSpeaking = true;
    };

    utterance.onend = () => {
        isSpeaking = false;
        if (!isRecognizing) {
            recognition.start();
        }
    };

    synth.speak(utterance);
}
