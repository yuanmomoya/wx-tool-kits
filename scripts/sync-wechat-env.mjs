import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const parseEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return {}

  const parsed = {}
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const separator = line.indexOf('=')
    if (separator < 1) continue

    const key = line.slice(0, separator).trim()
    let value = line.slice(separator + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    parsed[key] = value
  }
  return parsed
}

const env = {
  ...parseEnvFile(path.join(root, '.env.example')),
  ...parseEnvFile(path.join(root, '.env')),
}

const appid = env.TARO_APP_ID
if (!appid || appid === 'wxYourAppIdHere') {
  console.warn('[sync-wechat-env] 未配置有效的 TARO_APP_ID，请复制 .env.example 为 .env 并填写')
  process.exit(0)
}

const privateConfigPath = path.join(root, 'project.private.config.json')
const current = fs.existsSync(privateConfigPath)
  ? JSON.parse(fs.readFileSync(privateConfigPath, 'utf8'))
  : {}

current.appid = appid
fs.writeFileSync(privateConfigPath, `${JSON.stringify(current, null, 2)}\n`)
