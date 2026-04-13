import 'server-only';
import fs from 'fs';
import path from 'path';

const PROMPTS = {
  recap: { env: 'SIGGY_RECAP_PROMPT', file: 'siggy_recap_prompt.txt' },
  preview: { env: 'SIGGY_PREVIEW_PROMPT', file: 'siggy_preview_prompt.txt' },
} as const;

export type PromptType = keyof typeof PROMPTS;

export function readSystemPrompt(type: PromptType): string {
  const { env, file } = PROMPTS[type];

  // Production: read from Google Secret Manager via env var
  if (process.env[env]) {
    return process.env[env]!;
  }

  // Local dev: read from file
  const filePath = path.join(process.cwd(), 'src', 'ai', 'prompts', file);
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf-8');
  }

  throw new Error(
    `Prompt "${type}" not found. Set ${env} env var or provide ${filePath}`
  );
}
