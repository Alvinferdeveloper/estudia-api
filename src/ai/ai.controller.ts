import {
  Controller,
  Post,
  Body,
  UseGuards,
  Res,
  Req,
  Logger,
  HttpStatus,
} from '@nestjs/common';
import { Readable } from 'stream';
import type { Request, Response } from 'express';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUserId } from '../common/decorators/user.decorator';
import { AIService } from './ai.service';
import { ChatDto } from './dto/chat.dto';
import { GenerateQuestionsDto, EvaluateAnswerDto } from './dto/exam.dto';
import { NoteDto } from './dto/note.dto';
import { VocabularyDto } from './dto/vocabulary.dto';
import { ErrorCode } from '../common/errors/error-codes';
import { buildErrorResponse } from '../common/errors/error-response';

@Controller('ai')
@UseGuards(AuthGuard)
export class AIController {
  private readonly logger = new Logger(AIController.name);

  constructor(private readonly aiService: AIService) {}

  @Post('chat')
  async chat(
    @CurrentUserId() userId: string,
    @Body() dto: ChatDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // Errors before streaming reach the global filter, which sends their code.
    const stream = await this.aiService.streamChat(
      dto.messages as any,
      userId,
      dto.documentId,
      dto.documentName,
      dto.responseLanguage,
    );

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    this.pipeStream(res, req, stream, 'chat');
  }

  @Post('notes/stream')
  async streamNote(
    @CurrentUserId() userId: string,
    @Body() dto: NoteDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const stream = await this.aiService.streamNote(dto);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    this.pipeStream(res, req, stream, 'notes/stream');
  }

  private pipeStream(
    res: Response,
    req: Request,
    stream: ReadableStream,
    feature: string,
  ): void {
    const nodeStream = Readable.fromWeb(stream as any);

    nodeStream.on('error', (err: Error) => {
      this.logger.error(`${feature} stream error:`, this.getStack(err));
      // Mid-stream, ending early is the signal (chat already sent a coded chunk).
      if (res.headersSent) {
        res.end();
        return;
      }
      const body = buildErrorResponse(HttpStatus.BAD_GATEWAY, req.url, {
        code: ErrorCode.AI_PROVIDER_ERROR,
      });
      res.status(HttpStatus.BAD_GATEWAY).json(body);
    });

    req.on('aborted', () => {
      this.logger.warn(`${feature} request aborted by client`);
      nodeStream.destroy();
    });

    res.on('close', () => {
      if (!res.writableEnded) {
        this.logger.warn(`${feature} connection closed by client`);
        nodeStream.destroy();
      }
    });

    nodeStream.on('close', () => {
      if (!res.writableEnded) res.end();
    });

    nodeStream.pipe(res);
  }

  private getStack(error: unknown): string | undefined {
    return error instanceof Error ? error.stack : String(error);
  }

  @Post('notes/generate')
  async generateNote(@CurrentUserId() userId: string, @Body() dto: NoteDto) {
    const content = await this.aiService.generateNote(dto);
    return { content };
  }

  @Post('vocabulary/explain')
  async explainVocabulary(
    @CurrentUserId() userId: string,
    @Body() dto: VocabularyDto,
  ) {
    const explanation = await this.aiService.explainVocabulary(dto);
    return { explanation };
  }

  @Post('exam/generate')
  async generateQuestions(
    @CurrentUserId() userId: string,
    @Body() dto: GenerateQuestionsDto,
  ) {
    const questions = await this.aiService.generateQuestions(dto);
    return { questions };
  }

  @Post('exam/evaluate')
  async evaluateAnswer(
    @CurrentUserId() userId: string,
    @Body() dto: EvaluateAnswerDto,
  ) {
    return this.aiService.evaluateAnswer(dto);
  }
}
