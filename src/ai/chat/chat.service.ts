import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ModelMessage } from 'ai';
import { RagService } from '../../rag/rag.service';
import { DocumentsService } from '../../documents/documents.service';
import { MessagesService } from '../../messages/messages.service';
import type { Message } from '../../typeorm/entities/Message.entity';
import { AI_PROVIDER } from '../providers/ai-provider.interface';
import type {
  AIProvider,
  StreamTextResult,
} from '../providers/ai-provider.interface';
import { buildChatSystemPrompt } from '../prompts/chat.prompts';

// Bounds the context sent per message, so the cost of one chat message stays predictable.
const HISTORY_BUDGET = { maxMessages: 20, maxChars: 24_000 };
const RAG_CHUNKS = 3;

export interface ChatReplyRequest {
  conversationId: string;
  message: string;
  responseLanguage?: string;
}

// Keeps the most recent messages that fit the character budget.
const fitHistory = (messages: Message[]): Message[] => {
  let chars = 0;
  const kept: Message[] = [];
  for (const message of [...messages].reverse()) {
    chars += message.content.length;
    if (chars > HISTORY_BUDGET.maxChars && kept.length > 0) break;
    kept.unshift(message);
  }
  return kept;
};

const toModelMessage = ({ role, content }: Message): ModelMessage => ({
  role,
  content,
});

// The server owns the conversation: it stores both turns and builds the history itself.
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @Inject(AI_PROVIDER) private readonly provider: AIProvider,
    private readonly messagesService: MessagesService,
    private readonly documentsService: DocumentsService,
    private readonly ragService: RagService,
  ) {}

  async streamReply(
    userId: string,
    { conversationId, message, responseLanguage }: ChatReplyRequest,
  ): Promise<StreamTextResult> {
    const conversation = await this.messagesService.getOwnedConversation(
      conversationId,
      userId,
    );
    const document = await this.documentsService.findOneDocument(
      conversation.documentId,
      userId,
    );

    const recent = await this.messagesService.getRecentMessages(
      conversation.id,
      HISTORY_BUDGET.maxMessages,
    );
    // A retry resends the same unanswered message; store it only once.
    const last = recent.at(-1);
    if (last?.role !== 'user' || last.content !== message) {
      recent.push(
        await this.messagesService.appendMessage(conversation, 'user', message),
      );
    }
    const history = fitHistory(recent.slice(-HISTORY_BUDGET.maxMessages));

    const chunks = await this.findRelevantChunks(document.id, userId, message);
    const result = await this.provider.streamText({
      feature: 'chat',
      systemPrompt: buildChatSystemPrompt(
        document.fileName,
        chunks,
        responseLanguage,
      ),
      messages: history.map(toModelMessage),
    });

    void result.completion.then((completion) =>
      completion
        ? this.saveReply(conversation.id, userId, completion.text)
        : undefined,
    );
    return result;
  }

  private async saveReply(
    conversationId: string,
    userId: string,
    text: string,
  ) {
    try {
      const conversation = await this.messagesService.getOwnedConversation(
        conversationId,
        userId,
      );
      await this.messagesService.appendMessage(conversation, 'assistant', text);
    } catch (error) {
      this.logger.error(
        `Failed to save the reply in conversation ${conversationId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // The chat still answers without document context if vectorizing fails.
  private async findRelevantChunks(
    documentId: string,
    userId: string,
    question: string,
  ) {
    try {
      // Usually indexed already when the reader opened it; a no-op then.
      await this.ragService.vectorizeDocument(documentId, userId);
      return await this.ragService.searchDocument(
        documentId,
        userId,
        question,
        RAG_CHUNKS,
      );
    } catch (error) {
      this.logger.error(
        'Document context lookup failed:',
        error instanceof Error ? error.stack : String(error),
      );
      return [];
    }
  }
}
