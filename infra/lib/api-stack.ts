import { Validations } from 'aws-cdk-lib';
import * as path from 'path';
import * as cdk from 'aws-cdk-lib/core';
import * as apigw from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';

export interface ChineseWordsApiStackProps extends cdk.StackProps {
  /** Progress table from the stateful stack. */
  table: dynamodb.ITable;
  /** User pool from the stateful stack. Issuer of the JWTs the authorizer accepts. */
  userPool: cognito.IUserPool;
  /** App client from the stateful stack. Its ID is the JWT audience. */
  userPoolClient: cognito.IUserPoolClient;
  /** GitHub username for the Pages CORS origin. Defaults to the `githubUser` context value. */
  githubUser?: string;
}

/** Lambda functions and the JWT-protected HTTP API for progress sync. */
export class ChineseWordsApiStack extends cdk.Stack {
  public readonly getProgressFunction: NodejsFunction;
  public readonly putProgressFunction: NodejsFunction;
  public readonly httpApi: apigw.HttpApi;

  constructor(scope: Construct, id: string, props: ChineseWordsApiStackProps) {
    super(scope, id, props);

    const common = {
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      environment: { TABLE_NAME: props.table.tableName },
      bundling: { minify: true, sourceMap: false },
    };

    this.getProgressFunction = new NodejsFunction(this, 'GetProgressFunction', {
      ...common,
      logGroup: new logs.LogGroup(this, 'GetProgressLogs', {
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
      entry: path.join(__dirname, '../lambda/get-progress/index.ts'),
      handler: 'handler',
      description: 'GET /progress: all word progress for the signed-in user',
    });

    this.putProgressFunction = new NodejsFunction(this, 'PutProgressFunction', {
      ...common,
      logGroup: new logs.LogGroup(this, 'PutProgressLogs', {
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
      entry: path.join(__dirname, '../lambda/put-progress/index.ts'),
      handler: 'handler',
      description: 'PUT /progress: conditional writes of up to 25 word records',
    });

    // Least privilege: only the one action each function calls.
    // grantReadData/grantWriteData would add Scan, BatchWriteItem, DeleteItem and more.
    props.table.grant(this.getProgressFunction, 'dynamodb:Query');
    props.table.grant(this.putProgressFunction, 'dynamodb:PutItem');

    const githubUser: string =
      props.githubUser ?? this.node.tryGetContext('githubUser') ?? 'your-github-username';

    this.httpApi = new apigw.HttpApi(this, 'HttpApi', {
      apiName: 'chinese-words-progress',
      description: 'Progress sync API for Chinese Words I Know',
      corsPreflight: {
        // An origin has no path, so the repo subpath is not part of it.
        allowOrigins: [`https://${githubUser}.github.io`, 'http://localhost:4200'],
        allowMethods: [apigw.CorsHttpMethod.GET, apigw.CorsHttpMethod.PUT, apigw.CorsHttpMethod.OPTIONS],
        allowHeaders: ['Authorization', 'Content-Type'],
        maxAge: cdk.Duration.hours(1),
      },
    });

    const authorizer = new HttpJwtAuthorizer(
      'CognitoAuthorizer',
      `https://cognito-idp.${this.region}.amazonaws.com/${props.userPool.userPoolId}`,
      {
        jwtAudience: [props.userPoolClient.userPoolClientId],
        identitySource: ['$request.header.Authorization'],
      },
    );

    this.httpApi.addRoutes({
      path: '/progress',
      methods: [apigw.HttpMethod.GET],
      integration: new HttpLambdaIntegration('GetProgressIntegration', this.getProgressFunction),
      authorizer,
    });
    this.httpApi.addRoutes({
      path: '/progress',
      methods: [apigw.HttpMethod.PUT],
      integration: new HttpLambdaIntegration('PutProgressIntegration', this.putProgressFunction),
      authorizer,
    });

    // cdk-nag acknowledgements.
    Validations.of(this).acknowledge(
      {
        id: 'AwsSolutions::AwsSolutions-IAM4[Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole]',
        reason:
          'AWSLambdaBasicExecutionRole only allows writing to CloudWatch Logs. It is the standard CDK default for Lambda roles and all table access is a separate, least-privilege inline policy.',
      },
      {
        id: 'AwsSolutions::AwsSolutions-L1',
        reason:
          'The project standard is Node.js 22 (see tech rules), which is a supported LTS runtime. A newer runtime is adopted deliberately, not automatically.',
      },
      {
        id: 'AwsSolutions::AwsSolutions-APIG1',
        reason:
          'Access logging is not enabled: the API has two routes, each Lambda already logs to its own log group, and API access logs would add cost and store client IPs for a free app. Revisit if abuse appears.',
      },
    );

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.httpApi.apiEndpoint,
      description: 'Base URL of the progress API',
    });
  }
}
