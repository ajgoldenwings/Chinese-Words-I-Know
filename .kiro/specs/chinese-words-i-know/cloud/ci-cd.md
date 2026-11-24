# CI/CD Pipeline

← [Design](../design.md)

## Strategy

A single pipeline runs on every push to `main`. It is defined in `.github/workflows/deploy.yml` and runs on GitHub Actions. It can also be started by hand (`workflow_dispatch`) to re-run a deploy without a new commit.

The workflow has two jobs, following GitHub's Pages workflow template:
- **`build`** runs steps 1 to 6 below and uploads the site with `actions/upload-pages-artifact`
- **`deploy`** (`needs: build`) runs step 7 with `actions/deploy-pages`. Deploying from a separate job means the `github-pages` artifact is fully registered before it is looked up. Deploying in the same job, one second after the upload, can fail with "No artifacts named github-pages were found"

Both jobs run in the `github-pages` environment. For the build job this keeps the OIDC token subject as `repo:<owner>/<repo>:environment:github-pages`, which the AWS role's trust policy matches. Moving the AWS steps out of that environment changes the subject to `repo:<owner>/<repo>:ref:refs/heads/main` and needs a trust policy change first.

This is a single-environment pipeline. Multi-environment support (dev/staging/prod) is a future feature.

The pipeline is built in two stages:
- **Task 2** creates test, build, and GitHub Pages deploy, so every later task ships automatically.
- **Task 16** adds the AWS authentication, CDK deploy, and generated app configuration steps.

## Pipeline steps (final form)

```
push to main
     │
     ▼
1. Install dependencies
   ├── npm ci (root — Angular app)
   └── npm ci (infra/ — CDK)
     │
     ▼
2. Run tests
   └── Vitest (src/shared and src/web)
     │
     ▼
3. Authenticate to AWS            (added in Task 16)
   └── OIDC role via aws-actions/configure-aws-credentials
     │
     ▼
4. Deploy infrastructure          (added in Task 16)
   └── cdk deploy --all --require-approval never --outputs-file cdk-outputs.json
     │
     ▼
5. Generate app configuration     (added in Task 16)
   └── write src/web/environments/environment.generated.ts from cdk-outputs.json
       (apiUrl, userPoolId, userPoolClientId, region)
     │
     ▼
6. Build Angular app
   └── ng build --configuration production --base-href /<repo>/
     │
     ▼
7. Deploy web app to GitHub Pages
   ├── actions/upload-pages-artifact   (end of the build job)
   └── actions/deploy-pages            (deploy job)
```

Before Task 16, steps 3 to 5 do not exist and the generated environment file has empty cloud values, so sync stays disabled.

The CDK deploy runs before the Angular build because the app needs the API URL and Cognito IDs from the stack outputs.

## Failure behavior

- If tests fail (step 2), nothing is deployed
- If the CDK deploy fails (step 4), the app is not built or deployed
- If the Angular build fails (step 6), the web deploy does not run
- If only the deploy job fails, re-run it from the Actions tab (Re-run failed jobs). The artifact from the build job is reused, so tests and the CDK deploy do not run again
- Each step's output is visible in the GitHub Actions log
- The workflow uses a `concurrency` group so two deploys never run at once

## One-time prerequisites

1. In the repository settings, set **Pages → Source** to **GitHub Actions**. If it is left on **Deploy from a branch**, GitHub also runs its own "pages build and deployment" workflow on every push. That workflow publishes the repository with Jekyll (the README) to the same site, so whichever deploy finishes last is live
2. Run `cdk bootstrap aws://<account>/<region>` once
3. Create the GitHub OIDC identity provider in the AWS account and an IAM role for the workflow (below)
4. Add repository variables `AWS_ROLE_ARN` and `AWS_REGION` (neither is a secret)

## AWS authentication (OIDC)

The workflow authenticates with GitHub OIDC. No long-lived AWS keys are stored in GitHub.

- Workflow permissions: `id-token: write`, `contents: read`, `pages: write`
- The role's trust policy is limited to this repository and the `main` branch
- The role's permissions only allow assuming the CDK bootstrap roles (deploy, file-publishing, image-publishing, lookup). It is not an admin role

## Future evolution

- Add a staging environment that deploys on pull request and tears down on merge
- Add `cdk diff` as a PR check before merge to main
- Add `cdk-nag` AwsSolutionsChecks as a required CI gate
- Add path filters so documentation-only changes skip the CDK deploy
