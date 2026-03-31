import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm'

export class CreateChatTables1774800000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create chat_rooms table
    await queryRunner.createTable(
      new Table({
        name: 'chat_rooms',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: false,
            isUnique: true,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'type',
            type: 'enum',
            enum: ['channel', 'direct'],
            default: "'channel'",
            isNullable: false,
          },
          {
            name: 'creator_id',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    )

    // Create chat_room_members table
    await queryRunner.createTable(
      new Table({
        name: 'chat_room_members',
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
            name: 'user_id',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'role',
            type: 'enum',
            enum: ['admin', 'member'],
            default: "'member'",
            isNullable: false,
          },
          {
            name: 'joined_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    )

    // Create messages table
    await queryRunner.createTable(
      new Table({
        name: 'messages',
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
            name: 'user_id',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'content',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'detected_lang',
            type: 'varchar',
            length: '10',
            isNullable: true,
          },
          {
            name: 'is_edited',
            type: 'boolean',
            default: false,
          },
          {
            name: 'previous_content',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    )

    // Create translation_cache table
    await queryRunner.createTable(
      new Table({
        name: 'translation_cache',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'message_id',
            type: 'int',
            isNullable: false,
            isUnique: true,
          },
          {
            name: 'translations',
            type: 'json',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    )

    // Add foreign keys for chat_rooms
    await queryRunner.createForeignKey(
      'chat_rooms',
      new TableForeignKey({
        name: 'FK_chat_rooms_creator_id',
        columnNames: ['creator_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    )

    // Add foreign keys for chat_room_members
    await queryRunner.createForeignKey(
      'chat_room_members',
      new TableForeignKey({
        name: 'FK_chat_room_members_room_id',
        columnNames: ['room_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'chat_rooms',
        onDelete: 'CASCADE',
      }),
    )
    await queryRunner.createForeignKey(
      'chat_room_members',
      new TableForeignKey({
        name: 'FK_chat_room_members_user_id',
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    )

    // Add unique constraint for room_id + user_id in chat_room_members
    await queryRunner.query(
      'ALTER TABLE `chat_room_members` ADD UNIQUE INDEX `UQ_chat_room_members_room_user` (`room_id`, `user_id`)',
    )

    // Add foreign keys for messages
    await queryRunner.createForeignKey(
      'messages',
      new TableForeignKey({
        name: 'FK_messages_room_id',
        columnNames: ['room_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'chat_rooms',
        onDelete: 'CASCADE',
      }),
    )
    await queryRunner.createForeignKey(
      'messages',
      new TableForeignKey({
        name: 'FK_messages_user_id',
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    )

    // Add foreign key for translation_cache
    await queryRunner.createForeignKey(
      'translation_cache',
      new TableForeignKey({
        name: 'FK_translation_cache_message_id',
        columnNames: ['message_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'messages',
        onDelete: 'CASCADE',
      }),
    )

    // Add index on messages.room_id for fast room message queries
    await queryRunner.query('CREATE INDEX `IDX_messages_room_id` ON `messages` (`room_id`)')
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order (respecting foreign keys)
    await queryRunner.dropTable('translation_cache')
    await queryRunner.dropTable('messages')
    await queryRunner.dropTable('chat_room_members')
    await queryRunner.dropTable('chat_rooms')
  }
}
