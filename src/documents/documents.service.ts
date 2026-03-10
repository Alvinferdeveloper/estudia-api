import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, IsNull } from 'typeorm';
import { Document } from '../typeorm/entities/Document.entity';
import { Folder } from '../typeorm/entities/Folder.entity';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import 'dotenv/config';

export interface FolderItem {
  id: string;
  name: string;
  color: string;
  createdAt: Date;
  type: 'folder';
  count: number;
  subfoldersCount: number;
}

export interface DocumentItem {
  id: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  createdAt: Date;
  topicId: string | null;
  folderId: string | null;
  tags: string[];
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


  async uploadDocument(file: Express.Multer.File, userId: string, topicId?: string, folderId?: string, tags?: string): Promise<Document> {
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

      const tagsArray = tags ? tags.split(',').map(t => t.trim()) : [];

      const newDocument = this.documentsRepository.create({
        fileName: file.originalname,
        filePath: data.path,
        fileSize: file.size,
        mimeType: file.mimetype,
        userId: userId,
        topicId: topicId,
        folderId: folderId,
        tags: tagsArray,
      });

      return this.documentsRepository.save(newDocument);
    } catch (error) {
      console.error('Error uploading document:', error);
      throw new InternalServerErrorException('Failed to upload document');
    }
  }

  async findAllDocuments(
    userId: string,
    topicId?: string,
    folderId?: string,
    page: number = 1,
    limit: number = 10,
    search?: string
  ): Promise<{ data: Document[], total: number, page: number, limit: number }> {
    const queryBuilder = this.documentsRepository.createQueryBuilder('document');

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
        { search: `%${search}%` }
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
    search?: string
  ): Promise<{ data: Item[], total: number, page: number, limit: number }> {

    // Get folders at current level
    const folderQuery = this.foldersRepository.createQueryBuilder('folder')
      .where('folder.userId = :userId', { userId })
      .andWhere('folder.topicId = :topicId', { topicId });

    if (folderId) {
      folderQuery.andWhere('folder.parentId = :parentId', { parentId: folderId });
    } else {
      folderQuery.andWhere('folder.parentId IS NULL');
    }

    const [folders, totalFolders] = await folderQuery.getManyAndCount();

    const folderItems: FolderItem[] = folders.map(folder => ({
      id: folder.id,
      name: folder.name,
      color: folder.color,
      createdAt: folder.createdAt,
      type: 'folder' as const,
      count: 0,
      subfoldersCount: 0,
    }));

    // Get documents at current level
    const docQuery = this.documentsRepository.createQueryBuilder('document')
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
        { search: `%${search}%` }
      );
    }

    const [documents, totalDocs] = await docQuery.getManyAndCount();

    const documentItems: DocumentItem[] = documents.map(doc => ({
      id: doc.id,
      fileName: doc.fileName,
      filePath: doc.filePath,
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
      createdAt: doc.createdAt,
      topicId: doc.topicId,
      folderId: doc.folderId,
      tags: doc.tags,
      type: 'document' as const,
    }));

    // Combine and sort by createdAt
    const allItems: Item[] = [...folderItems, ...documentItems].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
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

  async findOneDocument(id: string, userId: string): Promise<Document & { publicUrl?: string }> {
    const document = await this.documentsRepository.findOne({ where: { id, userId } });
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const { data } = await this.supabase.storage.from('documents').createSignedUrl(document.filePath, 60 * 60 * 24);

    return { ...document, publicUrl: data?.signedUrl };
  }

  async deleteDocument(id: string, userId: string): Promise<void> {
    const document = await this.findOneDocument(id, userId);

    try {
      const { error } = await this.supabase.storage
        .from('documents')
        .remove([document.filePath]);

      if (error) {
        throw new InternalServerErrorException(`Supabase delete error: ${error.message}`);
      }

      await this.documentsRepository.delete(id);
    } catch (error) {
      console.error('Error deleting document:', error);
      throw new InternalServerErrorException('Failed to delete document');
    }
  }
}