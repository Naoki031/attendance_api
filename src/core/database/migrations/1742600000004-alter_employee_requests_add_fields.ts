import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm'

export class AlterEmployeeRequestsAddFields1742600000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('employee_requests', [
      new TableColumn({
        name: 'leave_type',
        type: 'enum',
        enum: [
          'paid_leave',
          'unpaid_leave',
          'woman_leave',
          'marriage_leave',
          'maternity_leave',
          'paternity_leave',
          'compassionate_leave',
        ],
        isNullable: true,
      }),
      new TableColumn({
        name: 'unit_hours',
        type: 'decimal',
        precision: 5,
        scale: 2,
        isNullable: true,
      }),
      new TableColumn({
        name: 'location',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
      new TableColumn({
        name: 'quantity',
        type: 'int',
        isNullable: true,
      }),
      new TableColumn({
        name: 'clock_type',
        type: 'enum',
        enum: ['clock_in', 'clock_out'],
        isNullable: true,
      }),
      new TableColumn({
        name: 'forget_date',
        type: 'date',
        isNullable: true,
      }),
    ])
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('employee_requests', 'forget_date')
    await queryRunner.dropColumn('employee_requests', 'clock_type')
    await queryRunner.dropColumn('employee_requests', 'quantity')
    await queryRunner.dropColumn('employee_requests', 'location')
    await queryRunner.dropColumn('employee_requests', 'unit_hours')
    await queryRunner.dropColumn('employee_requests', 'leave_type')
  }
}
