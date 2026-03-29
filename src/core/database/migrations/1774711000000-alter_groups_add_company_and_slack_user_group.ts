import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm'

export class AlterGroupsAddCompanyAndSlackUserGroup1774711000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('groups', [
      new TableColumn({
        name: 'slack_user_group_id',
        type: 'varchar',
        length: '50',
        isNullable: true,
      }),
      new TableColumn({
        name: 'company_id',
        type: 'int',
        isNullable: true,
      }),
    ])
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('groups', 'slack_user_group_id')
    await queryRunner.dropColumn('groups', 'company_id')
  }
}
