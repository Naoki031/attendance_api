import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddDetectedLanguageToMemoryComments1776504107977 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE memory_comments ADD COLUMN detected_language VARCHAR(10) NULL DEFAULT NULL AFTER text`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE memory_comments DROP COLUMN detected_language`)
  }
}
