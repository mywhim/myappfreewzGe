import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const dbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(dbClient);

const TABLE_NAME = process.env.DYNAMO_TABLE_NAME;
const INDEX_NAME = "RecipientStatusIndex"; // template.yaml で定義するGSI名

export const handler = async (event) => {
    try {
        // API Gatewayのクエリパラメータから 'userId' を取得
        const userId = event.queryStringParameters?.userId;

        if (!userId) {
            return { statusCode: 400, body: JSON.stringify({ error: "userIdが必要です" }) };
        }

        // DynamoDBのGSI（グローバルセカンダリインデックス）をクエリ
        // GSIキー: recipientId, ソートキー: status
        // これにより「特定の受信者」の「配達済み」の文だけを効率的に取得できる
        const queryParams = {
            TableName: TABLE_NAME,
            IndexName: INDEX_NAME,
            KeyConditionExpression: "recipientId = :uid and #status = :status",
            ExpressionAttributeNames: {
                "#status": "status",
            },
            ExpressionAttributeValues: {
                ":uid": userId,
                ":status": "DELIVERED",
            },
            ScanIndexForward: false, // 新しいものから順に (配達日時でソートする方が望ましい)
        };

        const data = await ddbDocClient.send(new QueryCommand(queryParams));

        return {
            statusCode: 200,
            body: JSON.stringify(data.Items || []),
            headers: {
                "Access-Control-Allow-Origin": "*", // CORS
            }
        };

    } catch (error) {
        console.error("受信トレイ取得Lambdaエラー:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "サーバー内部でエラーが発生しました" }),
            headers: {
                "Access-Control-Allow-Origin": "*",
            }
        };
    }
};