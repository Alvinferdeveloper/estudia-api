import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UIMessagePartDto {
  @IsString()
  type: string;

  @IsString()
  text: string;
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
}
