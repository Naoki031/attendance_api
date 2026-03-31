import { DefaultNamingStrategy, NamingStrategyInterface } from 'typeorm'
import { snakeCase } from 'typeorm/util/StringUtils'

export class SnakeNamingStrategy extends DefaultNamingStrategy implements NamingStrategyInterface {
  tableName(targetName: string, userSpecifiedName: string | undefined): string {
    return userSpecifiedName ?? snakeCase(targetName)
  }

  columnName(propertyName: string, customName: string, embeddedPrefixes: string[]): string {
    return snakeCase(embeddedPrefixes.concat(customName || propertyName).join('_'))
  }

  relationName(propertyName: string): string {
    return snakeCase(propertyName)
  }

  joinColumnName(relationName: string, referencedColumnName: string): string {
    return snakeCase(relationName + '_' + referencedColumnName)
  }

  joinTableName(
    firstTableName: string,
    secondTableName: string,
    firstPropertyName: string,
    _secondPropertyName: string,
  ): string {
    return snakeCase(
      firstTableName + '_' + firstPropertyName.replace(/\./gi, '_') + '_' + secondTableName,
    )
  }

  joinTableColumnName(tableName: string, propertyName: string, columnName?: string): string {
    return snakeCase(tableName + '_' + (columnName || propertyName))
  }

  classTableInheritanceParentColumnName(
    parentTableName: string,
    parentTableIdPropertyName: string,
  ): string {
    return snakeCase(parentTableName + '_' + parentTableIdPropertyName)
  }
}
