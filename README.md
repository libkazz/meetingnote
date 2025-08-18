<div align="center">

# Meeting Note

A minimal web app to record in-browser, transcribe with n8n, and display the result.

[![CI](https://github.com/libkazz/meetingnote/actions/workflows/ci.yml/badge.svg)](../../actions/workflows/ci.yml)

</div>

## Features
- One-button recording start/stop (toggle)
- Waveform preview and recording timer display
- Copy/download results, and toast notifications
- Connection diagnostics tool to quickly check CORS/URL/headers
- Built with TypeScript + React + Vite, ESLint/Prettier, and Vitest

## Quick Start
1) Prerequisite: Have Node.js 18+ installed, then install dependencies:
   - `npm install`
2) Create a `.env` file (see example):
   - `VITE_N8N_TRANSCRIBE_URL=https://<your-n8n>/webhook/<transcribe-path>`
   - `VITE_N8N_SUMMARY_URL=https://<your-n8n>/webhook/<summary-path>`
   - `VITE_N8N_API_KEY=<optional>` (only if required by your Webhook)
   - `VITE_USE_PROXY=false` (set to `true` to bypass CORS in development)
   - `VITE_REQUEST_TIMEOUT_MS=60000`
   - `VITE_UPLOAD_FIELD_NAME=audio`
3) Run the app:
   - Development: `npm run dev`
   - Production: `npm run build` → `npm start`

Note: Environment variables exposed to the frontend must be prefixed with `VITE_`.

## Project Structure
```
src/
  components/AudioRecorder.tsx   # Recording/submission UI
  lib/api/transcribe-client.ts   # Transcription submission
  lib/api/summary-client.ts      # Summary submission (text → summary)
  lib/api/n8n-common.ts          # Shared n8n helpers/diagnostics
  styles/global.css              # Theme/layout
tests/                           # Vitest + Testing Library
scripts/curl-n8n.sh              # Minimal validation with curl
```

## n8n Setup (Key Points)
- Webhook: Method=POST, Path must match the frontend. Binary data ON, Property Name=`audio` (if changed, update `VITE_UPLOAD_FIELD_NAME` in `.env`). Use the Production URL in `VITE_N8N_TRANSCRIBE_URL`.
- Response: Set to "When last node finishes," and at the end, return a `200 application/json` with `{ "text": "..." }` from a Response/Respond node.
- Production: Activate the workflow and use the Production URL (`/webhook/...`). Put this in `VITE_N8N_TRANSCRIBE_URL`.

## Development & Testing
- Lint/Type Check: `npm run lint` / `npm run typecheck`
- Test/Coverage: `npm test` / `npm run test:coverage`

## Troubleshooting
- **Failed to fetch**: CORS/network issue. Use `VITE_USE_PROXY=true` for the dev proxy, or configure allowed origins/headers in n8n.
- **500**: Check the failed node in Executions. Review binary name, size limits (`N8N_PAYLOAD_SIZE_MAX`), timeouts, or authentication.
- **404**: Webhook not registered (activate the workflow).
- **Waveform not moving**: Check microphone permissions/input device, and confirm `AudioContext` has been `resume()`d.

## Security
- Only variables prefixed with `VITE_` are exposed to the client. Do not place sensitive information in the frontend; add it via a server/proxy if needed.
- The design is to not persist recorded data. Do not output sensitive information to logs.

## Contributing
- See `AGENTS.md` for contribution methods and coding conventions.

## License
- Not set. Please add a license (e.g., MIT) when making it public.

## Architecture Overview
- Browser (Recording/UI) → n8n Webhook (audio via `multipart/form-data`) → Transcription Node → JSON response with `text`.
- Frontend reads `VITE_N8N_TRANSCRIBE_URL` for the transcription endpoint.
- Only frontend environment variables with the `VITE_` prefix are exposed. As a rule, do not keep secrets in the frontend.

## Detailed n8n Setup (Steps)
1) **Webhook Node**
   - Method: POST, Path: `audio-upload` (example)
   - Binary data: Enabled, Property Name: `audio` (must match `VITE_UPLOAD_FIELD_NAME` in `.env`)
   - Response: When last node finishes (for synchronous response)
2) **Transcription**
   - Use a node like OpenAI Whisper, or an HTTP Request to an external API.
   - If using HTTP Request, turn on "Send Binary Data" and specify `audio` as the Property Name.
3) **Formatting (Optional)**
   - Use a Set node to store the result string in a `text` key.
4) **Response**
   - Use a Response / Respond to Webhook node to return a 200 `application/json` with `{ "text": "={{$json.text}}" }`.
5) **Production URL**
   - Activate the workflow and use the Production URL (`/webhook/...`).
6) **Recommended Environment Variables (n8n side)**
   - `N8N_PAYLOAD_SIZE_MAX=50mb`, `WEBHOOK_URL=https://<public-domain>`.

## Security / Operational Notes
- Handling API keys on the client is not recommended (if necessary, add them via a dev proxy or your own backend).
- Configure CORS appropriately (allowed origins/headers). Operate with least privilege in production.
- The policy is to not persist recorded data. Do not log sensitive information.

## Common Errors and Solutions
- **404 Webhook not registered**: Activate the workflow. Double-check the Method/Path.
- **500 Internal Server Error**: Check the failed node in Executions. Review binary name, size limits, timeouts, or authentication.
- **Failed to fetch (CORS/Network)**: Use `VITE_USE_PROXY=true` for the dev proxy or set allowed origins in n8n. Check the browser's Network tab.
- **413 Payload Too Large**: Increase `N8N_PAYLOAD_SIZE_MAX`.

## Browser Permissions and HTTPS
- `getUserMedia` requires HTTPS or `http://localhost`. Please allow microphone permissions.
- In Safari/some browsers, AudioContext may start as `suspended`, so it is `resume()`d after user interaction.

## Contributing
- See `AGENTS.md` for coding conventions and PR procedures.
