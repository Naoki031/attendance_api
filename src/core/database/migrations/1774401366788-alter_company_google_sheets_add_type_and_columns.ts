import { MigrationInterface, QueryRunner } from 'typeorm'

export class AlterCompanyGoogleSheetsAddTypeAndColumns1774401366788 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add request_type column if it doesn't exist yet
    const hasRequestType = await queryRunner.query(`
      SELECT COUNT(*) AS count FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_google_sheets' AND COLUMN_NAME = 'request_type'
    `)
    if (Number(hasRequestType[0].count) === 0) {
      await queryRunner.query(`
        ALTER TABLE company_google_sheets
          ADD COLUMN request_type VARCHAR(50) NOT NULL DEFAULT 'all' AFTER company_id
      `)
    }

    // Add column_config column if it doesn't exist yet
    const hasColumnConfig = await queryRunner.query(`
      SELECT COUNT(*) AS count FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_google_sheets' AND COLUMN_NAME = 'column_config'
    `)
    if (Number(hasColumnConfig[0].count) === 0) {
      await queryRunner.query(`
        ALTER TABLE company_google_sheets
          ADD COLUMN column_config JSON NULL AFTER sheet_name
      `)
    }

    // Drop old unique constraint on company_id alone (FK must be dropped first)
    const hasOldUniqueIndex = await queryRunner.query(`
      SELECT COUNT(*) AS count FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_google_sheets'
        AND INDEX_NAME = 'company_id' AND NON_UNIQUE = 0
    `)
    if (Number(hasOldUniqueIndex[0].count) > 0) {
      // Drop FK constraint that references the unique index
      await queryRunner.query(`
        ALTER TABLE company_google_sheets
          DROP FOREIGN KEY fk_company_google_sheets_company
      `)

      // Drop the unique index on company_id alone
      await queryRunner.query(`
        ALTER TABLE company_google_sheets DROP INDEX \`company_id\`
      `)

      // Re-add the FK (now backed by the composite unique key below)
      await queryRunner.query(`
        ALTER TABLE company_google_sheets
          ADD CONSTRAINT fk_company_google_sheets_company
            FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
      `)
    }

    // Add new unique constraint on (company_id, request_type) if not already present
    const hasNewUniqueIndex = await queryRunner.query(`
      SELECT COUNT(*) AS count FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_google_sheets'
        AND INDEX_NAME = 'UQ_company_request_type'
    `)
    if (Number(hasNewUniqueIndex[0].count) === 0) {
      await queryRunner.query(`
        ALTER TABLE company_google_sheets
          ADD CONSTRAINT UQ_company_request_type UNIQUE (company_id, request_type)
      `)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE company_google_sheets DROP INDEX UQ_company_request_type
    `)

    // Restore unique constraint on company_id alone (drop FK first)
    await queryRunner.query(`
      ALTER TABLE company_google_sheets
        DROP FOREIGN KEY fk_company_google_sheets_company
    `)

    await queryRunner.query(`
      ALTER TABLE company_google_sheets
        ADD CONSTRAINT \`company_id\` UNIQUE (company_id)
    `)

    await queryRunner.query(`
      ALTER TABLE company_google_sheets
        ADD CONSTRAINT fk_company_google_sheets_company
          FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    `)

    await queryRunner.query(`
      ALTER TABLE company_google_sheets
        DROP COLUMN column_config,
        DROP COLUMN request_type
    `)
  }
}
