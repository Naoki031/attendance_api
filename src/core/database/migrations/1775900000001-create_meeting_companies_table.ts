import type { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateMeetingCompaniesTable1775900000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`meeting_companies\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`meeting_id\` INT NOT NULL,
        \`company_id\` INT NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_meeting_companies\` (\`meeting_id\`, \`company_id\`),
        CONSTRAINT \`FK_meeting_companies_meeting\` FOREIGN KEY (\`meeting_id\`) REFERENCES \`meetings\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_meeting_companies_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`meeting_companies\``)
  }
}
