class ChatBot {
    constructor() {
        this.chatMessages = document.getElementById('chatMessages');
        this.userInput = document.getElementById('userInput');
        this.sendButton = document.getElementById('sendButton');
        this.llmUrl = "http://localhost:1234/v1/chat/completions";
        this.isComposing = false;
        
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
        this.userInput.value = '';
        this.userInput.disabled = true;
        if (this.sendButton) {
            this.sendButton.disabled = true;
        }

        try {
            await this.sendToLLM(message);
        } catch (error) {
            this.addMessage(`エラーが発生しました: ${error.message}`, 'ai');
        } finally {
            this.userInput.disabled = false;
            if (this.sendButton) {
                this.sendButton.disabled = false;
            }
            this.userInput.focus();
        }
    }

    async sendToLLM(userMessage) {
        const requestData = {
            model: "chat-model-001",
            messages: [
                {
                    role: "system",
                    content: "あなたは親切で知識豊富なAIアシスタントです。日本語で自然な会話を心がけてください。"
                },
                {
                    role: "user",
                    content: userMessage
                }
            ],
            temperature: 0.7,
            max_tokens: 1024,
            stream: true
        };

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

        await this.processStream(response);
    }

    async processStream(response) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let fullText = '';
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ai-message';
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        const label = document.createElement('span');
        label.className = 'message-label';
        label.textContent = 'AI:';
        
        const messageText = document.createElement('span');
        messageText.className = 'message-text';
        messageText.textContent = '';
        
        messageContent.appendChild(label);
        messageContent.appendChild(messageText);
        messageDiv.appendChild(messageContent);
        
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();

        try {
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                        try {
                            const data = JSON.parse(line.substring(6));
                            
                            if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
                                const content = data.choices[0].delta.content;
                                fullText += content;
                                messageText.textContent = fullText;
                                this.scrollToBottom();
                            }
                        } catch (e) {
                            console.error('JSON parsing error:', e);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Stream processing error:', error);
            messageText.textContent = 'ストリーミング処理中にエラーが発生しました。';
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