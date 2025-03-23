// ----------------
// グローバル変数
// ----------------
const chatContainer = document.getElementById('chat-container');
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const newChatBtn = document.querySelector('.new-chat-btn');

// LLMへの接続先URL (例: "http://localhost:1234/v1/chat/completions")
const LLM_URL = "http://localhost:1234/v1/chat/completions";

// 日本語入力関連のフラグ
let isComposing = false;

// marked.jsの設定
marked.setOptions({
  highlight: function(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    } else {
      return hljs.highlightAuto(code).value;
    }
  },
  breaks: true,
  gfm: true
});

// チャット履歴（システムメッセージを辞書仕様に）
let chatHistory = [
  {
    role: "system",
    content: `あなたは英単語辞書として振る舞います。
ユーザから渡される英単語について、
(1) 英語での意味
(2) 語源(英語の説明)
(3) 類似語(英語)
(4) 英単語を使用した例文(英語)
を示してください。
必要があれば簡単な補足説明をしても構いません。`
  }
];

// ----------------
// ヘルパー関数
// ----------------

// テキストエリアの高さ自動調整
function autoResizeTextarea() {
  messageInput.style.height = 'auto';
  messageInput.style.height = 
    (messageInput.scrollHeight > 200 ? 200 : messageInput.scrollHeight) + 'px';
}

// メッセージ行の作成
function createMessageRow(content, isUser) {
  const rowDiv = document.createElement('div');
  rowDiv.classList.add('message-row', isUser ? 'user-row' : 'bot-row');
  
  const avatarDiv = document.createElement('div');
  avatarDiv.classList.add('avatar', isUser ? 'user-avatar' : 'bot-avatar');
  avatarDiv.textContent = isUser ? 'U' : 'D';
  
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message-content');
  
  rowDiv.appendChild(avatarDiv);
  rowDiv.appendChild(messageDiv);
  
  if (isUser) {
    messageDiv.textContent = content;
  } else {
    // ボットの場合は後ほどMarkdownとして描画
    messageDiv.innerHTML = '';
  }
  
  return { row: rowDiv, content: messageDiv };
}

// Markdownのレンダリング
function renderMarkdown(text) {
  return marked.parse(text);
}

// ボットの応答中に表示するタイピングインジケーターの作成
function createTypingIndicator() {
  const rowDiv = document.createElement('div');
  rowDiv.classList.add('message-row', 'bot-row');
  rowDiv.id = 'typing-indicator-row';
  
  const avatarDiv = document.createElement('div');
  avatarDiv.classList.add('avatar', 'bot-avatar');
  avatarDiv.textContent = 'D';
  
  const indicatorDiv = document.createElement('div');
  indicatorDiv.classList.add('typing-indicator');
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement('span');
    indicatorDiv.appendChild(dot);
  }
  
  rowDiv.appendChild(avatarDiv);
  rowDiv.appendChild(indicatorDiv);
  
  return rowDiv;
}

// チャットコンテナを一番下までスクロール
function scrollToBottom() {
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// エラーメッセージの表示
function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.classList.add('error');
  errorDiv.textContent = `エラー: ${message}`;
  chatContainer.appendChild(errorDiv);
  scrollToBottom();
}

// SSE (Server-Sent Events) ストリームの処理
async function processStream(response, messageContentDiv) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let fullText = '';
  
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
            
            // ストリームからのコンテンツを抽出
            if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
              const content = data.choices[0].delta.content;
              fullText += content;
              
              // Markdownとしてレンダリング
              messageContentDiv.innerHTML = renderMarkdown(fullText);
              
              // コードブロックにシンタックスハイライトを適用
              messageContentDiv.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
              });
              
              scrollToBottom();
            }
          } catch (e) {
            console.error('JSON parsing error:', e, 'for line:', line);
          }
        }
      }
    }
  } catch (error) {
    showError(`ストリーム処理中にエラーが発生しました: ${error.message}`);
  }
  
  return fullText;
}

// チャットをクリア
function clearChat() {
  chatContainer.innerHTML = '';
  chatHistory = [
    {
      role: "system",
      content: `あなたは英単語辞書として振る舞います。
ユーザから渡される英単語について、
(1) 英語での意味
(2) 語源(英語の説明)
(3) 類似語(英語)
(4) 英単語を使用した例文(英語)
を示してください。
必要があれば簡単な補足説明をしても構いません。`
    }
  ];
  
  displayWelcomeMessage();
}

// 初期メッセージの表示
function displayWelcomeMessage() {
  const { row, content } = createMessageRow('', false);
  chatContainer.appendChild(row);
  
  const welcomeMessage = `
# 英単語辞書アプリ (Solarized Light)

英単語を入力すると、その単語の:
1. **英語での意味**  
2. **語源 (英語)**  
3. **類似語 (英語)**  
4. **英単語を使った例文 (英語)**  

をAIが解説してくれます。どうぞお試しください！
  `;
  
  content.innerHTML = renderMarkdown(welcomeMessage);
  scrollToBottom();
}

// メッセージの送信処理
async function sendMessage() {
  const userMessage = messageInput.value.trim();
  if (!userMessage || isComposing) return;
  
  // 入力を無効化
  sendButton.disabled = true;
  messageInput.disabled = true;
  
  // ユーザメッセージを表示
  const userMessageElement = createMessageRow(userMessage, true);
  chatContainer.appendChild(userMessageElement.row);
  
  // (1) 入力された英単語をLLMに尋ねるための追加プロンプト
  const dictionaryPrompt = `
The user wants to know about the English word: "${userMessage}"

Please provide:
1) The meaning in English,
2) The etymology in English,
3) Synonyms (in English),
4) Example sentences using the word (in English).

If possible, include brief clarifications in English if helpful.
  `.trim();
  
  // チャット履歴にユーザの入力を追加
  chatHistory.push({ role: "user", content: dictionaryPrompt });
  
  // タイピングインジケーターを表示
  const typingIndicator = createTypingIndicator();
  chatContainer.appendChild(typingIndicator);
  scrollToBottom();
  
  // ボットのメッセージ要素
  const botMessageElement = createMessageRow('', false);
  
  try {
    // APIリクエスト
    const requestData = {
      model: "dictionary-model-001",
      messages: chatHistory,
      temperature: 0.7,
      max_tokens: 1024,
      stream: true
    };
    
    const response = await fetch(LLM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestData)
    });
    
    if (!response.ok) {
      throw new Error(`APIリクエストに失敗しました: ${response.status} ${response.statusText}`);
    }
    
    // タイピングインジケーターを削除してボットのメッセージを追加
    chatContainer.removeChild(typingIndicator);
    chatContainer.appendChild(botMessageElement.row);
    
    // ストリーム処理
    const botResponse = await processStream(response, botMessageElement.content);
    
    // チャット履歴にボットの応答を格納
    chatHistory.push({ role: "assistant", content: botResponse });
    
  } catch (error) {
    chatContainer.removeChild(typingIndicator);
    showError(error.message);
    console.error('Error:', error);
  } finally {
    // 入力フォームをリセット
    chatForm.reset();
    messageInput.style.height = '52px';
    sendButton.disabled = true;
    messageInput.disabled = false;
    messageInput.focus();
  }
}

// ----------------
// イベントリスナー
// ----------------
messageInput.addEventListener('compositionstart', () => {
  isComposing = true;
});

messageInput.addEventListener('compositionend', () => {
  isComposing = false;
});

messageInput.addEventListener('input', () => {
  autoResizeTextarea();
  sendButton.disabled = !messageInput.value.trim();
});

messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    if (!isComposing) {
      e.preventDefault();
      if (!sendButton.disabled) {
        sendMessage();
      }
    }
  }
});

newChatBtn.addEventListener('click', clearChat);

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!isComposing) {
    sendMessage();
  }
});

window.addEventListener('load', () => {
  messageInput.focus();
  displayWelcomeMessage();
});

