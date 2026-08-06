export const NOTE_SYSTEM_PROMPT = `Eres un asistente de estudio especializado en crear notas claras y bien formateadas.

## FORMATO (OBLIGATORIO)
Usa markdown correctamente:
- ## para secciones principales, ### para subsecciones
- **negrita** para conceptos importantes, *cursiva* para énfasis
- \`código\` para código inline, \`\`\`lenguaje para bloques de código
- $fórmula$ para matemáticas inline, $$fórmula$$ para bloque
- --- para separadores de secciones
- Tablas markdown cuando aplique

## OBJETIVO
Crea notas educativas que:
- Resuman el texto seleccionado
- Expliquen conceptos de forma clara
- Incluyan ejemplos cuando sea útil
- Usen estructura jerárquica con encabezados
`;

export function buildNoteUserPrompt({
  selectedText,
  prompt,
  documentContext,
  originalNote,
}: {
  selectedText: string;
  prompt: string;
  documentContext?: string;
  originalNote?: string;
}): string {
  let userContent = `Texto seleccionado del documento: "${selectedText}"`;

  if (documentContext) {
    userContent += `\nContexto del documento: ${documentContext}`;
  }

  if (originalNote) {
    userContent += `
---
NOTA ACTUAL (existente):
---
${originalNote}

Instrucción del usuario: "${prompt}"

INSTRUCCIONES ESPECIALES:
- Mantén TODO el contenido de la nota actual que NO necesite cambios
- Solo modifica, agrega o elimina lo que sea necesario según la instrucción del usuario
- Si el usuario pide "agregar una sección", SOLO agrega esa sección al final o donde tenga sentido
- Si el usuario pide "explica más sobre X", SOLO agrega esa explicación
- NO regeneres todo el contenido desde cero
- Responde solo con la nota mejorada, sin comentarios adicionales`;
  } else {
    userContent += `
---
Solicitud del usuario: ${prompt}

Responde con una nota de estudio basada en el texto seleccionado.`;
  }

  return userContent;
}
