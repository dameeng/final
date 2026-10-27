const initials = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'
function normalize(value: unknown) {
  return String(value ?? '').normalize('NFKC').toLowerCase()
    .replace(/[\u1100-\u1112]/g, character => initials[character.charCodeAt(0) - 0x1100]!)
    .replace(/\s+/g, '')
}
/** 일반 글자와 초성을 섞어 검색할 수 있다. 공백으로 나눈 검색어는 모두 일치해야 한다. */
export function matchesKoreanSearch(value: unknown, query: unknown): boolean {
  const text = normalize(value)
  return String(query ?? '').trim().split(/\s+/).filter(Boolean).every(word => {
    const pattern = Array.from(normalize(word), character => {
      const index = initials.indexOf(character)
      if (index >= 0) {
        const start = 0xac00 + index * 588
        return `[${character}${String.fromCharCode(start)}-${String.fromCharCode(start + 587)}]`
      }
      return character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }).join('')
    return new RegExp(pattern, 'u').test(text)
  })
}
