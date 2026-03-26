import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";

const client = new DynamoDBClient({ region: "us-west-2" });
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {
  try {
    const body = JSON.parse(event.body);

    const { conversationId, senderId, content } = body;

    if (!conversationId || !senderId || !content) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Missing required fields" }),
      };
    }

    const messageItem = {
      conversationId,
      timestamp: new Date().toISOString(),
      messageId: uuidv4(),
      senderId,
      content,
    };

    await docClient.send(
      new PutCommand({
        TableName: "MessagingMessages",
        Item: messageItem,
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Message stored successfully", data: messageItem }),
    };
  } catch (error) {
    console.error("Error storing message:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};