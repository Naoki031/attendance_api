import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddDeletedAtToChatRooms1774800512383 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE chat_rooms ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE chat_rooms DROP COLUMN deleted_at`)
  }
}
