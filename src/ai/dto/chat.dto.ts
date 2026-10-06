import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';
import { IsResponseLanguage } from '../language';

// The server keeps the conversation history; the client only sends the message to answer.
export class ChatDto {
  @IsUUID()
  conversationId: string;

  // Resending the last unanswered message retries it without storing it twice.
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  message: string;

  @IsResponseLanguage()
  responseLanguage?: string;
}
