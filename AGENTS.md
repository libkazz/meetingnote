# Repository Guidelines

This repository is for a web application that records meeting audio in the browser, sends it to an n8n API for transcription, and displays the result on the screen. Audio files are not saved locally.

## Project Structure (Proposal)
- `/src`: UI components, pages/routes, `lib/api` (n8n client), `hooks`, `styles`
- `/public`: Static assets (icons, etc.)
- `/tests`: Unit/integration tests (`*.test.ts(x)` / `*.spec.ts(x)`)
- `/scripts`: Utility scripts (type checking, linting, etc.)
- `.env.example`: Template for required environment variables

## Build, Run, Test
Prerequisite: Node.js 18+. The package manager is described using `npm` examples (also works with `pnpm`/`yarn`).
- `npm install`: Install dependencies
- `npm run dev`: Start development server (with hot reload)
- `npm run build`: Generate production build
- `npm start`: Run the built artifact
- `npm test`: Run unit/integration tests (`-- --coverage` for coverage)

## Coding Conventions & Naming
- Language: TypeScript is recommended, 2-space indentation.
- Formatting: Prettier, Static Analysis: ESLint (`npm run lint`/`npm run format`).
- Naming: `camelCase` for variables/functions, `PascalCase` for React components, `kebab-case` for files.
- Examples: `src/components/AudioRecorder.tsx`, `src/lib/api/n8n-client.ts`.

## Testing Guidelines
- Framework: Assumes Jest/Vitest. Tests should mock external APIs, and recording I/O should be verified with minimal integration tests.
- Target Coverage: Lines 80% or higher. Naming: `*.test.ts(x)` / `*.spec.ts(x)`.
- Examples: `npm test`, `npm run test:watch`, `npm run test:coverage`.

## Commit & PR Guidelines
- Commits: Conventional Commits are recommended: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, etc. (keep it short and to the point).
- PRs should include: Purpose/background, main changes, screenshots/recordings of UI changes, verification steps, related Issues.
- Merge Conditions: CI green, lint/format pass, 1+ review.

## Security & Configuration
- Environment Variables (example): `N8N_API_URL`, `N8N_API_KEY`. Update `.env.example`.
- Recording data should only be handled in memory/temporary storage; maintain the design of not persisting it. Do not log sensitive information.
- Configure CORS and upload size/timeout appropriately.