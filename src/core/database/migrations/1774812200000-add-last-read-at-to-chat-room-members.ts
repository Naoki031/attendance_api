import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddLastReadAtToChatRoomMembers1774812200000 implements MigrationInterface {
  name = 'AddLastReadAtToChatRoomMembers1774812200000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE chat_room_members ADD COLUMN last_read_at DATETIME NULL DEFAULT NULL`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE chat_room_members DROP COLUMN last_read_at`)
  }
}
