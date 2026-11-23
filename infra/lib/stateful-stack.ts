import { Validations } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib/core';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

/**
 * Stateful resources: the progress table and the Cognito user pool.
 * Do not rename construct IDs below. Doing so replaces the resource.
 */
export class ChineseWordsStatefulStack extends cdk.Stack {
  public readonly table: dynamodb.Table;
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, { ...props, terminationProtection: true });

    this.table = new dynamodb.Table(this, 'ProgressTable', {
      tableName: 'chinese-words-progress',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'wordId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.userPool = new cognito.UserPool(this, 'UserPool', {
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Public client: no secret, for web and mobile.
    this.userPoolClient = this.userPool.addClient('AppClient', {
      generateSecret: false,
      authFlows: { userSrp: true },
    });

    // cdk-nag acknowledgements (see infra/README.md for the full reasoning).
    Validations.of(this.userPool).acknowledge(
      {
        id: 'AwsSolutions::AwsSolutions-COG2',
        reason:
          'MFA is not required: the users are parents of young children and the account only stores learning progress (no payment or sensitive personal data). Forced MFA would add sign-in friction for little risk reduction.',
      },
      {
        id: 'AwsSolutions::AwsSolutions-COG8',
        reason:
          'The Plus feature plan (advanced security) is a paid per-MAU tier. It is disproportionate for a free learning app that stores only word progress. Revisit if the app starts storing sensitive data.',
      },
    );

    new cdk.CfnOutput(this, 'UserPoolId', { value: this.userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
    });
  }
}
