import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateRoomSectionsTable1776500000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS room_sections (
        id          INT           NOT NULL AUTO_INCREMENT,
        user_id     INT           NOT NULL,
        name        VARCHAR(100)  NOT NULL,
        position    INT           NOT NULL DEFAULT 0,
        created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT FK_room_sections_user
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS room_section_items (
        id             INT          NOT NULL AUTO_INCREMENT,
        section_id     INT          NOT NULL,
        resource_type  ENUM('meeting','chat_room') NOT NULL,
        resource_id    INT          NOT NULL,
        created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY UQ_rsi_section_resource (section_id, resource_type, resource_id),
        CONSTRAINT FK_room_section_items_section
          FOREIGN KEY (section_id) REFERENCES room_sections(id) ON DELETE CASCADE
      )
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS room_section_items`)
    await queryRunner.query(`DROP TABLE IF EXISTS room_sections`)
  }
}
