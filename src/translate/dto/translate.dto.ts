import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class TranslateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  text: string;

  @IsOptional()
  @IsString()
  targetLanguage?: string;
}
