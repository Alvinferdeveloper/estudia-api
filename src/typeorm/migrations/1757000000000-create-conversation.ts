import {
  type MigrationInterface,
  type QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

export class CreateConversation1757000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'conversation',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
          },
          {
            name: 'documentId',
            type: 'text',
          },
          {
            name: 'userId',
            type: 'text',
          },
          {
            name: 'title',
            type: 'varchar',
            length: '255',
            default: "'Nueva conversación'",
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

    await queryRunner.createForeignKey(
      'conversation',
      new TableForeignKey({
        name: 'FK_conversation_document',
        columnNames: ['documentId'],
        referencedTableName: 'document',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.addColumn(
      'message',
      new Table({
        name: 'message',
        columns: [
          {
            name: 'conversationId',
            type: 'varchar',
            length: '36',
            isNullable: true,
          },
        ],
      }).columns[0],
    );

    await queryRunner.createForeignKey(
      'message',
      new TableForeignKey({
        name: 'FK_message_conversation',
        columnNames: ['conversationId'],
        referencedTableName: 'conversation',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('message', 'FK_message_conversation');
    await queryRunner.dropForeignKey(
      'conversation',
      'FK_conversation_document',
    );
    await queryRunner.dropColumn('message', 'conversationId');
    await queryRunner.dropTable('conversation');
  }
}
