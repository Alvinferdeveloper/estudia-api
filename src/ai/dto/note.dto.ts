import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { IsResponseLanguage } from '../language';

export class NoteDto {
  @IsString()
  @IsNotEmpty()
  selectedText: string;

  @IsString()
  @IsNotEmpty()
  prompt: string;

  @IsOptional()
  @IsString()
  documentContext?: string;

  @IsOptional()
  @IsString()
  originalNote?: string;

  @IsResponseLanguage()
  responseLanguage?: string;
}
