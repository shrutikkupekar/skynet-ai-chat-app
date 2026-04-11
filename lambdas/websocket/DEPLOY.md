# Day 3 — WebSocket Setup on AWS

## Step 1 — Create DynamoDB table for connections

```bash
aws dynamodb create-table \
  --table-name SkynetConnections \
  --attribute-definitions \
    AttributeName=connectionId,AttributeType=S \
    AttributeName=username,AttributeType=S \
  --key-schema AttributeName=connectionId,KeyType=HASH \
  --global-secondary-indexes '[{
    "IndexName": "username-index",
    "KeySchema": [{"AttributeName":"username","KeyType":"HASH"}],
    "Projection": {"ProjectionType":"ALL"},
    "ProvisionedThroughput": {"ReadCapacityUnits":5,"WriteCapacityUnits":5}
  }]' \
  --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
  --region us-west-2
```

Enable TTL (auto-deletes stale connections):
```bash
aws dynamodb update-time-to-live \
  --table-name SkynetConnections \
  --time-to-live-specification Enabled=true,AttributeName=ttl \
  --region us-west-2
```

## Step 2 — Create 3 Lambda functions

For each of wsConnect, wsDisconnect, wsMessage:

1. Go to AWS Lambda → Create function → Author from scratch
2. Runtime: Node.js 22.x
3. Paste the code from the corresponding .js file
4. Add the same IAM role as your existing Lambdas
5. Add extra IAM permissions to the role:
   - `dynamodb:PutItem`, `dynamodb:DeleteItem`, `dynamodb:Query` on `SkynetConnections`
   - `execute-api:ManageConnections` on the WebSocket API ARN (add after Step 3)

## Step 3 — Create API Gateway WebSocket API

1. Go to API Gateway → Create API → WebSocket API
2. Route selection expression: `$request.body.action`
3. Add routes:
   - `$connect`    → wsConnect Lambda
   - `$disconnect` → wsDisconnect Lambda
   - `sendMessage` → wsMessage Lambda
4. Deploy to a stage named `prod`
5. Copy the WebSocket URL — it looks like: `wss://xxxxxxxxxx.execute-api.us-west-2.amazonaws.com/prod`

## Step 4 — Set the WebSocket URL in the frontend

Create `.env.local` in `messaging-frontend/`:
```
NEXT_PUBLIC_WS_URL=wss://xxxxxxxxxx.execute-api.us-west-2.amazonaws.com/prod
```

Then restart `npm run dev`.

## Step 5 — Add execute-api permission to wsMessage Lambda role

After creating the WebSocket API, go to IAM → the Lambda role → add inline policy:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "execute-api:ManageConnections",
    "Resource": "arn:aws:execute-api:us-west-2:*:*/prod/POST/@connections/*"
  }]
}
```

## How it works end-to-end

1. Alice loads the app → browser opens `wss://.../prod?username=alice`
2. `wsConnect` Lambda fires → saves `{ connectionId, username: "alice" }` to SkynetConnections
3. Alice types and hits Send → frontend sends `{ action: "sendMessage", ... }` over WebSocket
4. `wsMessage` Lambda saves to DynamoDB, looks up Bob's connectionId, pushes message to Bob instantly
5. Bob's browser receives the message via `ws.onmessage` — no polling needed
6. If WebSocket is unavailable, frontend falls back to HTTP POST /send automatically
