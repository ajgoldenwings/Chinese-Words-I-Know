import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { App } from 'aws-cdk-lib/core';
import { ChineseWordsApiStack } from '../lib/api-stack';
import { ChineseWordsStatefulStack } from '../lib/stateful-stack';

test('cdk synth succeeds for all stacks', () => {
  const outdir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdk-synth-'));
  const app = new App({ outdir, context: { githubUser: 'testuser' } });
  const stateful = new ChineseWordsStatefulStack(app, 'ChineseWordsStatefulStack');
  new ChineseWordsApiStack(app, 'ChineseWordsApiStack', {
    table: stateful.table,
    userPool: stateful.userPool,
    userPoolClient: stateful.userPoolClient,
  });
  const assembly = app.synth();
  expect(assembly.stacks.map((s) => s.stackName).sort()).toEqual([
    'ChineseWordsApiStack',
    'ChineseWordsStatefulStack',
  ]);
  for (const stack of assembly.stacks) {
    expect(Object.keys(stack.template.Resources).length).toBeGreaterThan(0);
  }
});
