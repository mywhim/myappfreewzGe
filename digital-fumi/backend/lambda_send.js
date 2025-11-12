// AWS SDK (V3) をインポート
// 実行環境（Lambda）にプリインストールされていますが、SAMでバンドルするのが確実です
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import { randomUUID } from "crypto";

// AWSクライアントを初期化
const dbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(dbClient);
const sfnClient = new SFNClient({});

// 環境変数からリソース名を取得 (template.yaml で設定)
const TABLE_NAME = process.env.DYNAMO_TABLE_NAME;
const STATE_MACHINE_ARN = process.env.STATE_MACHINE_ARN;

export const handler = async (event) => {
    try {
        // 1. リクエストボディをパース
        const body = JSON.parse(event.body);
        const { senderId, recipientId, message } = body;

        if (!senderId || !recipientId || !message) {
            return { statusCode: 400, body: JSON.stringify({ error: "必須項目が不足しています" }) };
        }

        // 2. データをDBに保存
        const messageId = randomUUID(); // 一意のIDを生成
        const sentAt = new Date().toISOString();
        const deliveryAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24時間後

        const putParams = {
            TableName: TABLE_NAME,
            Item: {
                messageId: messageId,
                senderId: senderId,
                recipientId: recipientId,
                message: message,
                status: "WAITING", // 状態: 配達待ち
                sentAt: sentAt,
                deliveryAt: deliveryAt, // 配達予定時刻
            },
        };

        await ddbDocClient.send(new PutCommand(putParams));

        // 3. Step Functions（遅延処理）をキック
        // Step Functionsには「どのメッセージを配達するか」だけを渡す
        const sfnParams = {
            stateMachineArn: STATE_MACHINE_ARN,
            input: JSON.stringify({
                messageId: messageId,
            }),
        };

        await sfnClient.send(new StartExecutionCommand(sfnParams));

        // 4. 成功レスポンスを返す
        return {
            statusCode: 202, // 202 Accepted (処理受け付け)
            body: JSON.stringify({ status: "accepted", messageId: messageId }),
            headers: {
                "Access-Control-Allow-Origin": "*", // CORS設定（要セキュリティ検討）
            }
        };

    } catch (error) {
        console.error("送信Lambdaエラー:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "サーバー内部でエラーが発生しました" }),
            headers: {
                "Access-Control-Allow-Origin": "*",
            }
        };
    }
};