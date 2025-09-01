import { Controller, Post, UseInterceptors, UploadedFile, Req, BadRequestException, UseGuards } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import { Request } from 'express';
import { AuthGuard } from '../common/guards/auth.guard';

interface RequestWithAuth extends Request {
  userId: string;
  user?: any;
}

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) { }

  @Post('upload')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File, @Req() req: RequestWithAuth) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    const userId = req.userId;

    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Only PDF files are allowed');
    }

    return this.documentsService.uploadDocument(file, userId);
  }
}
