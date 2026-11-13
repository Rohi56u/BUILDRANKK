import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { GEMINI_MODEL, runGeminiAssessment } from './server/geminiAssessor.ts';
import { runSampleAssessment } from './src/lib/sampleAssessor.ts';
import { parseGitHubOwnerRepo, validateProjectAndRubric } from './src/lib/validation.ts';
import type { ProjectInput, RubricCriterion } from './src/types/buildrank.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getConfiguredGeminiKey(): string | null {
  const raw = process.env.GEMINI_API_KEY?.trim();
  if (!raw || raw === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return raw;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Status endpoint — never exposes secrets
  app.get('/api/status', (_req, res) => {
    const key = getConfiguredGeminiKey();
    res.json({
      aiConfigured: Boolean(key),
      mode: key ? 'gemini' : 'sample',
      model: key ? GEMINI_MODEL : null,
    });
  });

  // Public GitHub repository README & metadata fetch (no token required)
  app.post('/api/github/readme', async (req, res) => {
    const rawUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    const parsed = parseGitHubOwnerRepo(rawUrl);

    if (!parsed) {
      res.status(400).json({
        ok: false,
        reason: 'invalid_url',
        message: 'Enter a valid public GitHub repository URL (for example, https://github.com/owner/repo).',
      });
      return;
    }

    const headers = {
      'User-Agent': 'BuildRank-MVP',
      Accept: 'application/vnd.github+json',
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const repoResponse = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}`,
        { headers, signal: controller.signal }
      );

      if (!repoResponse.ok) {
        clearTimeout(timeoutId);
        if (repoResponse.status === 404) {
          res.json({
            ok: false,
            reason: 'not_found_or_private',
            message:
              'This repository could not be read (it may be private or unavailable). You can still paste your README or project description below.',
          });
          return;
        }
        if (repoResponse.status === 403 || repoResponse.status === 429) {
          res.json({
            ok: false,
            reason: 'rate_limited',
            message:
              'GitHub public API rate limit was reached. Assessment will still work—please paste your README or project notes below instead.',
          });
          return;
        }
        res.json({
          ok: false,
          reason: 'github_error',
          message:
            'GitHub returned an unexpected response while reading the repository. Please paste your README text below instead.',
        });
        return;
      }

      const repoJson = (await repoResponse.json()) as {
        full_name?: string;
        description?: string | null;
        language?: string | null;
        stargazers_count?: number;
        html_url?: string;
      };

      const readmeResponse = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/readme`,
        {
          headers: {
            'User-Agent': 'BuildRank-MVP',
            Accept: 'application/vnd.github.raw+json',
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      let readmeContent = '';
      if (readmeResponse.ok) {
        readmeContent = await readmeResponse.text();
      } else {
        res.json({
          ok: false,
          reason: 'no_readme',
          message:
            'The public repository was found, but no README file could be read. Paste a short project description or README below instead.',
        });
        return;
      }

      const trimmedReadme = readmeContent.slice(0, 12000).trim();

      res.json({
        ok: true,
        message: `Loaded public README from ${repoJson.full_name ?? `${parsed.owner}/${parsed.repo}`}. Source code files were not inspected.`,
        context: {
          url: repoJson.html_url ?? rawUrl,
          fullName: repoJson.full_name ?? `${parsed.owner}/${parsed.repo}`,
          description: repoJson.description ?? null,
          language: repoJson.language ?? null,
          stars: typeof repoJson.stargazers_count === 'number' ? repoJson.stargazers_count : null,
          readmeExcerpt: trimmedReadme,
          fetchedAt: new Date().toISOString(),
        },
      });
    } catch {
      res.json({
        ok: false,
        reason: 'network_error',
        message:
          'Could not reach GitHub right now. You can continue by pasting your README or project description directly.',
      });
    }
  });

  // Assessment endpoint — runs Gemini when configured, or deterministic Sample Assessment Mode otherwise
  app.post('/api/assess', async (req, res) => {
    const project = req.body?.project as ProjectInput | undefined;
    const rubric = req.body?.rubric as RubricCriterion[] | undefined;
    const forceSampleMode = Boolean(req.body?.forceSampleMode);
    const isSampleData = Boolean(req.body?.isSampleData);

    if (!project || !Array.isArray(rubric)) {
      res.status(400).json({ error: 'Request must include project details and rubric criteria.' });
      return;
    }

    const validationErrors = validateProjectAndRubric(project, rubric);
    if (Object.keys(validationErrors).length > 0) {
      res.status(400).json({
        error: 'Please resolve the validation issues before running the assessment.',
        validationErrors,
      });
      return;
    }

    const apiKey = getConfiguredGeminiKey();

    if (!apiKey || forceSampleMode) {
      const result = runSampleAssessment(project, rubric, {
        fallbackReason: forceSampleMode ? 'Switched to Sample assessment mode at user request.' : null,
        isSampleData,
      });
      res.json({ ok: true, result });
      return;
    }

    try {
      const result = await runGeminiAssessment(apiKey, project, rubric, isSampleData);
      res.json({ ok: true, result });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to complete AI rubric assessment due to an unexpected error.';
      res.status(502).json({
        ok: false,
        error: `AI assessment failed: ${message}`,
        canFallbackToSample: true,
      });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const port = Number(process.env.PORT || 3000);
  app.listen(port, '0.0.0.0', () => {
    console.log(`BuildRank server listening on http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start BuildRank server:', err);
  process.exit(1);
});
