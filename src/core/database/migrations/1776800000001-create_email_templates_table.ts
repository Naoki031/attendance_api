import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateEmailTemplatesTable1776800000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`email_templates\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`key\` VARCHAR(100) NOT NULL,
        \`subject\` VARCHAR(255) NOT NULL,
        \`body_html\` TEXT NOT NULL,
        \`description\` VARCHAR(500) NULL,
        \`variables\` JSON NULL,
        \`is_system\` TINYINT(1) NOT NULL DEFAULT 0,
        \`company_id\` INT NULL,
        \`created_at\` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deleted_at\` DATETIME(6) NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`IDX_email_templates_key_company\` (\`key\`, \`company_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    await queryRunner.query(`
      ALTER TABLE \`email_templates\`
      ADD CONSTRAINT \`FK_email_templates_company\`
      FOREIGN KEY (\`company_id\`) REFERENCES \`companies\` (\`id\`)
      ON DELETE CASCADE
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`email_templates\` DROP FOREIGN KEY \`FK_email_templates_company\``,
    )
    await queryRunner.dropTable('email_templates')
  }
}
