import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "us-west-2" }));

export const handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  try {
    const { username } = JSON.parse(event.body);

    if (!username) {
      return { statusCode: 400, headers, body: JSON.stringify({ message: "username is required" }) };
    }

    // Scan for groups where this user is a member
    const result = await dynamo.send(new ScanCommand({
      TableName: "SkynetGroups",
      FilterExpression: "contains(#members, :username)",
      ExpressionAttributeNames: { "#members": "members" },
      ExpressionAttributeValues: { ":username": username.toLowerCase() },
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result.Items || []),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, headers, body: JSON.stringify({ message: "Internal server error" }) };
  }
};
