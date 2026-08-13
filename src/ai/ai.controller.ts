import { Controller, Post, Body, UseGuards, Res, Req, Logger } from '@nestjs/common';
import { Readable } from 'stream';
import type { Request, Response } from 'express';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUserId } from '../common/decorators/user.decorator';
import { AIService } from './ai.service';
import { ChatDto } from './dto/chat.dto';
import { GenerateQuestionsDto, EvaluateAnswerDto } from './dto/exam.dto';
import { NoteDto } from './dto/note.dto';

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
    try {
      const stream = await this.aiService.streamChat(
        dto.messages as any,
        userId,
        dto.documentId,
        dto.documentName,
      );

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      this.pipeStream(res, req, stream, 'chat');
    } catch (error) {
      this.logger.error('Chat failed to start:', this.getStack(error));
      this.sendError(res, 'Failed to start chat stream');
    }
  }

  @Post('notes/stream')
  async streamNote(
    @CurrentUserId() userId: string,
    @Body() dto: NoteDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const stream = await this.aiService.streamNote(dto);

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      this.pipeStream(res, req, stream, 'notes/stream');
    } catch (error) {
      this.logger.error('Note stream failed to start:', this.getStack(error));
      this.sendError(res, 'Failed to start note stream');
    }
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
      if (!res.headersSent) {
        this.sendError(res, 'AI stream failed');
        return;
      }
      try {
        res.write(
          `event: error\ndata: ${JSON.stringify({
            message: err.message || 'AI stream failed',
          })}\n\n`,
        );
      } catch {
        /* connection already broken */
      }
      res.end();
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

  private sendError(res: Response, message: string): void {
    if (res.headersSent) {
      res.end();
      return;
    }
    res.status(500).json({ error: message });
  }

  private getStack(error: unknown): string | undefined {
    return error instanceof Error ? error.stack : String(error);
  }

  @Post('notes/generate')
  async generateNote(@CurrentUserId() userId: string, @Body() dto: NoteDto) {
    const content = await this.aiService.generateNote(dto);
    return { content };
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
