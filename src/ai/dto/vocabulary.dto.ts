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

  // Language the selected text is actually written in, when it differs from wordLanguage.
  @IsOptional()
  @IsString()
  sourceLanguage?: string;

  @IsOptional()
  @IsString()
  documentContext?: string;
}
