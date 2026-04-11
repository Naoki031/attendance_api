import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddMeetingIdToChatRooms1775840223147 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE chat_rooms
      ADD COLUMN meeting_id INT NULL,
      ADD CONSTRAINT FK_chat_rooms_meeting
        FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE SET NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE chat_rooms
      DROP FOREIGN KEY FK_chat_rooms_meeting,
      DROP COLUMN meeting_id
    `)
  }
}
