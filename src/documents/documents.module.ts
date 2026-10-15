import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DocumentIngestionService } from './document-ingestion.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from '../typeorm/entities/Document.entity';
import { Folder } from '../typeorm/entities/Folder.entity';
import { User } from '../typeorm/entities/User.entity';
import { DocumentImage } from '../typeorm/entities/DocumentImage.entity';
import { EntitlementsModule } from '../entitlements/entitlements.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document, Folder, User, DocumentImage]),
    EntitlementsModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentIngestionService],
  exports: [DocumentsService, DocumentIngestionService],
})
export class DocumentsModule {}
