import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm'

export class AddTripDestinationToEmployeeRequests1775272427305 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add trip_destination column for business trip requests
    await queryRunner.addColumn(
      'employee_requests',
      new TableColumn({
        name: 'trip_destination',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
    )

    // Extend employee_requests.type enum with 'business_trip'
    await queryRunner.query(`
      ALTER TABLE employee_requests
      MODIFY COLUMN type ENUM('wfh','off','equipment','clock_forget','overtime','business_trip') NOT NULL
    `)

    // Extend slack_channels.feature enum with 'business_trip'
    await queryRunner.query(`
      ALTER TABLE slack_channels
      MODIFY COLUMN feature ENUM('wfh','off','equipment','clock_forget','overtime','business_trip','error') NOT NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('employee_requests', 'trip_destination')

    await queryRunner.query(`
      ALTER TABLE employee_requests
      MODIFY COLUMN type ENUM('wfh','off','equipment','clock_forget','overtime') NOT NULL
    `)

    await queryRunner.query(`
      ALTER TABLE slack_channels
      MODIFY COLUMN feature ENUM('wfh','off','equipment','clock_forget','overtime','error') NOT NULL
    `)
  }
}
