import { Injectable, Logger } from '@nestjs/common'
import * as admin from 'firebase-admin'
import { ErrorLogsService } from '@/modules/error_logs/error_logs.service'

@Injectable()
export class FirebaseService {
  private readonly logger = new Logger(FirebaseService.name)
  private readonly app: admin.app.App | null = null

  constructor(private readonly errorLogsService: ErrorLogsService) {
    const projectId = process.env.FIREBASE_PROJECT_ID
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn('Firebase credentials not configured — push notifications disabled')

      return
    }

    try {
      // Re-use existing app if already initialized (hot-reload safety)
      this.app =
        admin.apps.find((application) => application?.name === 'attendance') ??
        admin.initializeApp(
          {
            credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
          },
          'attendance',
        )
    } catch (error) {
      this.logger.error('Failed to initialize Firebase app', error)
      this.errorLogsService.logError({
        message: 'Failed to initialize Firebase app',
        stackTrace: (error as Error).stack ?? null,
        path: 'firebase',
      })
    }
  }

  /**
   * Returns true if Firebase is initialized and ready to send notifications.
   */
  get isReady(): boolean {
    return this.app !== null
  }

  /**
   * Sends a push notification to a single device token.
   * Silently skips if Firebase is not configured or token is invalid.
   */
  async sendToDevice(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    if (!this.app || !token) return

    try {
      await admin.messaging(this.app).send({
        token,
        notification: { title, body },
        data,
        android: {
          notification: {
            clickAction: 'FLUTTER_NOTIFICATION_CLICK',
            sound: 'default',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
        webpush: {
          notification: {
            icon: '/favicon.ico',
            badge: '/favicon.ico',
          },
          fcmOptions: {
            link: data?.url ?? '/',
          },
        },
      })
    } catch (error) {
      // Log but do not throw — FCM errors must not block message delivery
      this.logger.warn(`Failed to send FCM to token ${token.slice(0, 20)}...: ${error}`)
      this.errorLogsService.logError({
        message: `Failed to send FCM to token ${token.slice(0, 20)}...`,
        stackTrace: (error as Error).stack ?? null,
        path: 'firebase',
      })
    }
  }

  /**
   * Sends a push notification to multiple device tokens in batch.
   */
  async sendToDevices(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    if (!this.app || tokens.length === 0) return

    await Promise.all(tokens.map((token) => this.sendToDevice(token, title, body, data)))
  }
}
