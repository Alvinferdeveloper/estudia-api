import { languageName as displayLanguageName } from '../language';

// The prompt is written in Spanish, so language names are too ("fr" → "francés").
const languageName = (code: string) => displayLanguageName(code, 'es');

export const VOCABULARY_SYSTEM_PROMPT = `Eres un profesor de idiomas experto en metodologías de adquisición de vocabulario (enfoque comunicativo, aprendizaje en contexto, y prevención de interferencias entre idiomas).

Tu tarea es explicar una palabra o frase a un estudiante para que la aprenda de verdad, no solo que la traduzca.

## FORMATO DE RESPUESTA (OBLIGATORIO)
Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin markdown y sin bloques de código (nada de \`\`\`). El JSON debe tener EXACTAMENTE esta forma:

{
  "word": "la palabra o frase que se explica (la seleccionada, o su equivalente si se indica)",
  "sourceText": "solo en modo equivalente: el texto original seleccionado; en otro caso omítelo",
  "wordLanguage": "código del idioma de la palabra",
  "explanationLanguage": "código del idioma de la explicación",
  "phonetic": "pronunciación aproximada (opcional, string o null)",
  "meanings": [
    {
      "partOfSpeech": "ej. verbo, sustantivo, adjetivo, expresión (opcional)",
      "definition": "definición clara, en el idioma de explicación",
      "exampleSentence": "una oración natural y breve, en el idioma de la palabra, usando la palabra/frase",
      "exampleTranslation": "traducción de esa oración al idioma de explicación (opcional)"
    }
  ],
  "confusables": [
    {
      "word": "una palabra parecida o fácil de confundir (falso amigo, parónimo, etc.)",
      "explanation": "en qué se diferencia y por qué se confunde, en el idioma de explicación"
    }
  ],
  "tip": "un dato breve y útil: registro formal/informal, frecuencia de uso, mnemotecnia, expresión idiomática relacionada, etc. (opcional, string o null)",
  "synonyms": ["sinónimos o expresiones equivalentes, en el idioma de la palabra (opcional)"]
}

## REGLAS
- "meanings" debe tener entre 1 y 3 elementos, priorizando los significados más comunes y relevantes al contexto dado.
- "confusables" debe tener entre 0 y 3 elementos. Inclúyelo SOLO si existen palabras realmente parecidas o fáciles de confundir; si no las hay, usa un array vacío.
- Los ejemplos deben sonar naturales, como los diría un hablante nativo, no traducciones literales.
- Si no tienes un dato útil para "tip", usa null.
- No agregues explicaciones fuera del JSON. No repitas el schema. Responde solo con el objeto JSON.`;

// The reader studies a word from a text in their own language: teach its equivalent in the target language.
export function isEquivalentMode({
  wordLanguage,
  sourceLanguage,
}: {
  wordLanguage: string;
  sourceLanguage?: string;
}): boolean {
  return !!sourceLanguage && sourceLanguage !== wordLanguage;
}

export function buildVocabularyUserPrompt({
  selectedText,
  wordLanguage,
  explanationLanguage,
  sourceLanguage,
  documentContext,
}: {
  selectedText: string;
  wordLanguage: string;
  explanationLanguage: string;
  sourceLanguage?: string;
  documentContext?: string;
}): string {
  const equivalentFrom = isEquivalentMode({ wordLanguage, sourceLanguage })
    ? sourceLanguage
    : undefined;

  let userContent = equivalentFrom
    ? `Texto seleccionado: "${selectedText}" (está en ${languageName(equivalentFrom)}, código: ${equivalentFrom})
MODO EQUIVALENTE: el estudiante quiere aprender cómo se dice esto en ${languageName(wordLanguage)}.
1. Elige el equivalente más natural en ${languageName(wordLanguage)} (código: ${wordLanguage}) según el contexto; si hay varios igual de comunes, elige el principal y menciona los otros en "synonyms" o "confusables".
2. Explica ESE equivalente siguiendo el formato: "word" es el equivalente y "sourceText" es "${selectedText}".
3. "wordLanguage" es ${wordLanguage}; los ejemplos van en ${languageName(wordLanguage)}.
Idioma en el que debes explicar: ${languageName(explanationLanguage)} (código: ${explanationLanguage})`
    : `Palabra o frase seleccionada: "${selectedText}"
Idioma de la palabra: ${languageName(wordLanguage)} (código: ${wordLanguage})
Idioma en el que debes explicar: ${languageName(explanationLanguage)} (código: ${explanationLanguage})`;

  if (documentContext) {
    userContent += `\nContexto del documento donde aparece: ${documentContext}`;
  }

  userContent += `\n\nGenera el JSON de explicación siguiendo exactamente el formato indicado.`;

  return userContent;
}
