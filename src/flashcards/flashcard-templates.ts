import { VocabularyEntry } from '../typeorm/entities/VocabularyEntry.entity';

// The two most common meanings are enough to recall a word; more crowds the card.
const MAX_MEANINGS = 2;

// Built only from saved data, so it carries no labels in any UI language.
export function vocabularyCard(
  entry: VocabularyEntry,
): { front: string; back: string } | null {
  const meanings = entry.explanation?.meanings.slice(0, MAX_MEANINGS) ?? [];
  if (meanings.length === 0) return null;

  const back = meanings
    .map(({ partOfSpeech, definition, exampleSentence }) =>
      [
        partOfSpeech ? `*${partOfSpeech}* — ${definition}` : definition,
        exampleSentence && `> ${exampleSentence}`,
      ]
        .filter(Boolean)
        .join('\n\n'),
    )
    .join('\n\n---\n\n');

  return { front: entry.explanation?.word || entry.selectedText, back };
}
