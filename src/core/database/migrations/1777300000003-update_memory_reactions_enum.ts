import { MigrationInterface, QueryRunner } from 'typeorm'

export class UpdateMemoryReactionsEnum1777300000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`memory_reactions\`
      MODIFY COLUMN \`type\` ENUM('heart','care','laugh','wow','angry','sad') NOT NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE \`memory_reactions\` SET \`type\` = 'heart'
      WHERE \`type\` NOT IN ('heart','clap','wow','laugh')
    `)
    await queryRunner.query(`
      ALTER TABLE \`memory_reactions\`
      MODIFY COLUMN \`type\` ENUM('heart','clap','wow','laugh') NOT NULL
    `)
  }
}
