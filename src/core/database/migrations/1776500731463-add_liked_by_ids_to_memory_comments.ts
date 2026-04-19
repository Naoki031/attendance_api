import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddLikedByIdsToMemoryComments1776500731463 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const [tableRow] = (await queryRunner.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'memory_comments'`,
    )) as [{ cnt: string }]
    if (parseInt(tableRow.cnt, 10) === 0) return

    const [colRow] = (await queryRunner.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'memory_comments' AND COLUMN_NAME = 'liked_by_ids'`,
    )) as [{ cnt: string }]
    if (parseInt(colRow.cnt, 10) > 0) return

    await queryRunner.query(
      `ALTER TABLE memory_comments ADD COLUMN liked_by_ids JSON NULL DEFAULT NULL`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE memory_comments DROP COLUMN IF EXISTS liked_by_ids`)
  }
}
