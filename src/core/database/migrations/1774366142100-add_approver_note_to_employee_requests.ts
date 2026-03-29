import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddApproverNoteToEmployeeRequests1774366142100 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE employee_requests ADD COLUMN approver_note TEXT NULL AFTER note`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE employee_requests DROP COLUMN approver_note`)
  }
}
