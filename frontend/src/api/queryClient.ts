import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { ApiError, keys } from './client'

/** Mọi lỗi 401 (phiên hết hạn) đều đưa người dùng về trạng thái chưa đăng nhập; route guard sẽ chuyển tới trang đăng nhập. */
export function createQueryClient(options: { retry?: boolean | number } = {}): QueryClient {
  const onError = (err: unknown) => {
    if (err instanceof ApiError && err.status === 401) client.setQueryData(keys.me, null)
  }
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: {
        retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < Number(options.retry ?? 1),
        refetchOnWindowFocus: false,
      },
    },
  })
  return client
}
