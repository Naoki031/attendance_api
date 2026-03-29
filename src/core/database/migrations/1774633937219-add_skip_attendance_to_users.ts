import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddSkipAttendanceToUsers1774633937219 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN skip_attendance TINYINT(1) NOT NULL DEFAULT 0
        COMMENT 'When true, exclude user from attendance tracking (auto-fill absences, device sync)'
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users DROP COLUMN skip_attendance`)
  }
}
