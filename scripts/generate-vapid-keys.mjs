// 生成 Web Push VAPID 密钥对（零成本，无需第三方服务）
// 用法：node scripts/generate-vapid-keys.mjs
// 输出可直接粘贴进 .env.local / Vercel 环境变量
import webpush from 'web-push'

const keys = webpush.generateVAPIDKeys()

console.log('生成的 VAPID 密钥对（私钥属机密，严禁提交进仓库）：\n')
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`)
console.log('VAPID_SUBJECT=mailto:kaifan-notifications@example.com')
