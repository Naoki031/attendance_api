import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateMemoriesTables1777300000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS memory_albums (
        id           VARCHAR(36) NOT NULL,
        title        VARCHAR(255) NOT NULL,
        description  TEXT NULL,
        event_type   VARCHAR(50) NOT NULL,
        cover_photo_id VARCHAR(36) NULL,
        date         VARCHAR(20) NOT NULL,
        privacy      VARCHAR(20) NOT NULL DEFAULT 'public',
        created_by   VARCHAR(255) NOT NULL,
        member_ids   JSON NULL,
        photo_count  INT NOT NULL DEFAULT 0,
        created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at   TIMESTAMP NULL,
        PRIMARY KEY (id),
        INDEX IDX_memory_albums_privacy (privacy),
        INDEX IDX_memory_albums_event_type (event_type),
        INDEX IDX_memory_albums_created_by (created_by),
        INDEX IDX_memory_albums_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS memory_photos (
        id             VARCHAR(36) NOT NULL,
        album_id       VARCHAR(36) NOT NULL,
        url            VARCHAR(500) NOT NULL,
        thumbnail_url  VARCHAR(500) NOT NULL,
        caption        TEXT NULL,
        uploaded_by    VARCHAR(255) NOT NULL,
        width          INT NOT NULL DEFAULT 0,
        height         INT NOT NULL DEFAULT 0,
        size           BIGINT NOT NULL DEFAULT 0,
        mime_type      VARCHAR(50) NOT NULL DEFAULT 'image/jpeg',
        created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at     TIMESTAMP NULL,
        PRIMARY KEY (id),
        INDEX IDX_memory_photos_album_id (album_id),
        INDEX IDX_memory_photos_uploaded_by (uploaded_by),
        INDEX IDX_memory_photos_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS memory_reactions (
        id         VARCHAR(36) NOT NULL,
        photo_id   VARCHAR(36) NOT NULL,
        user_id    VARCHAR(255) NOT NULL,
        type       VARCHAR(20) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY UQ_memory_reactions_photo_user_type (photo_id, user_id, type),
        INDEX IDX_memory_reactions_photo_id (photo_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS memory_comments (
        id         VARCHAR(36) NOT NULL,
        photo_id   VARCHAR(36) NOT NULL,
        user_id    VARCHAR(255) NOT NULL,
        text       TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX IDX_memory_comments_photo_id (photo_id),
        INDEX IDX_memory_comments_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS memory_comments`)
    await queryRunner.query(`DROP TABLE IF EXISTS memory_reactions`)
    await queryRunner.query(`DROP TABLE IF EXISTS memory_photos`)
    await queryRunner.query(`DROP TABLE IF EXISTS memory_albums`)
  }
}
