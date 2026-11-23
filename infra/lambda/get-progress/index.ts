import { DynamoDBClient, QueryCommand, type AttributeValue } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';

const client = new DynamoDBClient({});

const json = (statusCode: number, body: unknown): APIGatewayProxyResultV2 => ({
  statusCode,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

/** GET /progress: returns every UserWordState for the signed-in user. */
export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> => {
  // The user id comes from the verified token and is never read from the request.
  const userId = event.requestContext?.authorizer?.jwt?.claims?.sub;
  if (typeof userId !== 'string' || userId.length === 0) {
    return json(401, { message: 'Please sign in again.' });
  }

  try {
    const items: Record<string, unknown>[] = [];
    let startKey: Record<string, AttributeValue> | undefined;
    do {
      const result = await client.send(
        new QueryCommand({
          TableName: process.env.TABLE_NAME,
          KeyConditionExpression: 'userId = :userId',
          ExpressionAttributeValues: { ':userId': { S: userId } },
          ExclusiveStartKey: startKey,
        }),
      );
      for (const raw of result.Items ?? []) {
        const { userId: _omit, ...record } = unmarshall(raw);
        items.push(record);
      }
      startKey = result.LastEvaluatedKey;
    } while (startKey);

    return json(200, { items });
  } catch (error) {
    console.error('GetProgress failed', error);
    return json(500, { message: 'Something went wrong. Please try again later.' });
  }
};
