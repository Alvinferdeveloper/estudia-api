import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, IsNull } from 'typeorm';
import { PDFParse } from 'pdf-parse';
import { Document } from '../typeorm/entities/Document.entity';
import { Folder } from '../typeorm/entities/Folder.entity';
import { DocumentImage } from '../typeorm/entities/DocumentImage.entity';
import { touchFolder } from '../folders/folder-aggregates.util';
import { DocumentIngestionService } from './document-ingestion.service';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import 'dotenv/config';
import { ErrorCode } from '../common/errors/error-codes';

export interface FolderItem {
  id: string;
  name: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
  type: 'folder';
  count: number;
  subfoldersCount: number;
  totalSize: number;
  isStarred: boolean;
}

export interface DocumentItem {
  id: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  createdAt: Date;
  updatedAt: Date;
  lastAccessedAt: Date | null;
  topicId: string | null;
  folderId: string | null;
  tags: string[];
  isStarred: boolean;
  pageCount: number | null;
  type: 'document';
}

export type Item = FolderItem | DocumentItem;

@Injectable()
export class DocumentsService {
  private supabase: SupabaseClient;

  constructor(
    @InjectRepository(Document)
    private documentsRepository: Repository<Document>,
    @InjectRepository(Folder)
    private foldersRepository: Repository<Folder>,
    @InjectRepository(DocumentImage)
    private documentImagesRepository: Repository<DocumentImage>,
    private documentIngestionService: DocumentIngestionService,
  ) {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
        },
      },
    );
  }

  async uploadDocument(
    file: Express.Multer.File,
    userId: string,
    topicId?: string,
    folderId?: string,
    tags?: string,
  ): Promise<Document> {
    try {
      const filePath = `public/${userId}/${Date.now()}-${file.originalname}`;
      const { data, error } = await this.supabase.storage
        .from('documents')
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (error) {
        throw new InternalServerErrorException({
          code: ErrorCode.DOCUMENT_UPLOAD_FAILED,
          message: `Supabase upload error: ${error.message}`,
        });
      }

      const tagsArray = tags ? tags.split(',').map((t) => t.trim()) : [];
      const pageCount = await this.extractPageCount(file.buffer);

      const newDocument = this.documentsRepository.create({
        fileName: file.originalname,
        filePath: data.path,
        fileSize: file.size,
        mimeType: file.mimetype,
        userId: userId,
        topicId: topicId,
        folderId: folderId,
        tags: tagsArray,
        pageCount,
      });

      const saved = await this.documentsRepository.save(newDocument);

      if (folderId) {
        await touchFolder(this.foldersRepository, folderId, {
          documentDelta: 1,
          sizeDelta: file.size,
        });
      }

      this.documentIngestionService.ingestInBackground(
        saved.id,
        file.buffer,
        file.originalname,
      );

      return saved;
    } catch (error) {
      console.error('Error uploading document:', error);
      throw new InternalServerErrorException({
        code: ErrorCode.DOCUMENT_UPLOAD_FAILED,
      });
    }
  }

  private async extractPageCount(buffer: Buffer): Promise<number | null> {
    try {
      const parser = new PDFParse({ data: buffer });
      const info = await parser.getInfo();
      return info.total;
    } catch (error) {
      console.error('Error extracting PDF page count:', error);
      return null;
    }
  }

  async findAllDocuments(
    userId: string,
    topicId?: string,
    folderId?: string,
    page: number = 1,
    limit: number = 10,
    search?: string,
  ): Promise<{ data: Document[]; total: number; page: number; limit: number }> {
    const queryBuilder =
      this.documentsRepository.createQueryBuilder('document');

    queryBuilder.where('document.userId = :userId', { userId });

    if (topicId) {
      queryBuilder.andWhere('document.topicId = :topicId', { topicId });
    }

    if (folderId) {
      queryBuilder.andWhere('document.folderId = :folderId', { folderId });
    }

    if (search) {
      queryBuilder.andWhere(
        '(document.fileName LIKE :search OR CAST(document.tags AS CHAR) LIKE :search)',
        { search: `%${search}%` },
      );
    }

    queryBuilder
      .orderBy('document.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async findAllItems(
    userId: string,
    topicId?: string,
    folderId?: string,
    page: number = 1,
    limit: number = 10,
    search?: string,
    sortBy: 'date' | 'name' = 'date',
  ): Promise<{ data: Item[]; total: number; page: number; limit: number }> {
    // Get folders at current level
    const folderQuery = this.foldersRepository
      .createQueryBuilder('folder')
      .where('folder.userId = :userId', { userId })
      .andWhere('folder.topicId = :topicId', { topicId });

    if (folderId) {
      folderQuery.andWhere('folder.parentId = :parentId', {
        parentId: folderId,
      });
    } else {
      folderQuery.andWhere('folder.parentId IS NULL');
    }

    const [folders, totalFolders] = await folderQuery.getManyAndCount();

    const folderItems: FolderItem[] = folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      color: folder.color,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt,
      type: 'folder' as const,
      count: folder.count,
      subfoldersCount: folder.subfoldersCount,
      totalSize: folder.totalSize,
      isStarred: folder.isStarred,
    }));

    // Get documents at current level
    const docQuery = this.documentsRepository
      .createQueryBuilder('document')
      .where('document.userId = :userId', { userId })
      .andWhere('document.topicId = :topicId', { topicId });

    if (folderId) {
      docQuery.andWhere('document.folderId = :folderId', { folderId });
    } else {
      docQuery.andWhere('document.folderId IS NULL');
    }

    if (search) {
      docQuery.andWhere(
        '(document.fileName LIKE :search OR CAST(document.tags AS CHAR) LIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [documents, totalDocs] = await docQuery.getManyAndCount();

    const documentItems: DocumentItem[] = documents.map((doc) => ({
      id: doc.id,
      fileName: doc.fileName,
      filePath: doc.filePath,
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      lastAccessedAt: doc.lastAccessedAt,
      topicId: doc.topicId,
      folderId: doc.folderId,
      tags: doc.tags,
      isStarred: doc.isStarred,
      pageCount: doc.pageCount,
      type: 'document' as const,
    }));

    // Combine folders and documents into a single ordered list — no
    // "folders first" grouping, they interleave by the chosen criterion
    // just like Drive/OneDrive.
    const getName = (item: Item) =>
      item.type === 'folder' ? item.name : item.fileName;

    const allItems: Item[] = [...folderItems, ...documentItems].sort((a, b) =>
      sortBy === 'name'
        ? getName(a).localeCompare(getName(b))
        : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const total = totalFolders + totalDocs;
    const skip = (page - 1) * limit;
    const paginatedData = allItems.slice(skip, skip + limit);

    return {
      data: paginatedData,
      total,
      page,
      limit,
    };
  }

  async findOneDocument(
    id: string,
    userId: string,
  ): Promise<Document & { publicUrl?: string }> {
    const document = await this.documentsRepository.findOne({
      where: { id, userId },
    });
    if (!document) {
      throw new NotFoundException({ code: ErrorCode.DOCUMENT_NOT_FOUND });
    }

    const { data } = await this.supabase.storage
      .from('documents')
      .createSignedUrl(document.filePath, 60 * 60 * 24);

    return { ...document, publicUrl: data?.signedUrl };
  }

  async findRecentDocuments(
    userId: string,
    limit: number = 20,
    search?: string,
  ): Promise<Document[]> {
    const queryBuilder = this.documentsRepository
      .createQueryBuilder('document')
      .where('document.userId = :userId', { userId });

    if (search) {
      queryBuilder.andWhere(
        '(document.fileName LIKE :search OR CAST(document.tags AS CHAR) LIKE :search)',
        { search: `%${search}%` },
      );
    }

    return queryBuilder
      .orderBy('COALESCE(document.lastAccessedAt, document.createdAt)', 'DESC')
      .take(limit)
      .getMany();
  }

  async touchDocument(id: string, userId: string): Promise<void> {
    const document = await this.documentsRepository.findOne({
      where: { id, userId },
    });
    if (!document) {
      throw new NotFoundException({ code: ErrorCode.DOCUMENT_NOT_FOUND });
    }
    await this.documentsRepository.update(id, {
      lastAccessedAt: new Date(),
    });
  }

  async deleteDocument(id: string, userId: string): Promise<void> {
    const document = await this.findOneDocument(id, userId);

    try {
      const { error } = await this.supabase.storage
        .from('documents')
        .remove([document.filePath]);

      if (error) {
        throw new InternalServerErrorException({
          code: ErrorCode.DOCUMENT_DELETE_FAILED,
          message: `Supabase delete error: ${error.message}`,
        });
      }

      await this.documentsRepository.delete(id);

      if (document.folderId) {
        await touchFolder(this.foldersRepository, document.folderId, {
          documentDelta: -1,
          sizeDelta: -document.fileSize,
        });
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      throw new InternalServerErrorException({
        code: ErrorCode.DOCUMENT_DELETE_FAILED,
      });
    }
  }

  async toggleDocumentStar(
    id: string,
    userId: string,
    isStarred: boolean,
  ): Promise<void> {
    const result = await this.documentsRepository.update(
      { id, userId },
      { isStarred },
    );
    if (result.affected === 0) {
      throw new NotFoundException({ code: ErrorCode.DOCUMENT_NOT_FOUND });
    }
  }

  async getDocumentImages(
    id: string,
    userId: string,
  ): Promise<DocumentImage[]> {
    await this.findOneDocument(id, userId);

    return this.documentImagesRepository.find({
      where: { documentId: id },
      order: { pageNumber: 'ASC' },
    });
  }
}
