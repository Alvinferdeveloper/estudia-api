import { type MigrationInterface, type QueryRunner, Table, TableIndex, TableColumn } from 'typeorm';

export class CreateUser1756412357415 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'user',
        columns: [
          {
            name: 'id',
            type: 'text',
            isPrimary: true,
          },
          {
            name: 'name',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'email',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'emailVerified',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'image',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'date',
            isNullable: false,
          },
          {
            name: 'updatedAt',
            type: 'date',
            isNullable: false,
          }
        ],
      }),
    );

    await queryRunner.createIndex(
      'user',
      new TableIndex({
        name: 'IDX_user_email',
        columnNames: ['email'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('user');
  }
}