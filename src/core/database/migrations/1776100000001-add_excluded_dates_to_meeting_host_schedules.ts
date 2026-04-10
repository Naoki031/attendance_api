import type { MigrationInterface, QueryRunner } from 'typeorm'

export class AddExcludedDatesToMeetingHostSchedules1776100000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`meeting_host_schedules\`
        ADD COLUMN \`excluded_dates\` JSON NULL AFTER \`recur_end_date\`
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`meeting_host_schedules\` DROP COLUMN \`excluded_dates\`
    `)
  }
}
