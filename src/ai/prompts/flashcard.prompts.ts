import { responseLanguageInstruction } from '../language';

// Few, atomic cards per note: more tends to repeat the same idea.
export const MAX_CARDS_PER_NOTE = 3;

export const FLASHCARD_SYSTEM_PROMPT = `You turn a student's study note into flashcards for spaced repetition.

RULES:
- Each card tests exactly one idea: one question, one short answer.
- Write the front as a precise question that has a single correct answer. Never "What does the text say about...".
- Keep the back brief (one to three sentences). Markdown is allowed for emphasis, lists or formulas.
- Use only what the note says; do not add facts it does not contain.
- Fewer good cards are better than many weak ones.`;

export function buildFlashcardUserPrompt({
  selectedText,
  comment,
  aiResponse,
  responseLanguage,
}: {
  selectedText: string;
  comment?: string | null;
  aiResponse?: string | null;
  responseLanguage?: string;
}): string {
  const sections = [
    `HIGHLIGHTED TEXT FROM THE DOCUMENT:\n${selectedText}`,
    comment && `STUDENT'S COMMENT:\n${comment}`,
    aiResponse && `NOTE:\n${aiResponse}`,
  ].filter(Boolean);

  return `${sections.join('\n\n')}

Create between 1 and ${MAX_CARDS_PER_NOTE} flashcards from this note.

${responseLanguageInstruction('sourceText', responseLanguage)} This applies to the card text only: keep the JSON keys exactly as shown.

Format as JSON:
[
  {"front": "Question?", "back": "Answer"}
]

Respond ONLY with valid JSON, no additional text.`;
}
