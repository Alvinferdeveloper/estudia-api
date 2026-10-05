import { applyDecorators } from '@nestjs/common';
import { IsOptional, IsString, Matches } from 'class-validator';

// The language AI output is written in. Independent of the app's UI languages:
// any language the model handles is valid, and "auto" lets the content decide.
export const AUTO_RESPONSE_LANGUAGE = 'auto';

// "auto" or a BCP 47 tag such as "fr", "pt-BR" or "zh-Hant".
const RESPONSE_LANGUAGE_PATTERN = /^(auto|[a-z]{2,3}(-[A-Za-z0-9]{2,8})*)$/;

export const IsResponseLanguage = () =>
  applyDecorators(IsOptional(), IsString(), Matches(RESPONSE_LANGUAGE_PATTERN));

// What "auto" follows, per feature.
export type LanguageSource =
  | 'userMessage' // chat, visual questions: mirror what the user wrote
  | 'sourceText' // notes, generated questions: mirror the document
  | 'question'; // answer feedback: mirror the exam question

const AUTO_RULES: Record<LanguageSource, string> = {
  userMessage:
    'Reply in the same language the user wrote their latest message in.',
  sourceText:
    "Write in the same language as the document's source text, unless the user's instruction explicitly asks for another language.",
  question: 'Write in the same language as the question.',
};

const displayNamesByLocale = new Map<string, Intl.DisplayNames>();

// Human name of any language code, e.g. ("fr", "es") → "francés"; falls back to the code itself.
export function languageName(code: string, displayLocale = 'en'): string {
  let displayNames = displayNamesByLocale.get(displayLocale);
  if (!displayNames) {
    displayNames = new Intl.DisplayNames([displayLocale], { type: 'language' });
    displayNamesByLocale.set(displayLocale, displayNames);
  }
  try {
    return displayNames.of(code) ?? code;
  } catch {
    return code;
  }
}

export function responseLanguageInstruction(
  source: LanguageSource,
  language: string = AUTO_RESPONSE_LANGUAGE,
): string {
  const rule =
    language === AUTO_RESPONSE_LANGUAGE
      ? AUTO_RULES[source]
      : `Always write in ${languageName(language)}, even if the document or the user's message is in another language.`;
  return `LANGUAGE: ${rule}`;
}
