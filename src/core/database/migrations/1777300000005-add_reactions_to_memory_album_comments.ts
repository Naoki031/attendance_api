import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddReactionsToMemoryAlbumComments1777300000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE memory_album_comments
      ADD COLUMN reactions JSON NULL DEFAULT NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE memory_album_comments
      DROP COLUMN reactions
    `)
  }
}
