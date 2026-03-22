import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Annotation } from '../typeorm/entities/Annotation.entity';

@Injectable()
export class AnnotationsService {
  constructor(
    @InjectRepository(Annotation)
    private annotationRepository: Repository<Annotation>,
  ) {}

  async findByDocument(documentId: string): Promise<Annotation[]> {
    return this.annotationRepository.find({
      where: { documentId },
      order: { pageNumber: 'ASC' },
    });
  }

  async findByPage(
    documentId: string,
    pageNumber: number,
  ): Promise<Annotation[]> {
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
    embedding?: string | null;
  }): Promise<Annotation> {
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
    await this.annotationRepository.update(id, data);
    return this.annotationRepository.findOneBy({ id });
  }

  async delete(id: string): Promise<void> {
    await this.annotationRepository.delete(id);
  }
}
