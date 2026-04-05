import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets'
import type { Server, Socket } from 'socket.io'
import { Logger } from '@nestjs/common'
import { MeetingsService } from './meetings.service'
import { SpeechService } from './speech.service'

// Common Whisper hallucination patterns — generated when audio is silence/noise
const HALLUCINATION_PATTERNS = [
  /^(thanks? for watching[.!]?)+$/i,
  /^(please (like|subscribe|share)[.!]?)+$/i,
  /^(\[music\]|\[noise\]|\[silence\]|\[applause\]|\[laughter\])+$/i,
  /^(subtitles? (by|from)[^.]+[.!]?)+$/i,
]

function isWhisperHallucination(text: string): boolean {
  const trimmed = text.trim()

  // Detect 3+ consecutive repeated words: "Jesus Jesus Jesus..." or "No No No No..."
  const words = trimmed.split(/\s+/)

  for (let index = 0; index < words.length - 2; index++) {
    const word = words[index].toLowerCase().replace(/[^a-z]/g, '')

    if (
      word.length > 1 &&
      word === words[index + 1].toLowerCase().replace(/[^a-z]/g, '') &&
      word === words[index + 2].toLowerCase().replace(/[^a-z]/g, '')
    ) {
      return true
    }
  }

  // Detect known hallucination phrases
  for (const pattern of HALLUCINATION_PATTERNS) {
    if (pattern.test(trimmed)) return true
  }

  return false
}

interface JoinMeetingPayload {
  meetingId: number
  userId: number
  username: string
}

interface LeaveMeetingPayload {
  meetingId: number
  userId: number
}

interface SpeakerStatePayload {
  meetingId: number
  userId: number
  enabled: boolean
}

interface SubtitlePartialPayload {
  id: string
  meetingId: number
  speakerId: number
  speakerName: string
  original: string
  language: string
}

interface SubtitleUpdatePayload {
  id: string
  meetingId: number
  speakerId: number
  speakerName: string
  original: string
  language: string
  translations: Record<string, string>
  audioBase64: Record<string, string | null>
}

@WebSocketGateway({ cors: { origin: '*' }, namespace: 'meeting', path: '/ws' })
export class MeetingsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server

  private readonly logger = new Logger(MeetingsGateway.name)
  // meetingId → Map<socketId, { userId, username }>
  private readonly activeParticipants = new Map<
    number,
    Map<string, { userId: number; username: string }>
  >()
  // meetingId → Map<userId, speakerEnabled>
  private readonly speakerStates = new Map<number, Map<number, boolean>>()
  // socketId → queue of pending audio chunks (max 2 buffered to bound latency)
  private readonly audioQueue = new Map<string, Buffer[]>()
  private readonly processingAudio = new Set<string>()

  constructor(
    private readonly meetingsService: MeetingsService,
    private readonly speechService: SpeechService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`)
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`)
    this.processingAudio.delete(client.id)
    this.audioQueue.delete(client.id)

    // Remove from all meeting rooms
    for (const [meetingId, participants] of this.activeParticipants.entries()) {
      const participant = participants.get(client.id)

      if (participant) {
        participants.delete(client.id)
        this.speakerStates.get(meetingId)?.delete(participant.userId)
        this.server.to(`meeting_${meetingId}`).emit('participant_left', {
          userId: participant.userId,
          username: participant.username,
          meetingId,
        })

        this.meetingsService.recordLeave(meetingId, participant.userId).catch((error) => {
          this.logger.error('Failed to record participant leave', error)
        })

        // Notify list page of updated live participants
        this.emitParticipantsUpdated(meetingId)

        // Auto-reset to scheduled when the last participant disconnects
        if (participants.size === 0) {
          this.meetingsService
            .resetToScheduled(meetingId)
            .then(() => {
              this.server.to('meetings_list').emit('meeting_status_changed', {
                meetingId,
                status: 'scheduled',
                activeUserIds: [],
              })
            })
            .catch((error) => {
              this.logger.error('Failed to reset meeting to scheduled on disconnect', error)
            })
        }
      }
    }
  }

  @SubscribeMessage('join_meeting')
  handleJoinMeeting(@ConnectedSocket() client: Socket, @MessageBody() payload: JoinMeetingPayload) {
    const roomName = `meeting_${payload.meetingId}`
    client.join(roomName)

    if (!this.activeParticipants.has(payload.meetingId)) {
      this.activeParticipants.set(payload.meetingId, new Map())
    }

    this.activeParticipants.get(payload.meetingId)!.set(client.id, {
      userId: payload.userId,
      username: payload.username,
    })

    const participants = Array.from(this.activeParticipants.get(payload.meetingId)!.values())

    // Auto-activate meeting when first participant joins
    if (participants.length === 1) {
      this.meetingsService
        .setActive(payload.meetingId)
        .then(() => {
          const activeUserIds = Array.from(
            this.activeParticipants.get(payload.meetingId)?.values() ?? [],
          ).map((participant) => participant.userId)
          this.server.to('meetings_list').emit('meeting_status_changed', {
            meetingId: payload.meetingId,
            status: 'active',
            activeUserIds,
          })
        })
        .catch((error) => {
          this.logger.error('Failed to set meeting active', error)
        })
    }

    // Initialise speaker states map for this meeting if not present
    if (!this.speakerStates.has(payload.meetingId)) {
      this.speakerStates.set(payload.meetingId, new Map())
    }

    // Default new joiner's speaker to enabled (they can override with speaker_state event)
    this.speakerStates.get(payload.meetingId)!.set(payload.userId, true)

    // Build current speaker states snapshot for the joining user
    const speakerStatesSnapshot: Record<number, boolean> = {}
    for (const [userId, enabled] of this.speakerStates.get(payload.meetingId)!.entries()) {
      speakerStatesSnapshot[userId] = enabled
    }

    // Notify others
    client.to(roomName).emit('participant_joined', {
      userId: payload.userId,
      username: payload.username,
      meetingId: payload.meetingId,
    })

    // Send current participant list + speaker states to the joining user
    client.emit('meeting_state', {
      meetingId: payload.meetingId,
      participants,
      speakerStates: speakerStatesSnapshot,
    })

    // Notify list page of updated live participants (covers 2nd, 3rd... joins)
    this.emitParticipantsUpdated(payload.meetingId)

    this.logger.log(`User ${payload.userId} joined meeting ${payload.meetingId}`)
  }

  @SubscribeMessage('leave_meeting')
  handleLeaveMeeting(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: LeaveMeetingPayload,
  ) {
    const roomName = `meeting_${payload.meetingId}`
    client.leave(roomName)

    const leaving = this.activeParticipants.get(payload.meetingId)?.get(client.id)
    this.activeParticipants.get(payload.meetingId)?.delete(client.id)
    if (leaving) {
      this.speakerStates.get(payload.meetingId)?.delete(leaving.userId)
    }

    this.server.to(roomName).emit('participant_left', {
      userId: payload.userId,
      meetingId: payload.meetingId,
    })

    this.meetingsService.recordLeave(payload.meetingId, payload.userId).catch((error) => {
      this.logger.error('Failed to record participant leave', error)
    })

    // Notify list page of updated live participants (covers mid-session leaves)
    this.emitParticipantsUpdated(payload.meetingId)

    // Auto-reset to scheduled when the last participant leaves
    const remaining = this.activeParticipants.get(payload.meetingId)?.size ?? 0
    if (remaining === 0) {
      this.meetingsService
        .resetToScheduled(payload.meetingId)
        .then(() => {
          this.server.to('meetings_list').emit('meeting_status_changed', {
            meetingId: payload.meetingId,
            status: 'scheduled',
            activeUserIds: [],
          })
        })
        .catch((error) => {
          this.logger.error('Failed to reset meeting to scheduled', error)
        })
    }
  }

  @SubscribeMessage('subscribe_meetings_list')
  handleSubscribeMeetingsList(@ConnectedSocket() client: Socket) {
    client.join('meetings_list')
    this.logger.log(`Client ${client.id} subscribed to meetings_list`)

    // Send current live state so client can show correct status without reload
    const liveState: Record<number, number[]> = {}
    for (const [meetingId, participants] of this.activeParticipants.entries()) {
      if (participants.size > 0) {
        liveState[meetingId] = Array.from(participants.values()).map(
          (participant) => participant.userId,
        )
      }
    }
    client.emit('meetings_live_state', liveState)
  }

  @SubscribeMessage('unsubscribe_meetings_list')
  handleUnsubscribeMeetingsList(@ConnectedSocket() client: Socket) {
    client.leave('meetings_list')
  }

  @SubscribeMessage('speaker_state')
  handleSpeakerState(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SpeakerStatePayload,
  ) {
    // Persist so new joiners receive current state in meeting_state snapshot
    if (!this.speakerStates.has(payload.meetingId)) {
      this.speakerStates.set(payload.meetingId, new Map())
    }
    this.speakerStates.get(payload.meetingId)!.set(payload.userId, payload.enabled)

    // Broadcast to all other participants in the meeting room (excluding sender)
    client.to(`meeting_${payload.meetingId}`).emit('speaker_state', {
      userId: payload.userId,
      enabled: payload.enabled,
      meetingId: payload.meetingId,
    })
  }

  @SubscribeMessage('audio_stream')
  handleAudioStream(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      meetingId: number
      audioBase64: string
      speakerLanguage?: string | null
      ttsEnabled?: boolean
      isScreenAudio?: boolean
    },
  ) {
    const participant = this.activeParticipants.get(payload.meetingId)?.get(client.id)
    if (!participant) return

    // Skip if previous chunk is still being processed — prevents Whisper queue buildup
    if (this.processingAudio.has(client.id)) return

    const audioBuffer = Buffer.from(payload.audioBase64, 'base64')
    const speakerLanguage = payload.speakerLanguage ?? undefined
    const ttsEnabled = payload.ttsEnabled ?? false
    const isScreenAudio = payload.isScreenAudio ?? false

    // If already processing, buffer the chunk (keep max 2 to avoid growing queue)
    if (this.processingAudio.has(client.id)) {
      const queue = this.audioQueue.get(client.id) ?? []
      if (queue.length < 2) queue.push(audioBuffer)
      else queue[queue.length - 1] = audioBuffer // replace oldest buffered with newest
      this.audioQueue.set(client.id, queue)
      return
    }

    this.processingAudio.add(client.id)
    this.processAudioChunk(
      client,
      payload.meetingId,
      participant,
      audioBuffer,
      speakerLanguage,
      ttsEnabled,
      isScreenAudio,
    )
  }

  private processAudioChunk(
    client: Socket,
    meetingId: number,
    participant: { userId: number; username: string },
    audioBuffer: Buffer,
    speakerLanguage: string | undefined,
    ttsEnabled: boolean,
    isScreenAudio: boolean,
  ) {
    const subtitleId = `${participant.userId}-${Date.now()}`

    ;(async () => {
      try {
        this.logger.debug(
          `[audio] user=${participant.userId} meetingId=${meetingId} bytes=${audioBuffer.length}`,
        )
        const { text, language } = await this.speechService.transcribeOnly(
          audioBuffer,
          speakerLanguage,
          isScreenAudio,
        )
        this.logger.log(
          `[whisper] text="${text}" lang=${language} words=${text ? text.trim().split(/\s+/).length : 0}`,
        )

        if (!text || text.trim().split(/\s+/).length < 2) {
          this.logger.debug(`[subtitle] skipped — too short or empty`)
        } else if (isWhisperHallucination(text)) {
          this.logger.debug(
            `[subtitle] skipped — hallucination detected: "${text.substring(0, 50)}"`,
          )
        } else {
          this.logger.log(`[subtitle_partial] emitting to meeting_${meetingId}`)
          this.server.to(`meeting_${meetingId}`).emit('subtitle_partial', {
            id: subtitleId,
            meetingId,
            speakerId: participant.userId,
            speakerName: participant.username,
            original: text,
            language,
          } satisfies SubtitlePartialPayload)

          const { translations, audioBase64 } = await this.speechService.translateAndSynthesize(
            text,
            language,
            ['vi', 'en', 'ja'],
            ttsEnabled,
          )

          this.logger.log(
            `[subtitle_update] emitting to meeting_${meetingId} keys=${Object.keys(translations).join(',')}`,
          )
          this.broadcastSubtitleUpdate({
            id: subtitleId,
            meetingId,
            speakerId: participant.userId,
            speakerName: participant.username,
            original: text,
            language,
            translations,
            audioBase64,
          })
        }
      } catch (error) {
        this.logger.error('Audio chunk processing failed', error)
      } finally {
        // Drain queued chunk if any
        const queue = this.audioQueue.get(client.id)
        if (queue && queue.length > 0) {
          const nextBuffer = queue.shift()!
          if (queue.length === 0) this.audioQueue.delete(client.id)
          this.processAudioChunk(
            client,
            meetingId,
            participant,
            nextBuffer,
            speakerLanguage,
            ttsEnabled,
            isScreenAudio,
          )
        } else {
          this.processingAudio.delete(client.id)
        }
      }
    })()
  }

  broadcastSubtitleUpdate(payload: SubtitleUpdatePayload) {
    this.server.to(`meeting_${payload.meetingId}`).emit('subtitle_update', {
      ...payload,
      timestamp: Date.now(),
    })
  }

  private emitParticipantsUpdated(meetingId: number) {
    const activeUserIds = Array.from(this.activeParticipants.get(meetingId)?.values() ?? []).map(
      (participant) => participant.userId,
    )
    this.server.to('meetings_list').emit('meeting_participants_updated', {
      meetingId,
      activeUserIds,
    })
  }
}
