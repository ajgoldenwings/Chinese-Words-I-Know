# Welcome to your CDK TypeScript project

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

* `npm run build`   type-check the project
* `npm run watch`   watch for changes and type-check
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template

## cdk-nag

`test/nag.test.ts` runs `AwsSolutionsChecks` (cdk-nag v3, via `Validations.of(app).addPlugins`) against `ChineseWordsStatefulStack`. Any unacknowledged error or warning fails the test.

Fixed in code: `AwsSolutions-COG1` (explicit strong password policy) and `AwsSolutions-DDB3` (point-in-time recovery on the table).

Acknowledged in `lib/stateful-stack.ts` on the user pool:

- `AwsSolutions-COG2` (no MFA): users are parents, and the pool only guards learning progress. Forced MFA adds friction for little risk reduction.
- `AwsSolutions-COG8` (not on the Plus feature plan): Plus is paid per monthly active user and is disproportionate for a free app with no sensitive data. Revisit if that changes.
