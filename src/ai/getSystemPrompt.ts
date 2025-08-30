import 'server-only';
import fs from 'fs';
import path from 'path';

const relative = path.join('src', 'ai', 'prompts', 'siggy_system.txt');

export function readSystemPrompt(): string {
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
    'System prompt not found. Checked:\n' + candidates.join('\n')
  );
}
