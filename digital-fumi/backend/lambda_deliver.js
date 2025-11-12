import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const dbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(dbClient);

const TABLE_NAME = process.env.DYNAMO_TABLE_NAME;

export const handler = async (event) => {
    // Step Functionsから渡された 'messageId' を受け取る
    const { messageId } = event;

    if (!messageId) {
        console.error("messageIdがありません", event);
        throw new Error("messageId not provided");
    }

    try {
        // 該当する文のステータスを "DELIVERED"（配達済み）に更新
        const updateParams = {
            TableName: TABLE_NAME,
            Key: {
                messageId: messageId,
            },
            UpdateExpression: "set #status = :status, #deliveredAt = :deliveredAt",
            ExpressionAttributeNames: {
                "#status": "status",
                "#deliveredAt": "deliveredAt" // 実際の配達時刻
            },
            ExpressionAttributeValues: {
                ":status": "DELIVERED",
                ":deliveredAt": new Date().toISOString()
            },
            ConditionExpression: "#status = :waiting", // 念のため「配達待ち」の場合のみ更新
            ExpressionAttributeValues: {
                ":status": "DELIVERED",
                ":deliveredAt": new Date().toISOString(),
                ":waiting": "WAITING"
            }
        };

        await ddbDocClient.send(new UpdateCommand(updateParams));

        console.log(`メッセージ ${messageId} を配達済みに更新しました。`);
        return { status: "success", messageId: messageId };

    } catch (error) {
        console.error("配達Lambdaエラー:", error);
        // Step Functions側でリトライできるようにエラーをスローする
        throw new Error(`配達処理に失敗: ${error.message}`);
    }
};