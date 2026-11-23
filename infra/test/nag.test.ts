import { App, Validations } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { AwsSolutionsChecks } from 'cdk-nag';
import { ChineseWordsApiStack } from '../lib/api-stack';
import { ChineseWordsStatefulStack } from '../lib/stateful-stack';

function buildApp() {
  const app = new App();
  const stack = new ChineseWordsStatefulStack(app, 'Test');
  Validations.of(app).addPlugins(new AwsSolutionsChecks(app, { verbose: true }));
  return { app, stack };
}

describe('ChineseWordsApiStack cdk-nag', () => {
  test('AwsSolutionsChecks reports no unacknowledged violations', () => {
    const app = new App({ context: { githubUser: 'testuser' } });
    const stateful = new ChineseWordsStatefulStack(app, 'Stateful');
    new ChineseWordsApiStack(app, 'Api', {
      table: stateful.table,
      userPool: stateful.userPool,
      userPoolClient: stateful.userPoolClient,
    });
    Validations.of(app).addPlugins(new AwsSolutionsChecks(app, { verbose: true }));
    const logged = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      expect(() => app.synth()).not.toThrow();
      expect(logged).not.toHaveBeenCalled();
    } finally {
      logged.mockRestore();
    }
  });
});

describe('ChineseWordsStatefulStack synth and cdk-nag', () => {
  test('synthesizes to valid CloudFormation with the expected resources', () => {
    const { stack } = buildApp();
    const template = Template.fromStack(stack);
    expect(Object.keys(template.toJSON().Resources).length).toBeGreaterThan(0);
    template.resourceCountIs('AWS::DynamoDB::Table', 1);
    template.resourceCountIs('AWS::Cognito::UserPool', 1);
    template.resourceCountIs('AWS::Cognito::UserPoolClient', 1);
  });

  test('AwsSolutionsChecks reports no unacknowledged violations', () => {
    const { app } = buildApp();
    // Errors make synth throw. Warnings are only logged, so fail on those too.
    const logged = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      expect(() => app.synth()).not.toThrow();
      expect(logged).not.toHaveBeenCalled();
    } finally {
      logged.mockRestore();
    }
  });
});
