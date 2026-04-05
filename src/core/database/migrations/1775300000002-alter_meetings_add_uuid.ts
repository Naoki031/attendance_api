import { MigrationInterface, QueryRunner } from 'typeorm'

export class AlterMeetingsAddUuid1775300000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('meetings', 'uuid')) return

    await queryRunner.query(
      `ALTER TABLE \`meetings\` ADD COLUMN \`uuid\` VARCHAR(36) NULL AFTER \`id\``,
    )

    // Backfill existing rows with a uuid
    await queryRunner.query(`UPDATE \`meetings\` SET \`uuid\` = UUID() WHERE \`uuid\` IS NULL`)

    await queryRunner.query(`ALTER TABLE \`meetings\` MODIFY COLUMN \`uuid\` VARCHAR(36) NOT NULL`)

    await queryRunner.query(
      `ALTER TABLE \`meetings\` ADD UNIQUE INDEX \`UQ_meetings_uuid\` (\`uuid\`)`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`meetings\` DROP INDEX \`UQ_meetings_uuid\``)
    await queryRunner.query(`ALTER TABLE \`meetings\` DROP COLUMN \`uuid\``)
  }
}
