import { genkit } from "genkit";
import { googleAI, gemini20Flash } from "@genkit-ai/googleai";
import { readSystemPrompt } from "./getSystemPrompt"; 

// 1) Genkit client
export const ai = genkit({
  plugins: [googleAI()],
  model: gemini20Flash,
});

// 2) Types for the summary helper
export type SummarizeOptions = {
  maxSentences?: number;   
  temperature?: number;    
  maxChars?: number;       // safety trim before sending to model
};

// 3) Simple utilities the stub can use
function normalizeWhitespace(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

function splitSentences(s: string): string[] {
  const txt = normalizeWhitespace(s);
  if (!txt) return [];
  return txt
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map(x => x.trim())
    .filter(Boolean);
}

// 4) Stub implementation (extractive)
export async function summarizeWithoutAI(
  text: string,
  opts: SummarizeOptions = {}
): Promise<string> {
  const {
    maxSentences = 8,
    maxChars = 4000,
  } = opts;

  const trimmed = text.length > maxChars ? text.slice(0, maxChars) : text;

  const sentences = splitSentences(trimmed);
  if (sentences.length === 0) return "";
  return sentences.slice(0, maxSentences).join(" ");
}

/**
 * 5) Siggy persona recap - LLM version
 * Use for rewriting a recap in the voice of Siegfried aka "Siggy".
 */
export type SiggyOptions = {
  temperature?: number;
  maxTokens?: number;
  maxChars?: number;  // in case of large summary text
};

export async function summarizeAsSiggy(
  text: string,
  opts: SiggyOptions = {}
): Promise<string> {
  const temperature = opts.temperature ?? 0.5;
  const maxTokens = opts.maxTokens ?? 512;
  const maxChars = opts.maxChars ?? 12000;

  const trimmed = text.length > maxChars ? text.slice(0, maxChars) : text;
  if (!trimmed) return "";

  const system = readSystemPrompt();
  const prompt = `Rewrite this recap in Siggy's voice using all the rules and direction in the system prompt:\n\n${trimmed}`;

  const result = await ai.generate({
    system: system,
    prompt: prompt,
    config: {
      maxOutputTokens: maxTokens,
      temperature: 0.85,
      topP: 0.85,
      topK: 90,
    },
  });

  const out = typeof (result as any)?.text === "string"
    ? (result as any).text
    : String(result ?? "");

  return normalizeWhitespace(out);
}