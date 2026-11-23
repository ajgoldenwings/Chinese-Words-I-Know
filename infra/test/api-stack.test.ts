import * as cdk from 'aws-cdk-lib/core';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { ChineseWordsApiStack } from '../lib/api-stack';
import { ChineseWordsStatefulStack } from '../lib/stateful-stack';

describe('ChineseWordsApiStack', () => {
  const app = new cdk.App({ context: { githubUser: 'testuser' } });
  const stateful = new ChineseWordsStatefulStack(app, 'Stateful');
  const stack = new ChineseWordsApiStack(app, 'Api', {
    table: stateful.table,
    userPool: stateful.userPool,
    userPoolClient: stateful.userPoolClient,
  });
  const template = Template.fromStack(stack);

  test('two Node.js 22 functions that know the table name', () => {
    const fns = template.findResources('AWS::Lambda::Function', {
      Properties: { Runtime: 'nodejs22.x' },
    });
    expect(Object.keys(fns)).toHaveLength(2);
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: { Variables: { TABLE_NAME: Match.anyValue() } },
    });
  });

  test('GET can read and PUT can write, and neither can delete', () => {
    const json = JSON.stringify(template.findResources('AWS::IAM::Policy'));
    expect(json).toContain('dynamodb:Query');
    expect(json).toContain('dynamodb:PutItem');
    expect(json).not.toContain('dynamodb:DeleteItem');
    expect(json).not.toContain('dynamodb:*');
  });

  test('HTTP API has GET and PUT /progress behind a JWT authorizer', () => {
    template.resourceCountIs('AWS::ApiGatewayV2::Api', 1);
    template.hasResourceProperties('AWS::ApiGatewayV2::Authorizer', {
      AuthorizerType: 'JWT',
      IdentitySource: ['$request.header.Authorization'],
      JwtConfiguration: { Audience: Match.anyValue(), Issuer: Match.anyValue() },
    });
    for (const key of ['GET /progress', 'PUT /progress']) {
      template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
        RouteKey: key,
        AuthorizationType: 'JWT',
        AuthorizerId: Match.anyValue(),
      });
    }
    template.resourceCountIs('AWS::ApiGatewayV2::Route', 2);
  });

  test('CORS allows the GitHub Pages origin and localhost only', () => {
    template.hasResourceProperties('AWS::ApiGatewayV2::Api', {
      CorsConfiguration: {
        AllowOrigins: ['https://testuser.github.io', 'http://localhost:4200'],
        AllowHeaders: Match.arrayWith(['Authorization']),
      },
    });
  });

  test('exports ApiUrl', () => {
    expect(template.toJSON().Outputs).toHaveProperty('ApiUrl');
  });

  test('githubUser falls back to a placeholder', () => {
    const a = new cdk.App();
    const st = new ChineseWordsStatefulStack(a, 'S');
    const t = Template.fromStack(
      new ChineseWordsApiStack(a, 'A', {
        table: st.table,
        userPool: st.userPool,
        userPoolClient: st.userPoolClient,
      }),
    );
    t.hasResourceProperties('AWS::ApiGatewayV2::Api', {
      CorsConfiguration: { AllowOrigins: ['https://your-github-username.github.io', 'http://localhost:4200'] },
    });
  });
});
