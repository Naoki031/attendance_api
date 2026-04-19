import { MigrationInterface, QueryRunner } from 'typeorm'

export class ReplaceLikedByIdsWithReactionsOnMemoryComments1776501137029 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const [tableRow] = (await queryRunner.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'memory_comments'`,
    )) as [{ cnt: string }]
    if (parseInt(tableRow.cnt, 10) === 0) return

    const [likedColRow] = (await queryRunner.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'memory_comments' AND COLUMN_NAME = 'liked_by_ids'`,
    )) as [{ cnt: string }]
    if (parseInt(likedColRow.cnt, 10) > 0) {
      await queryRunner.query(`ALTER TABLE memory_comments DROP COLUMN liked_by_ids`)
    }

    const [reactionsColRow] = (await queryRunner.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'memory_comments' AND COLUMN_NAME = 'reactions'`,
    )) as [{ cnt: string }]
    if (parseInt(reactionsColRow.cnt, 10) > 0) return

    await queryRunner.query(
      `ALTER TABLE memory_comments ADD COLUMN reactions JSON NULL DEFAULT NULL`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE memory_comments DROP COLUMN IF EXISTS reactions`)
    await queryRunner.query(
      `ALTER TABLE memory_comments ADD COLUMN liked_by_ids JSON NULL DEFAULT NULL`,
    )
  }
}
