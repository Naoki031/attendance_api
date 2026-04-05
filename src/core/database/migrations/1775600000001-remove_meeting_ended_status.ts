import { MigrationInterface, QueryRunner } from 'typeorm'

export class RemoveMeetingEndedStatus1775600000001 implements MigrationInterface {
  name = 'RemoveMeetingEndedStatus1775600000001'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Reset any ENDED meetings back to SCHEDULED (rooms are reusable)
    await queryRunner.query(`UPDATE meetings SET status = 'scheduled' WHERE status = 'ended'`)

    // Remove 'ended' from the enum — MariaDB requires re-specifying the full enum
    await queryRunner.query(`
      ALTER TABLE meetings
        MODIFY COLUMN status ENUM('scheduled', 'active') NOT NULL DEFAULT 'scheduled'
    `)

    // Drop ended_at column (no longer needed — rooms are reused, never truly "end")
    await queryRunner.query(`ALTER TABLE meetings DROP COLUMN ended_at`)

    // Remove duplicate participant rows before adding unique constraint
    await queryRunner.query(`
      DELETE mp1 FROM meeting_participants mp1
      INNER JOIN meeting_participants mp2
        ON mp1.meeting_id = mp2.meeting_id
        AND mp1.user_id = mp2.user_id
        AND mp1.id > mp2.id
    `)

    // Add unique constraint to prevent duplicate participant records
    await queryRunner.query(`
      ALTER TABLE meeting_participants
        ADD UNIQUE INDEX UQ_meeting_user (meeting_id, user_id)
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop unique constraint
    await queryRunner.query(`
      ALTER TABLE meeting_participants DROP INDEX UQ_meeting_user
    `)

    // Re-add ended_at column
    await queryRunner.query(`
      ALTER TABLE meetings
        ADD COLUMN ended_at TIMESTAMP NULL AFTER started_at
    `)

    // Restore the enum with 'ended'
    await queryRunner.query(`
      ALTER TABLE meetings
        MODIFY COLUMN status ENUM('scheduled', 'active', 'ended') NOT NULL DEFAULT 'scheduled'
    `)
  }
}
