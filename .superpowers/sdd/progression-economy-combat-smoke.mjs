import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { hasPositiveAreaOverlap } from './browser-layout-assertions.mjs'

const root = process.cwd()
const chromePath =
  process.env.CHROME_PATH ??
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const suppliedAppUrl = process.env.APP_URL
const profile = fs.mkdtempSync(
  path.join(os.tmpdir(), 'dobe-progression-smoke-'),
)
const screenshotPath = path.resolve(
  '.superpowers/sdd/progression-economy-combat-smoke.png',
)
const HTTP_TIMEOUT_MS = 10_000
const CDP_CONNECT_TIMEOUT_MS = 10_000
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
let socket
let chrome
let server
let appUrl
let nextId = 1
const pending = new Map()
const exceptions = []
const consoleErrors = []
const buildingSpots = new Map()
let serverOutput = ''

function assert(condition, message, evidence) {
  if (!condition) {
    throw new Error(`${message}: ${JSON.stringify(evidence)}`)
  }
}

async function fetchWithTimeout(url, options = {}) {
  return fetch(url, {
    ...options,
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  })
}

async function waitForSocketOpen(target) {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('Owned Chrome WebSocket connection timed out'))
    }, CDP_CONNECT_TIMEOUT_MS)
    const cleanup = () => {
      clearTimeout(timer)
      target.removeEventListener('open', handleOpen)
      target.removeEventListener('error', handleError)
    }
    const handleOpen = () => {
      cleanup()
      resolve()
    }
    const handleError = () => {
      cleanup()
      reject(new Error('Owned Chrome WebSocket connection failed'))
    }
    target.addEventListener('open', handleOpen)
    target.addEventListener('error', handleError)
  })
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const listener = net.createServer()
    listener.unref()
    listener.once('error', reject)
    listener.listen(0, '127.0.0.1', () => {
      const address = listener.address()
      listener.close(() => resolve(address.port))
    })
  })
}

async function startOwnedServer() {
  if (suppliedAppUrl) {
    appUrl = suppliedAppUrl
    return
  }
  const port = await getFreePort()
  appUrl = `http://127.0.0.1:${port}/`
  const command =
    process.platform === 'win32'
      ? {
          executable: 'cmd.exe',
          args: [
            '/d',
            '/s',
            '/c',
            `npm.cmd run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
          ],
        }
      : {
          executable: 'npm',
          args: [
            'run',
            'dev',
            '--',
            '--host',
            '127.0.0.1',
            '--port',
            String(port),
            '--strictPort',
          ],
        }
  server = spawn(command.executable, command.args, {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  const collect = (chunk) => {
    serverOutput = `${serverOutput}${chunk.toString()}`.slice(-8_000)
  }
  server.stdout.on('data', collect)
  server.stderr.on('data', collect)
  let spawnError
  server.once('error', (error) => {
    spawnError = error
  })
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (spawnError) throw spawnError
    if (server.exitCode !== null) {
      throw new Error(
        `Owned Vite exited early (${server.exitCode}): ${serverOutput}`,
      )
    }
    try {
      const response = await fetchWithTimeout(appUrl, { cache: 'no-store' })
      if (response.ok && (await response.text()).includes('id="root"')) return
    } catch {
      // Owned Vite is still starting.
    }
    await sleep(100)
  }
  throw new Error(`Owned Vite did not start: ${serverOutput}`)
}

async function waitForDebugger() {
  assert(fs.existsSync(chromePath), 'Chrome executable must exist', {
    chromePath,
  })
  chrome = spawn(
    chromePath,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      '--window-size=1440,900',
      'about:blank',
    ],
    { stdio: 'ignore', windowsHide: true },
  )
  let spawnError
  chrome.once('error', (error) => {
    spawnError = error
  })
  const activePortFile = path.join(profile, 'DevToolsActivePort')
  let port = 0
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (spawnError) throw spawnError
    if (chrome.exitCode !== null) {
      throw new Error(`Owned Chrome exited early (${chrome.exitCode})`)
    }
    try {
      port = Number(
        fs.readFileSync(activePortFile, 'utf8').trim().split(/\r?\n/)[0],
      )
      if (Number.isInteger(port) && port > 0) break
    } catch {
      // Owned Chrome has not published its selected port yet.
    }
    await sleep(100)
  }
  assert(port > 0, 'Owned Chrome must publish a DevTools port', { port })
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const targets = await fetchWithTimeout(
        `http://127.0.0.1:${port}/json/list`,
      ).then((response) => response.json())
      const page = targets.find((target) => target.type === 'page')
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
    } catch {
      // The owned Chrome debugger is still starting.
    }
    await sleep(100)
  }
  throw new Error('Owned Chrome debugger did not start')
}

function send(method, params = {}) {
  const id = nextId++
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error(`CDP timeout: ${method}`))
    }, 10_000)
    pending.set(id, {
      resolve: (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      reject: (error) => {
        clearTimeout(timer)
        reject(error)
      },
    })
    try {
      socket.send(JSON.stringify({ id, method, params }))
    } catch (error) {
      clearTimeout(timer)
      pending.delete(id)
      reject(error)
    }
  })
}

function rejectPendingRequests(message) {
  for (const [id, waiter] of pending) {
    pending.delete(id)
    waiter.reject(new Error(message))
  }
}

async function evaluate(expression) {
  const response = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  })
  if (response.result.exceptionDetails) {
    throw new Error(response.result.exceptionDetails.text)
  }
  return response.result.result.value
}

async function waitFor(expression, label, attempts = 120) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
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

async function clickSelector(selector, index = 0, settleMs = 120) {
  const result = await evaluate(`(() => {
    const element = document.querySelectorAll(${JSON.stringify(selector)})[${index}]
    if (!(element instanceof HTMLElement) || element.matches(':disabled')) {
      return {
        clicked: false,
        matches: document.querySelectorAll(${JSON.stringify(selector)}).length,
        panelText:
          document.querySelector('.adventure-panel, .formation-panel, .battle-screen')
            ?.textContent?.trim() ?? '',
        adventure:
          JSON.parse(localStorage.getItem('dobe-adventure-progression-v1') ?? 'null')
      }
    }
    element.click()
    return { clicked: true }
  })()`)
  assert(result.clicked, `Selector must be clickable: ${selector}[${index}]`, {
    selector,
    index,
    diagnostics: result,
  })
  if (settleMs > 0) await sleep(settleMs)
}

async function mouseClick(x, y) {
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x,
    y,
    button: 'left',
    clickCount: 1,
  })
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x,
    y,
    button: 'left',
    clickCount: 1,
  })
}

async function reloadAndWait() {
  await send('Page.reload', { ignoreCache: true })
  await sleep(350)
  await waitFor(
    `document.readyState === 'complete' &&
      document.querySelector('.global-hud') &&
      document.querySelector('canvas')`,
    'reloaded app shell',
  )
}

async function readBuildingPanel() {
  return evaluate(`(() => {
    const panel = document.querySelector('.building-panel')
    return {
      present: Boolean(panel),
      title: panel?.querySelector('.building-panel__title')?.textContent?.trim() ?? '',
      unlocked: Boolean(panel) && !panel.textContent.includes('尚未解锁')
    }
  })()`)
}

async function closeBuildingPanel() {
  await clickSelector('.building-panel__close')
  await waitFor(`!document.querySelector('.building-panel')`, 'closed building panel')
}

async function findBuilding(title) {
  const tryAt = async (x, y) => {
    await mouseClick(x, y)
    await sleep(140)
    const panel = await readBuildingPanel()
    if (panel.present && panel.title === title && panel.unlocked) {
      return { x, y, panel }
    }
    if (panel.present) await closeBuildingPanel()
    return null
  }
  const cached = buildingSpots.get(title)
  if (cached) {
    const hit = await tryAt(cached.x, cached.y)
    if (hit) return hit
  }
  for (let y = 280; y <= 720; y += 42) {
    for (let x = 300; x <= 1160; x += 42) {
      const hit = await tryAt(x, y)
      if (hit) {
        buildingSpots.set(title, { x, y })
        return hit
      }
    }
  }
  throw new Error(`Building not found by owned Chrome click scan: ${title}`)
}

async function setElapsedSalvageClock() {
  await evaluate(`(() => {
    const key = 'dobe-adventure-progression-v1'
    const save = JSON.parse(localStorage.getItem(key))
    save.version = 6
    save.state.partIdleClock = Date.now() - 65000
    save.state.carPartInventory = []
    save.state.spareParts = 0
    save.state.nextPartSerial = 1
    localStorage.setItem(key, JSON.stringify(save))
  })()`)
  await reloadAndWait()
}

async function prepareBattleSave() {
  await evaluate(`(() => {
    const key = 'dobe-adventure-progression-v1'
    const save = JSON.parse(localStorage.getItem(key))
    save.version = 6
    save.state.heroLevels = { foreman: 20, anvil: 20, skyline: 20 }
    save.state.highestClearedStage = 19
    save.state.formation = [
      { heroId: 'foreman', row: 'back', index: 1 },
      { heroId: 'anvil', row: 'front', index: 0 },
      { heroId: 'skyline', row: 'back', index: 0 }
    ]
    localStorage.setItem(key, JSON.stringify(save))
  })()`)
  await reloadAndWait()
}

async function killOwnedProcess(child) {
  if (!child?.pid || child.exitCode !== null) return
  await new Promise((resolve) => {
    if (process.platform === 'win32') {
      const killer = spawn(
        'taskkill',
        ['/PID', String(child.pid), '/T', '/F'],
        { stdio: 'ignore', windowsHide: true },
      )
      killer.once('error', resolve)
      killer.once('exit', resolve)
    } else {
      child.kill('SIGTERM')
      child.once('exit', resolve)
      setTimeout(resolve, 1_000)
    }
  })
}

async function removeOwnedProfile() {
  const safe =
    path.dirname(profile) === os.tmpdir() &&
    path.basename(profile).startsWith('dobe-progression-smoke-')
  assert(safe, 'Refusing to remove an unexpected Chrome profile', { profile })
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      fs.rmSync(profile, { recursive: true, force: true })
      if (!fs.existsSync(profile)) return
    } catch {
      // Chrome may briefly retain profile handles after taskkill.
    }
    await sleep(250)
  }
  throw new Error('Owned Chrome profile could not be removed')
}

try {
  await startOwnedServer()
  const debuggerUrl = await waitForDebugger()
  socket = new WebSocket(debuggerUrl)
  await waitForSocketOpen(socket)
  socket.addEventListener('close', () => {
    rejectPendingRequests('Owned Chrome WebSocket closed')
  })
  socket.addEventListener('error', () => {
    rejectPendingRequests('Owned Chrome WebSocket failed')
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
    } else if (
      message.method === 'Runtime.consoleAPICalled' &&
      message.params.type === 'error'
    ) {
      consoleErrors.push(
        message.params.args
          .map((argument) => argument.value ?? argument.description ?? '')
          .join(' '),
      )
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
    gangText: document.querySelector('.global-hud__gang')?.textContent ?? '',
    power: document.querySelector('.global-hud__gang .resource-amount')?.getAttribute('aria-label') ?? '',
    standalonePowerCount: document.querySelectorAll('.global-hud__top > .resource-amount').length,
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth
  }))()`)
  assert(hud.resourceCount === 3, 'HUD must contain three resource icons', hud)
  assert(!hud.resourceText.includes('/10秒'), 'HUD must hide increments', hud)
  assert(
    hud.power.startsWith('战力 ') &&
      hud.gangText.includes('战力') &&
      hud.standalonePowerCount === 0 &&
      !hud.horizontalOverflow,
    'HUD power must live inside the gang button without a standalone row',
    hud,
  )

  await clickButton('设置')
  await waitFor(`document.querySelector('.settings-panel')`, 'settings panel')
  await clickButton('解锁帮派树')
  const gangFeedback = await evaluate(
    `document.querySelector('.settings-panel__feedback')?.textContent ?? ''`,
  )
  assert(gangFeedback.includes('已解锁'), 'Gang debug action must unlock all', {
    gangFeedback,
  })
  await clickButton('查看掉落概率')
  const probabilities = await evaluate(
    `document.querySelector('.settings-panel__probabilities')?.textContent ?? ''`,
  )
  assert(
    probabilities.includes('Lv.10') &&
      probabilities.includes('传说 25%') &&
      probabilities.includes('0%') &&
      ['普通', '优秀', '精良', '史诗', '传说'].every((name) =>
        probabilities.includes(name),
      ),
    'Settings must expose all five qualities, zeroes, and legendary 25%',
    { probabilities },
  )
  await clickButton('关闭调试设置')

  await findBuilding('废车回收厂')
  await closeBuildingPanel()
  await setElapsedSalvageClock()
  await findBuilding('废车回收厂')
  const productionBefore = await evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem('dobe-adventure-progression-v1')).state
    const tab = [...document.querySelectorAll('.building-panel__tabs button')]
      .find((button) => button.textContent.includes('生产'))
    return {
      tabLabel: tab?.getAttribute('aria-label') ?? '',
      hasDot: Boolean(tab?.querySelector('.building-panel__tab-dot')),
      inventory: save.carPartInventory.length,
      serial: save.nextPartSerial,
      clock: save.partIdleClock
    }
  })()`)
  await clickButton('生产')
  const productionReady = await evaluate(`(() => {
    const region = document.querySelector('.building-panel__salvage-production')
    const claim = region?.querySelector('.building-panel__claim-button')
    return {
      text: region?.textContent ?? '',
      claimText: claim?.textContent?.trim() ?? '',
      claimDisabled: claim?.disabled ?? true
    }
  })()`)
  assert(
    productionBefore.hasDot &&
      productionBefore.tabLabel.includes('可领取') &&
      productionReady.text.includes('已完成批次') &&
      productionReady.text.includes('仓库 0/40') &&
      productionReady.claimText.startsWith('领取 ') &&
      !productionReady.claimDisabled,
    'Recycling production tab must expose a claimable saved-clock preview',
    { productionBefore, productionReady },
  )
  await clickSelector('.building-panel__claim-button')
  await waitFor(
    `document.querySelector('.building-panel--claim-result')`,
    'salvage claim result',
  )
  const productionAfter = await evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem('dobe-adventure-progression-v1')).state
    const panel = document.querySelector('.building-panel--claim-result')
    return {
      title: panel?.querySelector('.building-panel__title')?.textContent?.trim() ?? '',
      text: panel?.textContent ?? '',
      receivedCards: panel?.querySelectorAll('.heroes-panel__part-card').length ?? 0,
      inventory: save.carPartInventory.length,
      serial: save.nextPartSerial,
      clock: save.partIdleClock
    }
  })()`)
  assert(
    productionAfter.title === '领取结果' &&
      productionAfter.text.includes('已结算') &&
      productionAfter.text.includes('自动回收') &&
      productionAfter.receivedCards > 0 &&
      productionAfter.inventory > productionBefore.inventory &&
      productionAfter.serial > productionBefore.serial &&
      productionAfter.clock > productionBefore.clock,
    'Claim must render results and advance persisted salvage state',
    productionAfter,
  )
  const production = {
    before: productionBefore,
    ready: productionReady,
    after: productionAfter,
  }
  await clickButton('关闭领取结果')
  await closeBuildingPanel()

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

  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: false,
  })
  await clickButton('英雄')
  await waitFor(`document.querySelector('.heroes-panel')`, 'heroes panel')
  const mobileHeroLayout = await evaluate(`(() => {
    const rect = (element) => {
      const value = element.getBoundingClientRect()
      return { left: value.left, right: value.right, top: value.top, bottom: value.bottom }
    }
    const portrait = document.querySelector('.heroes-panel__portrait')
    const identity = document.querySelector('.heroes-panel__identity')
    const power = document.querySelector('.heroes-panel__identity-copy .resource-amount')
    return {
      viewport: { width: innerWidth, height: innerHeight },
      horizontalOverflow:
        document.documentElement.scrollWidth > innerWidth ||
        document.body.scrollWidth > innerWidth,
      skillText: document.querySelector('.heroes-panel__skill')?.textContent ?? '',
      rects: {
        portrait: rect(portrait),
        identity: rect(identity),
        power: rect(power)
      }
    }
  })()`)
  assert(
    mobileHeroLayout.viewport.width === 390 &&
      mobileHeroLayout.viewport.height === 844 &&
      !mobileHeroLayout.horizontalOverflow &&
      !hasPositiveAreaOverlap(
        mobileHeroLayout.rects.portrait,
        mobileHeroLayout.rects.identity,
      ) &&
      !hasPositiveAreaOverlap(
        mobileHeroLayout.rects.portrait,
        mobileHeroLayout.rects.power,
      ),
    'Portrait must not overlap identity or power at 390px',
    mobileHeroLayout,
  )
  assert(
    mobileHeroLayout.skillText.includes('怒气 100') &&
      mobileHeroLayout.skillText.includes('普攻 +20') &&
      mobileHeroLayout.skillText.includes('受击 +10') &&
      mobileHeroLayout.skillText.includes('满怒自动释放'),
    'Heroes skill card must explain rage cost and sources',
    mobileHeroLayout,
  )
  await clickButton('车辆')
  const bulkRecycleButtons = await evaluate(`(() => ({
    labels: [...document.querySelectorAll('.heroes-panel__bulk-recycle button')]
      .map((button) => button.textContent.trim()),
    horizontalOverflow:
      document.documentElement.scrollWidth > innerWidth ||
      document.body.scrollWidth > innerWidth
  }))()`)
  assert(
    bulkRecycleButtons.labels.length === 5 &&
      ['普通', '优秀', '精良', '史诗', '传说'].every((name) =>
        bulkRecycleButtons.labels.some((label) => label.includes(name)),
      ) &&
      !bulkRecycleButtons.horizontalOverflow,
    'Heroes panel must expose five quality recycle actions at 390px',
    { bulkRecycleButtons },
  )
  const screenshot = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  })
  fs.writeFileSync(screenshotPath, Buffer.from(screenshot.result.data, 'base64'))
  assert(fs.statSync(screenshotPath).size > 0, 'Screenshot must be non-empty', {
    screenshotPath,
  })
  await clickButton('关闭英雄培养')

  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  })
  await prepareBattleSave()
  await clickButton('推关')
  await waitFor(`document.querySelector('.adventure-panel')`, 'campaign panel')
  await clickSelector('.adventure-panel__challenge')
  await waitFor(`document.querySelector('.formation-panel')`, 'formation panel')
  await clickSelector('.formation-panel__start', 0, 0)
  await waitFor(`document.querySelector('.battle-screen')`, 'battle screen')
  const initialBattle = await evaluate(`(() => ({
    rages: [...document.querySelectorAll('.battle-hud__cd')]
      .map((bar) => Number(bar.getAttribute('aria-valuenow'))),
    tick: Number(document.querySelector('.battle-screen')?.dataset.currentTick ?? 0)
  }))()`)
  assert(
    initialBattle.rages.length === 3 &&
      initialBattle.rages.every((rage) => rage === 0),
    'Real battle must begin with 0 rage',
    initialBattle,
  )
  await evaluate(`(() => {
    const battle = document.querySelector('.battle-screen')
    const read = () => ({
      rages: [...document.querySelectorAll('.battle-hud__cd')]
        .map((bar) => Number(bar.getAttribute('aria-valuenow'))),
      skillMainHits: Number(battle?.dataset.skillMainHits ?? 0)
    })
    const initial = read()
    const evidence = {
      seenGrowth: false,
      seenFull: false,
      clearedAfterSkill: false,
      maxRage: Math.max(0, ...initial.rages),
      maxSkillMainHits: initial.skillMainHits,
      lastRages: initial.rages,
      lastSkillMainHits: initial.skillMainHits,
      clearTransitions: []
    }
    const sample = () => {
      const current = read()
      evidence.seenGrowth ||= current.rages.some((rage) => rage > 0 && rage < 100)
      evidence.seenFull ||= current.rages.some((rage) => rage === 100)
      evidence.maxRage = Math.max(evidence.maxRage, ...current.rages)
      if (current.skillMainHits > evidence.lastSkillMainHits) {
        current.rages.forEach((rage, index) => {
          if (evidence.lastRages[index] === 100 && rage === 0) {
            evidence.clearedAfterSkill = true
            evidence.clearTransitions.push({
              index,
              from: evidence.lastRages[index],
              to: rage,
              skillMainHits: current.skillMainHits
            })
          }
        })
      }
      evidence.maxSkillMainHits = Math.max(
        evidence.maxSkillMainHits,
        current.skillMainHits
      )
      evidence.lastRages = current.rages
      evidence.lastSkillMainHits = current.skillMainHits
    }
    const observer = new MutationObserver(sample)
    observer.observe(battle, {
      attributes: true,
      subtree: true,
      attributeFilter: ['aria-valuenow', 'data-skill-main-hits']
    })
    globalThis.__dobeRageSmoke = { evidence, observer, sample }
    sample()
  })()`)
  let lastBattleState = initialBattle
  for (let attempt = 0; attempt < 400; attempt += 1) {
    await sleep(50)
    const state = await evaluate(`(() => ({
      rages: [...document.querySelectorAll('.battle-hud__cd')]
        .map((bar) => Number(bar.getAttribute('aria-valuenow'))),
      skillMainHits: Number(document.querySelector('.battle-screen')?.dataset.skillMainHits ?? 0),
      tick: Number(document.querySelector('.battle-screen')?.dataset.currentTick ?? 0),
      result: document.querySelector('.battle-screen__result')?.textContent ?? '',
      evidence: globalThis.__dobeRageSmoke?.evidence ?? null
    }))()`)
    lastBattleState = state
    if (
      state.evidence?.seenGrowth &&
      state.evidence?.seenFull &&
      state.evidence?.clearedAfterSkill
    ) {
      break
    }
    if (state.result && !state.evidence?.clearedAfterSkill) break
  }
  const rageEvidence = await evaluate(`(() => {
    globalThis.__dobeRageSmoke?.sample()
    globalThis.__dobeRageSmoke?.observer.disconnect()
    return globalThis.__dobeRageSmoke?.evidence ?? null
  })()`)
  const battle = {
    initial: initialBattle,
    ...rageEvidence,
    last: lastBattleState,
  }
  assert(
    rageEvidence?.seenGrowth &&
      rageEvidence.seenFull &&
      rageEvidence.clearedAfterSkill &&
      rageEvidence.maxRage === 100 &&
      rageEvidence.maxSkillMainHits > 0 &&
      rageEvidence.clearTransitions.length > 0,
    'Real battle must show rage growth, full rage, skill release, and clearing',
    battle,
  )
  assert(exceptions.length === 0, 'Browser must have no runtime exceptions', {
    exceptions,
  })
  assert(consoleErrors.length === 0, 'Browser console must have no errors', {
    consoleErrors,
  })
  console.log(
    JSON.stringify(
      {
        ok: true,
        hud,
        gangFeedback,
        probabilities: {
          fiveQualities: true,
          includesZero: probabilities.includes('0%'),
          legendary25: probabilities.includes('传说 25%'),
        },
        production,
        mobileHeroLayout,
        bulkRecycleButtons,
        battle,
        screenshot: {
          path: screenshotPath,
          bytes: fs.statSync(screenshotPath).size,
        },
        exceptions,
        consoleErrors,
      },
      null,
      2,
    ),
  )
} finally {
  socket?.close()
  await killOwnedProcess(chrome)
  await killOwnedProcess(server)
  await removeOwnedProfile()
}
