import {
  type MigrationInterface,
  type QueryRunner,
  Table,
  TableIndex,
} from 'typeorm';

export class CreatePlan1756412357417 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'plan',
        columns: [
          {
            name: 'id',
            type: 'text',
            isPrimary: true,
          },
          {
            name: 'plan',
            type: 'enum',
            enum: ['free', 'basic', 'pro', 'enterprise'],
            isUnique: true,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'price',
            type: 'decimal',
            precision: 10,
            scale: 2,
          },
          {
            name: 'description',
            type: 'text',
          },
          {
            name: 'features',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'isPopular',
            type: 'boolean',
            default: false,
          },
          {
            name: 'chatMessagesLimit',
            type: 'integer',
            default: 0,
          },
          {
            name: 'aiNotesLimit',
            type: 'integer',
            default: 0,
          },
          {
            name: 'documentsLimit',
            type: 'integer',
            default: 0,
          },
          {
            name: 'storageLimitBytes',
            type: 'bigint',
            default: 0,
          },
          {
            name: 'hasSemanticSearch',
            type: 'boolean',
            default: false,
          },
          {
            name: 'hasVectorization',
            type: 'boolean',
            default: false,
          },
          {
            name: 'hasAdvancedModels',
            type: 'boolean',
            default: false,
          },
          {
            name: 'hasExportNotes',
            type: 'boolean',
            default: false,
          },
          {
            name: 'hasApiAccess',
            type: 'boolean',
            default: false,
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      'plan',
      new TableIndex({
        name: 'IDX_plan_name',
        columnNames: ['name'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('plan', 'IDX_plan_name');
    await queryRunner.dropTable('plan');
  }
}
