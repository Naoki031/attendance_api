import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddMissedToMeetingInvites1775900000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE meeting_invites MODIFY COLUMN status ENUM('pending','accepted','declined','maybe','missed') NOT NULL DEFAULT 'pending'`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reset any missed rows to pending before shrinking the enum
    await queryRunner.query(`UPDATE meeting_invites SET status = 'pending' WHERE status = 'missed'`)
    await queryRunner.query(
      `ALTER TABLE meeting_invites MODIFY COLUMN status ENUM('pending','accepted','declined','maybe') NOT NULL DEFAULT 'pending'`,
    )
  }
}
