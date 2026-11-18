import type { LibraryItem } from '../api/client'

export type LibraryFilter = { level: 'all' | 1 | 2 | 3; categories: string[]; weakOnly: boolean }

/** Lọc kho học liệu theo mức, mảng kiến thức; học liệu đang đề xuất và phần đang yếu xếp lên đầu. */
export function filterLibrary(items: LibraryItem[], filter: LibraryFilter): LibraryItem[] {
  const rank = (i: LibraryItem) => (i.recommended ? 0 : i.weak ? 1 : 2)
  return items
    .filter((i) => filter.level === 'all' || i.level === filter.level)
    .filter((i) => filter.categories.length === 0 || filter.categories.includes(i.category))
    .filter((i) => !filter.weakOnly || i.weak)
    .map((item, order) => ({ item, order }))
    .sort((a, b) => rank(a.item) - rank(b.item) || a.order - b.order)
    .map(({ item }) => item)
}

/** Các mảng kiến thức có trong kho, sắp xếp theo bảng chữ cái tiếng Việt. */
export const libraryCategories = (items: LibraryItem[]) =>
  [...new Set(items.map((i) => i.category))].sort((a, b) => a.localeCompare(b, 'vi'))
