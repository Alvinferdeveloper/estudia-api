import { IsInt, Min } from 'class-validator';

export class ReadingProgressDto {
  @IsInt()
  @Min(1)
  page: number;
}
