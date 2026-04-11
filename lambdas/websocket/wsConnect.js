import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "us-west-2" });
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const username = event.queryStringParameters?.username?.toLowerCase();

  if (!username) {
    return { statusCode: 400, body: "username query param required" };
  }

  // TTL: 24 hours from now (auto-cleanup stale connections)
  const ttl = Math.floor(Date.now() / 1000) + 86400;

  await docClient.send(new PutCommand({
    TableName: "SkynetConnections",
    Item: { connectionId, username, ttl },
  }));

  return { statusCode: 200, body: "Connected" };
};
