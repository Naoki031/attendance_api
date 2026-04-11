import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateMeetingInvitesTable1776200000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS meeting_invites (
        id          INT          NOT NULL AUTO_INCREMENT,
        meeting_id  INT          NOT NULL,
        user_id     INT          NOT NULL,
        invited_by  INT          NOT NULL,
        status      ENUM('pending','accepted','declined','maybe') NOT NULL DEFAULT 'pending',
        created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY UQ_meeting_invite_user (meeting_id, user_id),
        CONSTRAINT FK_meeting_invites_meeting
          FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
        CONSTRAINT FK_meeting_invites_user
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT FK_meeting_invites_invited_by
          FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE
      )
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS meeting_invites`)
  }
}
