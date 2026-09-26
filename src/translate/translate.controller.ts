import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { TranslateService } from './translate.service';
import { TranslateDto } from './dto/translate.dto';

@Controller('translate')
@UseGuards(AuthGuard)
export class TranslateController {
  constructor(private readonly translateService: TranslateService) {}

  @Post()
  async translate(@Body() dto: TranslateDto) {
    return this.translateService.translate(dto.text, dto.targetLanguage);
  }
}
