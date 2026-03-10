import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Folder } from '../typeorm/entities/Folder.entity';

@Injectable()
export class FoldersService {
  constructor(
    @InjectRepository(Folder)
    private foldersRepository: Repository<Folder>,
  ) { }

  async createFolder(name: string, color: string, topicId: string, userId: string, parentId?: string): Promise<Folder> {
    const newFolder = this.foldersRepository.create({
      name,
      color,
      topicId,
      userId,
      parentId
    });
    return this.foldersRepository.save(newFolder);
  }

  async findAllFolders(userId: string, topicId?: string): Promise<Folder[]> {
    const query = this.foldersRepository.createQueryBuilder('folder')
      .where('folder.userId = :userId', { userId })
      .leftJoinAndSelect('folder.subfolders', 'subfolders')
      .leftJoinAndSelect('folder.documents', 'documents');

    if (topicId) {
      query.andWhere('folder.topicId = :topicId', { topicId });
    }

    const folders = await query.getMany();

    return folders.map(folder => ({
      ...folder,
      count: folder.documents ? folder.documents.length : 0,
      subfoldersCount: folder.subfolders ? folder.subfolders.length : 0,
      subfolders: folder.subfolders?.map(sub => ({
        ...sub,
        count: sub.documents ? sub.documents.length : 0,
      })) || [],
    }));
  }

  async findFoldersByTopic(topicId: string, userId: string): Promise<Folder[]> {
    const folders = await this.foldersRepository.find({
      where: { topicId, userId },
      relations: ['subfolders', 'documents'],
    });

    return folders.map(folder => ({
      ...folder,
      count: folder.documents ? folder.documents.length : 0,
      subfoldersCount: folder.subfolders ? folder.subfolders.length : 0,
    }));
  }

  async findRootFolders(topicId: string, userId: string): Promise<Folder[]> {
    const folders = await this.foldersRepository.find({
      where: { topicId, userId, parentId: IsNull() },
      relations: ['subfolders', 'documents'],
    });

    return folders.map(folder => ({
      ...folder,
      count: folder.documents ? folder.documents.length : 0,
      subfoldersCount: folder.subfolders ? folder.subfolders.length : 0,
    }));
  }

  async findOneFolder(id: string, userId: string): Promise<Folder | null> {
    return this.foldersRepository.findOne({
      where: { id, userId },
      relations: ['subfolders', 'documents', 'parent']
    });
  }

  async updateFolder(id: string, name: string, color: string, userId: string): Promise<Folder> {
    const folder = await this.foldersRepository.findOne({ where: { id, userId } });
    if (!folder) {
      throw new NotFoundException('Folder not found');
    }
    folder.name = name;
    folder.color = color;
    return this.foldersRepository.save(folder);
  }

  async removeFolder(id: string, userId: string): Promise<void> {
    const result = await this.foldersRepository.delete({ id, userId });
    if (result.affected === 0) {
      throw new NotFoundException('Folder not found');
    }
  }
}
