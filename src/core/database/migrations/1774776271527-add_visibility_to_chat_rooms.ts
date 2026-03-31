import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm'

export class AddVisibilityToChatRooms1774776271527 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'chat_rooms',
      new TableColumn({
        name: 'visibility',
        type: 'enum',
        enum: ['public', 'private'],
        default: "'public'",
        isNullable: false,
      }),
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('chat_rooms', 'visibility')
  }
}
