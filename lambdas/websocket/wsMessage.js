import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";
import { v4 as uuidv4 } from "uuid";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "us-west-2" }));

async function getConnectionsForUser(username) {
  const result = await dynamo.send(new QueryCommand({
    TableName: "SkynetConnections",
    IndexName: "username-index",
    KeyConditionExpression: "username = :u",
    ExpressionAttributeValues: { ":u": username },
  }));
  return result.Items || [];
}

async function pushToUser(apigw, username, payload) {
  const connections = await getConnectionsForUser(username);
  await Promise.allSettled(
    connections.map((conn) =>
      apigw.send(new PostToConnectionCommand({
        ConnectionId: conn.connectionId,
        Data: Buffer.from(payload),
      }))
    )
  );
}

export const handler = async (event) => {
  const { domainName, stage } = event.requestContext;
  const apigw = new ApiGatewayManagementApiClient({
    endpoint: `https://${domainName}/${stage}`,
  });

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  const { action, conversationId, senderId, content } = body;

  if (action !== "sendMessage" || !conversationId || !senderId || !content) {
    return { statusCode: 400, body: "Missing fields" };
  }

  // Save message to DynamoDB
  const messageItem = {
    conversationId,
    timestamp: new Date().toISOString(),
    messageId: uuidv4(),
    senderId: senderId.toLowerCase(),
    content,
  };

  await dynamo.send(new PutCommand({
    TableName: "MessagingMessages",
    Item: messageItem,
  }));

  const payload = JSON.stringify({ type: "message", data: messageItem });
  const me = senderId.toLowerCase();

  if (conversationId.startsWith("grp_")) {
    // ── Group message: push to all members except sender ──────────────────
    const group = await dynamo.send(new GetCommand({
      TableName: "SkynetGroups",
      Key: { groupId: conversationId },
    }));

    const members = group.Item?.members || [];
    const recipients = members.filter((m) => m !== me);

    await Promise.allSettled(recipients.map((username) => pushToUser(apigw, username, payload)));
  } else {
    // ── Direct message: push to the other user ────────────────────────────
    const parts = conversationId.split("__");
    const otherUser = parts.find((p) => p !== me);
    if (otherUser) await pushToUser(apigw, otherUser, payload);
  }

  return { statusCode: 200, body: "OK" };
};
