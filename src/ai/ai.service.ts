import { Injectable, Logger } from '@nestjs/common';
import { convertToModelMessages } from 'ai';
import type { ModelMessage } from 'ai';
import { RagService } from '../rag/rag.service';
import { DocumentsService } from '../documents/documents.service';
import { createAIProvider } from './providers/provider.factory';
import type { AIProvider } from './providers/provider.factory';
import { buildChatSystemPrompt, SearchResult } from './prompts/chat.prompts';
import {
  buildGenerateQuestionsPrompt,
  buildEvaluateAnswerPrompt,
  generateFallbackQuestions,
  QuestionType,
} from './prompts/exam.prompts';
import {
  buildNoteSystemPrompt,
  buildNoteUserPrompt,
} from './prompts/note.prompts';
import {
  VOCABULARY_SYSTEM_PROMPT,
  buildVocabularyUserPrompt,
  isEquivalentMode,
} from './prompts/vocabulary.prompts';
import { VocabularyExplanation } from '../typeorm/entities/VocabularyEntry.entity';

@Injectable()
export class AIService {
  private provider: AIProvider;
  private readonly logger = new Logger(AIService.name);

  constructor(
    private ragService: RagService,
    private documentsService: DocumentsService,
  ) {
    this.provider = createAIProvider();
  }

  // ─── Chat with RAG ───────────────────────────────────────────────

  private getLastUserQuery(messages: any[]): string | null {
    const lastUserMessage = messages
      .filter((m: any) => m.role === 'user')
      .pop();

    return (
      lastUserMessage?.parts?.find((p: any) => p.type === 'text')?.text ?? null
    );
  }

  private async ensureDocumentIsVectorized(
    documentId: string,
    userId: string,
  ): Promise<void> {
    try {
      const isVectorized =
        await this.ragService.isDocumentVectorized(documentId);
      if (!isVectorized) {
        await this.ragService.vectorizeDocument(documentId, userId);
      }
    } catch (error) {
      this.logger.error(
        'Auto-vectorize error:',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async streamChat(
    rawMessages: any[],
    userId: string,
    documentId?: string,
    documentName: string = 'documento',
    responseLanguage?: string,
  ): Promise<ReadableStream> {
    let chunks: SearchResult[] = [];

    if (documentId) {
      await this.ensureDocumentIsVectorized(documentId, userId);

      const query = this.getLastUserQuery(rawMessages);
      if (query) {
        chunks = await this.ragService.searchDocument(documentId, query, 3);
      }
    }

    const systemPrompt = buildChatSystemPrompt(
      documentName,
      chunks,
      responseLanguage,
    );
    const modelMessages = await convertToModelMessages(rawMessages);

    return this.provider.streamText({
      feature: 'chat',
      systemPrompt,
      messages: modelMessages,
    });
  }

  // ─── Exam ─────────────────────────────────────────────────────────

  async generateQuestions(data: {
    content: string;
    pages: number[];
    difficulty: string;
    questionType?: string;
    numQuestions?: number;
    responseLanguage?: string;
  }): Promise<any[]> {
    const {
      content,
      pages,
      difficulty,
      questionType,
      numQuestions = 5,
      responseLanguage,
    } = data;

    if (process.env.USE_FALLBACK_ONLY === 'true') {
      return generateFallbackQuestions(
        (questionType as QuestionType) || 'open',
        numQuestions,
      );
    }

    if (questionType === 'mixed') {
      return this.generateMixedQuestions(
        content,
        pages,
        difficulty,
        numQuestions,
        responseLanguage,
      );
    }

    return this.generateSingleTypeQuestions(
      content,
      pages,
      difficulty,
      questionType as Exclude<QuestionType, 'mixed'>,
      numQuestions,
      responseLanguage,
    );
  }

  private async generateMixedQuestions(
    content: string,
    pages: number[],
    difficulty: string,
    numQuestions: number,
    responseLanguage?: string,
  ): Promise<any[]> {
    const types: Exclude<QuestionType, 'mixed'>[] = [
      'open',
      'multiple_choice',
      'true_false',
      'fill_blank',
    ];
    const questionsPerType = Math.floor(numQuestions / types.length);
    const remainder = numQuestions % types.length;

    let allQuestions: any[] = [];

    for (let i = 0; i < types.length; i++) {
      const type = types[i];
      const count = questionsPerType + (i < remainder ? 1 : 0);
      if (count === 0) continue;

      const prompt = buildGenerateQuestionsPrompt({
        content,
        pages,
        difficulty,
        type,
        count,
        responseLanguage,
      });

      try {
        const text = await this.provider.generateText({
          feature: 'exam',
          systemPrompt: prompt,
        });

        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const withType = parsed.map((q: any) => ({
            ...q,
            type, // Force the requested type, ignoring the LLM's output
            idealAnswer: String(q.correctAnswer ?? q.idealAnswer ?? ''),
          }));
          allQuestions = [...allQuestions, ...withType];
        }
      } catch (e) {
        this.logger.error(
          `Failed to generate ${type} questions:`,
          e instanceof Error ? e.stack : String(e),
        );
      }
    }

    const shuffled = allQuestions.sort(() => Math.random() - 0.5);
    return shuffled;
  }

  private normalizeQuestionType(
    type: string | undefined,
    fallback: QuestionType,
  ): QuestionType {
    const validTypes: QuestionType[] = [
      'open',
      'multiple_choice',
      'true_false',
      'fill_blank',
    ];
    return validTypes.includes(type as QuestionType)
      ? (type as QuestionType)
      : fallback === 'mixed'
        ? 'open'
        : fallback;
  }

  private async generateSingleTypeQuestions(
    content: string,
    pages: number[],
    difficulty: string,
    type: Exclude<QuestionType, 'mixed'>,
    numQuestions: number,
    responseLanguage?: string,
  ): Promise<any[]> {
    const prompt = buildGenerateQuestionsPrompt({
      content,
      pages,
      difficulty,
      type,
      count: numQuestions,
      responseLanguage,
    });

    try {
      const text = await this.provider.generateText({
        feature: 'exam',
        systemPrompt: prompt,
      });

      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const questions = JSON.parse(jsonMatch[0]);
        return questions.map((q: any) => ({
          ...q,
          type: type || 'open', // Force the requested type
          idealAnswer: String(q.correctAnswer ?? q.idealAnswer ?? ''),
        }));
      }
    } catch (e) {
      this.logger.error(
        'Failed to parse AI response:',
        e instanceof Error ? e.stack : String(e),
      );
    }

    return generateFallbackQuestions(type, numQuestions);
  }

  async evaluateAnswer(data: {
    userAnswer: string;
    idealAnswer: string;
    question: string;
    questionType?: string;
    responseLanguage?: string;
  }): Promise<{ score: number; feedback: string }> {
    const {
      userAnswer,
      idealAnswer,
      question,
      questionType,
      responseLanguage,
    } = data;

    const isClosedType = [
      'multiple_choice',
      'true_false',
      'fill_blank',
    ].includes(questionType || '');

    if (isClosedType) {
      const normalizedUser = String(userAnswer).toLowerCase().trim();
      const normalizedIdeal = String(idealAnswer).toLowerCase().trim();

      let isCorrect = normalizedUser === normalizedIdeal;

      if (questionType === 'true_false') {
        const userIsTrue = ['true', 'verdadero', 'v', '1'].includes(
          normalizedUser,
        );
        const idealIsTrue = ['true', 'verdadero', 'v', '1'].includes(
          normalizedIdeal,
        );
        isCorrect = userIsTrue === idealIsTrue;
      } else if (questionType === 'multiple_choice') {
        // Just in case they provide "A) Option" instead of just "A"
        isCorrect = normalizedUser[0] === normalizedIdeal[0];
      }

      // The UI already shows correct/incorrect and the right answer in the user's language.
      return { score: isCorrect ? 10 : 0, feedback: '' };
    }

    if (process.env.USE_FALLBACK_ONLY === 'true') {
      return {
        score: 5,
        feedback:
          'Dev mode: Using fallback evaluation. In production, this would be evaluated by AI.',
      };
    }

    const prompt = buildEvaluateAnswerPrompt({
      question,
      userAnswer,
      idealAnswer,
      responseLanguage,
    });

    try {
      const text = await this.provider.generateText({
        feature: 'exam',
        systemPrompt: prompt,
      });

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          score: Math.min(10, Math.max(0, parsed.score)),
          feedback: parsed.feedback || '',
        };
      }
    } catch (e) {
      this.logger.error(
        'Failed to parse evaluation:',
        e instanceof Error ? e.stack : String(e),
      );
    }

    return { score: 5, feedback: '' };
  }

  // ─── Notes ────────────────────────────────────────────────────────

  async streamNote(data: {
    selectedText: string;
    prompt: string;
    documentContext?: string;
    originalNote?: string;
    responseLanguage?: string;
  }): Promise<ReadableStream> {
    const userContent = buildNoteUserPrompt(data);

    const modelMessages: ModelMessage[] = [
      { role: 'user', content: userContent },
    ];

    return this.provider.streamText({
      feature: 'noteStream',
      systemPrompt: buildNoteSystemPrompt(data.responseLanguage),
      messages: modelMessages,
    });
  }

  // ─── Vocabulary (Language Mode) ────────────────────────────────────

  async explainVocabulary(data: {
    selectedText: string;
    wordLanguage: string;
    explanationLanguage: string;
    sourceLanguage?: string;
    documentContext?: string;
  }): Promise<VocabularyExplanation> {
    const userPrompt = buildVocabularyUserPrompt(data);

    const text = await this.provider.generateText({
      feature: 'vocabulary',
      systemPrompt: VOCABULARY_SYSTEM_PROMPT,
      userPrompt,
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed.meanings) && parsed.meanings.length > 0) {
          const explanation = parsed as VocabularyExplanation;
          if (isEquivalentMode(data)) {
            explanation.sourceText ??= data.selectedText;
          }
          return explanation;
        }
      } catch (e) {
        this.logger.error(
          'Failed to parse vocabulary explanation:',
          e instanceof Error ? e.stack : String(e),
        );
      }
    }

    return {
      word: data.selectedText,
      wordLanguage: data.wordLanguage,
      explanationLanguage: data.explanationLanguage,
      meanings: [
        {
          definition:
            text.trim().slice(0, 800) || 'No se pudo generar una explicación.',
          exampleSentence: '',
        },
      ],
    };
  }
}
