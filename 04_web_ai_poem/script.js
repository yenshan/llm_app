class ChatBot {
    constructor() {
        this.chatMessages = document.getElementById('chatMessages');
        this.userInput = document.getElementById('userInput');
        this.sendButton = document.getElementById('sendButton');
        this.llmUrl = "http://localhost:1234/v1/chat/completions";
        this.isComposing = false;
        this.chatHistory = [];
        
        this.initializeEventListeners();
        this.clearInitialMessages();
    }

    initializeEventListeners() {
        if (this.sendButton) {
            this.sendButton.addEventListener('click', () => this.handleSend());
        }
        
        this.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !this.isComposing) {
                this.handleSend();
            }
        });
        
        this.userInput.addEventListener('compositionstart', () => {
            this.isComposing = true;
        });
        
        this.userInput.addEventListener('compositionend', () => {
            this.isComposing = false;
        });
    }

    clearInitialMessages() {
        this.chatMessages.innerHTML = '';
    }

    async handleSend() {
        const message = this.userInput.value.trim();
        if (!message) return;

        this.addMessage(message, 'user');
        this.chatHistory.push({ role: 'user', content: message });
        this.userInput.value = '';
        this.userInput.disabled = true;
        if (this.sendButton) {
            this.sendButton.disabled = true;
        }

        try {
            await this.sendToLLM(message);
        } catch (error) {
            const errorMessage = `エラーが発生しました: ${error.message}`;
            this.addMessage(errorMessage, 'ai');
            this.chatHistory.push({ role: 'assistant', content: errorMessage });
        } finally {
            this.userInput.disabled = false;
            if (this.sendButton) {
                this.sendButton.disabled = false;
            }
            this.userInput.focus();
        }
    }

    async sendToLLM(userMessage) {
        const messages = [
            {
                role: "system",
                content: "あなたは想像力豊な詩人です。ユーザによって与えられた詩に対して、一行だけ追加するようにしてください。その一行を返信してください。"
            },
            ...this.chatHistory
        ];

        const requestData = {
            model: "chat-model-001",
            messages: messages,
            temperature: 0.7,
            max_tokens: 1024,
            stream: false
        };

        console.log('=== LLMへの送信メッセージ ===');
        console.log(JSON.stringify(requestData, null, 2));

        const response = await fetch(this.llmUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            throw new Error(`APIリクエストに失敗しました: ${response.status} ${response.statusText}`);
        }

        await this.processResponse(response);
    }

    async processResponse(response) {
        try {
            const data = await response.json();
            console.log('=== LLMからの受信データ ===');
            console.log(JSON.stringify(data, null, 2));
            
            if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
                const aiMessage = data.choices[0].message.content;
                console.log('=== AIの完成した応答 ===');
                console.log(aiMessage);
                
                this.addMessage(aiMessage, 'ai');
                this.chatHistory.push({ role: 'assistant', content: aiMessage });
            } else {
                throw new Error('LLMからの応答が空です');
            }
        } catch (error) {
            console.error('Response processing error:', error);
            throw error;
        }
    }

    addMessage(text, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}-message`;
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        const label = document.createElement('span');
        label.className = 'message-label';
        label.textContent = type === 'user' ? 'user:' : 'AI:';
        
        const messageText = document.createElement('span');
        messageText.className = 'message-text';
        messageText.textContent = text;
        
        messageContent.appendChild(label);
        messageContent.appendChild(messageText);
        messageDiv.appendChild(messageContent);
        
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ChatBot();
});