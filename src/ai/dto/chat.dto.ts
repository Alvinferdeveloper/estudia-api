import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsResponseLanguage } from '../language';

export class UIMessagePartDto {
  @IsString()
  type: string;

  // Only text parts carry text; the AI SDK also sends parts like step-start.
  @IsOptional()
  @IsString()
  text?: string;
}

export class UIMessageDto {
  @IsString()
  id: string;

  @IsString()
  role: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UIMessagePartDto)
  parts: UIMessagePartDto[];
}

export class ChatDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UIMessageDto)
  messages: UIMessageDto[];

  @IsOptional()
  @IsString()
  documentId?: string;

  @IsOptional()
  @IsString()
  documentName?: string;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsResponseLanguage()
  responseLanguage?: string;
}
