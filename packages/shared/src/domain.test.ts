import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  isValidRecipeTransition,
  isValidOrderTransition,
  isValidCircleMealMemoryTransition,
  safeParseCircleMealMemory,
  safeParseCircleMealCookSession,
} from './index.ts'
import {
  isPrivateIp,
  validateSafeUrl,
} from './ssrf.ts'

describe('Domain State Machine Transitions', () => {
  it('should enforce valid order state transitions', () => {
    assert.equal(isValidOrderTransition('closed', 'shopping'), true)
    assert.equal(isValidOrderTransition('shopping', 'cooking'), true)
    assert.equal(isValidOrderTransition('shopping', 'done'), true)
    assert.equal(isValidOrderTransition('open', 'done'), false)
  })

  it('should enforce valid recipe state transitions', () => {
    // 允许 pending -> published
    assert.equal(isValidRecipeTransition('pending', 'published'), true)
    // 允许 pending -> rejected
    assert.equal(isValidRecipeTransition('pending', 'rejected'), true)
    // 允许 published -> offline
    assert.equal(isValidRecipeTransition('published', 'offline'), true)
    // 禁止 published -> draft
    assert.equal(isValidRecipeTransition('published', 'draft'), false)
    // 禁止 failed -> published (必须先回退草稿或重新处理)
    assert.equal(isValidRecipeTransition('failed', 'published'), false)
  })

  it('should enforce valid circle meal memory transitions', () => {
    assert.equal(isValidCircleMealMemoryTransition('draft', 'published'), true)
    assert.equal(isValidCircleMealMemoryTransition('published', 'withdrawn'), true)
    assert.equal(isValidCircleMealMemoryTransition('published', 'draft'), false)
  })

  it('should validate circle meal memory input boundaries', () => {
    const result = safeParseCircleMealMemory({
      title: '周末晚餐',
      mealDate: '2026-08-28',
      mealType: 'dinner',
      dishes: [{ title: '番茄炒蛋' }],
    })
    assert.equal(result.success, true)

    const invalid = safeParseCircleMealMemory({
      title: '',
      mealDate: '28/08/2026',
      mealType: 'dinner',
      dishes: [],
    })
    assert.equal(invalid.success, false)

    const cookShare = safeParseCircleMealCookSession({
      sourceCookSessionId: '550e8400-e29b-41d4-a716-446655440000',
      selectedDishIds: ['550e8400-e29b-41d4-a716-446655440001'],
      selectedPhotos: [],
      sharedNote: '这顿饭很香',
      publish: true,
    })
    assert.equal(cookShare.success, true)

    const invalidCookShare = safeParseCircleMealCookSession({
      sourceCookSessionId: '550e8400-e29b-41d4-a716-446655440000',
      selectedDishIds: [],
    })
    assert.equal(invalidCookShare.success, false)
  })
})

describe('SSRF & Private IP Protection', () => {
  it('should identify IPv4 loopback and private subnets', () => {
    assert.equal(isPrivateIp('127.0.0.1'), true)
    assert.equal(isPrivateIp('10.0.1.5'), true)
    assert.equal(isPrivateIp('192.168.1.1'), true)
    assert.equal(isPrivateIp('172.16.0.1'), true)
    assert.equal(isPrivateIp('169.254.169.254'), true) // 云元数据
    assert.equal(isPrivateIp('8.8.8.8'), false) // 公网 IP
    assert.equal(isPrivateIp('1.1.1.1'), false) // 公网 IP
  })

  it('should identify obfuscated/hex/octal representations as private/unsafe', () => {
    assert.equal(isPrivateIp('0177.0.0.1'), true)
    assert.equal(isPrivateIp('0x7f000001'), true)
    assert.equal(isPrivateIp('2130706433'), true)
  })

  it('should identify IPv6 loopback and private addresses', () => {
    assert.equal(isPrivateIp('::1'), true)
    assert.equal(isPrivateIp('fe80::1'), true)
    assert.equal(isPrivateIp('fc00::1'), true)
    assert.equal(isPrivateIp('::ffff:127.0.0.1'), true)
  })

  it('should reject unsafe or private URLs in validateSafeUrl', async () => {
    await assert.rejects(async () => validateSafeUrl('http://127.0.0.1/admin'))
    await assert.rejects(async () => validateSafeUrl('http://localhost:3000'))
    await assert.rejects(async () => validateSafeUrl('http://169.254.169.254/latest/meta-data/'))
    await assert.rejects(async () => validateSafeUrl('http://0x7f.1/test'))
  })
})
