# Tech stack and conventions

The decisions and reasons are in `.kiro/specs/chinese-words-i-know/design.md` (Tech Stack). This file only holds the rules that are easy to get wrong.

## Stack

Angular 22 (standalone components, esbuild builder), Tailwind CSS v4, NgRx SignalStore with `localStorage`, Angular Router with hash location, Vitest through the Angular CLI (`ng test`), `HTMLAudioElement` for audio, an Angular service worker for offline, and Capacitor later for iOS and Android. Cloud: AWS CDK (TypeScript), Cognito, DynamoDB, API Gateway HTTP API, and Lambda on Node.js 22.

## Rules

- **Tailwind v4 is CSS-first.** Do not create `tailwind.config.js`.
- **Asset URLs are relative** (`assets/...`) and never start with `/`. The site is served from a GitHub Pages subpath, and the build uses `--base-href /<repo>/`.
- **Components never build asset paths.** Use `AudioService` and `ImageService`. A missing audio file or image never throws: audio resolves silently and images fall back to the category emoji.
- **Round confidence scores to 2 decimals** after every update.
- **Slugs are permanent IDs.** Never rename one once published.
- **Sync writes are conditional `PutItem` calls.** Do not use `BatchWriteItem`. The client uses `null` for "no override" and the API and DynamoDB use `"none"`.
- **Stateful CDK resources** (DynamoDB, Cognito) live in the stateful stack with `RETAIN` and termination protection. Do not rename their construct IDs, because that replaces the resource. Run `cdk diff` before any deploy.
- **CI authenticates to AWS with OIDC.** Never add long-lived AWS access keys.
- **Never put secrets in the repository,** including `.kiro/settings/mcp.json`.
