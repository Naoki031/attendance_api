import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateCompanyGoogleSheetsTable1774394190862 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE company_google_sheets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL UNIQUE,
        spreadsheet_id VARCHAR(255) NOT NULL,
        sheet_name VARCHAR(100) NOT NULL DEFAULT 'Leave Requests',
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        CONSTRAINT fk_company_google_sheets_company
          FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
      )
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE company_google_sheets`)
  }
}
