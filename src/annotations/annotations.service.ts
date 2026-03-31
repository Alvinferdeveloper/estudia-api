import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Annotation } from '../typeorm/entities/Annotation.entity';
import { Document } from '../typeorm/entities/Document.entity';

@Injectable()
export class AnnotationsService {
  constructor(
    @InjectRepository(Annotation)
    private annotationRepository: Repository<Annotation>,
  ) {}

  async findByDocument(documentId: string, userId: string): Promise<Annotation[]> {
    await this.verifyDocumentAccess(documentId, userId);
    return this.annotationRepository.find({
      where: { documentId },
      order: { pageNumber: 'ASC' },
    });
  }

  async findByPage(
    documentId: string,
    pageNumber: number,
    userId: string,
  ): Promise<Annotation[]> {
    await this.verifyDocumentAccess(documentId, userId);
    return this.annotationRepository.find({
      where: { documentId, pageNumber },
    });
  }

  async create(data: {
    selectedText: string;
    comment?: string | null;
    aiResponse?: string | null;
    color: string;
    pageNumber: number;
    boundingRect: {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      width: number;
      height: number;
      pageNumber: number;
    };
    rects?: {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      width: number;
      height: number;
      pageNumber: number;
    }[];
    documentId: string;
    userId: string;
    embedding?: string | null;
  }): Promise<Annotation> {
    await this.verifyDocumentAccess(data.documentId, data.userId);
    const annotation = this.annotationRepository.create({
      selectedText: data.selectedText,
      comment: data.comment || null,
      aiResponse: data.aiResponse || null,
      color: data.color,
      pageNumber: data.pageNumber,
      boundingRect: data.boundingRect,
      rects: data.rects || [],
      documentId: data.documentId,
      embedding: data.embedding || null,
    });
    return this.annotationRepository.save(annotation);
  }

  async update(
    id: string,
    userId: string,
    data: Partial<{
      comment: string | null;
      aiResponse: string | null;
      color: string;
      boundingRect: {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        width: number;
        height: number;
        pageNumber: number;
      };
      rects: {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        width: number;
        height: number;
        pageNumber: number;
      }[];
    }>,
  ): Promise<Annotation | null> {
    const annotation = await this.annotationRepository.findOneBy({ id });
    if (!annotation) {
      return null;
    }
    await this.verifyDocumentAccess(annotation.documentId, userId);
    await this.annotationRepository.update(id, data);
    return this.annotationRepository.findOneBy({ id });
  }

  async delete(id: string, userId: string): Promise<void> {
    const annotation = await this.annotationRepository.findOneBy({ id });
    if (!annotation) {
      return;
    }
    await this.verifyDocumentAccess(annotation.documentId, userId);
    await this.annotationRepository.delete(id);
  }

  private async verifyDocumentAccess(
    documentId: string,
    userId: string,
  ): Promise<void> {
    const document = await this.annotationRepository.manager.findOne(Document, {
      where: { id: documentId, userId },
    });
    if (!document) {
      throw new UnauthorizedException('Access to this document is denied');
    }
  }
}
