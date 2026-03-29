import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm'

export class CreateEmployeeRequestsTable1742600000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'employee_requests',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
            isNullable: false,
          },
          {
            name: 'user_id',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'approver_id',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'type',
            type: 'enum',
            enum: ['wfh', 'off', 'equipment', 'clock_forget'],
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'approved', 'rejected'],
            default: "'pending'",
            isNullable: false,
          },
          {
            name: 'from_datetime',
            type: 'datetime',
            isNullable: true,
          },
          {
            name: 'to_datetime',
            type: 'datetime',
            isNullable: true,
          },
          {
            name: 'reason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'cc_user_ids',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'equipment_name',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'note',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: true,
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: true,
          },
          {
            name: 'deleted_at',
            type: 'timestamp',
            isNullable: true,
          },
        ],
      }),
      true,
    )

    await queryRunner.createForeignKey(
      'employee_requests',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    )

    await queryRunner.createForeignKey(
      'employee_requests',
      new TableForeignKey({
        columnNames: ['approver_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('employee_requests')
    const userForeignKey = table!.foreignKeys.find((fk) => fk.columnNames.includes('user_id'))
    const approverForeignKey = table!.foreignKeys.find((fk) =>
      fk.columnNames.includes('approver_id'),
    )
    if (userForeignKey) await queryRunner.dropForeignKey('employee_requests', userForeignKey)
    if (approverForeignKey)
      await queryRunner.dropForeignKey('employee_requests', approverForeignKey)
    await queryRunner.dropTable('employee_requests')
  }
}
