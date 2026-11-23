import * as cdk from 'aws-cdk-lib/core';
import { Template } from 'aws-cdk-lib/assertions';
import { ChineseWordsStatefulStack } from '../lib/stateful-stack';

describe('ChineseWordsStatefulStack', () => {
  const stack = new ChineseWordsStatefulStack(new cdk.App(), 'Test');
  const template = Template.fromStack(stack);

  test('table is on-demand, keyed by userId/wordId, and retained', () => {
    template.hasResource('AWS::DynamoDB::Table', {
      Properties: {
        BillingMode: 'PAY_PER_REQUEST',
        KeySchema: [
          { AttributeName: 'userId', KeyType: 'HASH' },
          { AttributeName: 'wordId', KeyType: 'RANGE' },
        ],
      },
      DeletionPolicy: 'Retain',
    });
  });

  test('user pool and public client exist, outputs exported', () => {
    template.hasResource('AWS::Cognito::UserPool', { DeletionPolicy: 'Retain' });
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', { GenerateSecret: false });
    template.hasOutput('UserPoolId', {});
    template.hasOutput('UserPoolClientId', {});
  });

  test('termination protection is on', () => {
    expect(stack.terminationProtection).toBe(true);
  });
});
