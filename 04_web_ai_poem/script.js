const systemPrompt = `
    あなたは想像力豊な現代詩人です。ユーザと一緒にコラボしながら詩を作っていきます。
    ユーザによって与えられた詩に対して、一行だけ追加するようにしてください。
    言葉の響きやリズム、感情を大切にし、詩のテーマや雰囲気を考慮して、韻を踏むことも意識してください。
    その一行で詩を終わらせるのではなく、より豊かに展開していけるような一行にしてください。
    その一行だけ返信してください。
`;

class ChatBot {
    constructor() {
        this.chatMessages = document.getElementById('chatMessages');
        this.userInput = document.getElementById('userInput');
        this.sendButton = document.getElementById('sendButton');
        this.apiKeyInput = document.getElementById('apiKey');
        this.providerSelect = document.getElementById('provider');
        
        // API設定
        this.localUrl = "http://localhost:1234/v1/chat/completions";
        this.openaiUrl = "https://api.openai.com/v1/chat/completions";
        
        this.isComposing = false;
        this.poemLines = [];
        
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
        
        // プロバイダー変更時の処理
        if (this.providerSelect) {
            this.providerSelect.addEventListener('change', () => {
                this.toggleApiKeyVisibility();
            });
        }
        
        // 初期状態でAPIキー表示を設定
        this.toggleApiKeyVisibility();
    }

    clearInitialMessages() {
        this.chatMessages.innerHTML = '';
    }

    async handleSend() {
        const message = this.userInput.value.trim();
        if (!message) return;

        this.addPoemLine(message, 'user');
        this.poemLines.push(message);
        this.userInput.value = '';
        this.userInput.disabled = true;
        if (this.sendButton) {
            this.sendButton.disabled = true;
        }

        try {
            await this.sendToLLM();
        } catch (error) {
            const errorMessage = `エラーが発生しました: ${error.message}`;
            this.addPoemLine(errorMessage, 'ai');
        } finally {
            this.userInput.disabled = false;
            if (this.sendButton) {
                this.sendButton.disabled = false;
            }
            this.userInput.focus();
        }
    }

    toggleApiKeyVisibility() {
        if (this.apiKeyInput && this.providerSelect) {
            const isOpenAI = this.providerSelect.value === 'openai';
            this.apiKeyInput.style.display = isOpenAI ? 'block' : 'none';
        }
    }

    async sendToLLM() {
        const provider = this.providerSelect ? this.providerSelect.value : 'local';
        const poemText = this.poemLines.join('\n');
        
        const messages = [
            {
                role: "system",
                content: systemPrompt
            },
            {
                role: "user",
                content: poemText
            }
        ];

        let requestData, headers, url;
        
        if (provider === 'openai') {
            if (!config || !config.openai || !config.openai.apiKey || config.openai.apiKey === 'your-openai-api-key-here') {
                throw new Error('config.jsでOpenAI APIキーを設定してください');
            }
            const apiKey = config.openai.apiKey;
            
            url = this.openaiUrl;
            headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            };
            requestData = {
                model: "gpt-4o-mini",
                messages: messages,
                temperature: 0.7,
                max_tokens: 1024
            };
        } else {
            url = this.localUrl;
            headers = {
                'Content-Type': 'application/json'
            };
            requestData = {
                model: "chat-model-001",
                messages: messages,
                temperature: 0.7,
                max_tokens: 1024,
                stream: false
            };
        }

        console.log('=== LLMへの送信メッセージ ===');
        console.log(JSON.stringify(requestData, null, 2));

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
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
                let aiMessage = data.choices[0].message.content.trim();
                
                // <think></think>タグを削除
                aiMessage = aiMessage.replace(/<think>.*?<\/think>/gs, '').trim();
                
                console.log('=== AIの完成した応答 ===');
                console.log(aiMessage);
                
                this.addPoemLine(aiMessage, 'ai');
                this.poemLines.push(aiMessage);
            } else {
                throw new Error('LLMからの応答が空です');
            }
        } catch (error) {
            console.error('Response processing error:', error);
            throw error;
        }
    }

    addPoemLine(text, type) {
        const lineDiv = document.createElement('div');
        lineDiv.className = `poem-line ${type}-line`;
        lineDiv.textContent = text;
        
        this.chatMessages.appendChild(lineDiv);
        this.scrollToBottom();
    }

    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ChatBot();
});