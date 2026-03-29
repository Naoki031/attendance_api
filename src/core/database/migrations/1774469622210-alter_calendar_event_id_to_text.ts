import { MigrationInterface, QueryRunner } from 'typeorm'

export class AlterCalendarEventIdToText1774469622210 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`employee_requests\` MODIFY COLUMN \`calendar_event_id\` TEXT NULL`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`employee_requests\` MODIFY COLUMN \`calendar_event_id\` VARCHAR(255) NULL`,
    )
  }
}
