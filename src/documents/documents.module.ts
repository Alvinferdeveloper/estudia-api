import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from '../typeorm/entities/Document.entity';
import { Folder } from '../typeorm/entities/Folder.entity';
import { User } from '../typeorm/entities/User.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Document, Folder, User])],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
