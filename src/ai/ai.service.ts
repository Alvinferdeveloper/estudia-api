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
  NOTE_SYSTEM_PROMPT,
  buildNoteUserPrompt,
} from './prompts/note.prompts';

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
      this.logger.error('Auto-vectorize error:', error);
    }
  }

  async streamChat(
    rawMessages: any[],
    userId: string,
    documentId?: string,
    documentName: string = 'documento',
  ): Promise<ReadableStream> {
    let chunks: SearchResult[] = [];

    if (documentId) {
      await this.ensureDocumentIsVectorized(documentId, userId);

      const query = this.getLastUserQuery(rawMessages);
      if (query) {
        chunks = await this.ragService.searchDocument(documentId, query, 3);
      }
    }

    const systemPrompt = buildChatSystemPrompt(documentName, chunks);
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
  }): Promise<any[]> {
    const { content, pages, difficulty, questionType, numQuestions = 5 } = data;

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
      );
    }

    return this.generateSingleTypeQuestions(
      content,
      pages,
      difficulty,
      questionType as Exclude<QuestionType, 'mixed'>,
      numQuestions,
    );
  }

  private async generateMixedQuestions(
    content: string,
    pages: number[],
    difficulty: string,
    numQuestions: number,
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
      });

      try {
        const text = await this.provider.generateText({
          feature: 'exam',
          systemPrompt: prompt,
        });

        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          allQuestions = [...allQuestions, ...parsed];
        }
      } catch (e) {
        this.logger.error(`Failed to generate ${type} questions:`, e);
      }
    }

    const shuffled = allQuestions.sort(() => Math.random() - 0.5);
    return shuffled.map((q, i) => ({
      ...q,
      type: q.type || types[i % types.length],
      idealAnswer: q.correctAnswer || q.idealAnswer || '',
    }));
  }

  private async generateSingleTypeQuestions(
    content: string,
    pages: number[],
    difficulty: string,
    type: Exclude<QuestionType, 'mixed'>,
    numQuestions: number,
  ): Promise<any[]> {
    const prompt = buildGenerateQuestionsPrompt({
      content,
      pages,
      difficulty,
      type,
      count: numQuestions,
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
          type: q.type || type || 'open',
          idealAnswer: q.correctAnswer || q.idealAnswer || '',
        }));
      }
    } catch (e) {
      this.logger.error('Failed to parse AI response:', e);
    }

    return generateFallbackQuestions(type, numQuestions);
  }

  async evaluateAnswer(data: {
    userAnswer: string;
    idealAnswer: string;
    question: string;
    questionType?: string;
  }): Promise<{ score: number; feedback: string }> {
    const { userAnswer, idealAnswer, question, questionType } = data;

    const isClosedType = [
      'multiple_choice',
      'true_false',
      'fill_blank',
    ].includes(questionType || '');

    if (isClosedType) {
      const isCorrect =
        userAnswer.toLowerCase().trim() === idealAnswer.toLowerCase().trim();
      return {
        score: isCorrect ? 10 : 0,
        feedback: isCorrect
          ? 'Correct!'
          : `Incorrect. The correct answer is: ${idealAnswer}`,
      };
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
          feedback: parsed.feedback || 'Good attempt!',
        };
      }
    } catch (e) {
      this.logger.error('Failed to parse evaluation:', e);
    }

    return {
      score: 5,
      feedback: 'Your answer has been submitted for review.',
    };
  }

  // ─── Notes ────────────────────────────────────────────────────────

  async generateNote(data: {
    selectedText: string;
    prompt: string;
    documentContext?: string;
    originalNote?: string;
  }): Promise<string> {
    const userContent = buildNoteUserPrompt(data);

    return this.provider.generateText({
      feature: 'noteGeneration',
      systemPrompt: NOTE_SYSTEM_PROMPT,
      userPrompt: userContent,
    });
  }

  async streamNote(data: {
    selectedText: string;
    prompt: string;
    documentContext?: string;
    originalNote?: string;
  }): Promise<ReadableStream> {
    const userContent = buildNoteUserPrompt(data);

    const modelMessages: ModelMessage[] = [
      { role: 'user', content: userContent },
    ];

    return this.provider.streamText({
      feature: 'noteStream',
      systemPrompt: NOTE_SYSTEM_PROMPT,
      messages: modelMessages,
    });
  }
}
