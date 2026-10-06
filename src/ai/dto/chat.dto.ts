import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { IsResponseLanguage } from '../language';

// The server keeps the conversation history; the client only sends the new message.
export class ChatDto {
  @IsUUID()
  conversationId: string;

  // Omitted to retry the last message.
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  message?: string;

  @IsResponseLanguage()
  responseLanguage?: string;
}
