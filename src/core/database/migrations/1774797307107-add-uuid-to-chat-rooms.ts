import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddUuidToChatRooms1774797307107 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE chat_rooms ADD COLUMN uuid CHAR(36) NULL`)
    await queryRunner.query(`UPDATE chat_rooms SET uuid = UUID() WHERE uuid IS NULL`)
    await queryRunner.query(`ALTER TABLE chat_rooms MODIFY COLUMN uuid CHAR(36) NOT NULL`)
    await queryRunner.query(`ALTER TABLE chat_rooms ADD UNIQUE INDEX idx_chat_rooms_uuid (uuid)`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE chat_rooms DROP INDEX idx_chat_rooms_uuid`)
    await queryRunner.query(`ALTER TABLE chat_rooms DROP COLUMN uuid`)
  }
}
