let audioContext;
let analyser;
let isRecognizing = false;
let isSpeaking = false;
let messages = [];
let shouldWaitForCodePaste = false;
let initialTranscript = "";

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
    if (isSpeaking || isRecognizing) return;
    isRecognizing = true;
    recognition.start();
}

// 1. Capturar imagem colada pelo usuário.
document.addEventListener('paste', async (event) => {
    if (!shouldWaitForCodePaste) return;

    const items = (event.clipboardData || event.originalEvent.clipboardData).items;
    for (let index in items) {
        let item = items[index];
        if (item.kind === 'file') {
            const blob = item.getAsFile();
            const reader = new FileReader();
            reader.onload = async function(event) {
                try {
                    drawLoading();
                    const codeText = await imageToCode(event.target.result);
                    console.log("codeText ", codeText);

                    processTranscript(initialTranscript + " " + codeText);
                    shouldWaitForCodePaste = false;
                    initialTranscript = "";
                    
                    setTimeout(() => {
                        startListening(); 
                    }, 500); 
                } catch (error) {
                    console.error('Erro ao processar imagem:', error);
                }
            };
            reader.readAsDataURL(blob);
        }
    }
});


async function imageToCode(imageDataUrl) {
    const result = await Tesseract.recognize(imageDataUrl, 'eng', { logger: m => console.log(m) });
    console.log("Resultado completo do OCR:", result); 
    return result.text;
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

    if (transcript.includes("revisar um código") || transcript.includes("verificar esse trecho") || transcript.includes("código")) {
        console.log("if");
        recognition.stop();  // <---- Adicione esta linha.
        shouldWaitForCodePaste = true;
        initialTranscript = transcript;
    } else {
        console.log("else");
        processTranscript(transcript);
    }
};


async function processTranscript(transcript) {
    if (isSystemMessage(transcript)) return;

    messages.push({ role: 'user', content: transcript });

    try {
        const response = await askGPT3(transcript);
        messages.push({ role: 'system', content: response }); 
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
        // Efetuando a requisição
        const response = await fetch('https://chat-cast.vercel.app/api/openai', {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "gpt-4",
                messages: messages,
                max_tokens: 2048,
                temperature: 0.5
            })
        });

        // Verificando status da resposta
        if (!response.ok) {
            console.error("Erro no servidor:", response.status);
            throw new Error("Failed to fetch from server");
        }

        // Parsing da resposta
        const data = await response.json();

        // Logs de depuração
        console.log("Response Status:", response.status);
        console.log("Response Data:", data);

        // Processando a resposta
        if (data && data.choices && data.choices.length > 0) {
            console.log("O Chat respondeu: ", data.choices[0].message.content.trim());
            return data.choices[0].message.content.trim();
        } else {
            console.warn("Resposta inesperada:", data);
            return "Desculpe, não consegui gerar uma resposta.";
        }

    } catch (error) {
        // Tratando diferentes tipos de erros
        if (error.response && error.response.status === 429) {
            console.warn("Limite de solicitações atingido:", error);
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

    const utterance = new SpeechSynthesisUtterance(processedMessage); 
    utterance.lang = 'pt-BR';
    
    if (processedMessage.includes("?")) {
        utterance.pitch = 1.2;
        utterance.rate = 1.1;
    } else if (processedMessage.includes("!")) {
        utterance.pitch = 0.9;
        utterance.rate = 1.3;
    } else {
        utterance.pitch = 1.0;
        utterance.rate = 1.0;
    }

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(voice => voice.lang.includes('pt-BR')); 
    
    if (preferredVoice) {
        utterance.voice = preferredVoice;
    }

    utterance.onstart = () => {
        isSpeaking = true;
        recognition.stop();
    };

    utterance.onend = () => {
        isSpeaking = false;
        recognition.stop();
        startListening();
    };

    window.speechSynthesis.speak(utterance);
}

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
        canvasContext.strokeStyle = '#236E8C';
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
        canvasContext.fillStyle = `rgba(2, 73, 89, ${alpha})`;
        canvasContext.fill();
    }

    pulseTimestamp += 1;
}

canvas.addEventListener('click', function() {
    if (!isSpeaking) {
        startListening(); 
    }
}); 
