import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateAlbumMembersTable1777300000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS memory_album_members (
        album_id  VARCHAR(36)  NOT NULL,
        user_id   INT          NOT NULL,
        PRIMARY KEY (album_id, user_id),
        INDEX IDX_album_members_album_id (album_id),
        INDEX IDX_album_members_user_id (user_id),
        CONSTRAINT FK_album_members_album
          FOREIGN KEY (album_id) REFERENCES memory_albums (id) ON DELETE CASCADE,
        CONSTRAINT FK_album_members_user
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    // Migrate existing CSV data from member_ids column (only if column still exists)
    const [colRow] = (await queryRunner.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'memory_albums' AND COLUMN_NAME = 'member_ids'`,
    )) as [{ cnt: string }]

    if (parseInt(colRow.cnt, 10) > 0) {
      const albums = (await queryRunner.query(
        `SELECT id, member_ids FROM memory_albums WHERE member_ids IS NOT NULL AND member_ids != ''`,
      )) as Array<{ id: string; member_ids: string | null }>

      for (const album of albums) {
        const ids = (album.member_ids ?? '')
          .split(',')
          .map((string_: string) => string_.trim())
          .filter(
            (string_: string) =>
              string_.length > 0 && !isNaN(Number(string_)) && Number(string_) > 0,
          )

        for (const userId of ids) {
          await queryRunner.query(
            `INSERT IGNORE INTO memory_album_members (album_id, user_id) VALUES (?, ?)`,
            [album.id, Number(userId)],
          )
        }
      }

      await queryRunner.query(`ALTER TABLE memory_albums DROP COLUMN member_ids`)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE memory_albums ADD COLUMN member_ids TEXT NULL AFTER created_by_id`,
    )

    const rows = (await queryRunner.query(
      `SELECT album_id, user_id FROM memory_album_members ORDER BY album_id, user_id`,
    )) as Array<{ album_id: string; user_id: number }>

    const grouped = new Map<string, number[]>()
    for (const row of rows) {
      if (!grouped.has(row.album_id)) grouped.set(row.album_id, [])
      grouped.get(row.album_id)!.push(row.user_id)
    }

    for (const [albumId, userIds] of grouped) {
      await queryRunner.query(`UPDATE memory_albums SET member_ids = ? WHERE id = ?`, [
        userIds.join(','),
        albumId,
      ])
    }

    await queryRunner.query(`DROP TABLE IF EXISTS memory_album_members`)
  }
}
