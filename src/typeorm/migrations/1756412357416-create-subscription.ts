import {
  type MigrationInterface,
  type QueryRunner,
  Table,
  TableIndex,
  TableForeignKey,
} from 'typeorm';

export class CreateSubscription1756412357416 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'subscription',
        columns: [
          {
            name: 'id',
            type: 'text',
            isPrimary: true,
          },
          {
            name: 'userId',
            type: 'text',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'plan',
            type: 'enum',
            enum: ['free', 'basic', 'pro', 'enterprise'],
            default: "'free'",
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
          },
          {
            name: 'currentPeriodStart',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'currentPeriodEnd',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'chatMessagesUsed',
            type: 'integer',
            default: 0,
          },
          {
            name: 'chatMessagesLimit',
            type: 'integer',
            default: 30,
          },
          {
            name: 'aiNotesUsed',
            type: 'integer',
            default: 0,
          },
          {
            name: 'aiNotesLimit',
            type: 'integer',
            default: 20,
          },
          {
            name: 'documentsLimit',
            type: 'integer',
            default: 3,
          },
          {
            name: 'storageLimitBytes',
            type: 'bigint',
            default: 52428800,
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
            name: 'stripeCustomerId',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'stripeSubscriptionId',
            type: 'text',
            isNullable: true,
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
      'subscription',
      new TableIndex({
        name: 'IDX_subscription_userId',
        columnNames: ['userId'],
        isUnique: true,
      }),
    );

    await queryRunner.createForeignKey(
      'subscription',
      new TableForeignKey({
        name: 'FK_subscription_user',
        columnNames: ['userId'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('subscription', 'FK_subscription_user');
    await queryRunner.dropIndex('subscription', 'IDX_subscription_userId');
    await queryRunner.dropTable('subscription');
  }
}
