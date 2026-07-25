import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const appUrl = process.env.APP_URL ?? 'http://127.0.0.1:5199/'
const chromePath =
  process.env.CHROME_PATH ??
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const profile = fs.mkdtempSync(
  path.join(os.tmpdir(), 'dobe-progression-smoke-'),
)
const screenshotPath = path.resolve(
  '.superpowers/sdd/progression-economy-combat-smoke.png',
)
const chrome = spawn(
  chromePath,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=9238',
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
let socket
let nextId = 1
const pending = new Map()
const exceptions = []

async function waitForDebugger() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const targets = await fetch('http://127.0.0.1:9238/json/list').then(
        (response) => response.json(),
      )
      const page = targets.find((target) => target.type === 'page')
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
    } catch {
      // Chrome is still starting.
    }
    await sleep(100)
  }
  throw new Error('Chrome debugger did not start')
}

function send(method, params = {}) {
  const id = nextId++
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
}

async function evaluate(expression) {
  const response = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  })
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.text)
  }
  return response.result.result.value
}

async function waitFor(expression, label) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await evaluate(`Boolean(${expression})`)) return
    await sleep(100)
  }
  throw new Error(`Timed out waiting for ${label}`)
}

async function clickButton(text) {
  const clicked = await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find(
      (candidate) => (
        candidate.textContent.trim() + ' ' + (candidate.getAttribute('aria-label') ?? '')
      ).includes(${JSON.stringify(text)})
    )
    if (!button || button.disabled) return false
    button.click()
    return true
  })()`)
  if (!clicked) throw new Error(`Button unavailable: ${text}`)
  await sleep(120)
}

function assert(condition, message, evidence) {
  if (!condition) {
    throw new Error(`${message}: ${JSON.stringify(evidence)}`)
  }
}

try {
  const debuggerUrl = await waitForDebugger()
  socket = new WebSocket(debuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (message.id) {
      const waiter = pending.get(message.id)
      if (!waiter) return
      pending.delete(message.id)
      if (message.error) waiter.reject(new Error(message.error.message))
      else waiter.resolve(message)
      return
    }
    if (message.method === 'Runtime.exceptionThrown') {
      exceptions.push(message.params.exceptionDetails.text)
    }
  })
  await send('Runtime.enable')
  await send('Page.enable')
  await send('Page.navigate', { url: appUrl })
  await waitFor(
    `document.querySelector('.global-hud') && document.querySelector('canvas')`,
    'app shell',
  )

  const hud = await evaluate(`(() => ({
    resourceCount: document.querySelectorAll('.global-hud__resources .resource-amount').length,
    resourceText: document.querySelector('.global-hud__resources')?.textContent ?? '',
    power: document.querySelector('.global-hud__top > .resource-amount')?.getAttribute('aria-label') ?? ''
  }))()`)
  assert(hud.resourceCount === 3, 'HUD must contain three resource icons', hud)
  assert(!hud.resourceText.includes('/10秒'), 'HUD must hide increments', hud)
  assert(hud.power.startsWith('战力 '), 'HUD must show total power', hud)

  await clickButton('设置')
  await waitFor(`document.querySelector('.settings-panel')`, 'settings panel')
  await clickButton('帮派树升一级')
  const gangFeedback = await evaluate(
    `document.querySelector('.settings-panel__feedback')?.textContent ?? ''`,
  )
  assert(gangFeedback.includes('Lv.2'), 'Gang level button must advance once', {
    gangFeedback,
  })
  await clickButton('查看掉落概率')
  const probabilities = await evaluate(
    `document.querySelector('.settings-panel__probabilities')?.textContent ?? ''`,
  )
  assert(
    probabilities.includes('Lv.10') &&
      probabilities.includes('原型 25%') &&
      probabilities.includes('16–20关'),
    'Settings must expose salvage and stage probabilities',
    { probabilities },
  )
  await clickButton('关闭')

  await clickButton('推关')
  await waitFor(`document.querySelector('.adventure-panel')`, 'campaign panel')
  const campaignReward = await evaluate(
    `document.querySelector('.adventure-panel__rewards')?.textContent ?? ''`,
  )
  assert(
    campaignReward.includes('英雄经验 500') &&
      campaignReward.includes('钱 100') &&
      campaignReward.includes('配件概率 20%'),
    'Campaign must preview composite rewards',
    { campaignReward },
  )
  await clickButton('关闭')

  await clickButton('英雄')
  await waitFor(`document.querySelector('.heroes-panel')`, 'heroes panel')
  await clickButton('车辆')
  const bulkRecycleButtons = await evaluate(
    `document.querySelectorAll('.heroes-panel__bulk-recycle button').length`,
  )
  assert(
    bulkRecycleButtons === 4,
    'Heroes panel must expose four quality recycle actions',
    { bulkRecycleButtons },
  )
  await clickButton('关闭')

  await evaluate(`(() => {
    const key = 'dobe-adventure-progression-v1'
    const save = JSON.parse(localStorage.getItem(key))
    save.version = 5
    save.state.highestClearedRacingStage = 1
    localStorage.setItem(key, JSON.stringify(save))
    location.reload()
  })()`)
  await waitFor(`document.querySelector('.global-hud')`, 'reloaded HUD')
  await clickButton('赛车')
  await waitFor(`document.querySelector('.racing-panel')`, 'racing panel')
  const stageTwo = await evaluate(
    `document.querySelector('.racing-panel')?.textContent ?? ''`,
  )
  assert(
    stageTwo.includes('第 2 关') &&
      stageTwo.includes('没有护卫') &&
      stageTwo.includes('300') &&
      stageTwo.includes('20%'),
    'Racing stage two must show money, chance, and zero escorts',
    { stageTwo },
  )
  await clickButton('发车')
  await waitFor(`document.querySelector('.race-screen')`, 'race screen')
  const pursuit = await evaluate(`(() => ({
    sight: document.querySelector('.race-hud__sight')?.textContent ?? '',
    durabilityMax: Number(document.querySelector('.race-hud__status label progress')?.max ?? 0)
  }))()`)
  assert(pursuit.sight.includes('护卫 0/0'), 'Stage two must spawn no escorts', pursuit)
  assert(pursuit.durabilityMax === 100, 'Pursuit durability must not be doubled', pursuit)

  const screenshot = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  })
  fs.writeFileSync(screenshotPath, Buffer.from(screenshot.result.data, 'base64'))
  assert(exceptions.length === 0, 'Browser must have no runtime exceptions', {
    exceptions,
  })
  console.log(
    JSON.stringify(
      {
        ok: true,
        hud,
        gangFeedback,
        bulkRecycleButtons,
        pursuit,
        screenshot: screenshotPath,
      },
      null,
      2,
    ),
  )
} finally {
  socket?.close()
  chrome.kill()
  await sleep(300)
  fs.rmSync(profile, { recursive: true, force: true })
}
