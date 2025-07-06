class ChatBot {
    constructor() {
        this.chatMessages = document.getElementById('chatMessages');
        this.userInput = document.getElementById('userInput');
        
        this.initializeEventListeners();
        this.clearInitialMessages();
    }

    initializeEventListeners() {
        this.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleSend();
            }
        });
    }

    clearInitialMessages() {
        this.chatMessages.innerHTML = '';
    }

    handleSend() {
        const message = this.userInput.value.trim();
        if (!message) return;

        this.addMessage(message, 'user');
        this.userInput.value = '';
        this.userInput.disabled = true;

        setTimeout(() => {
            const aiResponse = this.generateAIResponse(message);
            this.addMessage(aiResponse, 'ai');
            this.userInput.disabled = false;
            this.userInput.focus();
        }, 1000);
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

    generateAIResponse(userMessage) {
        const responses = [
            "そのお話はとても興味深いですね。",
            "なるほど、よく理解できました。",
            "面白い視点ですね。もう少し詳しく教えてください。",
            "それについて考えてみます。",
            "素晴らしいアイデアですね！",
            "その件について、いくつか質問があります。",
            "とても参考になりました。",
            "なるほど、そういう考え方もありますね。",
            "詳しく説明していただき、ありがとうございます。",
            "それは新しい発見ですね。"
        ];
        
        if (userMessage.includes('こんにちは') || userMessage.includes('はじめまして')) {
            return "こんにちは！お気軽にお話しください。";
        }
        
        if (userMessage.includes('元気') || userMessage.includes('調子')) {
            return "私は元気です！あなたはいかがですか？";
        }
        
        if (userMessage.includes('ありがとう') || userMessage.includes('感謝')) {
            return "どういたしまして！お役に立てて嬉しいです。";
        }
        
        const randomIndex = Math.floor(Math.random() * responses.length);
        return responses[randomIndex];
    }

    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ChatBot();
});