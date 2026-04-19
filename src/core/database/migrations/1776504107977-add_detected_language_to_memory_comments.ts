import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddDetectedLanguageToMemoryComments1776504107977 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const [tableRow] = (await queryRunner.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'memory_comments'`,
    )) as [{ cnt: string }]
    if (parseInt(tableRow.cnt, 10) === 0) return

    const [colRow] = (await queryRunner.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'memory_comments' AND COLUMN_NAME = 'detected_language'`,
    )) as [{ cnt: string }]
    if (parseInt(colRow.cnt, 10) > 0) return

    await queryRunner.query(
      `ALTER TABLE memory_comments ADD COLUMN detected_language VARCHAR(10) NULL DEFAULT NULL AFTER text`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE memory_comments DROP COLUMN IF EXISTS detected_language`)
  }
}
