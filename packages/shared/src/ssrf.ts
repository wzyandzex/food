import dns from 'node:dns/promises'
import net from 'node:net'

export interface SafeFetchOptions extends RequestInit {
  timeoutMs?: number
  maxRedirects?: number
  maxContentLength?: number // bytes, 默认 5MB
  allowedMimeTypes?: string[]
}

/**
 * 校验字符串是否为标准严格十进制点分 IPv4（严格禁止八进制、十六进制等混淆）
 */
function isStrictIpv4(ip: string): boolean {
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) return false
  const parts = ip.split('.').map(Number)
  return parts.every((p) => p >= 0 && p <= 255)
}

/**
 * 校验目标 IP 是否为内网/回环/保留私有地址（严格防御各种进制变形）
 */
export function isPrivateIp(ip: string): boolean {
  // 拦截八进制 (0177)、十六进制 (0x7f) 或纯整数形式等非法 IP 表示
  if (/^0x/i.test(ip) || /^0\d+/.test(ip) || /^\d+$/.test(ip)) {
    return true
  }

  if (isStrictIpv4(ip)) {
    const parts = ip.split('.').map(Number)
    const p0 = parts[0] ?? 0
    const p1 = parts[1] ?? 0

    // 0.0.0.0/8 (Current network)
    if (p0 === 0) return true
    // 10.0.0.0/8 (Private network)
    if (p0 === 10) return true
    // 100.64.0.0/10 (Carrier-grade NAT)
    if (p0 === 100 && p1 >= 64 && p1 <= 127) return true
    // 127.0.0.0/8 (Loopback)
    if (p0 === 127) return true
    // 169.254.0.0/16 (Link-local / AWS/GCP/Alibaba metadata)
    if (p0 === 169 && p1 === 254) return true
    // 172.16.0.0/12 (Private network)
    if (p0 === 172 && p1 >= 16 && p1 <= 31) return true
    // 192.0.0.0/24 & 192.0.2.0/24 (TEST-NET-1 / Reserved)
    if (p0 === 192 && p1 === 0) return true
    // 192.168.0.0/16 (Private network)
    if (p0 === 192 && p1 === 168) return true
    // 198.18.0.0/15 (Benchmark testing)
    if (p0 === 198 && (p1 === 18 || p1 === 19)) return true
    // 198.51.100.0/24 & 203.0.113.0/24 (TEST-NET-2/3)
    if ((p0 === 198 && p1 === 51) || (p0 === 203 && p1 === 0)) return true
    // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved / Future use)
    if (p0 >= 224) return true
    return false
  }

  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase()
    // ::1 (Loopback)
    if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1' || normalized === '::') return true
    // IPv4-mapped IPv6 (::ffff:127.0.0.1 等)
    if (normalized.startsWith('::ffff:')) {
      const v4Part = normalized.slice(7)
      return isPrivateIp(v4Part)
    }
    // fc00::/7 (Unique local address)
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true
    // fe80::/10 (Link-local)
    if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true
    return false
  }

  return true // 无法识别为合规公开公网 IP 的统一拒绝
}

/**
 * 严格校验 URL 合法性并解析全部 DNS 记录检测 SSRF（彻底防御 DNS Rebinding 与多 A 记录旁路）
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

  // 1. 基础字面量黑名单快速过滤
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.includes('metadata.google.internal') ||
    hostname.includes('instance-data')
  ) {
    throw new Error(`禁止访问受保护或内网主机: ${hostname}`)
  }

  // 2. 拦截特殊编码/进制主机名（如 0x7f000001, 2130706433）
  if (/^0x/i.test(hostname) || /^\d+$/.test(hostname) || /^0\d+/.test(hostname)) {
    throw new Error(`禁止使用非常规进制 IP 访问: ${hostname}`)
  }

  // 3. 若直接是 IP 字面量
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new Error(`禁止访问私有/内网 IP 地址: ${hostname}`)
    }
    return parsed
  }

  // 4. 执行真实 DNS 解析检查（解析所有 IPv4 和 IPv6 A/AAAA 记录，任何一条为私有 IP 立即整单阻断）
  try {
    const addresses = await dns.lookup(hostname, { all: true })
    if (!addresses || addresses.length === 0) {
      throw new Error(`DNS 无法解析该域名: ${hostname}`)
    }
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
 * 包装流式 Response，提供实时传输字节数熔断（防御 Chunked 慢速 DoS / 无限流攻击）
 */
async function enforceBodySizeLimit(response: Response, maxBytes: number): Promise<ArrayBuffer> {
  if (!response.body) {
    return new ArrayBuffer(0)
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    if (value) {
      totalBytes += value.length
      if (totalBytes > maxBytes) {
        // 立即取消流读取
        await reader.cancel()
        throw new Error(`响应流式体积过大，已超过单次上限 (${maxBytes} 字节)，已主动熔断`)
      }
      chunks.push(value)
    }
  }

  // 合并 chunks
  const result = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return result.buffer
}

/**
 * 具有全套 SSRF 防御、重定向逐级校验、超时控制与流式体积熔断的安全 fetch
 */
export async function safeFetch(url: string, options: SafeFetchOptions = {}): Promise<Response> {
  const {
    timeoutMs = 15000,
    maxRedirects = 3,
    maxContentLength = 5 * 1024 * 1024, // 默认 5MB
    allowedMimeTypes,
    ...fetchInit
  } = options

  let currentUrl = url
  let redirectsCount = 0

  while (redirectsCount <= maxRedirects) {
    const targetUrl = await validateSafeUrl(currentUrl)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    let rawResponse: Response
    try {
      rawResponse = await fetch(targetUrl.toString(), {
        ...fetchInit,
        signal: controller.signal,
        redirect: 'manual', // 手动处理重定向以逐级严格校验目标 IP
      })
    } catch (err: unknown) {
      clearTimeout(timeoutId)
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`请求目标 URL 超时 (${timeoutMs}ms)`)
      }
      throw err
    }
    clearTimeout(timeoutId)

    // 处理 301, 302, 303, 307, 308 重定向
    if ([301, 302, 303, 307, 308].includes(rawResponse.status)) {
      const location = rawResponse.headers.get('location')
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

    if (!rawResponse.ok) {
      throw new Error(`目标服务器返回 HTTP 状态错误: ${rawResponse.status} ${rawResponse.statusText}`)
    }

    // 检查响应头中的 Content-Type
    const contentType = rawResponse.headers.get('content-type') || ''
    if (allowedMimeTypes && allowedMimeTypes.length > 0) {
      const isAllowed = allowedMimeTypes.some((mime) => contentType.toLowerCase().includes(mime.toLowerCase()))
      if (!isAllowed) {
        throw new Error(`不支持的响应类型: ${contentType}，期望: ${allowedMimeTypes.join(', ')}`)
      }
    }

    // 检查明确的 Content-Length
    const contentLength = rawResponse.headers.get('content-length')
    if (contentLength && parseInt(contentLength, 10) > maxContentLength) {
      throw new Error(`响应内容过大 (${contentLength} 字节)，已超过上限 (${maxContentLength} 字节)`)
    }

    // 对流式 / Chunked 响应体进行实际字节数熔断式读取并重构安全 Response
    const buffer = await enforceBodySizeLimit(rawResponse, maxContentLength)

    return new Response(buffer, {
      status: rawResponse.status,
      statusText: rawResponse.statusText,
      headers: rawResponse.headers,
    })
  }

  throw new Error('超出最大重定向次数')
}
