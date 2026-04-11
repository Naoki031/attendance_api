import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateMeetingScheduledParticipantsTables1776300000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // meeting_scheduled_participants
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS meeting_scheduled_participants (
        id          INT          NOT NULL AUTO_INCREMENT,
        meeting_id  INT          NOT NULL,
        user_id     INT          NOT NULL,
        invited_by  INT          NOT NULL,
        status      ENUM('pending','accepted','declined') NOT NULL DEFAULT 'pending',
        rsvp_token  VARCHAR(64)  NULL DEFAULT NULL,
        created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY UQ_msp_meeting_user (meeting_id, user_id),
        UNIQUE KEY UQ_msp_rsvp_token (rsvp_token),
        CONSTRAINT FK_msp_meeting
          FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
        CONSTRAINT FK_msp_user
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT FK_msp_invited_by
          FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE
      )
    `)

    // meeting_auto_call_configs
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS meeting_auto_call_configs (
        id                      INT          NOT NULL AUTO_INCREMENT,
        meeting_id              INT          NOT NULL,
        minutes_before          TINYINT UNSIGNED NOT NULL DEFAULT 5,
        retry_count             TINYINT UNSIGNED NOT NULL DEFAULT 0,
        retry_interval_minutes  TINYINT UNSIGNED NOT NULL DEFAULT 2,
        is_enabled              TINYINT(1)   NOT NULL DEFAULT 1,
        created_at              TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at              TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY UQ_macc_meeting (meeting_id),
        CONSTRAINT FK_macc_meeting
          FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
      )
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS meeting_auto_call_configs`)
    await queryRunner.query(`DROP TABLE IF EXISTS meeting_scheduled_participants`)
  }
}
