// Quy tắc giao diện: không gradient, không kính mờ, không đổ bóng cho thẻ, bo góc 6px, khoảng cách theo bậc 4px
const sources = import.meta.glob(['./**/*.tsx', '!./**/*.test.tsx'], { query: '?raw', import: 'default', eager: true })

const SPACING_SCALE = new Set(['0', 'px', '1', '2', '3', '4', '6', '8', '12', '16', 'auto'])
// Lớp nổi (menu, dropdown, hộp thoại, toast) được phép có bóng
const FLOATING_SHADOW = 'shadow-popover'

function classTokens(src: string) {
  return src.split(/[\s"'`{}()]+/).filter(Boolean)
}

function violations(check: (token: string) => boolean) {
  return Object.entries(sources).flatMap(([file, src]) =>
    classTokens(src as string)
      .filter(check)
      .map((token) => `${file}: ${token}`),
  )
}

const bare = (token: string) => token.replace(/^([a-z0-9-]+:)+/, '').replace(/^-/, '')

describe('quy tắc giao diện', () => {
  it('không dùng gradient', () => {
    expect(violations((t) => /^(bg-(linear|radial|conic|gradient)|from-|via-|to-[a-z]+-\d)/.test(bare(t)))).toEqual([])
  })

  it('không dùng kính mờ (blur, nền trong suốt)', () => {
    expect(violations((t) => /^(backdrop-|blur)/.test(bare(t)))).toEqual([])
  })

  it('chỉ lớp nổi mới có bóng', () => {
    expect(violations((t) => /^(shadow|drop-shadow|ring-)/.test(bare(t)) && bare(t) !== FLOATING_SHADOW)).toEqual([])
  })

  it('bo góc 6px (rounded-md), rounded-full chỉ cho hình tròn', () => {
    expect(violations((t) => /^rounded/.test(bare(t)) && !/^rounded(-[a-z]{1,2})?-(md|full|none)$/.test(bare(t)))).toEqual([])
  })

  it('khoảng cách theo bậc 4px', () => {
    const spacing = /^(px|py|pt|pb|pl|pr|ps|pe|p|mx|my|mt|mb|ml|mr|m|gap-x|gap-y|gap|space-x|space-y)-(.+)$/
    expect(
      violations((t) => {
        const m = spacing.exec(bare(t))
        return m !== null && !SPACING_SCALE.has(m[2] ?? '')
      }),
    ).toEqual([])
  })
})
