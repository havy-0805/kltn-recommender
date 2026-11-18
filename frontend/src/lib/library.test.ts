import type { LibraryItem } from '../api/client'
import { filterLibrary, libraryCategories } from './library'

const item = (id: string, over: Partial<LibraryItem> = {}): LibraryItem => ({
  material_id: id,
  title: id,
  skill_id: 'SK_A',
  skill_name: 'Chuyên đề A',
  category: 'Ngữ pháp',
  group_name: null,
  level: 2,
  recommended: false,
  weak: false,
  ...over,
})

const ITEMS = [
  item('M1', { level: 1 }),
  item('M2'),
  item('M3', { weak: true }),
  item('M4', { recommended: true, weak: true }),
  item('M5', { category: 'Từ vựng', level: 3 }),
]

describe('kho học liệu', () => {
  it('lọc theo mức và mảng kiến thức', () => {
    expect(filterLibrary(ITEMS, { level: 2, categories: [], weakOnly: false }).map((i) => i.material_id)).toEqual([
      'M4',
      'M3',
      'M2',
    ])
    expect(filterLibrary(ITEMS, { level: 'all', categories: ['Từ vựng'], weakOnly: false }).map((i) => i.material_id)).toEqual(['M5'])
  })

  it('chọn nhiều mảng kiến thức cùng lúc', () => {
    expect(filterLibrary(ITEMS, { level: 'all', categories: ['Ngữ pháp', 'Từ vựng'], weakOnly: false }).map((i) => i.material_id)).toEqual(
      ['M4', 'M3', 'M1', 'M2', 'M5'],
    )
  })

  it('học liệu đang đề xuất lên đầu, rồi đến phần đang yếu; chỉ phần yếu khi bật lọc', () => {
    expect(filterLibrary(ITEMS, { level: 'all', categories: [], weakOnly: false })[0]?.material_id).toBe('M4')
    expect(filterLibrary(ITEMS, { level: 'all', categories: [], weakOnly: true }).map((i) => i.material_id)).toEqual([
      'M4',
      'M3',
    ])
  })

  it('liệt kê mảng kiến thức không trùng, sắp xếp theo bảng chữ cái', () => {
    expect(libraryCategories(ITEMS)).toEqual(['Ngữ pháp', 'Từ vựng'])
  })
})
