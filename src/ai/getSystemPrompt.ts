import 'server-only';
import fs from 'fs';
import path from 'path';

// Base relative directory where prompt text files live
const BASE_RELATIVE = path.join('src', 'ai', 'prompts');

const PROMPT_FILES = {
  recap: 'siggy_recap_prompt.txt',
  preview: 'siggy_preview_prompt.txt',
} as const;

export type PromptType = keyof typeof PROMPT_FILES;

/**
 * Reads the appropriate Siggy system prompt file from known build locations.
 * @param type 'recap' | 'preview'
 */
export function readSystemPrompt(type: PromptType): string {
  const fileName = PROMPT_FILES[type];
  const relative = path.join(BASE_RELATIVE, fileName);

  // Candidate search paths depending on environment
  const candidates = [
    // dev: next dev
    path.join(process.cwd(), relative),

    // prod: next default server output
    path.join(process.cwd(), '.next', 'server', relative),

    // prod: standalone bundle 
    path.join(process.cwd(), '.next', 'standalone', relative),

    // firebase runtime explicit fallbacks
    path.join('/workspace', '.next', 'standalone', relative),
    path.join('/workspace', '.next', 'server', relative),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return fs.readFileSync(p, 'utf-8');
    }
  }

  throw new Error(
    `System prompt for "${type}" not found. Checked:\n` + candidates.join('\n')
  );
}
