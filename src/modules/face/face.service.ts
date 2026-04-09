import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { User } from '@/modules/users/entities/user.entity'

const FACE_MATCH_THRESHOLD = 0.55

// If the best and second-best match are within this margin, the result is
// ambiguous and must be rejected to prevent clocking in the wrong employee.
const AMBIGUITY_MARGIN = 0.08

export interface MatchResult {
  employeeId: number
  employeeName: string
  employeeCode: string
  distance: number
  confidence: number
}

@Injectable()
export class FaceService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Finds the best matching employee for the given face descriptor.
   * Returns null if no employee is within the match threshold.
   */
  async matchFace(incomingDescriptor: number[]): Promise<MatchResult | null> {
    const candidates = await this.userRepository
      .createQueryBuilder('user')
      .where('user.is_activated = :activated', { activated: true })
      .andWhere('user.kyc_status = :kycStatus', { kycStatus: 'approved' })
      .andWhere('user.face_descriptor IS NOT NULL')
      .andWhere('user.deleted_at IS NULL')
      .select([
        'user.id',
        'user.first_name',
        'user.last_name',
        'user.username',
        'user.face_descriptor',
      ])
      .getMany()

    let bestMatch: MatchResult | null = null
    let bestDistance = FACE_MATCH_THRESHOLD
    let secondBestDistance = FACE_MATCH_THRESHOLD

    for (const user of candidates) {
      if (!user.face_descriptor || user.face_descriptor.length !== 128) continue

      const distance = this.euclideanDistance(
        new Float32Array(incomingDescriptor),
        new Float32Array(user.face_descriptor),
      )

      if (distance < bestDistance) {
        secondBestDistance = bestDistance
        bestDistance = distance
        bestMatch = {
          employeeId: user.id,
          employeeName: `${user.first_name} ${user.last_name}`,
          employeeCode: user.username,
          distance,
          confidence: parseFloat((1 - distance).toFixed(4)),
        }
      } else if (distance < secondBestDistance) {
        secondBestDistance = distance
      }
    }

    // Reject ambiguous matches: if the top 2 candidates are too close,
    // we cannot confidently identify the person — returning null prevents
    // clocking in the wrong employee.
    if (bestMatch && secondBestDistance - bestMatch.distance < AMBIGUITY_MARGIN) {
      return null
    }

    return bestMatch
  }

  /**
   * Computes the Euclidean distance between two 128-dimension face descriptors.
   */
  private euclideanDistance(descriptorA: Float32Array, descriptorB: Float32Array): number {
    let sum = 0

    for (let index = 0; index < descriptorA.length; index++) {
      const diff = descriptorA[index] - descriptorB[index]
      sum += diff * diff
    }

    return Math.sqrt(sum)
  }
}
