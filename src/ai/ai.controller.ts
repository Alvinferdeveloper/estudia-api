import { Controller, Post, Body, UseGuards, Res, Logger } from '@nestjs/common';
import { Readable } from 'stream';
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
    @Res() res: any,
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

      const nodeStream = Readable.fromWeb(stream as any);
      nodeStream.pipe(res);
    } catch (error) {
      this.logger.error('Chat error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  @Post('notes/stream')
  async streamNote(
    @CurrentUserId() userId: string,
    @Body() dto: NoteDto,
    @Res() res: any,
  ) {
    try {
      const stream = await this.aiService.streamNote(dto);

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      const nodeStream = Readable.fromWeb(stream as any);
      nodeStream.pipe(res);
    } catch (error) {
      this.logger.error('Stream note error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
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
