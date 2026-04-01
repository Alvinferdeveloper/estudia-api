import {
  type MigrationInterface,
  type QueryRunner,
  Table,
  TableIndex,
  TableForeignKey,
} from 'typeorm';

export class CreatePayment1756412357418 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'payment',
        columns: [
          {
            name: 'id',
            type: 'text',
            isPrimary: true,
          },
          {
            name: 'userId',
            type: 'text',
          },
          {
            name: 'plan',
            type: 'enum',
            enum: ['free', 'basic', 'pro', 'enterprise'],
          },
          {
            name: 'amount',
            type: 'decimal',
            precision: 10,
            scale: 2,
          },
          {
            name: 'currency',
            type: 'varchar',
            length: '3',
            default: 'USD',
          },
          {
            name: 'paypalOrderId',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'paypalCaptureId',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'paypalPayerId',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'paypalPayerEmail',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'approved', 'completed', 'failed', 'refunded', 'cancelled'],
            default: 'pending',
          },
          {
            name: 'provider',
            type: 'enum',
            enum: ['paypal'],
            default: 'paypal',
          },
          {
            name: 'eventId',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'failureReason',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'completedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'expiresAt',
            type: 'timestamp',
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
      'payment',
      new TableIndex({
        name: 'IDX_payment_userId_status',
        columnNames: ['userId', 'status'],
      }),
    );

    await queryRunner.createIndex(
      'payment',
      new TableIndex({
        name: 'IDX_payment_paypalOrderId',
        columnNames: ['paypalOrderId'],
      }),
    );

    await queryRunner.createIndex(
      'payment',
      new TableIndex({
        name: 'IDX_payment_eventId',
        columnNames: ['eventId'],
      }),
    );

    await queryRunner.createForeignKey(
      'payment',
      new TableForeignKey({
        name: 'FK_payment_user',
        columnNames: ['userId'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('payment', 'FK_payment_user');
    await queryRunner.dropIndex('payment', 'IDX_payment_eventId');
    await queryRunner.dropIndex('payment', 'IDX_payment_paypalOrderId');
    await queryRunner.dropIndex('payment', 'IDX_payment_userId_status');
    await queryRunner.dropTable('payment');
  }
}
