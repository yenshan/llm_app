// main.js

// ----------------
// グローバル変数
// ----------------
const chatContainer = document.getElementById("chat-container");
const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const sendButton = document.getElementById("send-button");
const newChatBtn = document.getElementById("new-chat-btn");
// 追加: ダウンロードボタン
const downloadChatBtn = document.getElementById("download-chat-btn");

// LLMへの接続先URL
const LLM_URL = "http://localhost:1234/v1/chat/completions";

// システムメッセージ: 「英単語辞書として振る舞う」よう指示

const SYSTEM_MESSAGE = `あなたは英単語辞書として振る舞います。
ユーザから質問されたことのみに答えてください。他のコメントは不要です。
`;

// 日本語入力関連のフラグ
let isComposing = false;

// marked.jsの設定
marked.setOptions({
  highlight: function (code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    } else {
      return hljs.highlightAuto(code).value;
    }
  },
  breaks: true,
  gfm: true,
});

// ----------------
// ヘルパー関数
// ----------------

// テキストエリアの高さ自動調整
function autoResizeTextarea() {
  messageInput.style.height = "auto";
  messageInput.style.height =
    (messageInput.scrollHeight > 200 ? 200 : messageInput.scrollHeight) + "px";
}

// メッセージ行の作成
function createMessageRow(content, isUser) {
  const rowDiv = document.createElement("div");
  rowDiv.classList.add("message-row", isUser ? "user-row" : "bot-row");

  const avatarDiv = document.createElement("div");
  avatarDiv.classList.add("avatar", isUser ? "user-avatar" : "bot-avatar");
  avatarDiv.textContent = isUser ? "U" : "D";

  const messageDiv = document.createElement("div");
  messageDiv.classList.add("message-content");

  rowDiv.appendChild(avatarDiv);
  rowDiv.appendChild(messageDiv);

  if (isUser) {
    // ユーザ入力はそのままテキスト表示
    messageDiv.textContent = content;
  } else {
    // ボットからの返答は後でMarkdownとして描画
    messageDiv.innerHTML = "";
  }

  return { row: rowDiv, content: messageDiv };
}

// Markdownのレンダリング
function renderMarkdown(text) {
  return marked.parse(text);
}

// ボットの応答中に表示するタイピングインジケーターの作成
function createTypingIndicator() {
  const rowDiv = document.createElement("div");
  rowDiv.classList.add("message-row", "bot-row");
  rowDiv.id = "typing-indicator-row";

  const avatarDiv = document.createElement("div");
  avatarDiv.classList.add("avatar", "bot-avatar");
  avatarDiv.textContent = "D";

  const indicatorDiv = document.createElement("div");
  indicatorDiv.classList.add("typing-indicator");
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement("span");
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
  const errorDiv = document.createElement("div");
  errorDiv.classList.add("error");
  errorDiv.textContent = `エラー: ${message}`;
  chatContainer.appendChild(errorDiv);
  scrollToBottom();
}

// SSE (Server-Sent Events) ストリームの処理
async function processStream(response, messageContentDiv) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let fullText = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ") && line !== "data: [DONE]") {
          try {
            const data = JSON.parse(line.substring(6));

            // ストリームからのコンテンツを抽出
            if (
              data.choices &&
              data.choices[0].delta &&
              data.choices[0].delta.content
            ) {
              const content = data.choices[0].delta.content;
              fullText += content;

              // Markdownとしてレンダリング
              messageContentDiv.innerHTML = renderMarkdown(fullText);

              // コードブロックにシンタックスハイライトを適用
              messageContentDiv.querySelectorAll("pre code").forEach((block) => {
                hljs.highlightElement(block);
              });

              scrollToBottom();
            }
          } catch (e) {
            console.error("JSON parsing error:", e, "for line:", line);
          }
        }
      }
    }
  } catch (error) {
    showError(`ストリーム処理中にエラーが発生しました: ${error.message}`);
  }

  return fullText;
}

// チャットをクリア（UIのみリセット）
function clearChat() {
  chatContainer.innerHTML = "";
  displayWelcomeMessage();
}

// 初期メッセージの表示
function displayWelcomeMessage() {
  const { row, content } = createMessageRow("", false);
  chatContainer.appendChild(row);

  const welcomeMessage = `
# 英単語辞書アプリ
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

  // ユーザメッセージをUIに表示
  const userMessageElement = createMessageRow(userMessage, true);
  chatContainer.appendChild(userMessageElement.row);

  // ユーザ入力をLLMに尋ねるためのプロンプト
  const dictionaryPrompt = `
The user wants to know about the English word: "${userMessage}"

Please provide:
1. The meaning in English
2. phonetic symbol
3. two examples of a slightly longer passage using the word (2–3 sentences)
4. two sample conversations using the word
5. Explain in English when this word should be used.
`.trim();

  // SSEでLLMへ送る会話履歴(今回、過去履歴は送らない)
  const requestData = {
    model: "dictionary-model-001",
    messages: [
      { role: "system", content: SYSTEM_MESSAGE },
      { role: "user", content: dictionaryPrompt },
    ],
    temperature: 0.7,
    max_tokens: 1024,
    stream: true,
  };

  // タイピングインジケーターを表示
  const typingIndicator = createTypingIndicator();
  chatContainer.appendChild(typingIndicator);
  scrollToBottom();

  // ボットのメッセージ要素
  const botMessageElement = createMessageRow("", false);

  try {
    // APIリクエスト
    const response = await fetch(LLM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestData),
    });

    if (!response.ok) {
      throw new Error(
        `APIリクエストに失敗しました: ${response.status} ${response.statusText}`
      );
    }

    // タイピングインジケーターを削除してボットのメッセージをUIに追加
    chatContainer.removeChild(typingIndicator);
    chatContainer.appendChild(botMessageElement.row);

    // ストリームを処理してボットの応答を表示
    await processStream(response, botMessageElement.content);
  } catch (error) {
    chatContainer.removeChild(typingIndicator);
    showError(error.message);
    console.error("Error:", error);
  } finally {
    // 入力フォームをリセット
    chatForm.reset();
    messageInput.style.height = "52px";
    sendButton.disabled = true;
    messageInput.disabled = false;
    messageInput.focus();
  }
}

// 追加: 画面に表示されている会話をダウンロード
function downloadChat() {
  // .message-row 単位でテキストをまとめる
  const rows = chatContainer.querySelectorAll(".message-row");
  const lines = [];

  rows.forEach((row) => {
    const avatar = row.querySelector(".avatar");
    const contentElem = row.querySelector(".message-content");
    if (!avatar || !contentElem) return;

    // 誰の発話か(U: User / D: Dictionary)
    const speaker = avatar.textContent === "U" ? "User" : "Dictionary";

    // テキスト部分(改行を適宜挿入)
    const text = contentElem.innerText.trim();
    lines.push(`${speaker}: ${text}`);
  });

  // ファイルに書き出すテキスト
  const fileContent = lines.join("\n\n");

  // Blobを生成してリンクからダウンロード
  const blob = new Blob([fileContent], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  // ダウンロードするファイル名
  a.download = "chat-log.txt";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ----------------
// イベントリスナー
// ----------------

// 日本語入力を開始したタイミング
messageInput.addEventListener("compositionstart", () => {
  isComposing = true;
});

// 日本語入力が終了したタイミング
messageInput.addEventListener("compositionend", () => {
  isComposing = false;
});

// 入力欄の内容が変化
messageInput.addEventListener("input", () => {
  autoResizeTextarea();
  sendButton.disabled = !messageInput.value.trim();
});

// Enterキーで送信（Shift+Enterは改行）
messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    if (!isComposing) {
      e.preventDefault();
      if (!sendButton.disabled) {
        sendMessage();
      }
    }
  }
});

// 「新しい検索」ボタンが押されたらチャットUIをクリア
newChatBtn.addEventListener("click", clearChat);

// ダウンロードボタンが押されたら現在の会話をファイル保存
downloadChatBtn.addEventListener("click", downloadChat);

// フォーム送信時
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!isComposing) {
    sendMessage();
  }
});

// ページ読み込み時
window.addEventListener("load", () => {
  messageInput.focus();
  displayWelcomeMessage();
});


