import { Repository } from 'typeorm';
import { Folder } from '../typeorm/entities/Folder.entity';

export interface TouchFolderOptions {
  documentDelta?: number;
  subfolderDelta?: number;
  sizeDelta?: number;
}

/**
 * Updates a folder's direct counters (count, subfoldersCount, totalSize) and
 * touches its updatedAt — "modified" only reflects direct changes, it never
 * cascades to ancestors. totalSize, however, represents everything nested
 * inside the folder, so its delta is propagated up the parent chain.
 */
export async function touchFolder(
  foldersRepository: Repository<Folder>,
  folderId: string | null | undefined,
  { documentDelta = 0, subfolderDelta = 0, sizeDelta = 0 }: TouchFolderOptions,
): Promise<void> {
  if (!folderId) return;

  if (documentDelta !== 0) {
    await foldersRepository.increment({ id: folderId }, 'count', documentDelta);
  }
  if (subfolderDelta !== 0) {
    await foldersRepository.increment(
      { id: folderId },
      'subfoldersCount',
      subfolderDelta,
    );
  }
  if (sizeDelta !== 0) {
    await foldersRepository.increment({ id: folderId }, 'totalSize', sizeDelta);
  }
  await foldersRepository.update(folderId, { updatedAt: new Date() });

  if (sizeDelta !== 0) {
    let current = await foldersRepository.findOne({
      where: { id: folderId },
      select: ['id', 'parentId'],
    });
    while (current?.parentId) {
      await foldersRepository.increment(
        { id: current.parentId },
        'totalSize',
        sizeDelta,
      );
      current = await foldersRepository.findOne({
        where: { id: current.parentId },
        select: ['id', 'parentId'],
      });
    }
  }
}
