import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "us-west-2" });
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {
  const connectionId = event.requestContext.connectionId;

  await docClient.send(new DeleteCommand({
    TableName: "SkynetConnections",
    Key: { connectionId },
  }));

  return { statusCode: 200, body: "Disconnected" };
};
