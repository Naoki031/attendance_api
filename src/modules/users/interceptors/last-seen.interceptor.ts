import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import type { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'
import { UsersService } from '@/modules/users/users.service'

/** Minimum interval between last_seen_at updates per user (5 minutes). */
const THROTTLE_MS = 5 * 60 * 1000

@Injectable()
export class LastSeenInterceptor implements NestInterceptor {
  /** Map of userId → timestamp of the last DB write. Kept in-process memory. */
  private readonly lastUpdated = new Map<number, number>()

  constructor(private readonly usersService: UsersService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ user?: { id?: number } }>()
    const userId = request.user?.id

    if (userId) {
      const now = Date.now()
      const previous = this.lastUpdated.get(userId) ?? 0

      if (now - previous >= THROTTLE_MS) {
        this.lastUpdated.set(userId, now)
        // Fire-and-forget — do not block the response
        this.usersService.updateLastSeen(userId).catch(() => {
          // Silently ignore — last_seen_at is non-critical
        })
      }
    }

    return next.handle().pipe(tap(() => {}))
  }
}
