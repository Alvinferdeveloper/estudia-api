/**
 * One-time backfill for the new denormalized Folder counters (count,
 * subfoldersCount, totalSize). These are maintained incrementally going
 * forward (see src/folders/folder-aggregates.util.ts), but existing rows
 * need an initial seed computed from current data.
 *
 * Run once after deploying the new columns:
 *   npx ts-node scripts/backfill-folder-aggregates.ts
 */
import { dataSource } from '../src/data-source';
import { Folder } from '../src/typeorm/entities/Folder.entity';
import { Document } from '../src/typeorm/entities/Document.entity';

async function main() {
  await dataSource.initialize();

  const folderRepo = dataSource.getRepository(Folder);
  const documentRepo = dataSource.getRepository(Document);

  const folders = await folderRepo.find();
  const documents = await documentRepo.find({
    select: ['id', 'folderId', 'fileSize'],
  });

  const directSizeByFolder = new Map<string, number>();
  const directCountByFolder = new Map<string, number>();
  for (const doc of documents) {
    if (!doc.folderId) continue;
    directSizeByFolder.set(
      doc.folderId,
      (directSizeByFolder.get(doc.folderId) ?? 0) + Number(doc.fileSize),
    );
    directCountByFolder.set(
      doc.folderId,
      (directCountByFolder.get(doc.folderId) ?? 0) + 1,
    );
  }

  const childrenByParent = new Map<string, Folder[]>();
  for (const folder of folders) {
    if (!folder.parentId) continue;
    const siblings = childrenByParent.get(folder.parentId) ?? [];
    siblings.push(folder);
    childrenByParent.set(folder.parentId, siblings);
  }

  const totalSizeCache = new Map<string, number>();
  function computeTotalSize(folder: Folder): number {
    const cached = totalSizeCache.get(folder.id);
    if (cached !== undefined) return cached;

    let total = directSizeByFolder.get(folder.id) ?? 0;
    for (const child of childrenByParent.get(folder.id) ?? []) {
      total += computeTotalSize(child);
    }
    totalSizeCache.set(folder.id, total);
    return total;
  }

  for (const folder of folders) {
    const count = directCountByFolder.get(folder.id) ?? 0;
    const subfoldersCount = (childrenByParent.get(folder.id) ?? []).length;
    const totalSize = computeTotalSize(folder);

    await folderRepo.update(folder.id, { count, subfoldersCount, totalSize });
    console.log(
      `Updated "${folder.name}" (${folder.id}): count=${count}, subfoldersCount=${subfoldersCount}, totalSize=${totalSize}`,
    );
  }

  await dataSource.destroy();
  console.log(`\nBackfill complete — ${folders.length} folder(s) updated.`);
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
