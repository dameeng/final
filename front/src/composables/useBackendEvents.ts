
import { onBeforeUnmount, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useApp } from '../stores/app'
import { useManagerNotifications } from '../stores/managerNotifications'

export type BackendEvent = { name: string; data: Record<string, any> }

const eventNames = [
  'connected',
  'risk-update',
  'water-update',
  'risk-level-change',
  'control-change',
  'transit-update',
  'plate-queue-add',
  'plate-queue-done',
  'notice-new',
  'inquiry-new',
  'display-change',
  'notification-new',
  'data-changed',
  'pm-update',
  'sinkhole-update',
  'analysis-state-change',
  'pm-engine-status',
  'manager-assignment-change',
  'notification-read-change',
]

// SSE 진단 로그 활성화 여부.
// 원인 파악이 끝나면 false로 변경하면 된다.
const SSE_DEBUG = true

let nextConnectionId = 0

const readyStateName = (value: number) =>
  value === EventSource.CONNECTING ? 'CONNECTING' :
  value === EventSource.OPEN ? 'OPEN' : 'CLOSED'

// 앱 전체에서 SSE 연결을 관리한다.
// 인증된 사용자 정보가 변경될 때 연결을 교체한다.
export function useBackendStream() {
  const app = useApp()
  const route = useRoute()
  const managerNotifications = useManagerNotifications()

  let stream: EventSource | undefined
  let connectionId = 0
  let previousIdentity: (string | number | undefined)[] | undefined
  let lastEventLogAt = 0
  let bufferedEvents: Record<string, number> = {}
  let lastOpenedAt = 0

  // 공통 진단 로그
  const debug = (
    message: string,
    detail: Record<string, unknown> = {},
  ) => {
    if (SSE_DEBUG) {
      console.info(`[PUF:SSE] ${message}`, {
        at: new Date().toISOString(),
        route: route.path,
        ...detail,
      })
    }
  }

  // 일정 시간 동안 받은 이벤트를 종류별로 요약
  const summarizeEvents = () => {
    if (!Object.keys(bufferedEvents).length) return

    debug('received events (summary)', {
      connectionId,
      counts: bufferedEvents,
    })

    bufferedEvents = {}
  }

  // 페이지 이동 추적
  // 페이지 이동 자체가 SSE 재연결 사유는 아니다.
  watch(
    () => route.fullPath,
    (to, from) => {
      debug('route change (not a reason to reconnect)', {
        from: from.split('?')[0],
        to: to.split('?')[0],
        connectionId,
        readyState: stream
          ? readyStateName(stream.readyState)
          : 'none',
      })
    },
  )

  // 로그인 계정 및 권한 정보 변경 감시
  const stop = watch(
  [
    () => app.account?.id,
    () => app.account?.role,
    () => app.authVersion,
    () =>
      (app.account?.regions || [])
        .map((region) => String(region.id))
        .sort()
        .join(','),
  ],
  (identity) => {
      const changedFields = previousIdentity
        ? [
            'account.id',
            'account.role',
            'authVersion',
            'regions',
          ].filter(
            (_, index) =>
              previousIdentity![index] !== identity[index],
          )
        : ['initial watch']

      previousIdentity = [...identity]

      debug('identity watcher triggered', {
        changedFields,
        accountPresent: Boolean(app.account?.id),
        role: app.account?.role,
        authVersion: app.authVersion,
        regionCount: app.account?.regions?.length ?? 0,
      })

      // 기존 SSE 연결 종료
      if (stream) {
        debug('closing prior connection', {
          connectionId,
          readyState: readyStateName(stream.readyState),
        })

        summarizeEvents()
        stream.close()
        stream = undefined
      }

      if (typeof EventSource === 'undefined') {
        debug('EventSource unavailable')
        return
      }

      // 사용자 유형에 맞는 SSE 주소 선택
      const endpoint =
        app.account?.role === 'REGIONAL_ADMIN'
          ? '/api/admin/stream'
          : '/api/stream'

      const source = new EventSource(endpoint, {
        withCredentials: true,
      })

      const id = ++nextConnectionId

      connectionId = id
      stream = source
      lastEventLogAt = Date.now()
      bufferedEvents = {}
      lastOpenedAt = 0

      debug('connection created', {
        connectionId: id,
        endpoint,
        readyState: readyStateName(source.readyState),
      })

      // 연결 성공
      source.onopen = () => {
        if (stream !== source) return

        lastOpenedAt = Date.now()

        debug('OPEN', {
          connectionId: id,
          endpoint,
          readyState: readyStateName(source.readyState),
        })
      }

      // 연결 오류
      // EventSource는 오류 후 자동 재연결을 시도할 수 있다.
      source.onerror = () => {
        if (stream !== source) return

        debug('ERROR / browser may automatically retry', {
          connectionId: id,
          endpoint,
          readyState: readyStateName(source.readyState),
          openForMs: lastOpenedAt
            ? Date.now() - lastOpenedAt
            : null,
        })
      }

      // 관리자 미읽음 알림 개수 갱신
      // 요청은 알림 store 한 곳에서 모아 보내서, 여러 곳에서 동시에 불러도 한 번만 나간다.
      const refreshManagerUnread = async () => {
        if (app.account?.role !== 'REGIONAL_ADMIN') return

        const failure = await managerNotifications.refresh()

        if (failure && stream === source) {
          const error = failure
          debug('unread-count request failed', {
            connectionId: id,
            errorType:
              error instanceof Error
                ? error.name
                : typeof error,
            message:
              error instanceof Error
                ? error.message
                : String(error),
          })
        }
      }

      void refreshManagerUnread()

      // 서버에서 전달하는 이벤트 등록
      for (const name of eventNames) {
        source.addEventListener(name, (event) => {
          if (stream !== source) return

          // 최초 연결 또는 재연결 후 서버 이벤트
          if (name === 'connected') {
            debug('CONNECTED server event', {
              connectionId: id,
              endpoint,
            })

            void refreshManagerUnread()

            window.dispatchEvent(
              new CustomEvent<BackendEvent>(
                'routel-backend-event',
                {
                  detail: {
                    name,
                    data: {},
                  },
                },
              ),
            )

            return
          }

          if (name === 'notification-new') {
            void refreshManagerUnread()
          }

          // 이벤트 수신량 집계
          bufferedEvents[name] =
            (bufferedEvents[name] || 0) + 1

          // 5초 간격으로 이벤트 수신량 요약 출력
          if (Date.now() - lastEventLogAt >= 5000) {
            summarizeEvents()
            lastEventLogAt = Date.now()
          }

          try {
            const data = JSON.parse(
              (event as MessageEvent).data || '{}',
            )

            if (
              data &&
              typeof data === 'object' &&
              !Array.isArray(data)
            ) {
              window.dispatchEvent(
                new CustomEvent<BackendEvent>(
                  'routel-backend-event',
                  {
                    detail: {
                      name,
                      data,
                    },
                  },
                ),
              )
            }
          } catch (error) {
            debug('malformed SSE event ignored', {
              connectionId: id,
              name,
              errorType:
                error instanceof Error
                  ? error.name
                  : typeof error,
            })
          }
        })
      }
    },
    { immediate: true },
  )

  // 앱에서 SSE 관리 컴포넌트가 해제될 때 정리
  onBeforeUnmount(() => {
    debug('useBackendStream unmounted', {
      connectionId,
    })

    stop()
    summarizeEvents()
    stream?.close()
    stream = undefined
  })
}

// 각 화면에서 SSE 이벤트를 구독하기 위한 함수
export function useBackendEvents(
  handler: (event: BackendEvent) => void,
) {
  const receive = (event: Event) =>
    handler((event as CustomEvent<BackendEvent>).detail)

  onMounted(() => {
    window.addEventListener(
      'routel-backend-event',
      receive,
    )
  })

  onBeforeUnmount(() => {
    window.removeEventListener(
      'routel-backend-event',
      receive,
    )
  })
}
