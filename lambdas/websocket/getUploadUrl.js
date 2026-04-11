import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";

const s3 = new S3Client({ region: "us-west-2" });
const BUCKET = process.env.MEDIA_BUCKET;

export const handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  try {
    const { filename, contentType } = JSON.parse(event.body);
    if (!filename || !contentType) {
      return { statusCode: 400, headers, body: JSON.stringify({ message: "filename and contentType required" }) };
    }

    const ext = filename.split(".").pop();
    const key = `uploads/${uuidv4()}.${ext}`;

    const url = await getSignedUrl(
      s3,
      new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
      { expiresIn: 300 } // 5 minutes
    );

    const publicUrl = `https://${BUCKET}.s3.us-west-2.amazonaws.com/${key}`;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ uploadUrl: url, publicUrl }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, headers, body: JSON.stringify({ message: "Internal server error" }) };
  }
};
