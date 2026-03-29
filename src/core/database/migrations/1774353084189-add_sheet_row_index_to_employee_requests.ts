import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm'

export class AddSheetRowIndexToEmployeeRequests1774353084189 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'employee_requests',
      new TableColumn({
        name: 'sheet_row_index',
        type: 'int',
        isNullable: true,
        default: null,
        comment: 'Row index in Google Sheet for approval update',
      }),
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('employee_requests', 'sheet_row_index')
  }
}
