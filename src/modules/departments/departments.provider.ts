import { Department } from './entities/department.entity'
import { DEPARTMENT_REPOSITORY } from 'src/core/constants/repository'

export const departmentsProviders = [
  {
    provide: DEPARTMENT_REPOSITORY,
    useValue: Department,
  },
]
