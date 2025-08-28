import { type MigrationInterface, type QueryRunner, Table, TableIndex, TableColumn } from 'typeorm';

export class CreateAccount1756412357415 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'account',
        columns: [
          {
            name: 'id',
            type: 'text',
            isPrimary: true,
          },
          {
            name: 'accountId',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'providerId',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'userId',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'accessToken',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'refreshToken',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'idToken',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'accessTokenExpiresAt',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'refreshTokenExpiresAt',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'scope',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'password',
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

  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('account');
  }
}