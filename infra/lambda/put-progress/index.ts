import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';

const client = new DynamoDBClient({});

const MAX_ITEMS = 25;
const OVERRIDES = ['known', 'unknown', 'none'];

interface ProgressRecord {
  wordId: string;
  confidenceScore: number;
  timesSeenCount: number;
  lastSeenAt: string;
  manualOverride: 'known' | 'unknown' | 'none';
  updatedAt: string;
}

const json = (statusCode: number, body: unknown): APIGatewayProxyResultV2 => ({
  statusCode,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

const isIso = (value: unknown): value is string =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value));

function parseRecord(value: unknown): ProgressRecord | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const r = value as Record<string, unknown>;
  if (
    typeof r.wordId !== 'string' ||
    r.wordId.length === 0 ||
    typeof r.confidenceScore !== 'number' ||
    !(r.confidenceScore >= 0 && r.confidenceScore <= 1) ||
    typeof r.timesSeenCount !== 'number' ||
    !Number.isInteger(r.timesSeenCount) ||
    r.timesSeenCount < 0 ||
    !isIso(r.lastSeenAt) ||
    typeof r.manualOverride !== 'string' ||
    !OVERRIDES.includes(r.manualOverride) ||
    !isIso(r.updatedAt)
  ) {
    return undefined;
  }
  return {
    wordId: r.wordId,
    confidenceScore: r.confidenceScore,
    timesSeenCount: r.timesSeenCount,
    lastSeenAt: r.lastSeenAt,
    manualOverride: r.manualOverride as ProgressRecord['manualOverride'],
    updatedAt: r.updatedAt,
  };
}

type Outcome =
  | { wordId: string; accepted: true }
  | { wordId: string; accepted: false; current: Record<string, unknown> };

async function writeOne(userId: string, record: ProgressRecord): Promise<Outcome> {
  try {
    await client.send(
      new PutItemCommand({
        TableName: process.env.TABLE_NAME,
        Item: marshall({ userId, ...record }),
        ConditionExpression: 'attribute_not_exists(wordId) OR updatedAt < :updatedAt',
        ExpressionAttributeValues: marshall({ ':updatedAt': record.updatedAt }),
        ReturnValuesOnConditionCheckFailure: 'ALL_OLD',
      }),
    );
    return { wordId: record.wordId, accepted: true };
  } catch (error) {
    const failure = error as { name?: string; Item?: Parameters<typeof unmarshall>[0] };
    if (failure.name === 'ConditionalCheckFailedException' && failure.Item) {
      const { userId: _omit, ...current } = unmarshall(failure.Item);
      return { wordId: record.wordId, accepted: false, current };
    }
    throw error;
  }
}

/** PUT /progress: writes up to 25 records, each as its own conditional PutItem. */
export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> => {
  const userId = event.requestContext?.authorizer?.jwt?.claims?.sub;
  if (typeof userId !== 'string' || userId.length === 0) {
    return json(401, { message: 'Please sign in again.' });
  }

  let body: unknown;
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body ?? '', 'base64').toString('utf8')
      : (event.body ?? '');
    body = JSON.parse(raw);
  } catch {
    return json(400, { message: 'The request could not be read.' });
  }

  const rawItems = (body as { items?: unknown } | null)?.items;
  if (!Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > MAX_ITEMS) {
    return json(400, { message: `Send between 1 and ${MAX_ITEMS} items.` });
  }
  const records: ProgressRecord[] = [];
  for (const raw of rawItems) {
    const record = parseRecord(raw);
    if (!record) return json(400, { message: 'One of the items is not valid.' });
    records.push(record);
  }
  if (new Set(records.map((r) => r.wordId)).size !== records.length) {
    return json(400, { message: 'Each word can appear only once per request.' });
  }

  try {
    const outcomes = await Promise.all(records.map((r) => writeOne(userId, r)));
    const accepted: string[] = [];
    const rejected: { wordId: string; current: Record<string, unknown> }[] = [];
    for (const outcome of outcomes) {
      if (outcome.accepted) accepted.push(outcome.wordId);
      else rejected.push({ wordId: outcome.wordId, current: outcome.current });
    }
    return json(200, { accepted, rejected });
  } catch (error) {
    console.error('PutProgress failed', error);
    return json(500, { message: 'Something went wrong. Please try again later.' });
  }
};
