import { MigrationInterface, QueryRunner } from 'typeorm'

export class AlterUsersRolesNullable1742307600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`users\` MODIFY \`roles\` json NULL`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`users\` MODIFY \`roles\` json NOT NULL`)
  }
}
