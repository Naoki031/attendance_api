import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Fix chat timestamps: MariaDB container had TZ=Asia/Ho_Chi_Minh (UTC+7) but
 * TypeORM timezone was '+00:00' (UTC). This caused TIMESTAMP columns to be
 * stored 7 hours behind actual UTC.
 Now with TZ=UTC in docker-compose, new records are stored correctly in UTC.
 This migration adds 7 hours to correct existing chat timestamps.
 */
export class FixChatTimestampsTimezone1774812126200 implements MigrationInterface {
  name = 'FixChatTimestampsTimezone1774812126200'

  public async up(queryRunner: QueryRunner): Promise<void> {
    const chatTables: Array<{ table: string; columns: string[] }> = [
      { table: 'messages', columns: ['created_at', 'updated_at'] },
      { table: 'chat_rooms', columns: ['created_at', 'updated_at', 'deleted_at'] },
    ]

    for (const { table, columns } of chatTables) {
      for (const col of columns) {
        await queryRunner.query(
          `UPDATE \`${table}\` SET \`${col}\` = DATE_ADD(\`${col}\`, INTERVAL 7 HOUR)`,
        )
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const chatTables: Array<{ table: string; columns: string[] }> = [
      { table: 'messages', columns: ['created_at', 'updated_at'] },
      { table: 'chat_rooms', columns: ['created_at', 'updated_at', 'deleted_at'] },
    ]

    for (const { table, columns } of chatTables) {
      for (const col of columns) {
        await queryRunner.query(
          `UPDATE \`${table}\` SET \`${col}\` = DATE_SUB(\`${col}\`, INTERVAL 7 HOUR)`,
        )
      }
    }
  }
}
