import { MigrationInterface, QueryRunner } from 'typeorm'

export class RecreateMemoriesTables1777300000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop old tables (wrong schema from previous migration)
    await queryRunner.query(`DROP TABLE IF EXISTS memory_comments`)
    await queryRunner.query(`DROP TABLE IF EXISTS memory_reactions`)
    await queryRunner.query(`DROP TABLE IF EXISTS memory_photos`)
    await queryRunner.query(`DROP TABLE IF EXISTS memory_albums`)

    // Create memory_albums (without cover_photo_id FK — circular dep resolved below)
    await queryRunner.query(`
      CREATE TABLE memory_albums (
        id            VARCHAR(36)   NOT NULL,
        title         VARCHAR(200)  NOT NULL,
        description   TEXT          NULL,
        event_type    ENUM('team_building','birthday','trip','award','launch','other')
                      NOT NULL DEFAULT 'other',
        cover_photo_id VARCHAR(36)  NULL,
        date          DATE          NOT NULL,
        privacy       ENUM('public','private') NOT NULL DEFAULT 'public',
        created_by_id INT           NOT NULL,
        member_ids    TEXT          NULL,
        photo_count   INT           NOT NULL DEFAULT 0,
        created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX IDX_memory_albums_privacy (privacy),
        INDEX IDX_memory_albums_event_type (event_type),
        INDEX IDX_memory_albums_created_by_id (created_by_id),
        INDEX IDX_memory_albums_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    // Create memory_photos with FK → memory_albums
    await queryRunner.query(`
      CREATE TABLE memory_photos (
        id              VARCHAR(36)   NOT NULL,
        album_id        VARCHAR(36)   NOT NULL,
        url             VARCHAR(500)  NOT NULL,
        thumbnail_url   VARCHAR(500)  NULL,
        caption         TEXT          NULL,
        uploaded_by_id  INT           NOT NULL,
        width           INT           NULL,
        height          INT           NULL,
        size            BIGINT        NOT NULL DEFAULT 0,
        mime_type       VARCHAR(100)  NOT NULL,
        created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT FK_memory_photos_album
          FOREIGN KEY (album_id) REFERENCES memory_albums (id) ON DELETE CASCADE,
        CONSTRAINT FK_memory_photos_user
          FOREIGN KEY (uploaded_by_id) REFERENCES users (id),
        INDEX IDX_memory_photos_album_id (album_id),
        INDEX IDX_memory_photos_uploaded_by_id (uploaded_by_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    // Create memory_reactions with unique (photo_id, user_id) — one reaction per user per photo
    await queryRunner.query(`
      CREATE TABLE memory_reactions (
        id         VARCHAR(36) NOT NULL,
        photo_id   VARCHAR(36) NOT NULL,
        user_id    INT UNSIGNED NOT NULL,
        type       ENUM('heart','care','laugh','wow','angry','sad') NOT NULL,
        created_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY UQ_memory_reactions_photo_user (photo_id, user_id),
        CONSTRAINT FK_memory_reactions_photo
          FOREIGN KEY (photo_id) REFERENCES memory_photos (id) ON DELETE CASCADE,
        CONSTRAINT FK_memory_reactions_user
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        INDEX IDX_memory_reactions_photo_id (photo_id),
        INDEX IDX_memory_reactions_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    // Create memory_comments
    await queryRunner.query(`
      CREATE TABLE memory_comments (
        id         VARCHAR(36)  NOT NULL,
        photo_id   VARCHAR(36)  NOT NULL,
        user_id    INT UNSIGNED NOT NULL,
        text       TEXT         NOT NULL,
        created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT FK_memory_comments_photo
          FOREIGN KEY (photo_id) REFERENCES memory_photos (id) ON DELETE CASCADE,
        CONSTRAINT FK_memory_comments_user
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        INDEX IDX_memory_comments_photo_id (photo_id),
        INDEX IDX_memory_comments_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    // Add FK: albums.cover_photo_id → photos.id (SET NULL on delete)
    // Check first to avoid constraint collision
    const [rows] = (await queryRunner.query(`
      SELECT COUNT(*) AS cnt
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME   = 'memory_albums'
        AND CONSTRAINT_NAME = 'FK_memory_albums_cover_photo'
    `)) as [{ cnt: string }]

    if (parseInt(rows.cnt, 10) === 0) {
      await queryRunner.query(`
        ALTER TABLE memory_albums
          ADD CONSTRAINT FK_memory_albums_cover_photo
            FOREIGN KEY (cover_photo_id) REFERENCES memory_photos (id) ON DELETE SET NULL
      `)
    }

    // Add FK: albums.created_by_id → users.id
    const [rows2] = (await queryRunner.query(`
      SELECT COUNT(*) AS cnt
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME   = 'memory_albums'
        AND CONSTRAINT_NAME = 'FK_memory_albums_user'
    `)) as [{ cnt: string }]

    if (parseInt(rows2.cnt, 10) === 0) {
      await queryRunner.query(`
        ALTER TABLE memory_albums
          ADD CONSTRAINT FK_memory_albums_user
            FOREIGN KEY (created_by_id) REFERENCES users (id)
      `)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS memory_comments`)
    await queryRunner.query(`DROP TABLE IF EXISTS memory_reactions`)
    await queryRunner.query(`DROP TABLE IF EXISTS memory_photos`)
    await queryRunner.query(`
      ALTER TABLE memory_albums
        DROP FOREIGN KEY IF EXISTS FK_memory_albums_cover_photo,
        DROP FOREIGN KEY IF EXISTS FK_memory_albums_user
    `)
    await queryRunner.query(`DROP TABLE IF EXISTS memory_albums`)
  }
}
