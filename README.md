# BuildRank

BuildRank helps hackathon and demo-day teams check how clearly their project meets an event’s judging rubric before submitting or presenting.

It evaluates only the project information you provide and returns:
- An overall readiness score out of 100 with the exact weighted calculation
- Category-by-category scores, rationale, and cited evidence from your inputs
- Clear `"Not enough information"` flags with a follow-up question when evidence is missing
- Three prioritized, practical next actions

BuildRank is a preparation tool and never predicts judges’ final decisions.

## Running Locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the full-stack development server (Express + Vite on port 3000):
   ```bash
   npm run dev
   ```
3. Open `http://localhost:3000` in your browser.

To build and run in production mode:
```bash
npm run build
NODE_ENV=production npm start
```

## AI Rubric Review vs. Sample Assessment Mode

BuildRank reads `GEMINI_API_KEY` from the server environment (never exposed to browser code):
- **When `GEMINI_API_KEY` is configured** (via `.env` locally or **Settings > Secrets** in AI Studio): `POST /api/assess` runs structured rubric evaluation through `@google/genai` (`gemini-4-hydrogen`) on the server.
- **When no AI key is configured**: BuildRank automatically runs in **Sample assessment mode**, using a deterministic rubric-checking engine over your submitted text and clearly labelling the report as sample assessment mode.

To enable server-side AI evaluation locally, copy `.env.example` to `.env` and set:
```env
GEMINI_API_KEY="your-server-side-api-key"
```

## Data & Privacy Notes

- Recent assessments and in-progress form drafts are stored locally in your browser (`localStorage`) only. No cloud database or account is used in this MVP.
- Optional GitHub repository URLs fetch only the public repository metadata and `README` via GitHub’s public REST endpoint without requiring a token. Source code files are never inspected.
