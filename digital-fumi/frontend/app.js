// 注意: このURLは、AWS SAMでデプロイ後に発行される「API Gateway」のURLに書き換える必要があります
const API_ENDPOINT = "https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/Prod";

// ログイン機能は未実装なので、仮の自分のIDを固定
// 本来はログインセッションから取得します
const MY_USER_ID = "a-san";

document.addEventListener("DOMContentLoaded", () => {
    const sendForm = document.getElementById("send-form");
    const reloadButton = document.getElementById("reload-inbox");

    sendForm.addEventListener("submit", sendMessage);
    reloadButton.addEventListener("click", getInbox);

    // ページ読み込み時に一度受信トレイを読み込む
    getInbox();
});

/**
 * 文（ふみ）を送信する
 */
async function sendMessage(event) {
    event.preventDefault(); // フォームのデフォルト送信をキャンセル

    const recipientId = document.getElementById("recipient-id").value;
    const messageBody = document.getElementById("message-body").value;

    try {
        const response = await fetch(`${API_ENDPOINT}/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                senderId: MY_USER_ID,
                recipientId: recipientId,
                message: messageBody,
            }),
        });

        if (!response.ok) {
            throw new Error("送信に失敗しました");
        }

        alert("文を送信しました。24時間後に相手に届きます。");
        document.getElementById("send-form").reset(); // フォームをリセット

    } catch (error) {
        console.error("送信エラー:", error);
        alert("エラーが発生しました: " + error.message);
    }
}

/**
 * 受信トレイを取得する
 */
async function getInbox() {
    const inboxDiv = document.getElementById("inbox-messages");
    inboxDiv.innerHTML = "<p>読み込み中...</p>";

    try {
        // 本来は認証情報を送るが、今回はクエリパラメータで仮のIDを送る
        const response = await fetch(`${API_ENDPOINT}/inbox?userId=${MY_USER_ID}`);

        if (!response.ok) {
            throw new Error("受信トレイの読み込みに失敗しました");
        }

        const messages = await response.json();

        if (messages.length === 0) {
            inboxDiv.innerHTML = "<p>まだ届いている文はありません。</p>";
            return;
        }

        // 届いた文を表示
        inboxDiv.innerHTML = ""; // 読み込み中を消去
        messages.forEach(msg => {
            const msgElement = document.createElement("div");
            msgElement.className = "message";
            msgElement.innerHTML = `
                <div class="message-from">差出人: ${msg.senderId}</div>
                <div class="message-received">受信日時: ${new Date(msg.deliveredAt).toLocaleString()}</div>
                <div class="message-body">${escapeHTML(msg.message)}</div>
            `;
            inboxDiv.appendChild(msgElement);
        });

    } catch (error) {
        console.error("受信エラー:", error);
        inboxDiv.innerHTML = `<p>エラー: ${error.message}</p>`;
    }
}

// XSS対策の簡易エスケープ
function escapeHTML(str) {
    return str.replace(/[&<>"']/g, function (match) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[match];
    });
}