const fetch = require('node-fetch');

module.exports = async (req, res) => {
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                Authorization: "Bearer ${process.env.OPENAI_API_KEY}"
            },
            body: JSON.stringify({
                model: "gpt-4",
                messages: messages,
                max_tokens: 2048,
                temperature: 0.5
            })
        });

        const data = await response.json();
        
        if (data && data.choices && data.choices.length > 0) {
            return data.choices[0].message.content.trim();
        }
        
        return "Desculpe, não consegui gerar uma resposta.";
    } catch (error) {
        if (error.response && error.response.status === 429) {
            return "Estou recebendo muitas solicitações no momento. Por favor, tente novamente mais tarde.";
        }
        throw error;
    }
};
