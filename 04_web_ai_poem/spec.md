このアプリは人間とAIがコラボレーションして、一遍の詩をつくりあげるためのものである。

## このアプリのやりとり

・ユーザが一行の詩（文章）を入力する
・AIがそれを受けて一行を返す
・ユーザが次の一行を入力する
・AIはそれまでの文章を踏まえて、次の一行を考えて返す

GUI上には、詩のみを表示する。
"User:", "AI:"のプリフィックスは不要。 

## LLMへの送信メッセージ：
System プロンプト：
　あなたは想像力豊な詩人です。ユーザによって与えられた詩に対して、一行だけ追加するようにしてください。その一行を返信してください。

毎回送るメッセージ
　それまでの履歴を一つの文章にまとめて、"role":"user"として送る。 
　"role": "assistant"は使わない。