import { Controller, Get } from '@nestjs/common'
import { FeaturesService } from './features.service'
import { User } from '@/modules/auth/decorators/user.decorator'
import type { User as UserEntity } from '@/modules/users/entities/user.entity'

@Controller('features')
export class FeaturesController {
  constructor(private readonly featuresService: FeaturesService) {}

  /**
   * Returns feature flags for the authenticated user.
   * Features disabled via env vars are still available to test users.
   */
  @Get()
  getFeatures(@User() currentUser: UserEntity) {
    return this.featuresService.getFeatures(currentUser.id)
  }
}
