import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm'

export class CreateMeetingsTables1775300000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Guard: tables may already exist if created before this migration was tracked
    if (await queryRunner.hasTable('meetings')) return

    await queryRunner.createTable(
      new Table({
        name: 'meetings',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'title',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'host_id',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['scheduled', 'active', 'ended'],
            default: "'scheduled'",
            isNullable: false,
          },
          {
            name: 'livekit_room_name',
            type: 'varchar',
            length: '255',
            isNullable: false,
            isUnique: true,
          },
          {
            name: 'scheduled_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'started_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'ended_at',
            type: 'timestamp',
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

    await queryRunner.createTable(
      new Table({
        name: 'meeting_participants',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'meeting_id',
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
            enum: ['host', 'participant'],
            default: "'participant'",
            isNullable: false,
          },
          {
            name: 'joined_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'left_at',
            type: 'timestamp',
            isNullable: true,
          },
        ],
      }),
      true,
    )

    await queryRunner.createForeignKey(
      'meetings',
      new TableForeignKey({
        name: 'FK_meetings_host_id',
        columnNames: ['host_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    )

    await queryRunner.createForeignKey(
      'meeting_participants',
      new TableForeignKey({
        name: 'FK_meeting_participants_meeting_id',
        columnNames: ['meeting_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'meetings',
        onDelete: 'CASCADE',
      }),
    )

    await queryRunner.createForeignKey(
      'meeting_participants',
      new TableForeignKey({
        name: 'FK_meeting_participants_user_id',
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    )

    await queryRunner.query('CREATE INDEX `IDX_meetings_host_id` ON `meetings` (`host_id`)')
    await queryRunner.query(
      'CREATE INDEX `IDX_meeting_participants_meeting_id` ON `meeting_participants` (`meeting_id`)',
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('meeting_participants')
    await queryRunner.dropTable('meetings')
  }
}
