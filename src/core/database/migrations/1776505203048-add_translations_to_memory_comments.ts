import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddTranslationsToMemoryComments1776505203048 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE memory_comments ADD COLUMN translations JSON NULL DEFAULT NULL AFTER detected_language`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE memory_comments DROP COLUMN translations`)
  }
}
