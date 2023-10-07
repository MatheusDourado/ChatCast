let audioContext;
let analyser;
let isRecognizing = false;
let isSpeaking = false;
let messages = [];

function initialize() {
    hideElement('startButton');
    showElement('audioVisualizer');

    setupAudioContext();
    startListening();
    draw();
}

function hideElement(id) {
    document.getElementById(id).style.display = 'none';
}

function showElement(id) {
    document.getElementById(id).style.display = 'block';
}

function setupAudioContext() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);
        })
        .catch(err => {
            console.error('Erro ao acessar o microfone:', err);
        });
}

function startListening() {
    if (isSpeaking) return;
    isRecognizing = true;
    recognition.start();
}

const canvas = document.getElementById('audioVisualizer');
canvas.width = 480;
canvas.height = 240;
const canvasContext = canvas.getContext('2d');

const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.lang = 'pt-BR';
recognition.interimResults = false;

recognition.onresult = async (event) => {
    const transcript = event.results[0][0].transcript.trim();
    console.log("Você disse:", transcript);
    processTranscript(transcript);
};

async function processTranscript(transcript) {
    if (isSystemMessage(transcript)) return;

    messages.push({ role: 'user', content: transcript });

    try {
        const response = await askGPT3(transcript);
        messages.push({ role: 'system', content: response }); // Adicione a resposta ao histórico
        speak(response);
    } catch (error) {
        console.error("Erro ao comunicar-se com o GPT-3:", error);
    }
}

function isSystemMessage(transcript) {
    const systemPhrases = ["muitas solicitações", "não consegui gerar uma resposta"];
    return systemPhrases.some(phrase => transcript.includes(phrase));
}

async function askGPT3() {
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                Authorization: "Bearer API-TOKEN"
            },
            body: JSON.stringify({
                model: "gpt-4",
                messages: messages,
                max_tokens: 2048,
                temperature: 0.5
            })
        });

        const data = await response.json();
        console.log(data);

        if (data && data.choices && data.choices.length > 0) {
            return data.choices[0].message.content.trim();
        }
        return "Desculpe, não consegui gerar uma resposta.";

    } catch (error) {
        if (error.response && error.response.status === 429) {
            return "Estou recebendo muitas solicitações no momento. Por favor, tente novamente mais tarde.";
        }
        console.error("Erro ao solicitar ao GPT-4:", error);
        throw error;
    }
}

function preprocessResponse(text) {
    let processedText = text;

    processedText = processedText.replace(/[*/-]/g, '');

    return processedText;
}

function speak(message) {
    const processedMessage = preprocessResponse(message); 

    drawLoading(); 
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(processedMessage); 
    utterance.lang = 'pt-BR';

    utterance.onstart = () => {
        isSpeaking = true;
        recognition.stop();
    };

    utterance.onend = () => {
        isSpeaking = false;
        recognition.stop();
        startListening();
    };

    synth.speak(utterance);
}

recognition.onerror = (event) => {
    console.error("Erro de reconhecimento:", event.error);
};

recognition.onend = () => {
    isRecognizing = false;
    if (!isSpeaking) {
        startListening();
    }
};

let pulseTimestamp = 0;

function draw() {
    if (isSpeaking) {
        drawLoading();
    } else {
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
    }
    requestAnimationFrame(draw);
}

function drawLoading() {
    canvasContext.fillStyle = 'white';
    canvasContext.fillRect(0, 0, canvas.width, canvas.height);

    const numberOfDots = 8;
    const circlePathRadius = 50;
    const dotRadius = 8;
    const angleStep = 2 * Math.PI / numberOfDots;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    for (let i = 0; i < numberOfDots; i++) {
        const angle = pulseTimestamp * 0.05 + i * angleStep;
        const x = centerX + circlePathRadius * Math.sin(angle);
        const y = centerY + circlePathRadius * Math.cos(angle);
        const alpha = 0.2 + (Math.sin(pulseTimestamp * 0.1 + i * angleStep) + 1) * 0.4;

        canvasContext.beginPath();
        canvasContext.arc(x, y, dotRadius, 0, 2 * Math.PI);
        canvasContext.fillStyle = `rgba(0, 0, 0, ${alpha})`;
        canvasContext.fill();
    }

    pulseTimestamp += 1;
}

canvas.addEventListener('click', function() {
    if (!isSpeaking) {
        startListening(); 
    }
}); 
