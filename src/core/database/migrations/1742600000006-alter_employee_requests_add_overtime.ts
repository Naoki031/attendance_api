import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm'

export class AlterEmployeeRequestsAddOvertime1742600000006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Extend the type enum to include 'overtime'
    await queryRunner.query(
      `ALTER TABLE \`employee_requests\` MODIFY COLUMN \`type\` ENUM('wfh','off','equipment','clock_forget','overtime') NOT NULL`,
    )

    // Extend the slack_channels feature enum to include 'overtime'
    await queryRunner.query(
      `ALTER TABLE \`slack_channels\` MODIFY COLUMN \`feature\` ENUM('wfh','off','equipment','clock_forget','overtime') NOT NULL`,
    )

    // Add overtime_type column
    await queryRunner.addColumn(
      'employee_requests',
      new TableColumn({
        name: 'overtime_type',
        type: 'enum',
        enum: ['weekday', 'weekend', 'public_holiday'],
        isNullable: true,
      }),
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('employee_requests', 'overtime_type')

    await queryRunner.query(
      `ALTER TABLE \`slack_channels\` MODIFY COLUMN \`feature\` ENUM('wfh','off','equipment','clock_forget') NOT NULL`,
    )

    await queryRunner.query(
      `ALTER TABLE \`employee_requests\` MODIFY COLUMN \`type\` ENUM('wfh','off','equipment','clock_forget') NOT NULL`,
    )
  }
}
