import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

export interface FeatureFlags {
  qrCheckin: boolean
  faceCheckin: boolean
}

@Injectable()
export class FeaturesService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Returns feature flags for the given user.
   * Features disabled via env are still available to test users (TEST_USER_IDS).
   */
  getFeatures(userId: number): FeatureFlags {
    const testUserIds = (this.configService.get<string>('TEST_USER_IDS') ?? '')
      .split(',')
      .map((rawId) => parseInt(rawId.trim(), 10))
      .filter((parsedId) => !isNaN(parsedId))

    const isTestUser = testUserIds.includes(userId)
    const qrEnabled = this.configService.get<string>('FEATURE_QR_CHECKIN') !== 'false'
    const faceEnabled = this.configService.get<string>('FEATURE_FACE_CHECKIN') !== 'false'

    return {
      qrCheckin: qrEnabled || isTestUser,
      faceCheckin: faceEnabled || isTestUser,
    }
  }
}
