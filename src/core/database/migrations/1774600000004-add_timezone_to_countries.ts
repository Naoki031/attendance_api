import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddTimezoneToCountries1774600000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE countries ADD COLUMN timezone VARCHAR(100) NULL COMMENT 'IANA timezone identifier, e.g. Asia/Ho_Chi_Minh' AFTER longitude`,
    )

    // Seed known timezones for existing countries based on name
    await queryRunner.query(
      `UPDATE countries SET timezone = 'Asia/Ho_Chi_Minh' WHERE slug = 'vietnam' OR name = 'Vietnam'`,
    )
    await queryRunner.query(
      `UPDATE countries SET timezone = 'Asia/Tokyo' WHERE slug = 'japan' OR name = 'Japan'`,
    )
    await queryRunner.query(
      `UPDATE countries SET timezone = 'Asia/Seoul' WHERE slug = 'south-korea' OR name LIKE '%Korea%'`,
    )
    await queryRunner.query(
      `UPDATE countries SET timezone = 'Asia/Singapore' WHERE slug = 'singapore' OR name = 'Singapore'`,
    )
    await queryRunner.query(
      `UPDATE countries SET timezone = 'Asia/Bangkok' WHERE slug = 'thailand' OR name = 'Thailand'`,
    )
    await queryRunner.query(
      `UPDATE countries SET timezone = 'Asia/Shanghai' WHERE slug = 'china' OR name = 'China'`,
    )
    await queryRunner.query(
      `UPDATE countries SET timezone = 'America/New_York' WHERE slug = 'united-states' OR name LIKE '%United States%'`,
    )
    await queryRunner.query(
      `UPDATE countries SET timezone = 'Europe/London' WHERE slug = 'united-kingdom' OR name LIKE '%United Kingdom%'`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE countries DROP COLUMN timezone`)
  }
}
