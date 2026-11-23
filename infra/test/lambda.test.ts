import * as fs from 'fs';
import * as path from 'path';
import * as dynamo from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { handler as getHandler } from '../lambda/get-progress/index';
import { handler as putHandler } from '../lambda/put-progress/index';

const send = jest.spyOn(dynamo.DynamoDBClient.prototype, 'send') as unknown as jest.Mock;

const event = (body: unknown, sub: string | null = 'user-1', raw?: string): any => ({
  body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  isBase64Encoded: false,
  requestContext: { authorizer: { jwt: { claims: sub === null ? {} : { sub } } } },
});

const record = (wordId: string, updatedAt = '2025-01-02T00:00:00.000Z') => ({
  wordId,
  confidenceScore: 0.5,
  timesSeenCount: 3,
  lastSeenAt: '2025-01-01T00:00:00.000Z',
  manualOverride: 'none',
  updatedAt,
});

const parse = (res: any) => JSON.parse(res.body);

beforeEach(() => {
  send.mockReset();
  process.env.TABLE_NAME = 'progress';
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});


describe('get-progress', () => {
  test('queries by the token sub, follows pagination, and strips userId', async () => {
    send
      .mockResolvedValueOnce({
        Items: [marshall({ userId: 'user-1', ...record('cat') })],
        LastEvaluatedKey: { userId: { S: 'user-1' }, wordId: { S: 'cat' } },
      })
      .mockResolvedValueOnce({ Items: [marshall({ userId: 'user-1', ...record('dog') })] });
    const res: any = await getHandler(event(undefined));
    expect(res.statusCode).toBe(200);
    expect(parse(res).items.map((i: any) => i.wordId)).toEqual(['cat', 'dog']);
    expect(parse(res).items[0]).not.toHaveProperty('userId');
    const first = send.mock.calls[0][0];
    expect(first).toBeInstanceOf(dynamo.QueryCommand);
    expect(first.input.TableName).toBe('progress');
    expect(first.input.ExpressionAttributeValues[':userId']).toEqual({ S: 'user-1' });
    expect(send.mock.calls[1][0].input.ExclusiveStartKey).toEqual({
      userId: { S: 'user-1' },
      wordId: { S: 'cat' },
    });
  });

  test('returns an empty list when the user has no records', async () => {
    send.mockResolvedValueOnce({});
    expect(parse(await getHandler(event(undefined)))).toEqual({ items: [] });
  });

  test('401 without a sub claim, and DynamoDB is not called', async () => {
    const res: any = await getHandler(event(undefined, null));
    expect(res.statusCode).toBe(401);
    expect(send).not.toHaveBeenCalled();
  });

  test('500 with a plain message when DynamoDB fails', async () => {
    send.mockRejectedValueOnce(new Error('boom'));
    const res: any = await getHandler(event(undefined));
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain('boom');
  });
});

describe('put-progress', () => {
  test('accepts fresh records with one conditional PutItem each', async () => {
    send.mockResolvedValue({});
    const res: any = await putHandler(event({ items: [record('cat'), record('dog')] }));
    expect(res.statusCode).toBe(200);
    expect(parse(res)).toEqual({ accepted: ['cat', 'dog'], rejected: [] });
    expect(send).toHaveBeenCalledTimes(2);
    for (const [command] of send.mock.calls) {
      expect(command).toBeInstanceOf(dynamo.PutItemCommand);
      expect(command.input.ConditionExpression).toContain('updatedAt <');
      expect(command.input.Item.userId).toEqual({ S: 'user-1' });
    }
  });

  test('a stale write is rejected and the current record is returned', async () => {
    const current = record('cat', '2025-06-01T00:00:00.000Z');
    const err = Object.assign(new Error('conditional'), {
      name: 'ConditionalCheckFailedException',
      Item: marshall({ userId: 'user-1', ...current }),
    });
    send.mockRejectedValueOnce(err).mockResolvedValueOnce({});
    const res: any = await putHandler(
      event({ items: [record('cat', '2025-01-01T00:00:00.000Z'), record('dog')] }),
    );
    expect(res.statusCode).toBe(200);
    expect(parse(res)).toEqual({
      accepted: ['dog'],
      rejected: [{ wordId: 'cat', current }],
    });
  });

  test('accepts exactly 25 records and rejects 26', async () => {
    send.mockResolvedValue({});
    const make = (n: number) => Array.from({ length: n }, (_, i) => record(`word-${i}`));
    expect((await putHandler(event({ items: make(25) })) as any).statusCode).toBe(200);
    expect(send).toHaveBeenCalledTimes(25);
    send.mockClear();
    const res: any = await putHandler(event({ items: make(26) }));
    expect(res.statusCode).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  test.each([
    ['malformed JSON', event(undefined, 'user-1', '{nope')],
    ['missing items', event({})],
    ['empty items', event({ items: [] })],
    ['invalid score', event({ items: [{ ...record('cat'), confidenceScore: 1.5 }] })],
    ['invalid override', event({ items: [{ ...record('cat'), manualOverride: null }] })],
    ['bad timestamp', event({ items: [{ ...record('cat'), updatedAt: 'yesterday' }] })],
    ['duplicate wordIds', event({ items: [record('cat'), record('cat')] })],
  ])('400 for %s', async (_name, ev) => {
    const res: any = await putHandler(ev);
    expect(res.statusCode).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  test('401 without a sub claim', async () => {
    const res: any = await putHandler(event({ items: [record('cat')] }, null));
    expect(res.statusCode).toBe(401);
    expect(send).not.toHaveBeenCalled();
  });

  test('500 when DynamoDB fails for another reason', async () => {
    send.mockRejectedValueOnce(new Error('throttled'));
    const res: any = await putHandler(event({ items: [record('cat')] }));
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain('throttled');
  });

  test('BatchWriteItem is never used', async () => {
    send.mockResolvedValue({});
    await putHandler(event({ items: Array.from({ length: 25 }, (_, i) => record(`w-${i}`)) }));
    const names = send.mock.calls.map(([c]) => c.constructor.name);
    expect(names).not.toContain('BatchWriteItemCommand');
    expect(new Set(names)).toEqual(new Set(['PutItemCommand']));
    const source = fs.readFileSync(path.join(__dirname, '../lambda/put-progress/index.ts'), 'utf8');
    expect(source).not.toMatch(/BatchWrite/i);
  });
});

describe('put-progress empty lastSeenAt', () => {
  test('accepts a never-seen word with an empty lastSeenAt', async () => {
    send.mockResolvedValueOnce({});
    const res: any = await putHandler(event({ items: [{ ...record('cat'), lastSeenAt: '', manualOverride: 'known' }] }));
    expect(res.statusCode).toBe(200);
    expect(parse(res).accepted).toEqual(['cat']);
  });
  test('still rejects a lastSeenAt that is not a date', async () => {
    const res: any = await putHandler(event({ items: [{ ...record('cat'), lastSeenAt: 'yesterday' }] }));
    expect(res.statusCode).toBe(400);
  });
});
