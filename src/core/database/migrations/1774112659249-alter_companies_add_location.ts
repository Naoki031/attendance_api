import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from 'typeorm'

export class AlterCompaniesAddLocation1774112659249 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('companies', [
      new TableColumn({
        name: 'country_id',
        type: 'int',
        isNullable: true,
      }),
      new TableColumn({
        name: 'city_id',
        type: 'int',
        isNullable: true,
      }),
    ])

    await queryRunner.createForeignKey(
      'companies',
      new TableForeignKey({
        columnNames: ['country_id'],
        referencedTableName: 'countries',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    )

    await queryRunner.createForeignKey(
      'companies',
      new TableForeignKey({
        columnNames: ['city_id'],
        referencedTableName: 'cities',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('companies')

    const countryForeignKey = table!.foreignKeys.find((fk) => fk.columnNames.includes('country_id'))
    const cityForeignKey = table!.foreignKeys.find((fk) => fk.columnNames.includes('city_id'))

    if (countryForeignKey) await queryRunner.dropForeignKey('companies', countryForeignKey)
    if (cityForeignKey) await queryRunner.dropForeignKey('companies', cityForeignKey)

    await queryRunner.dropColumn('companies', 'country_id')
    await queryRunner.dropColumn('companies', 'city_id')
  }
}
