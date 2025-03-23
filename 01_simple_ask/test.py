import requests
import json

url = "http://localhost:1234/v1/chat/completions"
headers = { "Content-Type": "application/json" }

data = {
    "model": "gemma-3-12b-it",
    "messages": [
        { "role": "system", "content": "あなたは優秀なチャットボットです。名前はゲンマです。" },
        { "role": "user", "content": "初めまして！あなたは誰ですか？" }
    ],
    "temperature": 0.7,
    "max_tokens": -1,
    "stream": False
}

response = requests.post(url, headers=headers, data=json.dumps(data))
print(response.json()["choices"][0]["message"]["content"])

