/** 零依赖 HTML → 纯文本提取：剥离脚本/样式/注释，块级标签转换行，压缩空白。 */

const MAX_TEXT_LENGTH = 12_000

export function htmlToText(html: string): string {
  let text = html

  text = text
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<(nav|header|footer|aside)[\s\S]*?<\/\1>/gi, ' ')

  // img 的 alt 与 title 属性保留为文本（菜谱页面成品图描述常有用）
  text = text.replace(/<img[^>]*alt="([^"]{2,80})"[^>]*>/gi, '[图：$1]')

  // 块级/换行类标签转为换行，其余标签直接剥离
  text = text.replace(/<\/?(p|div|br|li|tr|h[1-6]|section|article|table|ul|ol|blockquote)(\s[^>]*)?\/?>/gi, '\n')
  text = text.replace(/<[^>]+>/g, ' ')

  // 常见实体
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
    '&hellip;': '…',
    '&mdash;': '—',
    '&middot;': '·',
  }
  for (const [entity, char] of Object.entries(entities)) {
    text = text.replaceAll(entity, char)
  }
  text = text.replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))

  // 行内与跨行空白压缩
  text = text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n')

  if (text.length > MAX_TEXT_LENGTH) {
    text = `${text.slice(0, MAX_TEXT_LENGTH)}\n（内容过长已截断）`
  }
  return text
}

/** 简易正文判定：过短或几乎没有中文则大概率是 JS 动态渲染的空壳 */
export function isLikelyUsefulText(text: string): boolean {
  if (text.length < 200) return false
  const cjkCount = (text.match(/[\u4e00-\u9fff]/g) ?? []).length
  return cjkCount >= 50
}
