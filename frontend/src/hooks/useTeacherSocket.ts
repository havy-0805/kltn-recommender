import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useEffectEvent, useState } from 'react'
import { keys, type Notification } from '../api/client'

export type SocketStatus = 'connecting' | 'online' | 'offline'

type Message = { type: 'notification'; data: Notification }

const MAX_BACKOFF_MS = 10_000

function socketUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${protocol}://${window.location.host}/ws/teacher`
}

/**
 * Nhận thông báo bài nộp real-time. Thông báo mới được chèn thẳng vào cache của React Query;
 * mỗi lần kết nối (lại) thì tải lại danh sách để không sót bài nộp lúc mất kết nối.
 */
export function useTeacherSocket(onNotification: (n: Notification) => void): SocketStatus {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<SocketStatus>('connecting')
  const notify = useEffectEvent(onNotification)

  useEffect(() => {
    let socket: WebSocket | null = null
    let retry: ReturnType<typeof setTimeout> | undefined
    let backoff = 1000
    let disposed = false

    const connect = () => {
      setStatus('connecting')
      socket = new WebSocket(socketUrl())
      socket.onopen = () => {
        backoff = 1000
        setStatus('online')
        void queryClient.invalidateQueries({ queryKey: keys.notifications })
      }
      socket.onmessage = (event: MessageEvent<string>) => {
        const message = JSON.parse(event.data) as Message
        if (message.type !== 'notification') return
        queryClient.setQueryData<Notification[]>(keys.notifications, (old = []) => [
          message.data,
          ...old.filter((n) => n.id !== message.data.id),
        ])
        void queryClient.invalidateQueries({ queryKey: ['attempts'] })
        void queryClient.invalidateQueries({ queryKey: ['overview'] })
        void queryClient.invalidateQueries({ queryKey: ['results'] })
        notify(message.data)
      }
      socket.onclose = () => {
        if (disposed) return
        setStatus('offline')
        retry = setTimeout(connect, backoff)
        backoff = Math.min(backoff * 2, MAX_BACKOFF_MS)
      }
    }

    connect()
    return () => {
      disposed = true
      clearTimeout(retry)
      socket?.close()
    }
  }, [queryClient])

  return status
}
