import { readFile, readdir, stat } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'

const ROOT = process.cwd()
const DIST = join(ROOT, 'dist')
const SINGLE_PACKAGE_BUDGET = Math.floor(1.8 * 1024 * 1024)
const TOTAL_PACKAGE_BUDGET = 18 * 1024 * 1024

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await collectFiles(fullPath)))
    else if (entry.isFile()) files.push(fullPath)
  }
  return files
}

function belongsToRoot(filePath, root) {
  return filePath === root || filePath.startsWith(`${root}/`)
}

const appConfig = JSON.parse(await readFile(join(DIST, 'app.json'), 'utf8'))
const subPackages = appConfig.subPackages || appConfig.subpackages || []
const subRoots = subPackages.map((item) => String(item.root).replace(/^\/+|\/+$/g, ''))
const absoluteFiles = await collectFiles(DIST)
const files = await Promise.all(
  absoluteFiles.map(async (filePath) => ({
    path: relative(DIST, filePath).split(sep).join('/'),
    size: (await stat(filePath)).size,
  })),
)

const packages = [
  {
    name: '主包',
    files: files.filter((file) => !subRoots.some((root) => belongsToRoot(file.path, root))),
  },
  ...subRoots.map((root) => ({
    name: `分包 ${root}`,
    files: files.filter((file) => belongsToRoot(file.path, root)),
  })),
]

let failed = false
for (const packageInfo of packages) {
  const size = packageInfo.files.reduce((sum, file) => sum + file.size, 0)
  const largest = packageInfo.files.slice().sort((a, b) => b.size - a.size)[0]
  const status = size <= SINGLE_PACKAGE_BUDGET ? '通过' : '超出预算'
  console.log(`${status}  ${packageInfo.name}: ${formatBytes(size)}`)
  if (largest) console.log(`  最大文件: ${largest.path} (${formatBytes(largest.size)})`)
  if (size > SINGLE_PACKAGE_BUDGET) failed = true
}

const totalSize = files.reduce((sum, file) => sum + file.size, 0)
console.log(`${totalSize <= TOTAL_PACKAGE_BUDGET ? '通过' : '超出预算'}  全部构建产物: ${formatBytes(totalSize)}`)
if (totalSize > TOTAL_PACKAGE_BUDGET) failed = true

if (failed) {
  console.error(
    `代码包体积超过内部预算：主包/单分包 ${formatBytes(SINGLE_PACKAGE_BUDGET)}，总包 ${formatBytes(TOTAL_PACKAGE_BUDGET)}`,
  )
  process.exitCode = 1
}
