import type { MigrationInterface, QueryRunner } from 'typeorm'

export class AddUserDepartmentsCompanyUserIndex1776000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`user_departments\`
        ADD INDEX \`IDX_user_departments_company_user\` (\`company_id\`, \`user_id\`)
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`user_departments\` DROP INDEX \`IDX_user_departments_company_user\`
    `)
  }
}
