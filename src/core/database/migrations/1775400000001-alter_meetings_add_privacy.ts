import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm'

export class AlterMeetingsAddPrivacy1775400000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('meetings', 'is_private')) return

    await queryRunner.addColumns('meetings', [
      new TableColumn({
        name: 'is_private',
        type: 'tinyint',
        default: 0,
        isNullable: false,
      }),
      new TableColumn({
        name: 'password_hash',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
    ])
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('meetings', 'password_hash')
    await queryRunner.dropColumn('meetings', 'is_private')
  }
}
