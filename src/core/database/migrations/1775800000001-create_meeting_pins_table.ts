import type { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateMeetingPinsTable1775800000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`meeting_pins\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`user_id\` INT NOT NULL,
        \`meeting_id\` INT NOT NULL,
        \`created_at\` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_meeting_pins_user_meeting\` (\`user_id\`, \`meeting_id\`),
        CONSTRAINT \`FK_meeting_pins_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_meeting_pins_meeting\` FOREIGN KEY (\`meeting_id\`) REFERENCES \`meetings\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`meeting_pins\``)
  }
}
