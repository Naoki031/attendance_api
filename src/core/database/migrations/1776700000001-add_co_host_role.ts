import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddCoHostRole1776700000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`meeting_participants\`
        MODIFY COLUMN \`role\`
        ENUM('host', 'co_host', 'participant')
        NOT NULL DEFAULT 'participant'
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Downgrade co_host rows to participant before removing the enum value —
    // MariaDB rejects MODIFY COLUMN if existing rows still hold the removed value.
    await queryRunner.query(`
      UPDATE \`meeting_participants\`
        SET \`role\` = 'participant'
        WHERE \`role\` = 'co_host'
    `)
    await queryRunner.query(`
      ALTER TABLE \`meeting_participants\`
        MODIFY COLUMN \`role\`
        ENUM('host', 'participant')
        NOT NULL DEFAULT 'participant'
    `)
  }
}
