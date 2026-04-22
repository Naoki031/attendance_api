import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { IsNull, Repository } from 'typeorm'
import { User } from '@/modules/users/entities/user.entity'

// 1:N search threshold — used only in kiosk mode (super admin, no userId context)
const FACE_MATCH_THRESHOLD = 0.65

// Threshold for 1:1 verification — slightly looser since we only compare
// against one known descriptor, eliminating cross-user ambiguity
const FACE_VERIFY_THRESHOLD = 0.65

// If the best and second-best match are within this margin, the result is
// ambiguous and must be rejected to prevent clocking in the wrong employee.
const AMBIGUITY_MARGIN = 0.05

export interface MatchResult {
  employeeId: number
  employeeName: string
  employeeCode: string
  distance: number
  confidence: number
}

export type MatchFailureReason = 'no_match' | 'ambiguous' | 'no_descriptor'

export interface MatchFailure {
  matched: false
  reason: MatchFailureReason
}

export interface MatchSuccess {
  matched: true
  result: MatchResult
}

@Injectable()
export class FaceService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * 1:1 verification — checks whether the incoming descriptor matches the
   * registered face of a specific user. Much more reliable than 1:N search
   * because cross-user ambiguity is impossible when identity is already known.
   */
  async verifyFace(
    userId: number,
    incomingDescriptor: number[],
  ): Promise<MatchSuccess | MatchFailure> {
    const user = await this.userRepository.findOne({
      where: { id: userId, is_activated: true, kyc_status: 'approved', deleted_at: IsNull() },
      select: ['id', 'first_name', 'last_name', 'username', 'face_descriptor'],
    })

    if (!user?.face_descriptor || user.face_descriptor.length !== 128) {
      console.log(`[FaceVerify] userId=${userId} has no approved descriptor`)
      return { matched: false, reason: 'no_descriptor' }
    }

    const distance = this.euclideanDistance(
      new Float32Array(incomingDescriptor),
      new Float32Array(user.face_descriptor),
    )

    console.log(
      `[FaceVerify] userId=${userId} (${user.username}) distance=${distance.toFixed(4)} threshold=${FACE_VERIFY_THRESHOLD}`,
    )

    if (distance > FACE_VERIFY_THRESHOLD) {
      console.log(
        `[FaceVerify] NO MATCH — distance ${distance.toFixed(4)} > ${FACE_VERIFY_THRESHOLD}`,
      )
      return { matched: false, reason: 'no_match' }
    }

    console.log(`[FaceVerify] VERIFIED ${user.username} distance=${distance.toFixed(4)}`)

    return {
      matched: true,
      result: {
        employeeId: user.id,
        employeeName: `${user.first_name} ${user.last_name}`,
        employeeCode: user.username,
        distance,
        confidence: parseFloat((1 - distance).toFixed(4)),
      },
    }
  }

  /**
   * 1:N search — finds the best matching employee across all approved users.
   * Used only in kiosk/super-admin mode where the caller's identity is unknown.
   */
  async matchFace(incomingDescriptor: number[]): Promise<MatchSuccess | MatchFailure> {
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
    let secondBestDistance = Infinity

    for (const user of candidates) {
      if (!user.face_descriptor || user.face_descriptor.length !== 128) continue

      const distance = this.euclideanDistance(
        new Float32Array(incomingDescriptor),
        new Float32Array(user.face_descriptor),
      )

      console.log(`[FaceMatch] ${user.username} distance=${distance.toFixed(4)}`)

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
      console.log(
        `[FaceMatch] AMBIGUOUS — best=${bestMatch.distance.toFixed(4)} second=${secondBestDistance.toFixed(4)} margin=${(secondBestDistance - bestMatch.distance).toFixed(4)}`,
      )
      return { matched: false, reason: 'ambiguous' }
    }

    if (!bestMatch) {
      console.log(`[FaceMatch] NO MATCH — best distance above threshold ${FACE_MATCH_THRESHOLD}`)
      return { matched: false, reason: 'no_match' }
    }

    console.log(
      `[FaceMatch] MATCHED ${bestMatch.employeeCode} distance=${bestMatch.distance.toFixed(4)} threshold=${FACE_MATCH_THRESHOLD}`,
    )

    return { matched: true, result: bestMatch }
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
