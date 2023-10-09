const fetch = require('node-fetch');

module.exports = async (req, res) => {
    // Adicione os cabeçalhos para habilitar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}` 
            },
            body: JSON.stringify(req.body)
        });

        const data = await response.json();
        
        if (data && data.choices && data.choices.length > 0) {
            res.status(200).json({ message: data.choices[0].message.content.trim() });
            return;
        }

        res.status(200).json({ message: "Desculpe, não consegui gerar uma resposta." });
    } catch (error) {
        if (error.response && error.response.status === 429) {
            res.status(429).json({ error: "Estou recebendo muitas solicitações no momento. Por favor, tente novamente mais tarde." });
            return;
        }
        res.status(500).json({ error: "Internal server error", exception: error.message });
    }
};
