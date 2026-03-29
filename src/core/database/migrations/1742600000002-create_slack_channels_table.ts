import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm'

export class CreateSlackChannelsTable1742600000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'slack_channels',
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
            name: 'company_id',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'webhook_url',
            type: 'varchar',
            length: '500',
            isNullable: false,
          },
          {
            name: 'feature',
            type: 'enum',
            enum: ['wfh', 'off', 'equipment', 'clock_forget'],
            isNullable: false,
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
      'slack_channels',
      new TableForeignKey({
        columnNames: ['company_id'],
        referencedTableName: 'companies',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('slack_channels')
    const foreignKey = table!.foreignKeys.find((fk) => fk.columnNames.includes('company_id'))
    if (foreignKey) await queryRunner.dropForeignKey('slack_channels', foreignKey)
    await queryRunner.dropTable('slack_channels')
  }
}
