import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "us-west-2" }));

function generateGroupId() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "grp_";
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

export const handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  try {
    const { groupName, createdBy, members = [] } = JSON.parse(event.body);

    if (!groupName || !createdBy) {
      return { statusCode: 400, headers, body: JSON.stringify({ message: "groupName and createdBy are required" }) };
    }

    const groupId = generateGroupId();

    // Always include the creator in members
    const allMembers = [...new Set([createdBy.toLowerCase(), ...members.map(m => m.toLowerCase())])];

    const groupItem = {
      groupId,
      name: groupName.trim(),
      members: allMembers,
      createdBy: createdBy.toLowerCase(),
      createdAt: new Date().toISOString(),
    };

    await dynamo.send(new PutCommand({
      TableName: "SkynetGroups",
      Item: groupItem,
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ groupId, group: groupItem }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, headers, body: JSON.stringify({ message: "Internal server error" }) };
  }
};
