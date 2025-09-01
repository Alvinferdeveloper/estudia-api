import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from '../typeorm/entities/Document.entity';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import 'dotenv/config';

@Injectable()
export class DocumentsService {
  private supabase: SupabaseClient;

  constructor(
    @InjectRepository(Document)
    private documentsRepository: Repository<Document>,
  ) {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
        },
      }
    );
  }

  async uploadDocument(file: Express.Multer.File, userId: string, topicId?: string): Promise<Document> {
    try {
      const filePath = `public/${userId}/${Date.now()}-${file.originalname}`;
      const { data, error } = await this.supabase.storage
        .from('documents')
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (error) {
        throw new InternalServerErrorException(`Supabase upload error: ${error.message}`);
      }

      const newDocument = this.documentsRepository.create({
        fileName: file.originalname,
        filePath: data.path,
        fileSize: file.size,
        mimeType: file.mimetype,
        userId: userId,
        topicId: topicId
      });

      return this.documentsRepository.save(newDocument);
    } catch (error) {
      console.error('Error uploading document:', error);
      throw new InternalServerErrorException('Failed to upload document');
    }
  }

  async findAllDocuments(userId: string, topicId?: string): Promise<Document[]> {
    const where: any = { userId };
    if (topicId) {
      where.topicId = topicId;
    }
    return this.documentsRepository.find({ where });
  }

  async findOneDocument(id: string, userId: string): Promise<Document> {
    const document = await this.documentsRepository.findOne({ where: { id, userId } });
    if (!document) {
      throw new NotFoundException('Document not found');
    }
    return document;
  }
}
