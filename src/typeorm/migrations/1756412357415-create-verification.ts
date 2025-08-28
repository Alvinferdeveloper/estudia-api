import { type MigrationInterface, type QueryRunner, Table, TableIndex, TableColumn } from 'typeorm';

export class CreateVerification1756412357415 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'verification',
        columns: [
          {
            name: 'id',
            type: 'text',
            isPrimary: true,
          },
          {
            name: 'identifier',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'value',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'expiresAt',
            type: 'date',
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'updatedAt',
            type: 'date',
            isNullable: true,
          }
        ],
      }),
    );

  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('verification');
  }
}