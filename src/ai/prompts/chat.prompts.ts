import { responseLanguageInstruction } from '../language';

export interface SearchResult {
  content: string;
  pageNumber: number;
  similarity: number;
}

export interface RagContext {
  chunks: SearchResult[];
  documentName: string;
}

export function buildChatSystemPrompt(
  documentName: string,
  chunks: SearchResult[],
  responseLanguage?: string,
): string {
  let prompt = `Eres un asistente de estudio del documento "${documentName}". `;

  if (chunks.length > 0) {
    prompt += `El usuario hace una pregunta. Busca las secciones más relevantes del documento para responder.\n\n`;
    prompt += `SECCIONES RELEVANTES DEL DOCUMENTO:\n`;

    chunks.forEach((chunk, i) => {
      prompt += `\n[${i + 1}] (pág. ${chunk.pageNumber})\n${chunk.content}\n`;
    });

    prompt += `\n\nResponde basándote en estas secciones. Justo después de cada afirmación que salga de una sección, cítala con su número entre corchetes, por ejemplo [1] o [1][3]. Usa solo los números de esta lista: no cites páginas ni inventes números, y no cites lo que no salga de las secciones. No pongas citas en las preguntas sugeridas.`;
  } else {
    prompt += `Responde de forma clara, concisa y útil para facilitar el estudio.`;
  }

  prompt += `\n\n${responseLanguageInstruction('userMessage', responseLanguage)}`;

  prompt += `\n\nIMPORTANT: After your answer, generate 2-3 follow-up questions the user might ask next, in the same language as your answer. Format exactly as:
[SUGGESTIONS]
1. [question 1]
2. [question 2]
3. [question 3]
If no relevant follow-ups, write: NONE`;

  return prompt;
}
