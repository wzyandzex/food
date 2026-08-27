import dns from 'node:dns/promises'
import net from 'node:net'

export interface SafeFetchOptions extends RequestInit {
  timeoutMs?: number
  maxRedirects?: number
  maxContentLength?: number // bytes, 默认 5MB
  allowedMimeTypes?: string[]
}

/**
 * 校验目标 IP 是否为内网/回环/保留私有地址
 */
export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number)
    const p0 = parts[0] ?? 0
    const p1 = parts[1] ?? 0

    // 0.0.0.0/8
    if (p0 === 0) return true
    // 10.0.0.0/8
    if (p0 === 10) return true
    // 127.0.0.0/8 (Loopback)
    if (p0 === 127) return true
    // 169.254.0.0/16 (Link-local / Cloud metadata)
    if (p0 === 169 && p1 === 254) return true
    // 172.16.0.0/12 (Private)
    if (p0 === 172 && p1 >= 16 && p1 <= 31) return true
    // 192.168.0.0/16 (Private)
    if (p0 === 192 && p1 === 168) return true
    // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved)
    if (p0 >= 224) return true
    return false
  }

  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase()
    // ::1 (Loopback)
    if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true
    // fc00::/7 (Unique local)
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true
    // fe80::/10 (Link-local)
    if (normalized.startsWith('fe80')) return true
    return false
  }

  return true // 无法识别的视为私有/不安全
}

/**
 * 严格校验 URL 合法性并解析 DNS 检测 SSRF
 */
export async function validateSafeUrl(rawUrl: string): Promise<URL> {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error('URL 格式无效')
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`不支持的协议 ${parsed.protocol}，仅允许 HTTP / HTTPS`)
  }

  const hostname = parsed.hostname.toLowerCase()

  // 基础字面量黑名单快速过滤
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.includes('metadata.google.internal')
  ) {
    throw new Error(`禁止访问受保护或内网主机: ${hostname}`)
  }

  // 若直接是 IP 地址
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new Error(`禁止访问私有/内网 IP 地址: ${hostname}`)
    }
    return parsed
  }

  // 执行真实 DNS 解析检查（防御 DNS Rebinding 攻击）
  try {
    const addresses = await dns.lookup(hostname, { all: true })
    for (const record of addresses) {
      if (isPrivateIp(record.address)) {
        throw new Error(`域名 ${hostname} 解析至受限私有 IP (${record.address})，已拦截请求`)
      }
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('受限私有 IP')) {
      throw err
    }
    throw new Error(`DNS 解析失败: ${hostname}`)
  }

  return parsed
}

/**
 * 具有 SSRF 防御、重定向检查、超时控制和体积限制的安全 fetch
 */
export async function safeFetch(url: string, options: SafeFetchOptions = {}): Promise<Response> {
  const {
    timeoutMs = 15000,
    maxRedirects = 3,
    maxContentLength = 5 * 1024 * 1024, // 5MB
    allowedMimeTypes,
    ...fetchInit
  } = options

  let currentUrl = url
  let redirectsCount = 0

  while (redirectsCount <= maxRedirects) {
    const targetUrl = await validateSafeUrl(currentUrl)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    let response: Response
    try {
      response = await fetch(targetUrl.toString(), {
        ...fetchInit,
        signal: controller.signal,
        redirect: 'manual', // 手动处理重定向以逐级校验目标 IP
      })
    } catch (err: unknown) {
      clearTimeout(timeoutId)
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`请求目标 URL 超时 (${timeoutMs}ms)`)
      }
      throw err
    }
    clearTimeout(timeoutId)

    // 处理 301, 302, 307, 308 重定向
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location')
      if (!location) {
        throw new Error('收到重定向响应但缺失 Location 标头')
      }
      redirectsCount++
      if (redirectsCount > maxRedirects) {
        throw new Error(`重定向次数超过上限 (${maxRedirects})`)
      }
      currentUrl = new URL(location, currentUrl).toString()
      continue
    }

    if (!response.ok) {
      throw new Error(`目标服务器返回 HTTP 状态错误: ${response.status} ${response.statusText}`)
    }

    // 检查响应头中的 Content-Type
    const contentType = response.headers.get('content-type') || ''
    if (allowedMimeTypes && allowedMimeTypes.length > 0) {
      const isAllowed = allowedMimeTypes.some((mime) => contentType.toLowerCase().includes(mime.toLowerCase()))
      if (!isAllowed) {
        throw new Error(`不支持的响应类型: ${contentType}，期望: ${allowedMimeTypes.join(', ')}`)
      }
    }

    // 检查 Content-Length
    const contentLength = response.headers.get('content-length')
    if (contentLength && parseInt(contentLength, 10) > maxContentLength) {
      throw new Error(`响应内容过大 (${contentLength} bytes)，已超过上限 (${maxContentLength} bytes)`)
    }

    return response
  }

  throw new Error('超出最大重定向次数')
}
