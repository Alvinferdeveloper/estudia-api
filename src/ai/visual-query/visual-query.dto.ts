import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

export class VisualQueryDto {
  @IsString()
  @IsNotEmpty()
  question: string;

  @ValidateIf((o: VisualQueryDto) => o.imageXref === undefined)
  @IsString()
  @IsNotEmpty()
  imageBase64?: string;

  @ValidateIf((o: VisualQueryDto) => o.imageBase64 === undefined)
  @IsInt()
  imageXref?: number;

  @IsOptional()
  @IsInt()
  pageNumber?: number;
}
