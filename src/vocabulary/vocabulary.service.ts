import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  VocabularyEntry,
  VocabularyExplanation,
} from '../typeorm/entities/VocabularyEntry.entity';
import {
  BoundingRect,
  AnnotationRect,
} from '../typeorm/entities/Annotation.entity';
import { Document } from '../typeorm/entities/Document.entity';
import { ErrorCode } from '../common/errors/error-codes';

@Injectable()
export class VocabularyService {
  constructor(
    @InjectRepository(VocabularyEntry)
    private vocabularyRepository: Repository<VocabularyEntry>,
  ) {}

  async findByDocument(
    documentId: string,
    userId: string,
  ): Promise<VocabularyEntry[]> {
    await this.verifyDocumentAccess(documentId, userId);
    return this.vocabularyRepository.find({
      where: { documentId },
      order: { pageNumber: 'ASC' },
    });
  }

  async create(data: {
    selectedText: string;
    wordLanguage: string;
    explanationLanguage: string;
    color?: string;
    pageNumber: number;
    boundingRect: BoundingRect;
    rects?: AnnotationRect[];
    explanation?: VocabularyExplanation | null;
    documentId: string;
    userId: string;
  }): Promise<VocabularyEntry> {
    await this.verifyDocumentAccess(data.documentId, data.userId);
    const entry = this.vocabularyRepository.create({
      selectedText: data.selectedText,
      wordLanguage: data.wordLanguage,
      explanationLanguage: data.explanationLanguage,
      color: data.color || '#B39DDB',
      pageNumber: data.pageNumber,
      boundingRect: data.boundingRect,
      rects: data.rects || [],
      explanation: data.explanation || null,
      documentId: data.documentId,
    });
    return this.vocabularyRepository.save(entry);
  }

  async update(
    id: string,
    userId: string,
    data: Partial<{
      color: string;
      explanation: VocabularyExplanation | null;
      boundingRect: BoundingRect;
      rects: AnnotationRect[];
    }>,
  ): Promise<VocabularyEntry | null> {
    const entry = await this.vocabularyRepository.findOneBy({ id });
    if (!entry) {
      return null;
    }
    await this.verifyDocumentAccess(entry.documentId, userId);
    await this.vocabularyRepository.update(id, data);
    return this.vocabularyRepository.findOneBy({ id });
  }

  async delete(id: string, userId: string): Promise<void> {
    const entry = await this.vocabularyRepository.findOneBy({ id });
    if (!entry) {
      return;
    }
    await this.verifyDocumentAccess(entry.documentId, userId);
    await this.vocabularyRepository.delete(id);
  }

  private async verifyDocumentAccess(
    documentId: string,
    userId: string,
  ): Promise<void> {
    const document = await this.vocabularyRepository.manager.findOne(Document, {
      where: { id: documentId, userId },
    });
    if (!document) {
      throw new ForbiddenException({
        code: ErrorCode.DOCUMENT_ACCESS_DENIED,
      });
    }
  }
}
