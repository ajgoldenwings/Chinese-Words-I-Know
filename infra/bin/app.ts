#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { ChineseWordsApiStack } from '../lib/api-stack';
import { ChineseWordsStatefulStack } from '../lib/stateful-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

export const stateful = new ChineseWordsStatefulStack(app, 'ChineseWordsStatefulStack', { env });

// Resources are passed as props, not through Fn::ImportValue.
new ChineseWordsApiStack(app, 'ChineseWordsApiStack', {
  env,
  table: stateful.table,
  userPool: stateful.userPool,
  userPoolClient: stateful.userPoolClient,
});
