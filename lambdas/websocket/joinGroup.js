import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "us-west-2" }));

export const handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  try {
    const { groupId, username } = JSON.parse(event.body);

    if (!groupId || !username) {
      return { statusCode: 400, headers, body: JSON.stringify({ message: "groupId and username are required" }) };
    }

    // Check group exists first
    const existing = await dynamo.send(new GetCommand({
      TableName: "SkynetGroups",
      Key: { groupId },
    }));

    if (!existing.Item) {
      return { statusCode: 404, headers, body: JSON.stringify({ message: "Group not found. Check the code and try again." }) };
    }

    // Add user to members list
    const result = await dynamo.send(new UpdateCommand({
      TableName: "SkynetGroups",
      Key: { groupId },
      UpdateExpression: "SET #members = list_append(if_not_exists(#members, :empty), :newMember)",
      ConditionExpression: "not contains(#members, :username)",
      ExpressionAttributeNames: { "#members": "members" },
      ExpressionAttributeValues: {
        ":newMember": [username.toLowerCase()],
        ":username": username.toLowerCase(),
        ":empty": [],
      },
      ReturnValues: "ALL_NEW",
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ group: result.Attributes }),
    };
  } catch (err) {
    // ConditionalCheckFailedException means user is already a member — that's fine
    if (err.name === "ConditionalCheckFailedException") {
      const existing = await dynamo.send(new GetCommand({
        TableName: "SkynetGroups",
        Key: { groupId: JSON.parse(event.body).groupId },
      }));
      return { statusCode: 200, headers, body: JSON.stringify({ group: existing.Item }) };
    }
    console.error(err);
    return { statusCode: 500, headers, body: JSON.stringify({ message: "Internal server error" }) };
  }
};
