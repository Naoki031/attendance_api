import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm'

export class CreatePinnedMessagesTable1775242918950 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Guard: table may already exist if created before this migration was tracked
    if (await queryRunner.hasTable('pinned_messages')) return

    await queryRunner.createTable(
      new Table({
        name: 'pinned_messages',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'room_id',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'message_id',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'pinned_by_user_id',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'datetime',
            isNullable: false,
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    )

    await queryRunner.createIndex(
      'pinned_messages',
      new TableIndex({
        name: 'UQ_pinned_messages_room_message',
        columnNames: ['room_id', 'message_id'],
        isUnique: true,
      }),
    )

    await queryRunner.createForeignKey(
      'pinned_messages',
      new TableForeignKey({
        columnNames: ['room_id'],
        referencedTableName: 'chat_rooms',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    )

    await queryRunner.createForeignKey(
      'pinned_messages',
      new TableForeignKey({
        columnNames: ['message_id'],
        referencedTableName: 'messages',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    )

    await queryRunner.createForeignKey(
      'pinned_messages',
      new TableForeignKey({
        columnNames: ['pinned_by_user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('pinned_messages', true)
  }
}
