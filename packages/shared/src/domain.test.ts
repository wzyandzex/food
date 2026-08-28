import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  isValidRecipeTransition,
  isValidOrderTransition,
} from './index.ts'
import {
  isPrivateIp,
  validateSafeUrl,
} from './ssrf.ts'

describe('Domain State Machine Transitions', () => {
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

  it('should enforce valid order session state transitions', () => {
    // 允许 open -> closed
    assert.equal(isValidOrderTransition('open', 'closed'), true)
    // 允许 closed -> shopping
    assert.equal(isValidOrderTransition('closed', 'shopping'), true)
    // 允许 shopping -> cooking
    assert.equal(isValidOrderTransition('shopping', 'cooking'), true)
    // 允许 cooking -> done
    assert.equal(isValidOrderTransition('cooking', 'done'), true)
    // 禁止已完成(done)再流转回 open
    assert.equal(isValidOrderTransition('done', 'open'), false)
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
