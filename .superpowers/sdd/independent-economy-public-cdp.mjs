import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC_URL = 'https://sherlock3rd.github.io/DobeDemo/'
const SCREENSHOT = path.join(HERE, 'independent-economy-public.png')
const PROFILE_PREFIX = path.join(
  os.tmpdir(),
  'dobe-independent-economy-public-',
)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function resolveChromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    path.join(
      process.env['PROGRAMFILES'] ?? '',
      'Google',
      'Chrome',
      'Application',
      'chrome.exe',
    ),
    path.join(
      process.env['PROGRAMFILES(X86)'] ?? '',
      'Google',
      'Chrome',
      'Application',
      'chrome.exe',
    ),
    path.join(
      process.env.LOCALAPPDATA ?? '',
      'Google',
      'Chrome',
      'Application',
      'chrome.exe',
    ),
  ].filter(Boolean)
  const chromePath = candidates.find((candidate) => fs.existsSync(candidate))
  if (!chromePath) throw new Error('Chrome executable not found')
  return chromePath
}

async function selectFreePort() {
  const server = net.createServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : null
  await new Promise((resolve) => server.close(resolve))
  if (!port) throw new Error('Unable to select a CDP port')
  return port
}

async function waitForPage(port) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`)
      const pages = await response.json()
      const page = pages.find((entry) => entry.type === 'page')
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
    } catch {
      // Chrome is still starting.
    }
    await sleep(100)
  }
  throw new Error('Timed out waiting for Chrome CDP')
}

async function connect(url) {
  const socket = new WebSocket(url)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })
  let nextId = 1
  const pending = new Map()
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    const request = pending.get(message.id)
    if (!request) return
    pending.delete(message.id)
    if (message.error) request.reject(new Error(message.error.message))
    else request.resolve(message.result)
  })
  return {
    close: () => socket.close(),
    send(method, params = {}) {
      const id = nextId
      nextId += 1
      socket.send(JSON.stringify({ id, method, params }))
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject })
      })
    },
  }
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  })
  if (result.exceptionDetails) throw new Error('Browser evaluation failed')
  return result.result.value
}

async function click(cdp, x, y) {
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x,
    y,
    button: 'left',
    buttons: 1,
    clickCount: 1,
  })
  await sleep(30)
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x,
    y,
    button: 'left',
    clickCount: 1,
  })
}

async function findRepairShop(cdp) {
  const points = [{ x: 468, y: 280 }]
  for (let y = 240; y <= 720; y += 42) {
    for (let x = 260; x <= 1180; x += 42) {
      points.push({ x, y })
    }
  }
  for (const point of points) {
    await click(cdp, point.x, point.y)
    await sleep(170)
    const panel = await evaluate(
      cdp,
      `(() => {
        const panel = document.querySelector('.building-panel')
        return panel ? {
          title: panel.querySelector('.building-panel__title')?.textContent?.trim() ?? null,
          unlocked: Boolean(panel.querySelector('.building-panel__level')),
        } : null
      })()`,
    )
    if (panel?.title === '修车厂' && panel.unlocked) return point
    if (panel) {
      await evaluate(
        cdp,
        `document.querySelector('.building-panel__close')?.click(); true`,
      )
      await sleep(100)
    }
  }
  throw new Error('Repair shop not found by real CDP click scan')
}

const port = await selectFreePort()
const profileDir = fs.mkdtempSync(PROFILE_PREFIX)
const chrome = spawn(
  resolveChromePath(),
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    '--window-size=1440,900',
    'about:blank',
  ],
  { stdio: 'ignore', windowsHide: true },
)
let cdp

try {
  cdp = await connect(await waitForPage(port))
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  })
  await cdp.send('Page.navigate', {
    url: `${PUBLIC_URL}?release=2fffcf455b1e191b52ca296ad857abd63f98a2c5`,
  })
  await sleep(4_000)
  await evaluate(cdp, 'localStorage.clear(); location.reload(); true')
  await sleep(4_000)
  const repairCoordinate = await findRepairShop(cdp)
  await sleep(500)

  const evidence = await evaluate(
    cdp,
    `(() => ({
      url: location.href,
      title: document.querySelector('.building-panel__title')?.textContent?.trim() ?? null,
      childCount: document.querySelectorAll('.building-panel__child-card').length,
      resources: [...document.querySelectorAll('.city-hud__resource')].map((node) => node.textContent?.replace(/\\s+/g, ' ').trim()),
    }))()`,
  )
  if (
    evidence.title !== '修车厂' ||
    evidence.childCount !== 5 ||
    !evidence.resources.some((text) => text?.startsWith('钱 ')) ||
    !evidence.resources.some((text) => text?.startsWith('油 ')) ||
    !evidence.resources.some((text) => text?.startsWith('物资 '))
  ) {
    throw new Error(
      `Public UI verification failed: ${JSON.stringify(evidence)}`,
    )
  }

  const shot = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
  })
  fs.writeFileSync(SCREENSHOT, Buffer.from(shot.data, 'base64'))
  if (fs.statSync(SCREENSHOT).size === 0) {
    throw new Error('Public screenshot is empty')
  }
  console.log(
    JSON.stringify({
      ...evidence,
      repairCoordinate,
      screenshot: path.basename(SCREENSHOT),
    }),
  )
} finally {
  cdp?.close()
  if (chrome.pid) {
    spawnSync('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    })
  }
  if (!profileDir.startsWith(PROFILE_PREFIX)) {
    throw new Error('Refusing to remove unexpected Chrome profile')
  }
  for (
    let attempt = 0;
    attempt < 20 && fs.existsSync(profileDir);
    attempt += 1
  ) {
    try {
      fs.rmSync(profileDir, { recursive: true, force: true })
    } catch {
      await sleep(100)
    }
  }
  if (fs.existsSync(profileDir)) {
    throw new Error('Chrome profile cleanup failed')
  }
}
