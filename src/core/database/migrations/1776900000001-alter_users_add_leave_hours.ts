import { MigrationInterface, QueryRunner } from 'typeorm'

export class AlterUsersAddLeaveHours1776900000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN annual_leave_hours DECIMAL(6,2) NULL COMMENT 'Total annual leave hours allocated for the year',
        ADD COLUMN remaining_leave_hours DECIMAL(6,2) NULL COMMENT 'Remaining leave hours available for use'
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        DROP COLUMN annual_leave_hours,
        DROP COLUMN remaining_leave_hours
    `)
  }
}
