import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class VocabularyDto {
  @IsString()
  @IsNotEmpty()
  selectedText: string;

  @IsString()
  @IsNotEmpty()
  wordLanguage: string;

  @IsString()
  @IsNotEmpty()
  explanationLanguage: string;

  @IsOptional()
  @IsString()
  documentContext?: string;
}
