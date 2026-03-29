import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm'

export class AlterUsersAddSlackId1742600000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'slack_id',
        type: 'varchar',
        length: '100',
        isNullable: true,
      }),
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'slack_id')
  }
}
