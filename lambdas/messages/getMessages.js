import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "us-west-2" });
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const { conversationId } = body;

    if (!conversationId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "conversationId is required" }),
      };
    }

    const result = await docClient.send(
      new QueryCommand({
        TableName: "MessagingMessages",
        KeyConditionExpression: "conversationId = :cid",
        ExpressionAttributeValues: {
          ":cid": conversationId,
        },
        ScanIndexForward: true,
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify(result.Items),
    };
  } catch (error) {
    console.error("Error fetching messages:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};