#!/usr/bin/env python
# -*- coding: utf-8 -*-
import requests
import json
import sys

# LLMへの接続先URL
LLM_URL = "http://localhost:1234/v1/chat/completions"

# システムメッセージ
SYSTEM_MESSAGE = (
    "あなたは英単語辞書として振る舞います。\n"
    "ユーザから質問されたことのみに答えてください。他のコメントは不要です。"
)

def send_message(word):
    dictionary_prompt = (
        f'The user wants to know about the English word: "{word}"\n\n'
        "Please provide:\n"
        "1. The meaning in English\n"
        "2. phonetic symbol\n"
        "3. two examples of a slightly longer passage using the word (2–3 sentences)\n"
        "4. two sample conversations using the word\n"
        "5. Explain in English when this word should be used."
        "Reply a plain text, not mardown style."
    )
    request_data = {
        "model": "dictionary-model-001",
        "messages": [
            {"role": "system", "content": SYSTEM_MESSAGE},
            {"role": "user", "content": dictionary_prompt},
        ],
        "temperature": 0.7,
        "max_tokens": 1024,
        "stream": True,
    }
    headers = {"Content-Type": "application/json"}

    try:
        response = requests.post(LLM_URL, json=request_data, headers=headers, stream=True)
        # response.encoding を明示的に UTF-8 に設定
        response.encoding = 'utf-8'
    except Exception as e:
        print(f"APIリクエスト送信中にエラーが発生しました: {e}")
        return ""

    if response.status_code != 200:
        print(f"APIリクエストに失敗しました: {response.status_code} {response.reason}")
        return ""

    full_text = ""
    try:
        for line in response.iter_lines(decode_unicode=True):
            if line:
                if line.startswith("data: "):
                    data_line = line[6:]
                    if data_line == "[DONE]":
                        break
                    try:
                        data = json.loads(data_line)
                        if ("choices" in data and 
                            data["choices"][0].get("delta", {}).get("content")):
                            content = data["choices"][0]["delta"]["content"]
                            full_text += content
                            print(content, end="", flush=True)
                    except json.JSONDecodeError as e:
                        print("\nJSONパースエラー:", e, file=sys.stderr)
    except Exception as e:
        print(f"\nストリーム処理中にエラーが発生しました: {e}", file=sys.stderr)

    print()  # レスポンス完了後に改行
    return full_text

def main():
    # コマンドライン引数がない場合は何もせず終了
    if len(sys.argv) < 2:
        sys.exit(0)
    
    word = sys.argv[1]
    if not word:
        sys.exit(0)
    
    # LLMへ問い合わせ
    send_message(word)

if __name__ == "__main__":
    main()

