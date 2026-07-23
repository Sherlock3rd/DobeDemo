// Safe, repeatable Chrome/CDP acceptance for debug-settings account reset.
//
// Safety:
// - Selects free dev/CDP ports without connecting to or killing listeners found
//   during preflight.
// - Tracks child PIDs and only terminates process trees started by this script.
// - Creates an isolated Chrome profile under os.tmpdir() and only removes that
//   exact profile.
// - Writes machine-readable assertions and exits non-zero on any failure.
//
// Config: DEV_PORT, CDP_PORT, CHROME_PATH. Preferred occupied ports are skipped.
// Run: node .superpowers/sdd/settings-reset-cdp.mjs

import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { execFileSync, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '..', '..')
const OUT_JSON = path.join(HERE, 'settings-reset-results.json')
const DIST_INDEX = path.join(REPO, 'dist', 'index.html')
const VITE_BIN = path.join(REPO, 'node_modules', 'vite', 'bin', 'vite.js')
const CITY_KEY = 'dobe-city-progression-v1'
const GANG_KEY = 'gang-progression-v1'
const BUILDING_IDS = [
  'repair-shop',
  'recycling-yard',
  'commercial-street',
  'metalworking-plant',
  'gas-station',
  'clubhouse',
]
const INJECTED_REPUTATION = 330
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const results = {
  generatedAt: new Date().toISOString(),
  preflight: {
    terminalAndPortCheckPerformed: true,
    strategy: 'skip occupied preferred ports; never terminate unknown PID',
    attemptedDevPorts: [],
    attemptedCdpPorts: [],
  },
  processSafety: {
    ownedPids: [],
    killAttempts: [],
    unknownProcessesTerminated: false,
  },
  dist: {},
  http: {},
  injection: {},
  nonInitialBuilding: {},
  settingsOpened: {},
  firstResetClick: {},
  resetMoment: {},
  afterReset: {},
  reopenedInitialBuilding: {},
  afterRefresh: {},
  mobile: {},
  screenshots: {},
  teardown: {},
  assertionSelfTest: {},
  assertions: [],
}

let devPort
let cdpPort
let devUrl
let devProc
let chromeProc
let profileDir
let ws
let nextId = 1
const pending = new Map()
const ownedPids = new Set()

function isPortInUse(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host })
    let settled = false
    const finish = (inUse) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(inUse)
    }
    socket.setTimeout(600)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))
  })
}

async function selectFreePort(preferred, attempted) {
  for (let offset = 0; offset < 40; offset += 1) {
    const port = preferred + offset
    const inUse = await isPortInUse(port)
    attempted.push({ port, free: !inUse })
    if (!inUse) return port
  }
  throw new Error(`No free port in safe range ${preferred}-${preferred + 39}`)
}

function registerOwnedProcess(process, label) {
  if (!process?.pid) throw new Error(`${label} did not return a PID`)
  ownedPids.add(process.pid)
  results.processSafety.ownedPids.push({ label, pid: process.pid })
}

function killOwnedTree(process, label) {
  const pid = process?.pid
  if (!pid || !ownedPids.has(pid)) {
    if (pid) {
      throw new Error(`SAFETY_ABORT: refusing to terminate unowned PID ${pid}`)
    }
    return
  }
  results.processSafety.killAttempts.push({ label, pid, owned: true })
  try {
    if (process.platform === 'win32') {
      execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
        stdio: 'ignore',
      })
    } else {
      process.kill('SIGKILL')
    }
  } catch {
    // The owned child may already have exited.
  }
}

function resolveChromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(
      os.homedir(),
      'AppData',
      'Local',
      'Google',
      'Chrome',
      'Application',
      'chrome.exe',
    ),
  ].filter(Boolean)
  const found = candidates.find((candidate) => fs.existsSync(candidate))
  if (!found) throw new Error('Chrome not found; set CHROME_PATH')
  return found
}

function send(method, params = {}) {
  const id = nextId++
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })
}

async function connectCdp() {
  let targets
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${cdpPort}/json`)
      targets = await response.json()
      if (targets.some((target) => target.type === 'page')) break
    } catch {
      // Chrome is still starting.
    }
    await sleep(250)
  }
  const page = targets?.find((target) => target.type === 'page')
  if (!page) throw new Error('No CDP page target')
  ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener('error', reject, { once: true })
  })
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data))
    if (!message.id || !pending.has(message.id)) return
    const waiter = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) waiter.reject(new Error(JSON.stringify(message.error)))
    else waiter.resolve(message.result)
  })
}

async function evaluate(expression) {
  const response = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  })
  if (response.exceptionDetails) {
    throw new Error(
      `CDP evaluate failed: ${JSON.stringify(response.exceptionDetails)}`,
    )
  }
  return response.result.value
}

async function mouseClick(x, y) {
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x,
    y,
    button: 'left',
    buttons: 1,
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

async function clickSelector(selector) {
  const point = await evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)})
    if (!element) return null
    const rect = element.getBoundingClientRect()
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  })()`)
  if (!point) throw new Error(`Element not found for real click: ${selector}`)
  await mouseClick(Math.round(point.x), Math.round(point.y))
}

async function screenshot(fileName) {
  const response = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(
    path.join(HERE, fileName),
    Buffer.from(response.data, 'base64'),
  )
  results.screenshots[fileName] = fileName
}

async function waitForApp(previousTimeOrigin = null) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const state = await evaluate(`({
        href: location.href,
        ready: document.readyState,
        hasCanvas: Boolean(document.querySelector('canvas')),
        hasHud: Boolean(document.querySelector('.city-hud')),
        timeOrigin: performance.timeOrigin
      })`)
      if (
        state.href?.startsWith('http') &&
        state.ready === 'complete' &&
        state.hasCanvas &&
        state.hasHud &&
        (previousTimeOrigin === null || state.timeOrigin !== previousTimeOrigin)
      ) {
        return state
      }
    } catch {
      // The initial about:blank target has an opaque origin.
    }
    await sleep(250)
  }
  throw new Error('App did not become ready')
}

async function reloadAndWait(extraDelay = 0) {
  const previousTimeOrigin = await evaluate('performance.timeOrigin')
  await send('Page.reload', { ignoreCache: false })
  await waitForApp(previousTimeOrigin)
  if (extraDelay) await sleep(extraDelay)
}

async function readStorage() {
  return evaluate(`(() => {
    const parse = (key) => {
      const raw = localStorage.getItem(key)
      return raw === null ? null : JSON.parse(raw)
    }
    return {
      city: parse(${JSON.stringify(CITY_KEY)}),
      gang: parse(${JSON.stringify(GANG_KEY)})
    }
  })()`)
}

async function readDom() {
  return evaluate(`(() => {
    const text = (selector) => document.querySelector(selector)?.textContent?.trim() ?? null
    const dialog = document.querySelector('[role="dialog"]')
    const dialogLabelledBy = dialog?.getAttribute('aria-labelledby')
    return {
      hudLevel: text('.city-hud__level'),
      hudProgress: text('.city-hud__progress-label'),
      buildingPresent: Boolean(document.querySelector('.building-panel')),
      buildingTitle: text('.building-panel__title'),
      buildingLevel: text('.building-panel__level'),
      buildingProgress: text('.building-panel__progress-count'),
      settingsDialogPresent: Boolean(document.querySelector('.settings-panel[role="dialog"]')),
      dialogName: dialogLabelledBy
        ? document.getElementById(dialogLabelledBy)?.textContent?.trim() ?? null
        : null,
      gangTreePresent: Boolean(document.querySelector('.gang-tree-panel')),
      resetButtonPresent: [...document.querySelectorAll('button')].some(
        (button) => button.textContent?.trim() === '重置账号'
      ),
      confirmButtonPresent: [...document.querySelectorAll('button')].some(
        (button) => button.textContent?.trim() === '确认重置账号'
      ),
      warning: text('.settings-panel__warning')
    }
  })()`)
}

async function closeBuildingPanel() {
  const present = await evaluate(
    `Boolean(document.querySelector('.building-panel__close'))`,
  )
  if (present) {
    await clickSelector('.building-panel__close')
    await sleep(100)
  }
}

async function findRepairShop(preferred = { x: 455, y: 280 }) {
  const tryPoint = async (x, y) => {
    await mouseClick(x, y)
    await sleep(160)
    const dom = await readDom()
    if (
      dom.buildingPresent &&
      dom.buildingTitle === '修车厂' &&
      dom.buildingLevel
    ) {
      return { x, y, dom }
    }
    if (dom.buildingPresent) await closeBuildingPanel()
    return null
  }
  const preferredHit = await tryPoint(preferred.x, preferred.y)
  if (preferredHit) return preferredHit
  for (let y = 280; y <= 700; y += 45) {
    for (let x = 320; x <= 1120; x += 45) {
      const hit = await tryPoint(x, y)
      if (hit) return hit
    }
  }
  throw new Error('Repair shop not found via real CDP click scan')
}

function initialCityProgress(progress) {
  return (
    progress &&
    BUILDING_IDS.every(
      (id) =>
        progress[id]?.level === 1 && progress[id]?.completedFragments === 0,
    )
  )
}

function progressionDerivedGang(
  gangState,
  baselineTimestamp,
  baselineReputation,
  maxExclusive,
) {
  if (!gangState || !Number.isFinite(baselineTimestamp)) return false
  const elapsed = gangState.lastUpdatedAt - baselineTimestamp
  return (
    elapsed >= 0 &&
    elapsed % 1000 === 0 &&
    gangState.totalReputation === baselineReputation + (elapsed / 1000) * 5 &&
    gangState.totalReputation < maxExclusive
  )
}

function evaluateAssertions(value) {
  const checks = []
  const add = (name, pass, detail) =>
    checks.push({ name, pass: pass === true, detail: String(detail ?? '') })
  const injectedGang = value.injection?.storage?.gang?.state
  const beforeGang = value.firstResetClick?.beforeStorage?.gang?.state
  const afterFirstGang = value.firstResetClick?.afterStorage?.gang?.state
  const resetGang = value.resetMoment?.storage?.gang?.state
  const refreshGang = value.afterRefresh?.storage?.gang?.state
  const resetCity = value.resetMoment?.storage?.city?.state?.buildingProgress
  const refreshCity = value.afterRefresh?.storage?.city?.state?.buildingProgress

  add(
    'preflight selected free dev port',
    value.preflight?.devPortFree === true,
    value.preflight?.devPort,
  )
  add(
    'preflight selected free CDP port',
    value.preflight?.cdpPortFree === true,
    value.preflight?.cdpPort,
  )
  add(
    'dist assets use /DobeDemo/',
    value.dist?.baseOk === true,
    JSON.stringify(value.dist?.assetRefs),
  )
  add('HTTP status 200', value.http?.status === 200, value.http?.status)
  add(
    'HTTP contains root and main.tsx',
    value.http?.hasRoot === true && value.http?.hasMainTsx === true,
    JSON.stringify(value.http),
  )
  add(
    'injected gang is Lv.12 seed plus exact idle earnings',
    progressionDerivedGang(
      injectedGang,
      value.injection?.injectedAt,
      INJECTED_REPUTATION,
      360,
    ),
    JSON.stringify({ injectedAt: value.injection?.injectedAt, injectedGang }),
  )
  add(
    'injected repair shop is Lv.6 with 3 fragments',
    value.injection?.storage?.city?.state?.buildingProgress?.['repair-shop']
      ?.level === 6 &&
      value.injection?.storage?.city?.state?.buildingProgress?.['repair-shop']
        ?.completedFragments === 3,
    JSON.stringify(
      value.injection?.storage?.city?.state?.buildingProgress?.['repair-shop'],
    ),
  )
  add(
    'non-initial repair panel shown',
    value.nonInitialBuilding?.dom?.buildingTitle === '修车厂' &&
      value.nonInitialBuilding?.dom?.buildingLevel === '等级 6 / 10' &&
      value.nonInitialBuilding?.dom?.buildingProgress === '3 / 7 个子建筑',
    JSON.stringify(value.nonInitialBuilding?.dom),
  )
  add(
    'settings dialog accessible name',
    value.settingsOpened?.dom?.settingsDialogPresent === true &&
      value.settingsOpened?.dom?.dialogName === '调试设置',
    JSON.stringify(value.settingsOpened?.dom),
  )
  add(
    'settings and gang tree are mutually exclusive',
    value.settingsOpened?.dom?.gangTreePresent === false,
    value.settingsOpened?.dom?.gangTreePresent,
  )
  add(
    'first click preserves city durable store',
    value.firstResetClick?.cityStorageUnchanged === true,
    value.firstResetClick?.cityStorageUnchanged,
  )
  add(
    'first click preserves gang progression except valid idle tick',
    progressionDerivedGang(
      beforeGang,
      value.injection?.injectedAt,
      INJECTED_REPUTATION,
      360,
    ) &&
      progressionDerivedGang(
        afterFirstGang,
        value.injection?.injectedAt,
        INJECTED_REPUTATION,
        360,
      ),
    JSON.stringify({
      injectedAt: value.injection?.injectedAt,
      beforeGang,
      afterFirstGang,
    }),
  )
  add(
    'first click preserves HUD Lv.12',
    value.firstResetClick?.afterDom?.hudLevel === 'Lv. 12',
    value.firstResetClick?.afterDom?.hudLevel,
  )
  add(
    'first click preserves repair panel',
    value.firstResetClick?.afterDom?.buildingLevel === '等级 6 / 10' &&
      value.firstResetClick?.afterDom?.buildingProgress === '3 / 7 个子建筑',
    JSON.stringify(value.firstResetClick?.afterDom),
  )
  add(
    'first click enters confirmation state',
    value.firstResetClick?.afterDom?.confirmButtonPresent === true &&
      value.firstResetClick?.afterDom?.warning === '确定要永久重置当前账号吗？',
    JSON.stringify(value.firstResetClick?.afterDom),
  )
  add(
    'reset moment city persistence is initial',
    initialCityProgress(resetCity),
    JSON.stringify(resetCity),
  )
  add(
    'reset moment gang persistence is zero',
    resetGang?.totalReputation === 0,
    JSON.stringify(resetGang),
  )
  add(
    'reset uses confirmation Date.now()',
    resetGang?.lastUpdatedAt >= value.resetMoment?.nodeBeforeClick - 1000 &&
      resetGang?.lastUpdatedAt <= value.resetMoment?.nodeAfterClick + 1000,
    JSON.stringify({
      resetGang,
      before: value.resetMoment?.nodeBeforeClick,
      after: value.resetMoment?.nodeAfterClick,
    }),
  )
  add(
    'confirmation closes settings dialog',
    value.afterReset?.dom?.settingsDialogPresent === false,
    value.afterReset?.dom?.settingsDialogPresent,
  )
  add(
    'confirmation closes building panel',
    value.afterReset?.dom?.buildingPresent === false,
    value.afterReset?.dom?.buildingPresent,
  )
  add(
    'HUD resets to Lv.1',
    value.afterReset?.dom?.hudLevel === 'Lv. 1',
    value.afterReset?.dom?.hudLevel,
  )
  add(
    'repair shop reopens at Lv.1 0/2',
    value.reopenedInitialBuilding?.dom?.buildingLevel === '等级 1 / 10' &&
      value.reopenedInitialBuilding?.dom?.buildingProgress === '0 / 2 个子建筑',
    JSON.stringify(value.reopenedInitialBuilding?.dom),
  )
  add(
    'refresh city persistence remains initial',
    initialCityProgress(refreshCity),
    JSON.stringify(refreshCity),
  )
  add(
    'refresh gang is reset baseline plus exact idle earnings',
    progressionDerivedGang(refreshGang, resetGang?.lastUpdatedAt, 0, 30),
    JSON.stringify({ refreshGang, resetAt: resetGang?.lastUpdatedAt }),
  )
  add(
    'refresh HUD remains Lv.1',
    value.afterRefresh?.dom?.hudLevel === 'Lv. 1',
    value.afterRefresh?.dom?.hudLevel,
  )
  add(
    'mobile settings dialog present',
    value.mobile?.dom?.settingsDialogPresent === true &&
      value.mobile?.dom?.dialogName === '调试设置',
    JSON.stringify(value.mobile?.dom),
  )
  add(
    'mobile drawer within viewport',
    value.mobile?.measure?.withinBounds === true,
    JSON.stringify(value.mobile?.measure),
  )
  add(
    'mobile drawer has no horizontal overflow',
    value.mobile?.measure?.noHorizontalOverflow === true,
    JSON.stringify(value.mobile?.measure),
  )
  add(
    'all three screenshots written',
    value.screenshots &&
      [
        'settings-reset-confirm.png',
        'settings-reset-complete.png',
        'settings-reset-mobile.png',
      ].every(
        (name) =>
          value.screenshots[name] === name &&
          fs.existsSync(path.join(HERE, name)),
      ),
    JSON.stringify(value.screenshots),
  )
  add(
    'only owned PIDs targeted',
    value.processSafety?.unknownProcessesTerminated === false &&
      value.processSafety?.killAttempts?.every(
        (attempt) => attempt.owned === true,
      ),
    JSON.stringify(value.processSafety),
  )
  add(
    'dev port released',
    value.teardown?.devPortReleased === true,
    value.teardown?.devPortReleased,
  )
  add(
    'CDP port released',
    value.teardown?.cdpPortReleased === true,
    value.teardown?.cdpPortReleased,
  )
  add(
    'temporary Chrome profile removed',
    value.teardown?.tempProfileRemoved === true,
    value.teardown?.tempProfileRemoved,
  )
  return checks
}

function runAssertionSelfTest() {
  const now = 1_000_000
  const initialProgress = Object.fromEntries(
    BUILDING_IDS.map((id) => [id, { level: 1, completedFragments: 0 }]),
  )
  const good = {
    preflight: { devPortFree: true, cdpPortFree: true },
    processSafety: { unknownProcessesTerminated: false, killAttempts: [] },
    dist: { baseOk: true, assetRefs: ['/DobeDemo/assets/a.js'] },
    http: { status: 200, hasRoot: true, hasMainTsx: true },
    injection: {
      injectedAt: now,
      storage: {
        gang: {
          state: { totalReputation: 330, lastUpdatedAt: now },
        },
        city: {
          state: {
            buildingProgress: {
              'repair-shop': { level: 6, completedFragments: 3 },
            },
          },
        },
      },
    },
    nonInitialBuilding: {
      dom: {
        buildingTitle: '修车厂',
        buildingLevel: '等级 6 / 10',
        buildingProgress: '3 / 7 个子建筑',
      },
    },
    settingsOpened: {
      dom: {
        settingsDialogPresent: true,
        dialogName: '调试设置',
        gangTreePresent: false,
      },
    },
    firstResetClick: {
      beforeStorage: {
        gang: { state: { totalReputation: 330, lastUpdatedAt: now } },
      },
      afterStorage: {
        gang: { state: { totalReputation: 330, lastUpdatedAt: now } },
      },
      cityStorageUnchanged: true,
      afterDom: {
        hudLevel: 'Lv. 12',
        buildingLevel: '等级 6 / 10',
        buildingProgress: '3 / 7 个子建筑',
        confirmButtonPresent: true,
        warning: '确定要永久重置当前账号吗？',
      },
    },
    resetMoment: {
      nodeBeforeClick: now,
      nodeAfterClick: now,
      storage: {
        city: { state: { buildingProgress: initialProgress } },
        gang: { state: { totalReputation: 0, lastUpdatedAt: now } },
      },
    },
    afterReset: {
      dom: {
        settingsDialogPresent: false,
        buildingPresent: false,
        hudLevel: 'Lv. 1',
      },
    },
    reopenedInitialBuilding: {
      dom: { buildingLevel: '等级 1 / 10', buildingProgress: '0 / 2 个子建筑' },
    },
    afterRefresh: {
      storage: {
        city: { state: { buildingProgress: initialProgress } },
        gang: { state: { totalReputation: 5, lastUpdatedAt: now + 1000 } },
      },
      dom: { hudLevel: 'Lv. 1' },
    },
    mobile: {
      dom: { settingsDialogPresent: true, dialogName: '调试设置' },
      measure: { withinBounds: true, noHorizontalOverflow: true },
    },
    screenshots: Object.fromEntries(
      [
        'settings-reset-confirm.png',
        'settings-reset-complete.png',
        'settings-reset-mobile.png',
      ].map((name) => [name, name]),
    ),
    teardown: {
      devPortReleased: true,
      cdpPortReleased: true,
      tempProfileRemoved: true,
    },
  }
  const checks = evaluateAssertions(good)
  // Screenshot existence depends on runtime files, so it is excluded from the
  // pure-data portion while all other checks must distinguish good from empty.
  const pureChecks = checks.filter(
    (check) => check.name !== 'all three screenshots written',
  )
  const badChecks = evaluateAssertions({}).filter(
    (check) => check.name !== 'all three screenshots written',
  )
  return {
    ok:
      pureChecks.every((check) => check.pass) &&
      badChecks.every((check) => !check.pass),
    checked: pureChecks.length,
    failuresOnGoodData: pureChecks
      .filter((check) => !check.pass)
      .map((check) => check.name),
    passesOnBadData: badChecks
      .filter((check) => check.pass)
      .map((check) => check.name),
  }
}

async function preflight() {
  const preferredDev = Number(process.env.DEV_PORT || 5188)
  const preferredCdp = Number(process.env.CDP_PORT || 9234)
  devPort = await selectFreePort(
    preferredDev,
    results.preflight.attemptedDevPorts,
  )
  cdpPort = await selectFreePort(
    preferredCdp,
    results.preflight.attemptedCdpPorts,
  )
  devUrl = `http://127.0.0.1:${devPort}/`
  results.preflight.devPort = devPort
  results.preflight.cdpPort = cdpPort
  results.preflight.devPortFree = true
  results.preflight.cdpPortFree = true
  results.preflight.ok = true
}

function checkDist() {
  const html = fs.readFileSync(DIST_INDEX, 'utf8')
  const assetRefs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((reference) => reference.includes('/assets/'))
  results.dist = {
    index: 'dist/index.html',
    assetRefs,
    baseOk:
      assetRefs.length > 0 &&
      assetRefs.every((reference) => reference.startsWith('/DobeDemo/')),
  }
}

async function startDevServer() {
  if (!fs.existsSync(VITE_BIN)) throw new Error(`Vite CLI missing: ${VITE_BIN}`)
  devProc = spawn(
    process.execPath,
    [
      VITE_BIN,
      '--host',
      '127.0.0.1',
      '--port',
      String(devPort),
      '--strictPort',
    ],
    { cwd: REPO, stdio: 'ignore', windowsHide: true },
  )
  registerOwnedProcess(devProc, 'vite')
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(devUrl)
      if (response.ok) return
    } catch {
      // Vite is still starting.
    }
    if (devProc.exitCode !== null) {
      throw new Error(`Owned Vite process exited ${devProc.exitCode}`)
    }
    await sleep(250)
  }
  throw new Error('Owned Vite server did not become ready')
}

async function checkHttp() {
  const response = await fetch(devUrl)
  const body = await response.text()
  results.http = {
    url: devUrl,
    status: response.status,
    hasRoot: /id="root"/.test(body),
    hasMainTsx: body.includes('/src/main.tsx'),
  }
}

function launchChrome() {
  const chromePath = resolveChromePath()
  profileDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'dobe-settings-reset-cdp-'),
  )
  // Keep absolute paths only in local runtime variables. The JSON is a public
  // artifact, so it records basenames that cannot expose a drive, home folder,
  // username, installation directory, or OS temp directory.
  results.processSafety.chromeExecutable = path.basename(chromePath)
  results.processSafety.tempProfileName = path.basename(profileDir)
  chromeProc = spawn(
    chromePath,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--window-size=1440,900',
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${profileDir}`,
      devUrl,
    ],
    { stdio: 'ignore', windowsHide: true },
  )
  registerOwnedProcess(chromeProc, 'chrome')
}

async function injectProgress() {
  const injectedAt = Date.now()
  const buildingProgress = Object.fromEntries(
    BUILDING_IDS.map((id) => [
      id,
      id === 'repair-shop'
        ? { level: 6, completedFragments: 3 }
        : { level: 1, completedFragments: 0 },
    ]),
  )
  const citySave = { state: { buildingProgress }, version: 1 }
  const gangSave = {
    state: {
      totalReputation: INJECTED_REPUTATION,
      lastUpdatedAt: injectedAt,
    },
    version: 0,
  }
  await evaluate(`(() => {
    localStorage.setItem(${JSON.stringify(CITY_KEY)}, ${JSON.stringify(JSON.stringify(citySave))})
    localStorage.setItem(${JSON.stringify(GANG_KEY)}, ${JSON.stringify(JSON.stringify(gangSave))})
  })()`)
  await reloadAndWait(1200)
  results.injection = {
    injectedAt,
    citySave,
    gangSave,
    storage: await readStorage(),
    dom: await readDom(),
  }
}

async function measureMobileDrawer() {
  return evaluate(`(() => {
    const panel = document.querySelector('.settings-panel')
    const root = document.documentElement
    if (!panel) return { present: false }
    const rect = panel.getBoundingClientRect()
    return {
      present: true,
      viewport: { width: innerWidth, height: innerHeight },
      rect: {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height
      },
      panelScrollWidth: panel.scrollWidth,
      panelClientWidth: panel.clientWidth,
      documentScrollWidth: root.scrollWidth,
      withinBounds:
        rect.left >= -1 &&
        rect.top >= -1 &&
        rect.right <= innerWidth + 1 &&
        rect.bottom <= innerHeight + 1,
      noHorizontalOverflow:
        panel.scrollWidth <= panel.clientWidth + 1 &&
        root.scrollWidth <= innerWidth + 1
    }
  })()`)
}

async function runFlow() {
  await preflight()
  checkDist()
  await startDevServer()
  await checkHttp()
  launchChrome()
  await connectCdp()
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Input.setIgnoreInputEvents', { ignore: false })
  await send('Page.navigate', { url: devUrl })
  await waitForApp()
  await sleep(800)

  // 1. Inject Lv.12 gang and repair-shop Lv.6 / 3-fragment saves.
  await injectProgress()

  // 2. Open repair shop and prove a non-initial building state.
  const nonInitial = await findRepairShop()
  results.nonInitialBuilding = {
    coordinate: { x: nonInitial.x, y: nonInitial.y },
    dom: nonInitial.dom,
    storage: await readStorage(),
  }

  // 3. Open settings with a real click; gang tree must not be open.
  await clickSelector('[aria-label="打开调试设置"]')
  await sleep(120)
  results.settingsOpened = { dom: await readDom() }

  // 4. First reset click only enters confirmation; all progression remains.
  const beforeStorage = await readStorage()
  const beforeDom = await readDom()
  await clickSelector('.settings-panel__reset')
  const afterStorage = await readStorage()
  const afterDom = await readDom()
  results.firstResetClick = {
    beforeStorage,
    beforeDom,
    afterStorage,
    afterDom,
    cityStorageUnchanged:
      JSON.stringify(beforeStorage.city) === JSON.stringify(afterStorage.city),
    gangIdleTolerance:
      'GangIdleController may add exact +5/sec; progression must remain Lv.12 and must not reset.',
  }
  await screenshot('settings-reset-confirm.png')

  // 5. Confirm reset; capture persistence immediately as deterministic proof.
  const nodeBeforeClick = Date.now()
  await clickSelector('.settings-panel__confirm-reset')
  const resetStorage = await readStorage()
  const nodeAfterClick = Date.now()
  results.resetMoment = {
    nodeBeforeClick,
    nodeAfterClick,
    storage: resetStorage,
    evidence:
      'Raw persisted JSON read immediately after confirmation, before waiting for idle settlement.',
  }
  await sleep(120)
  results.afterReset = { dom: await readDom(), storage: await readStorage() }

  // 6. Reopen repair shop and prove Lv.1 / 0 of 2.
  const initial = await findRepairShop(results.nonInitialBuilding.coordinate)
  results.reopenedInitialBuilding = {
    coordinate: { x: initial.x, y: initial.y },
    dom: initial.dom,
    storage: await readStorage(),
  }
  await screenshot('settings-reset-complete.png')

  // 7. Refresh and verify both durable saves remain reset. Any gang reputation
  // must be exactly derivable from elapsed whole seconds since reset.
  await reloadAndWait()
  results.afterRefresh = {
    storage: await readStorage(),
    dom: await readDom(),
    idleTolerance:
      'Allowed only when reputation equals 5 * whole seconds since reset timestamp and remains Lv.1.',
  }

  // 8. At 390x844, settings is a contained bottom drawer with no h-overflow.
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  })
  await sleep(150)
  await clickSelector('[aria-label="打开调试设置"]')
  await sleep(300)
  results.mobile = {
    dom: await readDom(),
    measure: await measureMobileDrawer(),
  }
  await screenshot('settings-reset-mobile.png')
  await send('Emulation.clearDeviceMetricsOverride')
}

async function teardown() {
  try {
    ws?.close()
  } catch {
    // Ignore close races.
  }
  killOwnedTree(chromeProc, 'chrome')
  killOwnedTree(devProc, 'vite')
  await sleep(1200)
  results.teardown.cdpPortReleased = cdpPort
    ? !(await isPortInUse(cdpPort))
    : null
  results.teardown.devPortReleased = devPort
    ? !(await isPortInUse(devPort))
    : null
  if (profileDir) {
    const expectedPrefix = path.join(os.tmpdir(), 'dobe-settings-reset-cdp-')
    if (!profileDir.startsWith(expectedPrefix)) {
      throw new Error(
        `SAFETY_ABORT: refusing to remove unexpected profile ${profileDir}`,
      )
    }
    try {
      fs.rmSync(profileDir, { recursive: true, force: true })
      results.teardown.tempProfileRemoved = !fs.existsSync(profileDir)
    } catch {
      results.teardown.tempProfileRemoved = false
    }
  } else {
    results.teardown.tempProfileRemoved = null
  }
}

results.assertionSelfTest = runAssertionSelfTest()
let runError
try {
  await runFlow()
} catch (error) {
  runError = error
  results.error = String(error?.stack || error)
} finally {
  try {
    await teardown()
  } catch (error) {
    runError ||= error
    results.teardown.error = String(error?.stack || error)
  }
}

results.assertions = evaluateAssertions(results)
const failures = results.assertions.filter((assertion) => !assertion.pass)
fs.writeFileSync(OUT_JSON, `${JSON.stringify(results, null, 2)}\n`)
console.log(`WROTE ${OUT_JSON}`)
console.log(
  `ASSERTION SELF-TEST: ${results.assertionSelfTest.ok ? 'PASS' : 'FAIL'} (${results.assertionSelfTest.checked} pure-data checks)`,
)
for (const assertion of results.assertions) {
  console.log(
    `${assertion.pass ? 'PASS' : 'FAIL'} ${assertion.name}: ${assertion.detail}`,
  )
}
if (runError)
  console.error(`RUN ERROR: ${results.error || results.teardown.error}`)
if (failures.length) {
  console.error(
    `FAILED ASSERTIONS: ${failures.map((item) => item.name).join(', ')}`,
  )
}
const ok = !runError && results.assertionSelfTest.ok && failures.length === 0
console.log(ok ? 'ALL ASSERTIONS PASSED' : 'ACCEPTANCE FAILED')
process.exitCode = ok ? 0 : 1
