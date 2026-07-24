// Safe local Chrome/CDP acceptance for campaign, heroes and GlobalHud.
// Visible controls are driven with Input.dispatchMouseEvent, never DOM.click().
import crypto from 'node:crypto'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { execFileSync, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '..', '..')
const OUT_JSON = path.join(HERE, 'campaign-heroes-global-hud-results.json')
const DIST_INDEX = path.join(REPO, 'dist', 'index.html')
const VITE_BIN = path.join(REPO, 'node_modules', 'vite', 'bin', 'vite.js')
const PROFILE_PREFIX = 'dobe-campaign-heroes-cdp-'
const CITY_KEY = 'dobe-city-progression-v1'
const GANG_KEY = 'gang-progression-v1'
const ADVENTURE_KEY = 'dobe-adventure-progression-v1'
const BUILDING_IDS = [
  'repair-shop',
  'recycling-yard',
  'commercial-street',
  'metalworking-plant',
  'gas-station',
  'clubhouse',
]
const EXPECTED_SHOTS = [
  'campaign-fresh.png',
  'campaign-formation.png',
  'campaign-battle.png',
  'campaign-skill.png',
  'campaign-victory.png',
  'campaign-idle-heroes.png',
  'campaign-unlocks.png',
  'campaign-building-100.png',
  'campaign-mobile.png',
  'campaign-reset.png',
]

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const results = {
  generatedAt: new Date().toISOString(),
  script: 'campaign-heroes-global-hud-cdp.mjs',
  preflight: {
    strategy:
      'strict owned Vite port; Chrome assigns CDP port 0 inside isolated profile',
    attemptedDevPorts: [],
    cdpPortSource: 'DevToolsActivePort',
  },
  processSafety: {
    ownedPids: [],
    killAttempts: [],
    unknownProcessesTerminated: false,
  },
  dist: {},
  http: {},
  fresh: {},
  battle: {},
  idle: {},
  heroes: {},
  unlocks: {},
  overlay: {},
  building: {},
  migration: {},
  reset: {},
  layout: {},
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
const buildingSpots = {}

function check(name, pass, detail = '') {
  const assertion = { name, pass: pass === true, detail: String(detail ?? '') }
  results.assertions.push(assertion)
  console.log(`${assertion.pass ? 'PASS' : 'FAIL'} ${name}: ${assertion.detail}`)
  return assertion.pass
}

function arraysEqual(left, right) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  )
}

function pureChecks(value) {
  return [
    value?.preflight?.cdpPortSource === 'DevToolsActivePort',
    value?.fresh?.wallet?.money === 10000,
    value?.fresh?.sharedExp === 0,
    value?.battle?.highestAfter === 1,
    value?.battle?.sharedAfter === 500,
    value?.battle?.combatStateChanged === true,
    value?.battle?.runningVictoryDistinct === true,
    value?.teardown?.devPortReleased === true,
    value?.teardown?.cdpPortReleased === true,
    value?.teardown?.tempProfileRemoved === true,
  ]
}

function toPublicErrorCategory(error) {
  const rawName =
    error && typeof error === 'object' && typeof error.name === 'string'
      ? error.name
      : 'Error'
  const name = /^[A-Za-z][A-Za-z0-9]*$/.test(rawName)
    ? rawName.slice(0, 64)
    : 'Error'
  const rawCode =
    error && typeof error === 'object' && typeof error.code === 'string'
      ? error.code
      : null
  const code =
    rawCode && /^[A-Z0-9_-]{1,40}$/.test(rawCode) ? rawCode : null
  return code ? { name, code } : { name }
}

function runAssertionSelfTest() {
  const good = {
    preflight: { cdpPortSource: 'DevToolsActivePort' },
    fresh: { wallet: { money: 10000 }, sharedExp: 0 },
    battle: {
      highestAfter: 1,
      sharedAfter: 500,
      combatStateChanged: true,
      runningVictoryDistinct: true,
    },
    teardown: {
      devPortReleased: true,
      cdpPortReleased: true,
      tempProfileRemoved: true,
    },
  }
  const windowsError = new Error('C:\\Users\\private\\secret\\file.mjs')
  windowsError.stack = 'at C:\\Users\\private\\secret\\file.mjs:1:1'
  windowsError.code = 'ENOENT'
  const unixError = new TypeError('/Users/private/secret/file.mjs')
  unixError.stack = 'at /Users/private/secret/file.mjs:1:1'
  const publicErrors = [
    toPublicErrorCategory(windowsError),
    toPublicErrorCategory(unixError),
  ]
  const serialized = JSON.stringify(publicErrors)
  const redacted =
    !/Users|private|secret|[A-Za-z]:\\|\/Users\/|message|stack/i.test(
      serialized,
    ) &&
    serialized ===
      JSON.stringify([
        { name: 'Error', code: 'ENOENT' },
        { name: 'TypeError' },
      ])
  const goodChecks = pureChecks(good)
  const emptyChecks = pureChecks({})
  return {
    ok:
      goodChecks.every(Boolean) &&
      emptyChecks.every((value) => value === false) &&
      redacted,
    checked: goodChecks.length + 1,
    failuresOnGoodData: goodChecks
      .map((pass, index) => ({ pass, index }))
      .filter((item) => !item.pass)
      .map((item) => item.index),
    passesOnEmptyData: emptyChecks
      .map((pass, index) => ({ pass, index }))
      .filter((item) => item.pass)
      .map((item) => item.index),
    pathRedaction: {
      ok: redacted,
      outputs: publicErrors,
      forbiddenDataPresent: !redacted,
    },
  }
}

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

function registerOwnedProcess(child, label) {
  if (!child?.pid) throw new Error(`${label} did not return a PID`)
  ownedPids.add(child.pid)
  results.processSafety.ownedPids.push({ label, pid: child.pid })
}

function killOwnedTree(child, label) {
  const pid = child?.pid
  if (!pid) return
  if (!ownedPids.has(pid)) {
    results.processSafety.unknownProcessesTerminated = true
    throw new Error(`SAFETY_ABORT: refusing to terminate unowned PID ${pid}`)
  }
  results.processSafety.killAttempts.push({ label, pid, owned: true })
  try {
    if (process.platform === 'win32') {
      execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
        stdio: 'ignore',
      })
    } else {
      process.kill(pid, 'SIGKILL')
    }
  } catch {
    // An owned process may already have exited.
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
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
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
  const activePortFile = path.join(profileDir, 'DevToolsActivePort')
  let activePortText
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (chromeProc?.exitCode !== null) {
      throw new Error(`Owned Chrome process exited ${chromeProc.exitCode}`)
    }
    if (fs.existsSync(activePortFile)) {
      activePortText = fs.readFileSync(activePortFile, 'utf8')
      if (activePortText.trim()) break
    }
    await sleep(250)
  }
  const [portLine, browserWsPath] = activePortText?.trim().split(/\r?\n/) ?? []
  cdpPort = Number(portLine)
  if (
    !Number.isInteger(cdpPort) ||
    cdpPort < 1 ||
    cdpPort > 65535 ||
    !browserWsPath?.startsWith('/devtools/browser/')
  ) {
    throw new Error('Invalid owned Chrome DevToolsActivePort data')
  }
  results.preflight.cdpPort = cdpPort
  results.preflight.cdpBrowserWsPathValidated = true
  results.preflight.cdpOwnedProfile = true

  let targets
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (chromeProc?.exitCode !== null) {
      throw new Error(`Owned Chrome process exited ${chromeProc.exitCode}`)
    }
    try {
      const response = await fetch(`http://127.0.0.1:${cdpPort}/json`)
      targets = await response.json()
      if (targets.some((target) => target.type === 'page')) break
    } catch {
      // The owned Chrome DevTools endpoint is still starting.
    }
    await sleep(250)
  }
  const page = targets?.find((target) => target.type === 'page')
  if (!page) throw new Error('No CDP page target')
  const targetUrl = new URL(page.webSocketDebuggerUrl)
  if (
    targetUrl.hostname !== '127.0.0.1' ||
    Number(targetUrl.port) !== cdpPort
  ) {
    throw new Error('CDP page target does not belong to owned Chrome port')
  }
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
    throw new Error('CDP evaluate failed')
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
  await sleep(30)
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x,
    y,
    button: 'left',
    clickCount: 1,
  })
}

function pointExpression(selector, index) {
  return `(() => {
    const element = document.querySelectorAll(${JSON.stringify(selector)})[${index}]
    if (!element) return null
    element.scrollIntoView({ block: 'center', inline: 'center' })
    const rect = element.getBoundingClientRect()
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  })()`
}

async function clickSelector(selector, index = 0) {
  const first = await evaluate(pointExpression(selector, index))
  if (!first) throw new Error(`Element not found for real click: ${selector}`)
  await sleep(80)
  const point = (await evaluate(pointExpression(selector, index))) ?? first
  await mouseClick(Math.round(point.x), Math.round(point.y))
}

async function pressKey(key) {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key })
}

function pngInfo(buffer) {
  if (
    buffer.length < 24 ||
    buffer.toString('ascii', 1, 4) !== 'PNG' ||
    buffer.toString('ascii', 12, 16) !== 'IHDR'
  ) {
    throw new Error('Invalid PNG screenshot')
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    bytes: buffer.length,
    sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
  }
}

async function screenshot(fileName, evidence = {}) {
  const response = await send('Page.captureScreenshot', { format: 'png' })
  const buffer = Buffer.from(response.data, 'base64')
  fs.writeFileSync(path.join(HERE, fileName), buffer)
  results.screenshots[fileName] = { ...pngInfo(buffer), ...evidence }
  return buffer
}

function changedByteCount(left, right) {
  const limit = Math.min(left.length, right.length)
  let changed = Math.abs(left.length - right.length)
  for (let index = 0; index < limit; index += 1) {
    if (left[index] !== right[index]) changed += 1
  }
  return changed
}

async function waitForApp(previousTimeOrigin = null) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const state = await evaluate(`({
        ready: document.readyState,
        hasCanvas: Boolean(document.querySelector('canvas')),
        hasHud: Boolean(document.querySelector('.global-hud')),
        timeOrigin: performance.timeOrigin
      })`)
      if (
        state.ready === 'complete' &&
        state.hasCanvas &&
        state.hasHud &&
        (previousTimeOrigin === null || state.timeOrigin !== previousTimeOrigin)
      ) {
        return state
      }
    } catch {
      // about:blank has an opaque origin.
    }
    await sleep(250)
  }
  throw new Error('App did not become ready')
}

async function reloadAndWait(delay = 900) {
  const previous = await evaluate('performance.timeOrigin')
  await send('Page.reload', { ignoreCache: false })
  await waitForApp(previous)
  await sleep(delay)
}

async function readStorage() {
  return evaluate(`(() => {
    const parse = (key) => {
      const raw = localStorage.getItem(key)
      return raw === null ? null : JSON.parse(raw)
    }
    return {
      city: parse(${JSON.stringify(CITY_KEY)}),
      gang: parse(${JSON.stringify(GANG_KEY)}),
      adventure: parse(${JSON.stringify(ADVENTURE_KEY)})
    }
  })()`)
}

async function setSavesAndReload({ city, gang, adventure }) {
  await evaluate(`(() => {
    const values = ${JSON.stringify({ city, gang, adventure })}
    if (values.city !== undefined) localStorage.setItem(${JSON.stringify(CITY_KEY)}, JSON.stringify(values.city))
    if (values.gang !== undefined) localStorage.setItem(${JSON.stringify(GANG_KEY)}, JSON.stringify(values.gang))
    if (values.adventure !== undefined) localStorage.setItem(${JSON.stringify(ADVENTURE_KEY)}, JSON.stringify(values.adventure))
  })()`)
  await reloadAndWait()
}

async function clearStorageAndReload() {
  await evaluate('localStorage.clear()')
  await reloadAndWait()
}

function buildBuildingProgress(overrides = {}) {
  const result = {}
  for (const id of BUILDING_IDS) {
    result[id] = {
      level: 1,
      childLevels: Array(id === 'repair-shop' ? 5 : 10).fill(0),
    }
  }
  return { ...result, ...overrides }
}

function citySave(now, overrides = {}) {
  return {
    state: {
      buildingProgress: buildBuildingProgress(overrides.buildingProgress),
      resources: overrides.resources ?? {
        money: 10000,
        oil: 0,
        materials: 0,
      },
      lastResourceUpdatedAt: overrides.lastResourceUpdatedAt ?? now,
      activeProducerIds: overrides.activeProducerIds ?? ['repair-shop'],
    },
    version: 3,
  }
}

function gangSave(reputation, now) {
  return {
    state: { totalReputation: reputation, lastUpdatedAt: now },
    version: 0,
  }
}

function adventureSave(state) {
  return { state, version: 1 }
}

async function readHud() {
  return evaluate(`(() => ({
    resources: [...document.querySelectorAll('.global-hud__resources span')].map((e) => e.textContent.trim()),
    adventureDot: Boolean(document.querySelector('.global-hud__nav .global-hud__dot')),
    text: document.querySelector('.global-hud')?.textContent ?? ''
  }))()`)
}

async function readOverlay() {
  return evaluate(`(() => ({
    building: Boolean(document.querySelector('.building-panel')),
    adventure: Boolean(document.querySelector('.adventure-panel')),
    formation: Boolean(document.querySelector('.formation-panel')),
    heroes: Boolean(document.querySelector('.heroes-panel')),
    battle: Boolean(document.querySelector('.battle-screen')),
    globalHud: Boolean(document.querySelector('.global-hud') && !document.querySelector('.global-hud').closest('[hidden]')),
    settings: Boolean(document.querySelector('.settings-panel')),
    gangTree: Boolean(document.querySelector('.gang-tree-panel')),
    canvasHidden: document.querySelector('.city-app__canvas-wrap')?.classList.contains('city-app__canvas-wrap--hidden') ?? null
  }))()`)
}

async function measurePanel(selector) {
  return evaluate(`(() => {
    const panel = document.querySelector(${JSON.stringify(selector)})
    if (!panel) return { present: false }
    const rect = panel.getBoundingClientRect()
    const root = document.documentElement
    const style = getComputedStyle(panel)
    const controls = [...panel.querySelectorAll('button:not([disabled])')]
    return {
      present: true,
      viewport: { width: innerWidth, height: innerHeight },
      withinBounds: rect.left >= -1 && rect.top >= -1 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1,
      noHorizontalOverflow: panel.scrollWidth <= panel.clientWidth + 1 && root.scrollWidth <= innerWidth + 1,
      scrollableOrFits: panel.scrollHeight <= panel.clientHeight + 1 || style.overflowY === 'auto' || style.overflowY === 'scroll',
      controls: controls.length,
      controls44: controls.length > 0 && controls.every((control) => {
        const r = control.getBoundingClientRect()
        return r.width >= 44 && r.height >= 44
      }),
      undersizedControls: controls.flatMap((control) => {
        const r = control.getBoundingClientRect()
        return r.width >= 44 && r.height >= 44
          ? []
          : [{
              className: control.className,
              text: control.textContent?.trim() ?? '',
              width: r.width,
              height: r.height
            }]
      })
    }
  })()`)
}

async function findBuilding(title) {
  const tryAt = async (x, y) => {
    await mouseClick(x, y)
    await sleep(100)
    const found = await evaluate(`(() => {
      const panel = document.querySelector('.building-panel')
      return panel?.querySelector('.building-panel__title')?.textContent?.trim() ?? null
    })()`)
    if (found === title) return { x, y }
    if (found) {
      await clickSelector('.building-panel__close')
      await sleep(80)
    }
    return null
  }
  if (buildingSpots[title]) {
    const cached = await tryAt(buildingSpots[title].x, buildingSpots[title].y)
    if (cached) return cached
  }
  for (let y = 280; y <= 720; y += 42) {
    for (let x = 300; x <= 1160; x += 42) {
      const hit = await tryAt(x, y)
      if (hit) {
        buildingSpots[title] = hit
        return hit
      }
    }
  }
  throw new Error(`Building not found via real CDP pointer scan: ${title}`)
}

async function preflight() {
  devPort = await selectFreePort(
    Number(process.env.DEV_PORT || 5322),
    results.preflight.attemptedDevPorts,
  )
  devUrl = `http://127.0.0.1:${devPort}/`
  results.preflight.devPort = devPort
  results.preflight.devPortFree = true
  check('preflight selected a free dev port', true, devPort)
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
  check('dist assets use /DobeDemo/', results.dist.baseOk, assetRefs.join(','))
}

async function startDevServer() {
  if (!fs.existsSync(VITE_BIN)) throw new Error('Vite CLI missing')
  devProc = spawn(
    process.execPath,
    [VITE_BIN, '--host', '127.0.0.1', '--port', String(devPort), '--strictPort'],
    { cwd: REPO, stdio: 'ignore', windowsHide: true },
  )
  registerOwnedProcess(devProc, 'vite')
  for (let attempt = 0; attempt < 80; attempt += 1) {
    let response
    let body
    try {
      response = await fetch(devUrl)
      body = await response.text()
    } catch {
      // Vite is still starting.
    }
    await sleep(100)
    if (devProc.exitCode !== null) {
      throw new Error(`Owned Vite process exited ${devProc.exitCode}`)
    }
    const appFeatureOk =
      response?.ok === true &&
      /id="root"/.test(body ?? '') &&
      (body ?? '').includes('/src/main.tsx')
    if (appFeatureOk && ownedPids.has(devProc.pid)) {
      results.http.startupOwnershipVerified = true
      results.http.startupAppFeatureVerified = true
      return
    }
    await sleep(250)
  }
  throw new Error('Owned Vite server did not become ready')
}

async function checkHttp() {
  const response = await fetch(devUrl)
  const body = await response.text()
  results.http = {
    ...results.http,
    status: response.status,
    hasRoot: /id="root"/.test(body),
    hasMainTsx: body.includes('/src/main.tsx'),
  }
  check(
    'owned Vite serves the expected app over HTTP 200',
    response.status === 200 &&
      results.http.startupOwnershipVerified === true &&
      results.http.startupAppFeatureVerified === true &&
      results.http.hasRoot &&
      results.http.hasMainTsx,
    response.status,
  )
}

function launchChrome() {
  const chromePath = resolveChromePath()
  profileDir = fs.mkdtempSync(path.join(os.tmpdir(), PROFILE_PREFIX))
  const expectedRoot = path.join(os.tmpdir(), PROFILE_PREFIX)
  if (
    !profileDir.startsWith(expectedRoot) ||
    !path.basename(profileDir).startsWith(PROFILE_PREFIX)
  ) {
    throw new Error('SAFETY_ABORT: unexpected Chrome profile prefix')
  }
  results.processSafety.chromeExecutable = path.basename(chromePath)
  results.processSafety.tempProfileName = path.basename(profileDir)
  chromeProc = spawn(
    chromePath,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--window-size=1440,900',
      '--remote-debugging-port=0',
      `--user-data-dir=${profileDir}`,
      devUrl,
    ],
    { stdio: 'ignore', windowsHide: true },
  )
  registerOwnedProcess(chromeProc, 'chrome')
}

async function runFlow() {
  await preflight()
  checkDist()
  await startDevServer()
  await checkHttp()
  launchChrome()
  await connectCdp()
  check(
    'Chrome assigned an owned dynamic CDP port via DevToolsActivePort',
    results.preflight.cdpPortSource === 'DevToolsActivePort' &&
      results.preflight.cdpOwnedProfile === true &&
      results.preflight.cdpBrowserWsPathValidated === true &&
      Number.isInteger(results.preflight.cdpPort),
    results.preflight.cdpPort,
  )
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Input.setIgnoreInputEvents', { ignore: false })
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  })
  await send('Page.navigate', { url: devUrl })
  await waitForApp()
  await sleep(700)

  // 1. Fresh account and GlobalHud.
  await clearStorageAndReload()
  const fresh = await readStorage()
  const freshHud = await readHud()
  const desktopHudLayout = await measurePanel('.global-hud')
  const freshCity = fresh.city?.state
  const freshGang = fresh.gang?.state
  const freshAdventure = fresh.adventure?.state
  results.fresh = {
    wallet: freshCity?.resources ?? null,
    gangReputation: freshGang?.totalReputation ?? 0,
    gangSaveAbsentMeansInitial: fresh.gang === null,
    sharedExp: freshAdventure?.sharedExp ?? null,
    highestClearedStage: freshAdventure?.highestClearedStage ?? null,
    heroLevels: freshAdventure?.heroLevels ?? null,
    formation: freshAdventure?.formation ?? null,
    hud: freshHud,
  }
  check(
    '1. fresh wallet is {10000,0,0}',
    freshCity?.resources?.money === 10000 &&
      freshCity?.resources?.oil === 0 &&
      freshCity?.resources?.materials === 0,
    JSON.stringify(freshCity?.resources),
  )
  check(
    '1b. fresh gang/adventure state is initial',
    (freshGang === undefined || freshGang?.totalReputation === 0) &&
      freshAdventure?.sharedExp === 0 &&
      freshAdventure?.highestClearedStage === 0 &&
      arraysEqual(
        freshAdventure?.formation?.map((slot) => slot.heroId),
        ['foreman'],
      ),
    JSON.stringify({
      rep: freshGang?.totalReputation,
      shared: freshAdventure?.sharedExp,
      highest: freshAdventure?.highestClearedStage,
      formation: freshAdventure?.formation,
    }),
  )
  check(
    '1c. GlobalHud shows four resources and adventure red dot',
    freshHud.resources.length === 4 &&
      freshHud.resources.some((text) => text.startsWith('钱 10000')) &&
      freshHud.resources.some((text) => text.includes('英雄经验 0')) &&
      freshHud.adventureDot === true,
    JSON.stringify(freshHud),
  )
  const freshOverlay = await readOverlay()
  const freshDirectEntries = await evaluate(`(() => ({
    formationControls: [...document.querySelectorAll('button, a')].filter((e) => /编队|开始战斗/.test(e.textContent ?? '')).length,
    battleControls: [...document.querySelectorAll('button, a')].filter((e) => /进入战斗|确认退出/.test(e.textContent ?? '')).length,
    href: location.pathname + location.search + location.hash
  }))()`)
  results.overlay.fresh = {
    ...freshOverlay,
    directEntries: freshDirectEntries,
  }
  check(
    '1d. fresh DOM exposes no direct formation or battle entry',
    freshOverlay.formation === false &&
      freshOverlay.battle === false &&
      freshDirectEntries.formationControls === 0 &&
      freshDirectEntries.battleControls === 0,
    JSON.stringify(results.overlay.fresh),
  )
  await screenshot('campaign-fresh.png')

  // 2-3. Real campaign -> formation -> deterministic battle -> victory.
  await clickSelector('.global-hud__nav', 0)
  await sleep(180)
  const adventureLayout = await measurePanel('.adventure-panel')
  const adventureBeforeEscape = await readOverlay()
  await pressKey('Escape')
  await sleep(120)
  const adventureAfterEscape = await readOverlay()
  check(
    '2. adventure Escape closes to the city with no illegal overlay',
    adventureBeforeEscape.adventure === true &&
      adventureAfterEscape.adventure === false &&
      adventureAfterEscape.formation === false &&
      adventureAfterEscape.battle === false,
    JSON.stringify({ adventureBeforeEscape, adventureAfterEscape }),
  )
  await clickSelector('.global-hud__nav', 0)
  await sleep(120)
  await clickSelector('.adventure-panel__stage', 0)
  await clickSelector('.adventure-panel__challenge')
  await sleep(180)
  const formationBeforeEscape = await readOverlay()
  await pressKey('Escape')
  await sleep(120)
  const formationAfterEscape = await readOverlay()
  check(
    '2b. formation Escape returns to adventure without entering battle',
    formationBeforeEscape.formation === true &&
      formationAfterEscape.adventure === true &&
      formationAfterEscape.formation === false &&
      formationAfterEscape.battle === false,
    JSON.stringify({ formationBeforeEscape, formationAfterEscape }),
  )
  await clickSelector('.adventure-panel__stage', 0)
  await clickSelector('.adventure-panel__challenge')
  await sleep(120)
  const formation = await evaluate(`(() => ({
    slots: [...document.querySelectorAll('.formation-panel__slot')].map((e) => e.textContent.trim()),
    powers: [...document.querySelectorAll('.formation-panel__powers p')].map((e) => e.textContent.trim()),
    autoText: document.querySelector('.formation-panel')?.textContent?.includes('Auto') ?? false
  }))()`)
  const formationLayout = await measurePanel('.formation-panel')
  results.battle.formation = formation
  check(
    '2c. formation has 2 front + 3 back slots and both powers',
    formation.slots.length === 5 &&
      formation.slots.filter((text) => text.startsWith('front')).length === 2 &&
      formation.slots.filter((text) => text.startsWith('back')).length === 3 &&
      formation.powers.length === 2,
    JSON.stringify(formation),
  )
  await screenshot('campaign-formation.png')
  await clickSelector('.formation-panel__start')
  await sleep(80)
  const battleStart = await evaluate(`(() => ({
    dialog: Boolean(document.querySelector('.battle-screen')),
    banner: document.querySelector('.battle-screen__banner')?.textContent?.trim() ?? null,
    text: document.querySelector('.battle-screen')?.textContent ?? '',
    allyBars: document.querySelectorAll('.battle-hud__portraits > div').length,
    globalHudPresent: Boolean(document.querySelector('.global-hud') && !document.querySelector('.global-hud').closest('[hidden]')),
    exitConfirmPresent: Boolean(document.querySelector('.battle-hud__exit-confirm')),
    hp: [...document.querySelectorAll('.battle-hud__hp')].map((e) => Number(e.getAttribute('aria-valuenow'))),
    cooldown: [...document.querySelectorAll('.battle-hud__cd')].map((e) => Number(e.getAttribute('aria-valuenow'))),
    basicHits: Number(document.querySelector('.battle-screen')?.dataset.basicHits ?? 0),
    skillMainHits: Number(document.querySelector('.battle-screen')?.dataset.skillMainHits ?? 0),
    damageEvents: Number(document.querySelector('.battle-screen')?.dataset.damageEvents ?? 0),
    deaths: Number(document.querySelector('.battle-screen')?.dataset.deaths ?? 0),
    presentedBasic: document.querySelector('.battle-screen')?.dataset.presentedBasic === 'true',
    presentedSkill: document.querySelector('.battle-screen')?.dataset.presentedSkill === 'true'
  }))()`)
  const battleDesktopLayout = await measurePanel('.battle-screen')
  check(
    '2d. battle displays START and no Auto/manual-cast controls',
    battleStart.dialog === true &&
      battleStart.banner === 'START' &&
      battleStart.globalHudPresent === false &&
      battleStart.exitConfirmPresent === false &&
      !/Auto|手动施法/.test(battleStart.text),
    JSON.stringify(battleStart),
  )
  let battleBefore = null
  await clickSelector('.battle-hud__speed button', 1)
  let combatStateChanged = false
  let firstBattleMetrics = null
  let victoryText = null
  for (let attempt = 0; attempt < 180; attempt += 1) {
    await sleep(150)
    const state = await evaluate(`(() => ({
      result: document.querySelector('.battle-screen__result')?.textContent ?? null,
      hp: [...document.querySelectorAll('.battle-hud__hp')].map((e) => Number(e.getAttribute('aria-valuenow'))),
      cooldown: [...document.querySelectorAll('.battle-hud__cd')].map((e) => Number(e.getAttribute('aria-valuenow'))),
      basicHits: Number(document.querySelector('.battle-screen')?.dataset.basicHits ?? 0),
      skillMainHits: Number(document.querySelector('.battle-screen')?.dataset.skillMainHits ?? 0),
      damageEvents: Number(document.querySelector('.battle-screen')?.dataset.damageEvents ?? 0),
      deaths: Number(document.querySelector('.battle-screen')?.dataset.deaths ?? 0),
      presentedBasic: document.querySelector('.battle-screen')?.dataset.presentedBasic === 'true',
      presentedSkill: document.querySelector('.battle-screen')?.dataset.presentedSkill === 'true',
      currentPresentedBasic: document.querySelector('.battle-screen')?.dataset.currentPresentedBasic === 'true'
    }))()`)
    if (
      !arraysEqual(state.hp, battleStart.hp) ||
      !arraysEqual(state.cooldown, battleStart.cooldown)
    ) {
      combatStateChanged = true
    }
    firstBattleMetrics = state
    if (
      !battleBefore &&
      !state.result &&
      state.basicHits > 0 &&
      state.currentPresentedBasic
    ) {
      battleBefore = await screenshot('campaign-battle.png', {
        phase: 'running-basic-hit',
      })
    }
    if (state.result) {
      victoryText = state.result
      break
    }
  }
  const postBattle = await readStorage()
  results.battle = {
    ...results.battle,
    start: battleStart,
    combatStateChanged,
    firstBattleMetrics,
    resultText: victoryText,
    highestAfter: postBattle.adventure?.state?.highestClearedStage ?? null,
    sharedAfter: postBattle.adventure?.state?.sharedExp ?? null,
    idleClock: postBattle.adventure?.state?.idleClock ?? null,
  }
  check(
    '2e. automatic battle changes HP or cooldown from its initial values',
    combatStateChanged,
    JSON.stringify({
      initialHp: battleStart.hp,
      initialCooldown: battleStart.cooldown,
      combatStateChanged,
    }),
  )
  check(
    '2f. first battle exposes basic attacks, damage and a death',
    firstBattleMetrics?.basicHits > 0 &&
      firstBattleMetrics?.damageEvents > 0 &&
      firstBattleMetrics?.deaths > 0 &&
      firstBattleMetrics?.presentedBasic === true &&
      battleBefore !== null,
    JSON.stringify(firstBattleMetrics),
  )
  check(
    '2g. enemy defeat resolves as VICTORY',
    typeof victoryText === 'string' && victoryText.includes('VICTORY'),
    victoryText,
  )
  check(
    '3. first clear records highest=1 and sharedExp=500',
    results.battle.highestAfter === 1 && results.battle.sharedAfter === 500,
    JSON.stringify({
      highest: results.battle.highestAfter,
      shared: results.battle.sharedAfter,
    }),
  )
  if (!battleBefore) {
    throw new Error('No running battle screenshot captured after a basic hit')
  }
  const victoryBuffer = await screenshot('campaign-victory.png', {
    phase: 'resolved',
  })
  const runningShot = results.screenshots['campaign-battle.png']
  const victoryShot = results.screenshots['campaign-victory.png']
  results.battle.runningVictoryChangedBytes = changedByteCount(
    battleBefore,
    victoryBuffer,
  )
  results.battle.runningVictoryDistinct =
    runningShot.sha256 !== victoryShot.sha256 &&
    runningShot.bytes !== victoryShot.bytes &&
    results.battle.runningVictoryChangedBytes > 0
  check(
    '3b. running battle and victory screenshots have distinct hash and bytes',
    results.battle.runningVictoryDistinct,
    JSON.stringify({
      runningBytes: runningShot.bytes,
      victoryBytes: victoryShot.bytes,
      runningSha256: runningShot.sha256,
      victorySha256: victoryShot.sha256,
      changedBytes: results.battle.runningVictoryChangedBytes,
    }),
  )
  await clickSelector('.battle-screen__result button')
  await sleep(180)
  check(
    '3c. victory continue returns to adventure',
    (await readOverlay()).adventure === true,
  )

  // 4. Prepare elapsed idle time, then claim through a real click.
  const beforeIdle = await readStorage()
  const idleState = {
    ...beforeIdle.adventure.state,
    idleClock: Date.now() - 25_500,
  }
  await setSavesAndReload({ adventure: adventureSave(idleState) })
  await clickSelector('.global-hud__nav', 0)
  await sleep(180)
  const idleBefore = await readStorage()
  const displayBefore = await evaluate(
    `document.querySelector('.adventure-panel__chest p')?.textContent ?? ''`,
  )
  await clickSelector('.adventure-panel__claim')
  await sleep(180)
  const idleAfter = await readStorage()
  const idleStatus = await evaluate(
    `document.querySelector('.adventure-panel__status')?.textContent?.trim() ?? ''`,
  )
  const displayAfter = await evaluate(
    `document.querySelector('.adventure-panel__chest p')?.textContent ?? ''`,
  )
  results.idle = {
    displayBefore,
    displayAfter,
    sharedBefore: idleBefore.adventure?.state?.sharedExp ?? null,
    sharedAfter: idleAfter.adventure?.state?.sharedExp ?? null,
    clockBefore: idleBefore.adventure?.state?.idleClock ?? null,
    clockAfter: idleAfter.adventure?.state?.idleClock ?? null,
    status: idleStatus,
  }
  check(
    '4. idle chest claim increases sharedExp',
    results.idle.sharedAfter > results.idle.sharedBefore &&
      idleStatus.startsWith('已领取英雄经验') &&
      displayAfter === '当前可领取 0',
    JSON.stringify(results.idle),
  )
  check(
    '4b. idle claim preserves sub-tick remainder',
    results.idle.clockAfter > results.idle.clockBefore &&
      Date.now() - results.idle.clockAfter > 0 &&
      Date.now() - results.idle.clockAfter < 10_000,
    JSON.stringify({
      before: results.idle.clockBefore,
      after: results.idle.clockAfter,
    }),
  )
  const nextTickState = {
    ...idleAfter.adventure.state,
    idleClock: Date.now() - 10_500,
  }
  await setSavesAndReload({ adventure: adventureSave(nextTickState) })
  await clickSelector('.global-hud__nav', 0)
  await sleep(120)
  results.idle.displayAfterNextTick = await evaluate(
    `document.querySelector('.adventure-panel__chest p')?.textContent ?? ''`,
  )
  results.idle.sharedAfterNextTick =
    (await readStorage()).adventure?.state?.sharedExp ?? null
  check(
    '4c. idle chest continues accumulating after one legal tick',
    results.idle.displayAfterNextTick === '当前可领取 2' &&
      results.idle.sharedAfterNextTick === results.idle.sharedAfter,
    JSON.stringify({
      display: results.idle.displayAfterNextTick,
      shared: results.idle.sharedAfterNextTick,
    }),
  )
  await pressKey('Escape')
  await sleep(120)

  // 5. A legal gang Lv.2 preset permits a real hero upgrade.
  const beforeHeroPreset = await readStorage()
  await setSavesAndReload({
    gang: gangSave(30, Date.now()),
    adventure: adventureSave(beforeHeroPreset.adventure.state),
  })
  await findBuilding('修车厂')
  const heroEntryBuildingBefore = await readOverlay()
  await clickSelector('.global-hud__nav', 1)
  await sleep(180)
  const heroEntryOpen = await readOverlay()
  const selectedAfterHeroOpen = await evaluate(
    `import('/src/store/useCityStore.ts').then(({ useCityStore }) => useCityStore.getState().selectedBuildingId)`,
  )
  await pressKey('Escape')
  await sleep(120)
  const heroEntryAfterEscape = await readOverlay()
  check(
    '5. heroes entry replaces building detail and clears its selection',
    heroEntryBuildingBefore.building === true &&
      heroEntryOpen.heroes === true &&
      heroEntryOpen.building === false &&
      selectedAfterHeroOpen === null &&
      heroEntryAfterEscape.heroes === false &&
      heroEntryAfterEscape.building === false,
    JSON.stringify({
      before: heroEntryBuildingBefore,
      open: heroEntryOpen,
      selectedAfterHeroOpen,
      afterEscape: heroEntryAfterEscape,
    }),
  )
  await clickSelector('.global-hud__nav', 1)
  await sleep(120)
  const heroesDesktopLayout = await measurePanel('.heroes-panel')
  const heroBefore = await readStorage()
  await clickSelector('.heroes-panel__card[data-hero="foreman"] .heroes-panel__upgrade')
  await sleep(180)
  const heroAfter = await readStorage()
  const heroStatus = await evaluate(
    `document.querySelector('.heroes-panel__status')?.textContent?.trim() ?? ''`,
  )
  results.heroes = {
    levelBefore: heroBefore.adventure?.state?.heroLevels?.foreman ?? null,
    levelAfter: heroAfter.adventure?.state?.heroLevels?.foreman ?? null,
    sharedBefore: heroBefore.adventure?.state?.sharedExp ?? null,
    sharedAfter: heroAfter.adventure?.state?.sharedExp ?? null,
    status: heroStatus,
  }
  check(
    '5b. real hero upgrade adds one level and deducts 100 exp',
    results.heroes.levelAfter === results.heroes.levelBefore + 1 &&
      results.heroes.sharedBefore - results.heroes.sharedAfter === 100,
    JSON.stringify(results.heroes),
  )
  check(
    '5c. hero upgrade reports role=status feedback',
    heroStatus.includes('已升级') &&
      (await evaluate(
        `document.querySelector('.heroes-panel__status')?.getAttribute('role')`,
      )) === 'status',
    heroStatus,
  )
  await screenshot('campaign-idle-heroes.png')
  await pressKey('Escape')
  await sleep(120)

  // 6. Settings debug unlock and derived hero unlocks.
  await clickSelector('.global-hud__nav', 2)
  await sleep(120)
  const settingsDesktopLayout = await measurePanel('.settings-panel')
  await clickSelector('.settings-panel__debug-action', 0)
  await sleep(220)
  const unlockedStorage = await readStorage()
  const unlockFeedback = await evaluate(
    `document.querySelector('.settings-panel__feedback')?.textContent?.trim() ?? ''`,
  )
  await clickSelector('.settings-panel__close')
  await clickSelector('.global-hud__gang')
  await sleep(180)
  const gangTreeText = await evaluate(
    `document.querySelector('.gang-tree-panel')?.textContent ?? ''`,
  )
  results.unlocks = {
    reputation: unlockedStorage.gang?.state?.totalReputation ?? null,
    feedback: unlockFeedback,
    treeHasAnvil:
      gangTreeText.includes('岳峰·铁砧 已解锁') &&
      gangTreeText.includes('等级 12'),
    treeHasSkyline:
      gangTreeText.includes('秦岚·长空 已解锁') &&
      gangTreeText.includes('等级 28'),
  }
  check(
    '6. unlock gang tree sets reputation 1470 / Lv50',
    results.unlocks.reputation === 1470 &&
      unlockFeedback === '帮派树已解锁',
    JSON.stringify(results.unlocks),
  )
  check(
    '6b. gang tree derives both hero unlocks',
    results.unlocks.treeHasAnvil && results.unlocks.treeHasSkyline,
    JSON.stringify(results.unlocks),
  )
  await clickSelector('.gang-tree-panel__close')
  await clickSelector('.global-hud__nav', 1)
  await sleep(150)
  const heroUnlockView = await evaluate(`(() => ({
    unlockedCards: document.querySelectorAll('.heroes-panel__card .heroes-panel__upgrade').length,
    lockedCards: document.querySelectorAll('.heroes-panel__locked').length,
    text: document.querySelector('.heroes-panel')?.textContent ?? ''
  }))()`)
  results.unlocks.heroView = heroUnlockView
  check(
    '6c. heroes panel derives all three heroes unlocked',
    heroUnlockView.unlockedCards === 3 &&
      heroUnlockView.lockedCards === 0 &&
      heroUnlockView.text.includes('岳峰') &&
      heroUnlockView.text.includes('秦岚'),
    JSON.stringify(heroUnlockView),
  )
  await screenshot('campaign-unlocks.png')
  await pressKey('Escape')

  // 7. Single-overlay transitions and an early battle exit with no reward.
  const beforeSkillScenario = await readStorage()
  await setSavesAndReload({
    adventure: adventureSave({
      ...beforeSkillScenario.adventure.state,
      heroLevels: { foreman: 20, anvil: 20, skyline: 20 },
      highestClearedStage: 19,
    }),
  })
  await findBuilding('修车厂')
  const buildingOpen = await readOverlay()
  await clickSelector('.global-hud__nav', 0)
  await sleep(130)
  const adventureOpen = await readOverlay()
  const selectedAfterAdventure = await evaluate(
    `JSON.parse(localStorage.getItem(${JSON.stringify(CITY_KEY)})).state.selectedBuildingId ?? null`,
  )
  check(
    '7. adventure replaces building detail and clears selection',
    buildingOpen.building === true &&
      adventureOpen.adventure === true &&
      adventureOpen.building === false &&
      selectedAfterAdventure === null,
    JSON.stringify({ buildingOpen, adventureOpen, selectedAfterAdventure }),
  )
  await clickSelector('.adventure-panel__stage', 19)
  await clickSelector('.adventure-panel__challenge')
  await sleep(120)
  const formationOpen = await readOverlay()
  await clickSelector('.formation-panel__quick')
  await sleep(100)
  const quickDraft = await evaluate(
    `[...document.querySelectorAll('.formation-panel__slot')].map((e) => e.textContent.trim())`,
  )
  const formationStore = await readStorage()
  check(
    '7b. quick deploy derives three unlocked heroes into formation',
    quickDraft.filter((text) => !text.endsWith(' 空')).length === 3 &&
      formationStore.adventure?.state?.formation?.length === 1,
    JSON.stringify(quickDraft),
  )
  const progressBeforeExit = {
    highest: formationStore.adventure.state.highestClearedStage,
    shared: formationStore.adventure.state.sharedExp,
  }
  await clickSelector('.formation-panel__start')
  await sleep(120)
  const battleOpen = await readOverlay()
  const quickPersisted = await readStorage()
  check(
    '7c. Start persists the three-hero derived formation',
    quickPersisted.adventure?.state?.formation?.length === 3,
    JSON.stringify(quickPersisted.adventure?.state?.formation),
  )
  await clickSelector('.battle-hud__speed button', 1)
  let skillReplayMetrics = null
  let skillScreenshot = null
  for (let attempt = 0; attempt < 100; attempt += 1) {
    await sleep(100)
    skillReplayMetrics = await evaluate(`(() => {
      const battle = document.querySelector('.battle-screen')
      return {
        result: document.querySelector('.battle-screen__result')?.textContent ?? null,
        basicHits: Number(battle?.dataset.basicHits ?? 0),
        skillMainHits: Number(battle?.dataset.skillMainHits ?? 0),
        skillSplashHits: Number(battle?.dataset.skillSplashHits ?? 0),
        damageEvents: Number(battle?.dataset.damageEvents ?? 0),
        deaths: Number(battle?.dataset.deaths ?? 0),
        presentedBasic: battle?.dataset.presentedBasic === 'true',
        presentedSkill: battle?.dataset.presentedSkill === 'true',
        currentPresentedSkill: battle?.dataset.currentPresentedSkill === 'true'
      }
    })()`)
    if (
      !skillScreenshot &&
      skillReplayMetrics.skillMainHits > 0 &&
      skillReplayMetrics.currentPresentedSkill
    ) {
      skillScreenshot = await screenshot('campaign-skill.png', {
        phase: 'running-skill-effect',
      })
    }
    if (skillScreenshot) break
    if (skillReplayMetrics.result) break
  }
  const basicScreenshot = results.screenshots['campaign-battle.png']
  const skillShot = results.screenshots['campaign-skill.png']
  check(
    '7d. R3F presentation reports and captures basic and skill effects',
    skillReplayMetrics?.basicHits > 0 &&
      skillReplayMetrics?.skillMainHits > 0 &&
      skillReplayMetrics?.presentedBasic === true &&
      skillReplayMetrics?.presentedSkill === true &&
      skillScreenshot !== null &&
      skillShot?.sha256 !== basicScreenshot?.sha256 &&
      skillReplayMetrics?.damageEvents >
        skillReplayMetrics?.basicHits,
    JSON.stringify({
      ...skillReplayMetrics,
      basicSha256: basicScreenshot?.sha256,
      skillSha256: skillShot?.sha256,
    }),
  )
  await clickSelector('.battle-hud__exit')
  await sleep(100)
  const exitPrompt = await evaluate(`(() => ({
    battlePresent: Boolean(document.querySelector('.battle-screen')),
    globalHudPresent: Boolean(document.querySelector('.global-hud') && !document.querySelector('.global-hud').closest('[hidden]')),
    confirmButtons: document.querySelectorAll('.battle-hud__exit-confirm button').length,
    confirmText: document.querySelector('.battle-hud__exit-confirm')?.textContent ?? ''
  }))()`)
  check(
    '7e. battle hides GlobalHud and first exit click only opens confirmation',
    battleOpen.battle === true &&
      battleOpen.globalHud === false &&
      exitPrompt.battlePresent === true &&
      exitPrompt.globalHudPresent === false &&
      exitPrompt.confirmButtons === 2 &&
      exitPrompt.confirmText.includes('确认退出'),
    JSON.stringify(exitPrompt),
  )
  await clickSelector('.battle-hud__exit-confirm button', 0)
  await sleep(160)
  const progressAfterExit = await readStorage()
  results.overlay = {
    buildingOpen,
    adventureOpen,
    formationOpen,
    battleOpen,
    exitPrompt,
    progressBeforeExit,
    progressAfterExit: {
      highest: progressAfterExit.adventure?.state?.highestClearedStage ?? null,
      shared: progressAfterExit.adventure?.state?.sharedExp ?? null,
    },
    afterExit: await readOverlay(),
  }
  check(
    '7f. battle exit confirmation returns to adventure',
    battleOpen.battle === true && results.overlay.afterExit.adventure === true,
    JSON.stringify(results.overlay.afterExit),
  )
  check(
    '7g. early battle exit grants no reward/progress',
    results.overlay.progressAfterExit.highest === progressBeforeExit.highest &&
      results.overlay.progressAfterExit.shared === progressBeforeExit.shared,
    JSON.stringify({
      before: progressBeforeExit,
      after: results.overlay.progressAfterExit,
    }),
  )
  await pressKey('Escape')

  // 8. Legal persisted completed stage remains 100% with main-upgrade action.
  const now = Date.now()
  const beforeBuilding = await readStorage()
  await setSavesAndReload({
    city: citySave(now, {
      buildingProgress: {
        'repair-shop': { level: 2, childLevels: [2, 2, 0, 0, 0] },
      },
    }),
    gang: beforeBuilding.gang,
    adventure: beforeBuilding.adventure,
  })
  await findBuilding('修车厂')
  const buildingComplete = await evaluate(`(() => ({
    progress: Number(document.querySelector('.building-panel__progress-bar')?.getAttribute('aria-valuenow')),
    label: document.querySelector('.building-panel__progress-label')?.textContent?.trim() ?? null,
    mainButton: document.querySelector('.building-panel__main-button')?.textContent?.trim() ?? null
  }))()`)
  const buildingDesktopLayout = await measurePanel('.building-panel')
  results.building = buildingComplete
  check(
    '8. completed building stage still displays 100% and main button',
    buildingComplete.progress === 100 &&
      buildingComplete.label === '100%' &&
      buildingComplete.mainButton === '升级主建筑至 Lv.3',
    JSON.stringify(buildingComplete),
  )
  await screenshot('campaign-building-100.png')

  // 10. Mobile building, HUD, heroes, adventure and settings layout.
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  })
  await sleep(350)
  const mobileBuilding = await measurePanel('.building-panel')
  await clickSelector('.building-panel__close')
  await sleep(100)
  const mobileHud = await evaluate(`(() => {
    const hud = document.querySelector('.global-hud')
    const rect = hud.getBoundingClientRect()
    return {
      noHorizontalOverflow: document.documentElement.scrollWidth <= innerWidth + 1 && hud.scrollWidth <= hud.clientWidth + 1,
      withinBounds: rect.left >= -1 && rect.right <= innerWidth + 1,
      controls44: [...document.querySelectorAll('.global-hud button')].every((e) => {
        const r = e.getBoundingClientRect()
        return r.width >= 44 && r.height >= 44
      })
    }
  })()`)
  await clickSelector('.global-hud__nav', 0)
  await sleep(120)
  const mobileAdventure = await measurePanel('.adventure-panel')
  await clickSelector('.adventure-panel__stage', 0)
  await clickSelector('.adventure-panel__challenge')
  await sleep(120)
  const mobileFormation = await measurePanel('.formation-panel')
  await clickSelector('.formation-panel__start')
  await sleep(120)
  const mobileBattle = await measurePanel('.battle-screen')
  await clickSelector('.battle-hud__exit')
  await clickSelector('.battle-hud__exit-confirm button', 0)
  await sleep(120)
  await pressKey('Escape')
  await clickSelector('.global-hud__nav', 1)
  await sleep(120)
  const mobileHeroes = await measurePanel('.heroes-panel')
  await pressKey('Escape')
  await clickSelector('.global-hud__nav', 2)
  await sleep(120)
  const mobileSettings = await measurePanel('.settings-panel')
  await pressKey('Tab')
  const focusVisible = await evaluate(`(() => {
    const active = document.activeElement
    if (!active || active === document.body) return false
    const style = getComputedStyle(active)
    return active.matches(':focus-visible') && style.outlineStyle !== 'none'
  })()`)
  results.layout = {
    desktop: {
      hud: desktopHudLayout,
      adventure: adventureLayout,
      formation: formationLayout,
      battle: battleDesktopLayout,
      heroes: heroesDesktopLayout,
      building: buildingDesktopLayout,
      settings: settingsDesktopLayout,
    },
    mobile: {
      hud: mobileHud,
      building: mobileBuilding,
      adventure: mobileAdventure,
      formation: mobileFormation,
      battle: mobileBattle,
      heroes: mobileHeroes,
      settings: mobileSettings,
      focusVisible,
    },
  }
  const desktopPanels = Object.values(results.layout.desktop)
  const mobilePanels = Object.values(results.layout.mobile).filter(
    (value) => value && typeof value === 'object' && value.present,
  )
  check(
    '10. desktop core panels have no horizontal overflow',
    desktopPanels.every(
      (panel) =>
        panel.present &&
        panel.noHorizontalOverflow &&
        panel.withinBounds &&
        panel.scrollableOrFits,
    ),
    JSON.stringify(results.layout.desktop),
  )
  check(
    '10b. desktop key controls are at least 44x44',
    desktopPanels.every((panel) => panel.controls44),
    JSON.stringify(desktopPanels.map((panel) => panel.controls44)),
  )
  check(
    '10c. 390x844 core panels fit/scroll without horizontal overflow',
    mobileHud.noHorizontalOverflow &&
      mobileHud.withinBounds &&
      mobilePanels.length === 6 &&
      mobilePanels.every(
        (panel) =>
          panel.noHorizontalOverflow &&
          panel.scrollableOrFits,
      ),
    JSON.stringify(results.layout.mobile),
  )
  check(
    '10d. keyboard focus is visibly styled',
    focusVisible === true,
    focusVisible,
  )
  check(
    '10e. mobile key controls are at least 44x44',
    mobileHud.controls44 && mobilePanels.every((panel) => panel.controls44),
    JSON.stringify({
      hudControls44: mobileHud.controls44,
      panels: mobilePanels.map((panel) => panel.controls44),
    }),
  )
  await screenshot('campaign-mobile.png')
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  })
  await clickSelector('.settings-panel__close')

  // 9. Bad Adventure save normalization.
  const beforeBad = await readStorage()
  await setSavesAndReload({
    city: beforeBad.city,
    gang: gangSave(0, Date.now()),
    adventure: adventureSave(null),
  })
  const nullPayload = (await readStorage()).adventure?.state ?? null
  results.migration.nullPayload = nullPayload
  check(
    '9. persisted Adventure state null keeps the initial durable state',
    nullPayload?.heroLevels?.foreman === 1 &&
      nullPayload?.heroLevels?.anvil === 1 &&
      nullPayload?.heroLevels?.skyline === 1 &&
      nullPayload?.sharedExp === 0 &&
      nullPayload?.highestClearedStage === 0 &&
      arraysEqual(
        nullPayload?.formation?.map((slot) => slot.heroId),
        ['foreman'],
      ) &&
      Number.isFinite(nullPayload?.idleClock),
    JSON.stringify(nullPayload),
  )
  const badAdventure = {
    heroLevels: { foreman: 99, anvil: 0, skyline: null },
    sharedExp: -5,
    formation: [
      { heroId: 'bad', row: 'front', index: 0 },
      { heroId: 'anvil', row: 'front', index: 0 },
      { heroId: 'skyline', row: 'side', index: 99 },
    ],
    highestClearedStage: 99,
    idleClock: 'bad',
  }
  await setSavesAndReload({
    city: beforeBad.city,
    gang: gangSave(1470, Date.now()),
    adventure: adventureSave(badAdventure),
  })
  const normalized = await readStorage()
  results.migration.badPayload = normalized.adventure?.state ?? null
  const badPayload = results.migration.badPayload
  check(
    '9b. bad Adventure save reload is normalized',
    badPayload?.heroLevels?.foreman === 50 &&
      badPayload?.heroLevels?.anvil === 1 &&
      badPayload?.heroLevels?.skyline === 1 &&
      badPayload?.sharedExp === 0 &&
      badPayload?.highestClearedStage === 20 &&
      arraysEqual(
        badPayload?.formation?.map((slot) => slot.heroId),
        ['anvil'],
      ) &&
      Number.isFinite(badPayload?.idleClock),
    JSON.stringify(badPayload),
  )

  // Reset all three stores via the two real confirmation clicks.
  await clickSelector('.global-hud__nav', 2)
  await clickSelector('.settings-panel__reset')
  await sleep(100)
  const confirming = await evaluate(
    `Boolean(document.querySelector('.settings-panel__confirm-reset'))`,
  )
  await clickSelector('.settings-panel__confirm-reset')
  await sleep(250)
  const reset = await readStorage()
  const rc = reset.city?.state
  const rg = reset.gang?.state
  const ra = reset.adventure?.state
  results.reset = {
    confirming,
    wallet: rc?.resources ?? null,
    reputation: rg?.totalReputation ?? null,
    sharedExp: ra?.sharedExp ?? null,
    highest: ra?.highestClearedStage ?? null,
    formation: ra?.formation ?? null,
    clocks: {
      city: rc?.lastResourceUpdatedAt ?? null,
      gang: rg?.lastUpdatedAt ?? null,
      adventure: ra?.idleClock ?? null,
    },
  }
  check(
    '9c. reset required a second confirmation',
    confirming === true,
  )
  check(
    '9d. reset restores all three stores to initial state',
    rc?.resources?.money === 10000 &&
      rc?.resources?.oil === 0 &&
      rc?.resources?.materials === 0 &&
      rg?.totalReputation === 0 &&
      ra?.sharedExp === 0 &&
      ra?.highestClearedStage === 0 &&
      arraysEqual(
        ra?.formation?.map((slot) => slot.heroId),
        ['foreman'],
      ),
    JSON.stringify(results.reset),
  )
  check(
    '9e. reset aligns all three clocks to one captured instant',
    results.reset.clocks.city === results.reset.clocks.gang &&
      results.reset.clocks.gang === results.reset.clocks.adventure,
    JSON.stringify(results.reset.clocks),
  )
  await screenshot('campaign-reset.png')
}

async function removeProfileSafely() {
  if (!profileDir) return null
  const expectedRoot = path.join(os.tmpdir(), PROFILE_PREFIX)
  if (
    !profileDir.startsWith(expectedRoot) ||
    !path.basename(profileDir).startsWith(PROFILE_PREFIX)
  ) {
    throw new Error('SAFETY_ABORT: refusing to remove unexpected profile')
  }
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      fs.rmSync(profileDir, { recursive: true, force: true })
    } catch {
      // Windows Chrome can briefly hold profile files after taskkill.
    }
    if (!fs.existsSync(profileDir)) return true
    await sleep(300)
  }
  return false
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
  results.teardown.tempProfileRemoved = await removeProfileSafely()
  check(
    'teardown: only owned PIDs targeted',
    results.processSafety.unknownProcessesTerminated === false &&
      results.processSafety.killAttempts.every((attempt) => attempt.owned),
    JSON.stringify(results.processSafety.killAttempts),
  )
  check(
    'teardown: dev port released',
    results.teardown.devPortReleased === true,
    results.teardown.devPortReleased,
  )
  check(
    'teardown: CDP port released',
    results.teardown.cdpPortReleased === true,
    results.teardown.cdpPortReleased,
  )
  check(
    'teardown: temporary Chrome profile removed',
    results.teardown.tempProfileRemoved === true,
    results.teardown.tempProfileRemoved,
  )
  check(
    'all expected screenshots are nonempty PNG files',
    EXPECTED_SHOTS.every((name) => {
      const file = path.join(HERE, name)
      const metadata = results.screenshots[name]
      return (
        metadata?.bytes > 0 &&
        metadata.width > 0 &&
        metadata.height > 0 &&
        fs.existsSync(file) &&
        fs.statSync(file).size === metadata.bytes
      )
    }),
    JSON.stringify(Object.keys(results.screenshots)),
  )
}

results.assertionSelfTest = runAssertionSelfTest()
console.log(
  `ASSERTION SELF-TEST: ${results.assertionSelfTest.ok ? 'PASS' : 'FAIL'} (${results.assertionSelfTest.checked} pure-data checks)`,
)
let runError
let teardownError
try {
  if (!results.assertionSelfTest.ok) {
    throw new Error('Assertion self-test failed before browser run')
  }
  await runFlow()
} catch (error) {
  runError = error
  results.error = toPublicErrorCategory(error)
} finally {
  try {
    await teardown()
  } catch (error) {
    teardownError = error
    runError ||= error
    results.teardown.error = toPublicErrorCategory(error)
  }
}

const failures = results.assertions.filter((assertion) => !assertion.pass)
fs.writeFileSync(OUT_JSON, `${JSON.stringify(results, null, 2)}\n`)
console.log(`WROTE ${path.basename(OUT_JSON)}`)
if (runError) console.error('RUN ERROR:', runError?.stack || runError)
if (teardownError && teardownError !== runError) {
  console.error('TEARDOWN ERROR:', teardownError?.stack || teardownError)
}
if (failures.length) {
  console.error(
    `FAILED ASSERTIONS: ${failures.map((item) => item.name).join(', ')}`,
  )
}
const ok =
  !runError && results.assertionSelfTest.ok && failures.length === 0
console.log(
  ok
    ? `ALL ASSERTIONS PASSED (${results.assertions.length}/${results.assertions.length})`
    : 'ACCEPTANCE FAILED',
)
process.exitCode = ok ? 0 : 1
