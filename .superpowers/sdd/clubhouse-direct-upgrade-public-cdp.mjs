// Safe public GitHub Pages acceptance for Clubhouse direct upgrades.
// All visible actions use Input.dispatchMouseEvent; DOM.click() is never used.
//
// Safety:
// - Every public/CDP HTTP request, CDP request and WebSocket connection is
//   bounded by a timeout.
// - Chrome chooses port 0; the script trusts only DevToolsActivePort from this
//   run's isolated profile and validates the page WebSocket against that port.
// - ChildProcess error listeners are attached before PID/activity checks.
// - Cleanup can terminate only the still-active ChildProcess object registered
//   by this run and can remove only the verified temporary profile prefix.
// - JSON and stderr contain only relative basenames, measurements and
//   whitelisted error name/code categories; no raw message, stack or path.
// - Any assertion, screenshot, runtime, write or teardown failure exits nonzero.
//
// Config: CHROME_PATH, PUBLIC_URL, RELEASE_COMMIT, RELEASE_TAG, MAIN_COMMIT.
// Run: node .superpowers/sdd/clubhouse-direct-upgrade-public-cdp.mjs
import crypto from 'node:crypto'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { execFileSync, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT_JSON = path.join(HERE, 'clubhouse-direct-upgrade-public-results.json')
const PROFILE_PREFIX = 'dobe-clubhouse-direct-public-cdp-'
const CDP_REQUEST_TIMEOUT_MS = 10_000
const HTTP_FETCH_TIMEOUT_MS = 10_000
const MAIN_COMMIT = process.env.MAIN_COMMIT || '9e063c8'
const RELEASE_COMMIT =
  process.env.RELEASE_COMMIT || '9f7844863443d084d23425d77a0940f99b5a61bc'
const RELEASE_TAG = process.env.RELEASE_TAG || '9f78448'
const PUBLIC_ORIGIN = new URL(
  process.env.PUBLIC_URL || 'https://sherlock3rd.github.io/DobeDemo/',
)
const PUBLIC_URL_OBJECT = new URL(PUBLIC_ORIGIN)
PUBLIC_URL_OBJECT.searchParams.set('release', RELEASE_TAG)
const PUBLIC_URL = PUBLIC_URL_OBJECT.toString()
const EXPECTED_JS = '/DobeDemo/assets/index-781xcY6f.js'
const EXPECTED_CSS = '/DobeDemo/assets/index-CoMhGqEJ.css'
const CITY_KEY = 'dobe-city-progression-v1'
const GANG_KEY = 'gang-progression-v1'
const GANG_LV40_REPUTATION = 1170
const STARTING_MONEY = 100_000
const BUILDING_IDS = [
  'repair-shop',
  'recycling-yard',
  'commercial-street',
  'metalworking-plant',
  'gas-station',
  'clubhouse',
]
const EXPECTED_SHOTS = [
  'clubhouse-public-desktop-before.png',
  'clubhouse-public-desktop-after.png',
  'clubhouse-public-mobile.png',
]

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const results = {
  generatedAt: new Date().toISOString(),
  script: 'clubhouse-direct-upgrade-public-cdp.mjs',
  release: {
    mainCommit: MAIN_COMMIT,
    pagesCommit: RELEASE_COMMIT,
    url: `?release=${RELEASE_TAG}`,
  },
  preflight: {
    strategy:
      'Chrome assigns port 0; trust only isolated-profile DevToolsActivePort',
    cdpPortSource: 'DevToolsActivePort',
  },
  processSafety: {
    registeredProcesses: [],
    childErrors: [],
    killAttempts: [],
    unknownProcessesTerminated: false,
  },
  http: {},
  fresh: {},
  firstUpgrade: {},
  persistence: {},
  layout: {},
  screenshots: {},
  teardown: {},
  assertionSelfTest: {},
  assertions: [],
}

let chromeProc
let profileDir
let cdpPort
let ws
let nextId = 1
const pending = new Map()
const ownedPids = new Set()
const activeChildren = new Set()
const registeredChildren = new WeakMap()
const childProcessStates = new WeakMap()
const buildingSpots = {}

function arraysEqual(left, right) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  )
}

function walletDelta(before, after) {
  if (!before || !after) return null
  return {
    money: before.money - after.money,
    oil: before.oil - after.oil,
    materials: before.materials - after.materials,
  }
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
  const code = rawCode && /^[A-Z0-9_-]{1,40}$/.test(rawCode) ? rawCode : null
  return code ? { name, code } : { name }
}

function createPublicError(name, code) {
  const error = new Error(name)
  error.name = name
  error.code = code
  return error
}

function publicErrorJson(error) {
  return JSON.stringify(toPublicErrorCategory(error))
}

function emitPublicError(label, error) {
  try {
    console.error(`${label}:`, publicErrorJson(error))
  } catch {
    try {
      process.stderr.write(`${label}: {"name":"Error"}\n`)
    } catch {
      // Never escape to Node's default stack printer.
    }
  }
}

function attemptResultWrite(writeFile, outputPath, value) {
  try {
    writeFile(outputPath, `${JSON.stringify(value, null, 2)}\n`)
    return { ok: true, error: null }
  } catch (error) {
    return { ok: false, error: toPublicErrorCategory(error) }
  }
}

function isPublicSafe(value) {
  const visit = (entry) => {
    if (typeof entry === 'string') {
      return (
        !/[A-Za-z]:\\/.test(entry) &&
        !/(?:^|[ (])\/(?:Users|home|tmp)\//.test(entry)
      )
    }
    if (!entry || typeof entry !== 'object') return true
    if (Array.isArray(entry)) return entry.every(visit)
    return Object.entries(entry).every(
      ([key, child]) => !/^(?:message|stack)$/i.test(key) && visit(child),
    )
  }
  return visit(value)
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

function attachChildProcessErrorListener(child, onError) {
  const handler = (error) => {
    try {
      onError(toPublicErrorCategory(error))
    } catch {
      // Observer failures must not restore EventEmitter's default throw.
    }
  }
  child.on('error', handler)
  return handler
}

function registerOwnedProcess(child, label) {
  if (!child || typeof child.on !== 'function') {
    throw createPublicError(
      'ChildProcessRegistrationError',
      'CHILD_PROCESS_REGISTRATION_ERROR',
    )
  }
  const state = {
    label,
    pid: child.pid ?? null,
    error: null,
  }
  childProcessStates.set(child, state)
  attachChildProcessErrorListener(child, (category) => {
    if (state.error) return
    state.error = category
    activeChildren.delete(child)
    if (state.pid !== null) ownedPids.delete(state.pid)
    results.processSafety.childErrors.push({ label, error: category })
  })

  const pid = child.pid ?? null
  registeredChildren.set(child, { label, pid })
  results.processSafety.registeredProcesses.push({
    label,
    owned: pid !== null,
  })
  if (pid === null) return state
  if (
    child.exitCode !== null ||
    child.signalCode !== null ||
    child.killed === true
  ) {
    return state
  }
  activeChildren.add(child)
  ownedPids.add(pid)
  child.once('exit', () => {
    activeChildren.delete(child)
    const registration = registeredChildren.get(child)
    if (registration?.pid === pid) ownedPids.delete(pid)
  })
  return state
}

function throwIfChildProcessFailed(child) {
  const state = child ? childProcessStates.get(child) : null
  if (state?.error) {
    throw createPublicError(
      'ChildProcessError',
      state.error.code ?? 'CHILD_PROCESS_ERROR',
    )
  }
  if (!child) {
    throw createPublicError('ChildProcessMissingError', 'CHILD_PROCESS_MISSING')
  }
  if (child.exitCode !== null || child.signalCode !== null) {
    throw createPublicError('ChildProcessExitedError', 'CHILD_PROCESS_EXITED')
  }
}

function getOwnedChildDecision(
  child,
  label,
  registrations,
  activeChildSet,
  ownedPidSet,
) {
  const registration = child ? registrations.get(child) : null
  const owned =
    Boolean(child?.pid) &&
    registration?.label === label &&
    registration?.pid === child.pid
  const active =
    owned &&
    activeChildSet.has(child) &&
    ownedPidSet.has(child.pid) &&
    child.exitCode === null &&
    child.signalCode === null &&
    child.killed !== true
  return { owned, active }
}

function killOwnedTree(child, label) {
  if (!child) return
  const childState = childProcessStates.get(child)
  if (childState && childState.pid === null) {
    results.processSafety.killAttempts.push({
      label,
      owned: false,
      active: false,
      skipped: true,
      spawnError: childState.error !== null,
    })
    return
  }
  const decision = getOwnedChildDecision(
    child,
    label,
    registeredChildren,
    activeChildren,
    ownedPids,
  )
  const attempt = {
    label,
    owned: decision.owned,
    active: decision.active,
  }
  if (!decision.owned) {
    results.processSafety.killAttempts.push({ ...attempt, skipped: true })
    results.processSafety.unknownProcessesTerminated = true
    throw createPublicError('SafetyAbortError', 'UNOWNED_PROCESS')
  }
  if (!decision.active) {
    results.processSafety.killAttempts.push({ ...attempt, skipped: true })
    return
  }
  results.processSafety.killAttempts.push(attempt)
  try {
    if (process.platform === 'win32') {
      execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
      })
    } else {
      process.kill(child.pid, 'SIGKILL')
    }
  } catch {
    // The owned child may have exited after the active check.
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
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ].filter(Boolean)
  const found = candidates.find((candidate) => fs.existsSync(candidate))
  if (!found) {
    throw createPublicError('ChromeNotFoundError', 'CHROME_NOT_FOUND')
  }
  return found
}

function rejectAllPending(pendingRequests, error) {
  let rejected = 0
  for (const [id, waiter] of pendingRequests) {
    pendingRequests.delete(id)
    clearTimeout(waiter.timer)
    waiter.reject(error)
    rejected += 1
  }
  return rejected
}

function handleCdpSocketFailure(pendingRequests, name, code) {
  return rejectAllPending(pendingRequests, createPublicError(name, code))
}

function settlePendingResponse(pendingRequests, message) {
  if (!message.id || !pendingRequests.has(message.id)) return false
  const waiter = pendingRequests.get(message.id)
  pendingRequests.delete(message.id)
  clearTimeout(waiter.timer)
  if (message.error) {
    waiter.reject(createPublicError('CdpResponseError', 'CDP_RESPONSE_ERROR'))
  } else {
    waiter.resolve(message.result)
  }
  return true
}

function sendCdpRequest(
  socket,
  pendingRequests,
  id,
  method,
  params,
  timeoutMs,
) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (!pendingRequests.delete(id)) return
      reject(createPublicError('CdpTimeoutError', 'CDP_TIMEOUT'))
    }, timeoutMs)
    pendingRequests.set(id, { resolve, reject, timer })
    try {
      socket.send(JSON.stringify({ id, method, params }))
    } catch {
      if (pendingRequests.delete(id)) clearTimeout(timer)
      reject(createPublicError('CdpSocketError', 'CDP_SOCKET_ERROR'))
    }
  })
}

function send(method, params = {}) {
  if (!ws || ws.readyState !== 1) {
    return Promise.reject(
      createPublicError('CdpSocketClosedError', 'CDP_SOCKET_CLOSED'),
    )
  }
  return sendCdpRequest(
    ws,
    pending,
    nextId++,
    method,
    params,
    CDP_REQUEST_TIMEOUT_MS,
  )
}

async function fetchWithTimeout(
  url,
  options = {},
  timeoutMs = HTTP_FETCH_TIMEOUT_MS,
  fetchImpl = fetch,
) {
  const signal = AbortSignal.timeout(timeoutMs)
  try {
    return await fetchImpl(url, { ...options, signal })
  } catch {
    if (signal.aborted) {
      throw createPublicError('HttpTimeoutError', 'HTTP_TIMEOUT')
    }
    throw createPublicError('HttpRequestError', 'HTTP_REQUEST_FAILED')
  }
}

function waitForSocketOpen(socket, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false
    let timer
    const cleanup = () => {
      if (timer) clearTimeout(timer)
      try {
        socket.removeEventListener('open', onOpen)
        socket.removeEventListener('error', onError)
        socket.removeEventListener('close', onClose)
      } catch {
        // Listener cleanup is best-effort for malformed test doubles.
      }
    }
    const finish = (settler, value) => {
      if (settled) return
      settled = true
      cleanup()
      settler(value)
    }
    const onOpen = () => finish(resolve)
    const onError = () =>
      finish(reject, createPublicError('CdpSocketError', 'CDP_SOCKET_ERROR'))
    const onClose = () =>
      finish(
        reject,
        createPublicError('CdpSocketClosedError', 'CDP_SOCKET_CLOSED'),
      )

    timer = setTimeout(
      () =>
        finish(
          reject,
          createPublicError('CdpConnectTimeoutError', 'CDP_CONNECT_TIMEOUT'),
        ),
      timeoutMs,
    )
    try {
      socket.addEventListener('open', onOpen)
      socket.addEventListener('error', onError)
      socket.addEventListener('close', onClose)
      if (socket.readyState === 1) finish(resolve)
    } catch {
      finish(reject, createPublicError('CdpSocketError', 'CDP_SOCKET_ERROR'))
    }
  })
}

function launchChrome() {
  const chromePath = resolveChromePath()
  profileDir = fs.mkdtempSync(path.join(os.tmpdir(), PROFILE_PREFIX))
  const expectedRoot = path.join(os.tmpdir(), PROFILE_PREFIX)
  if (
    !profileDir.startsWith(expectedRoot) ||
    !path.basename(profileDir).startsWith(PROFILE_PREFIX)
  ) {
    throw createPublicError('SafetyAbortError', 'BAD_PROFILE_PREFIX')
  }
  results.processSafety.chromeExecutable = path.basename(chromePath)
  results.processSafety.profilePrefixVerified = true
  chromeProc = spawn(
    chromePath,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--window-size=1440,900',
      '--remote-debugging-port=0',
      `--user-data-dir=${profileDir}`,
      PUBLIC_URL,
    ],
    { stdio: 'ignore', windowsHide: true },
  )
  registerOwnedProcess(chromeProc, 'chrome')
}

async function connectCdp() {
  const activePortFile = path.join(profileDir, 'DevToolsActivePort')
  let activePortText
  for (let attempt = 0; attempt < 80; attempt += 1) {
    throwIfChildProcessFailed(chromeProc)
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
    throw createPublicError('CdpPortDataError', 'INVALID_CDP_PORT_DATA')
  }
  results.preflight.cdpPortAssigned = true
  results.preflight.cdpOwnedProfile = true
  results.preflight.cdpBrowserWsPathValidated = true

  let targets
  for (let attempt = 0; attempt < 40; attempt += 1) {
    throwIfChildProcessFailed(chromeProc)
    try {
      const response = await fetchWithTimeout(
        `http://127.0.0.1:${cdpPort}/json`,
      )
      targets = await response.json()
      if (targets.some((target) => target.type === 'page')) break
    } catch {
      // The owned endpoint is still starting.
    }
    await sleep(250)
  }
  const page = targets?.find((target) => target.type === 'page')
  if (!page) throw createPublicError('CdpTargetError', 'NO_CDP_PAGE_TARGET')
  const targetUrl = new URL(page.webSocketDebuggerUrl)
  if (
    targetUrl.hostname !== '127.0.0.1' ||
    Number(targetUrl.port) !== cdpPort
  ) {
    throw createPublicError('SafetyAbortError', 'UNOWNED_CDP_TARGET')
  }
  ws = new WebSocket(page.webSocketDebuggerUrl)
  await waitForSocketOpen(ws, CDP_REQUEST_TIMEOUT_MS)
  ws.addEventListener('error', () => {
    handleCdpSocketFailure(pending, 'CdpSocketError', 'CDP_SOCKET_ERROR')
  })
  ws.addEventListener('close', () => {
    handleCdpSocketFailure(pending, 'CdpSocketClosedError', 'CDP_SOCKET_CLOSED')
  })
  ws.addEventListener('message', (event) => {
    try {
      settlePendingResponse(pending, JSON.parse(String(event.data)))
    } catch {
      rejectAllPending(
        pending,
        createPublicError('CdpProtocolError', 'CDP_PROTOCOL_ERROR'),
      )
    }
  })
}

async function evaluate(expression) {
  const response = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  })
  if (response.exceptionDetails) {
    throw createPublicError('CdpEvaluateError', 'CDP_EVALUATE_FAILED')
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
  if (!first) {
    throw createPublicError('ElementNotFoundError', 'ELEMENT_NOT_FOUND')
  }
  await sleep(80)
  const point = (await evaluate(pointExpression(selector, index))) ?? first
  await mouseClick(Math.round(point.x), Math.round(point.y))
}

function pngInfo(buffer) {
  if (
    buffer.length < 24 ||
    buffer.toString('ascii', 1, 4) !== 'PNG' ||
    buffer.toString('ascii', 12, 16) !== 'IHDR'
  ) {
    throw createPublicError('ScreenshotError', 'INVALID_PNG')
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
}

async function waitForApp(previousTimeOrigin = null) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
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
      // The initial about:blank target has an opaque origin.
    }
    await sleep(250)
  }
  throw createPublicError('AppReadyTimeoutError', 'APP_READY_TIMEOUT')
}

async function reloadAndWait(delay = 800) {
  const previousTimeOrigin = await evaluate('performance.timeOrigin')
  await send('Page.reload', { ignoreCache: false })
  await waitForApp(previousTimeOrigin)
  await sleep(delay)
}

async function reloadWithSeed(seedSource) {
  const { identifier } = await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `try { ${seedSource} } catch { /* bounded seed */ }`,
  })
  try {
    const previousTimeOrigin = await evaluate('performance.timeOrigin')
    await send('Page.reload', { ignoreCache: false })
    await waitForApp(previousTimeOrigin)
  } finally {
    await send('Page.removeScriptToEvaluateOnNewDocument', { identifier })
  }
  await sleep(900)
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

async function inject(city, gang) {
  const seed =
    `localStorage.clear();` +
    `localStorage.setItem(${JSON.stringify(CITY_KEY)}, ${JSON.stringify(JSON.stringify(city))});` +
    `localStorage.setItem(${JSON.stringify(GANG_KEY)}, ${JSON.stringify(JSON.stringify(gang))});`
  await reloadWithSeed(seed)
}

function childArray(id) {
  return Array(id === 'repair-shop' ? 5 : 10).fill(0)
}

function buildBuildingProgress() {
  return Object.fromEntries(
    BUILDING_IDS.map((id) => [id, { level: 1, childLevels: childArray(id) }]),
  )
}

function citySave() {
  return {
    state: {
      buildingProgress: buildBuildingProgress(),
      resources: { money: STARTING_MONEY, oil: 0, materials: 0 },
      lastResourceUpdatedAt: Date.now(),
      activeProducerIds: [],
    },
    version: 4,
  }
}

function gangSave() {
  return {
    state: {
      totalReputation: GANG_LV40_REPUTATION,
      lastUpdatedAt: Date.now(),
    },
    version: 0,
  }
}

async function readPanel() {
  return evaluate(`(() => {
    const panel = document.querySelector('.building-panel')
    if (!panel) return { present: false }
    const text = (selector) => panel.querySelector(selector)?.textContent?.trim() ?? null
    const button = panel.querySelector('.building-panel__main-button')
    const buttonRect = button?.getBoundingClientRect()
    return {
      present: true,
      title: text('.building-panel__title'),
      level: text('.building-panel__level'),
      text: panel.textContent ?? '',
      radioCount: panel.querySelectorAll('[role="radio"]').length,
      radiogroupCount: panel.querySelectorAll('[role="radiogroup"]').length,
      progressbarCount: panel.querySelectorAll('[role="progressbar"]').length,
      childOptionCount: panel.querySelectorAll('.building-panel__child-option').length,
      sharedUpgradeCount: panel.querySelectorAll('.building-panel__shared-upgrade').length,
      mainButtonLabel: button?.textContent?.trim() ?? null,
      mainButtonDisabled: button ? Boolean(button.disabled) : null,
      mainButtonRect: buttonRect ? {
        width: buttonRect.width,
        height: buttonRect.height,
        left: buttonRect.left,
        right: buttonRect.right,
        top: buttonRect.top,
        bottom: buttonRect.bottom
      } : null,
      confirmSubmitCount: panel.querySelectorAll('.building-panel__confirm-submit').length,
      confirmBackCount: panel.querySelectorAll('.building-panel__confirm-back').length,
      confirmTitleCount: panel.querySelectorAll('#building-panel-confirm-title').length,
      cost: [...panel.querySelectorAll('.building-panel__confirm-cost li')].map((item) => item.textContent.trim()),
      powers: [...panel.querySelectorAll('.building-panel__confirm-power')].map((item) => item.textContent.trim())
    }
  })()`)
}

async function closePanel() {
  const present = await evaluate(
    `Boolean(document.querySelector('.building-panel__close'))`,
  )
  if (present) {
    await clickSelector('.building-panel__close')
    await sleep(120)
  }
}

async function findBuilding(title) {
  const tryAt = async (x, y) => {
    await mouseClick(x, y)
    await sleep(150)
    const panel = await readPanel()
    if (panel.present && panel.title === title && panel.level !== null) {
      return { x, y, panel }
    }
    if (panel.present) await closePanel()
    return null
  }
  const cached = buildingSpots[title]
  if (cached) {
    const hit = await tryAt(cached.x, cached.y)
    if (hit) return hit
  }
  for (let y = 280; y <= 720; y += 42) {
    for (let x = 300; x <= 1160; x += 42) {
      const hit = await tryAt(x, y)
      if (hit) {
        buildingSpots[title] = { x, y }
        return hit
      }
    }
  }
  throw createPublicError('BuildingNotFoundError', 'BUILDING_NOT_FOUND')
}

async function measureBuildingPanel() {
  return evaluate(`(() => {
    const panel = document.querySelector('.building-panel')
    const root = document.documentElement
    if (!panel) return { present: false }
    const button = panel.querySelector('.building-panel__main-button')
    button?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    const panelRect = panel.getBoundingClientRect()
    const buttonRect = button?.getBoundingClientRect()
    const style = getComputedStyle(panel)
    return {
      present: true,
      viewport: { width: innerWidth, height: innerHeight },
      noHorizontalOverflow:
        panel.scrollWidth <= panel.clientWidth + 1 &&
        root.scrollWidth <= innerWidth + 1,
      withinHorizontalBounds:
        panelRect.left >= -1 && panelRect.right <= innerWidth + 1,
      scrollableOrFits:
        panel.scrollHeight <= panel.clientHeight + 1 ||
        style.overflowY === 'auto' ||
        style.overflowY === 'scroll',
      button: buttonRect ? {
        width: buttonRect.width,
        height: buttonRect.height,
        left: buttonRect.left,
        right: buttonRect.right,
        top: buttonRect.top,
        bottom: buttonRect.bottom,
        withinViewport:
          buttonRect.left >= -1 &&
          buttonRect.right <= innerWidth + 1 &&
          buttonRect.top >= -1 &&
          buttonRect.bottom <= innerHeight + 1
      } : null
    }
  })()`)
}

async function fetchNoCache(url) {
  const response = await fetchWithTimeout(url, {
    cache: 'no-store',
    headers: { 'cache-control': 'no-cache', pragma: 'no-cache' },
  })
  return {
    status: response.status,
    body: await response.text(),
  }
}

async function checkPublicHttp() {
  const html = await fetchNoCache(PUBLIC_URL)
  const refs = [...html.body.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((reference) => reference.includes('/assets/'))
  const jsRef = refs.find((reference) => reference.endsWith('.js')) ?? null
  const cssRef = refs.find((reference) => reference.endsWith('.css')) ?? null
  const absolute = (reference) => new URL(reference, PUBLIC_ORIGIN).toString()
  const js = jsRef
    ? await fetchNoCache(absolute(jsRef))
    : { status: 0, body: '' }
  const css = cssRef
    ? await fetchNoCache(absolute(cssRef))
    : { status: 0, body: '' }
  results.http = {
    fetchTimeoutMs: HTTP_FETCH_TIMEOUT_MS,
    url: `?release=${RELEASE_TAG}`,
    htmlStatus: html.status,
    htmlBytes: Buffer.byteLength(html.body),
    assetRefs: refs,
    jsRef,
    cssRef,
    jsStatus: js.status,
    cssStatus: css.status,
    jsBytes: Buffer.byteLength(js.body),
    cssBytes: Buffer.byteLength(css.body),
    jsMatchesExpected: jsRef === EXPECTED_JS,
    cssMatchesExpected: cssRef === EXPECTED_CSS,
    baseOk:
      refs.length === 2 &&
      refs.every((reference) => reference.startsWith('/DobeDemo/')),
  }
}

function evaluateAssertions(value, { checkFiles = true } = {}) {
  const checks = []
  const add = (name, pass, detail = '') =>
    checks.push({ name, pass: pass === true, detail: String(detail ?? '') })

  add(
    'R1. release identity matches main and built gh-pages commits',
    value.release?.mainCommit === MAIN_COMMIT &&
      value.release?.pagesCommit === RELEASE_COMMIT &&
      value.release?.url === `?release=${RELEASE_TAG}`,
    JSON.stringify(value.release),
  )
  add(
    'S1. dynamic CDP belongs to isolated owned profile',
    value.preflight?.cdpPortSource === 'DevToolsActivePort' &&
      value.preflight?.cdpPortAssigned === true &&
      value.preflight?.cdpBrowserWsPathValidated === true &&
      value.preflight?.cdpOwnedProfile === true &&
      value.processSafety?.profilePrefixVerified === true,
    JSON.stringify(value.preflight),
  )
  add(
    'H1. public HTML/current JS/current CSS return exact HTTP 200',
    value.http?.htmlStatus === 200 &&
      value.http?.jsStatus === 200 &&
      value.http?.cssStatus === 200 &&
      value.http?.htmlBytes > 0 &&
      value.http?.jsBytes > 0 &&
      value.http?.cssBytes > 0,
    JSON.stringify({
      html: value.http?.htmlStatus,
      js: value.http?.jsStatus,
      css: value.http?.cssStatus,
    }),
  )
  add(
    'H2. public asset names exactly match the Clubhouse release',
    value.http?.baseOk === true &&
      value.http?.jsMatchesExpected === true &&
      value.http?.cssMatchesExpected === true &&
      arraysEqual(value.http?.assetRefs, [EXPECTED_JS, EXPECTED_CSS]),
    JSON.stringify({
      refs: value.http?.assetRefs,
      js: value.http?.jsRef,
      css: value.http?.cssRef,
    }),
  )
  const freshChildren = value.fresh?.clubhouse?.childLevels
  const freshProduction = value.fresh?.productionSincePreset
  add(
    '1. isolated profile rehydrates legal v4 wallet and gang Lv.40 preset',
    value.fresh?.injectedCityVersion === 4 &&
      value.fresh?.injectedGangReputation === GANG_LV40_REPUTATION &&
      value.fresh?.injectedWallet?.money === STARTING_MONEY &&
      value.fresh?.injectedWallet?.oil === 0 &&
      value.fresh?.injectedWallet?.materials === 0 &&
      value.fresh?.cityVersion === 4 &&
      value.fresh?.gangReputation >= GANG_LV40_REPUTATION &&
      value.fresh?.gangReputation < GANG_LV40_REPUTATION + 30 &&
      freshProduction?.money >= 0 &&
      freshProduction?.oil >= 0 &&
      freshProduction?.materials >= 0 &&
      freshProduction?.money === freshProduction?.oil * 3 &&
      freshProduction?.materials === freshProduction?.oil &&
      value.fresh?.clubhouse?.level === 1 &&
      arraysEqual(freshChildren, Array(10).fill(0)),
    JSON.stringify({
      version: value.fresh?.cityVersion,
      reputation: value.fresh?.gangReputation,
      wallet: value.fresh?.wallet,
      clubhouse: value.fresh?.clubhouse,
    }),
  )
  const freshPanel = value.fresh?.panel
  add(
    '2. real Clubhouse open has no child, progress, radio or confirmation UI',
    freshPanel?.present === true &&
      freshPanel?.title === 'Clubhouse' &&
      freshPanel?.level === '等级 1 / 10' &&
      freshPanel?.radioCount === 0 &&
      freshPanel?.radiogroupCount === 0 &&
      freshPanel?.progressbarCount === 0 &&
      freshPanel?.childOptionCount === 0 &&
      freshPanel?.sharedUpgradeCount === 0 &&
      freshPanel?.confirmSubmitCount === 0 &&
      freshPanel?.confirmBackCount === 0 &&
      freshPanel?.confirmTitleCount === 0,
    JSON.stringify(freshPanel),
  )
  add(
    '2b. public Clubhouse shows exact direct target-2 cost and power',
    arraysEqual(freshPanel?.powers, [
      '当前建筑战力 250',
      '本次战力 +60',
      '升级后战力 310',
    ]) &&
      arraysEqual(freshPanel?.cost, ['钱 25', '油 0', '物资 0']) &&
      freshPanel?.mainButtonLabel === '直接升级 Clubhouse 至 Lv.2 · 钱 25' &&
      freshPanel?.mainButtonDisabled === false,
    JSON.stringify({
      powers: freshPanel?.powers,
      cost: freshPanel?.cost,
      button: freshPanel?.mainButtonLabel,
    }),
  )
  add(
    '3. one real click upgrades 1->2, deducts exactly 25 and keeps children zero',
    value.firstUpgrade?.levelBefore === 1 &&
      value.firstUpgrade?.levelAfter === 2 &&
      value.firstUpgrade?.spent?.money === 25 &&
      value.firstUpgrade?.spent?.oil === 0 &&
      value.firstUpgrade?.spent?.materials === 0 &&
      arraysEqual(value.firstUpgrade?.children, Array(10).fill(0)),
    JSON.stringify({
      before: value.firstUpgrade?.levelBefore,
      after: value.firstUpgrade?.levelAfter,
      spent: value.firstUpgrade?.spent,
      children: value.firstUpgrade?.children,
    }),
  )
  const afterPanel = value.firstUpgrade?.panel
  add(
    '3b. direct click opens no confirmation and stays on Lv.2 details',
    afterPanel?.level === '等级 2 / 10' &&
      afterPanel?.confirmSubmitCount === 0 &&
      afterPanel?.confirmBackCount === 0 &&
      afterPanel?.confirmTitleCount === 0 &&
      afterPanel?.mainButtonLabel === '直接升级 Clubhouse 至 Lv.3 · 钱 60',
    JSON.stringify(afterPanel),
  )
  add(
    '4. refresh persists Lv.2 and ten zero children with only legal production',
    value.persistence?.cityVersion === 4 &&
      value.persistence?.level === 2 &&
      value.persistence?.productionSinceClick?.money >= 0 &&
      value.persistence?.productionSinceClick?.oil >= 0 &&
      value.persistence?.productionSinceClick?.materials >= 0 &&
      value.persistence?.productionSinceClick?.money ===
        value.persistence?.productionSinceClick?.oil * 3 &&
      value.persistence?.productionSinceClick?.materials ===
        value.persistence?.productionSinceClick?.oil &&
      arraysEqual(value.persistence?.children, Array(10).fill(0)),
    JSON.stringify(value.persistence),
  )
  const mobile = value.layout?.mobile
  add(
    '5. mobile 390x844 has no horizontal overflow and a reachable 44x44 button',
    mobile?.present === true &&
      mobile?.viewport?.width === 390 &&
      mobile?.viewport?.height === 844 &&
      mobile?.noHorizontalOverflow === true &&
      mobile?.withinHorizontalBounds === true &&
      mobile?.scrollableOrFits === true &&
      mobile?.button?.width >= 44 &&
      mobile?.button?.height >= 44 &&
      mobile?.button?.withinViewport === true,
    JSON.stringify(mobile),
  )
  const screenshotMetadataOk = EXPECTED_SHOTS.every((name) => {
    const metadata = value.screenshots?.[name]
    if (
      !metadata ||
      metadata.width < 1 ||
      metadata.height < 1 ||
      metadata.bytes < 1 ||
      !/^[a-f0-9]{64}$/.test(metadata.sha256)
    ) {
      return false
    }
    if (!checkFiles) return true
    const file = path.join(HERE, name)
    return fs.existsSync(file) && fs.statSync(file).size === metadata.bytes
  })
  add(
    'E1. all public screenshots are nonempty valid PNG files',
    screenshotMetadataOk,
    JSON.stringify(value.screenshots),
  )
  add(
    'E2. persisted evidence contains no absolute paths or raw errors',
    Object.keys(value ?? {}).length > 0 && isPublicSafe(value),
    isPublicSafe(value),
  )
  add(
    'T1. teardown targeted only the owned active Chrome child',
    value.processSafety?.unknownProcessesTerminated === false &&
      arraysEqual(
        value.processSafety?.registeredProcesses?.map((item) => item.label),
        ['chrome'],
      ) &&
      value.processSafety?.childErrors?.length === 0 &&
      value.processSafety?.killAttempts?.length === 1 &&
      value.processSafety.killAttempts.every(
        (attempt) =>
          attempt.label === 'chrome' &&
          attempt.owned === true &&
          (attempt.active === true ||
            (attempt.active === false && attempt.skipped === true)),
      ),
    JSON.stringify(value.processSafety),
  )
  add(
    'T2. owned CDP port was released',
    value.teardown?.cdpPortReleased === true,
    value.teardown?.cdpPortReleased,
  )
  add(
    'T3. isolated temporary Chrome profile was removed',
    value.teardown?.tempProfileRemoved === true,
    value.teardown?.tempProfileRemoved,
  )
  return checks
}

function verifyTopLevelSafetyStructure(entrypoint) {
  const source = Function.prototype.toString.call(entrypoint)
  return (
    source.includes('await runAssertionSelfTest()') &&
    source.includes('attemptResultWrite(') &&
    source.includes('finally') &&
    source.includes('toPublicErrorCategory(error)') &&
    source.includes('emitPublicError(')
  )
}

function verifyChildProcessErrorStructure() {
  const registerSource = Function.prototype.toString.call(registerOwnedProcess)
  const attachIndex = registerSource.indexOf('attachChildProcessErrorListener(')
  const pidIndex = registerSource.indexOf('const pid')
  return (
    attachIndex >= 0 &&
    pidIndex > attachIndex &&
    Function.prototype.toString
      .call(connectCdp)
      .includes('throwIfChildProcessFailed(') &&
    Function.prototype.toString
      .call(killOwnedTree)
      .includes('childProcessStates')
  )
}

function verifyHttpFetchStructure() {
  const sources = [connectCdp, fetchNoCache].map((fn) =>
    Function.prototype.toString.call(fn),
  )
  return sources.every(
    (source) =>
      source.includes('fetchWithTimeout(') && !/\bfetch\s*\(/.test(source),
  )
}

async function runTransportSafetySelfTest() {
  let sendTimeout = false
  const timeoutPending = new Map()
  try {
    await sendCdpRequest(
      { send() {} },
      timeoutPending,
      1,
      'SelfTest.timeout',
      {},
      5,
    )
  } catch (error) {
    sendTimeout = error?.code === 'CDP_TIMEOUT' && timeoutPending.size === 0
  }

  let socketClose = false
  const closePending = new Map()
  const closePromise = new Promise((resolve, reject) => {
    closePending.set(2, {
      resolve,
      reject,
      timer: setTimeout(() => {}, 1000),
    })
  })
  handleCdpSocketFailure(
    closePending,
    'CdpSocketClosedError',
    'CDP_SOCKET_CLOSED',
  )
  const closeResult = await closePromise.then(
    () => ({ rejected: false }),
    (error) => ({ rejected: true, code: error?.code }),
  )
  socketClose =
    closeResult.rejected &&
    closeResult.code === 'CDP_SOCKET_CLOSED' &&
    closePending.size === 0

  let connectionTimeout = false
  const connectionListeners = new Map()
  try {
    await waitForSocketOpen(
      {
        addEventListener(type, listener) {
          const group = connectionListeners.get(type) ?? new Set()
          group.add(listener)
          connectionListeners.set(type, group)
        },
        removeEventListener(type, listener) {
          connectionListeners.get(type)?.delete(listener)
        },
      },
      5,
    )
  } catch (error) {
    connectionTimeout =
      error?.code === 'CDP_CONNECT_TIMEOUT' &&
      [...connectionListeners.values()].every((group) => group.size === 0)
  }

  let httpFetchTimeout = false
  try {
    await fetchWithTimeout(
      'http://127.0.0.1/self-test',
      {},
      5,
      (_url, options) =>
        new Promise((_resolve, reject) => {
          const keeper = setTimeout(
            () => reject(new Error('self-test HTTP timeout did not fire')),
            1000,
          )
          options.signal.addEventListener(
            'abort',
            () => {
              clearTimeout(keeper)
              reject(options.signal.reason)
            },
            { once: true },
          )
        }),
    )
  } catch (error) {
    httpFetchTimeout =
      error?.name === 'HttpTimeoutError' && error?.code === 'HTTP_TIMEOUT'
  }

  let inactiveChildSkipped = false
  const child = {
    pid: 42,
    exitCode: 0,
    signalCode: null,
    killed: false,
  }
  const decision = getOwnedChildDecision(
    child,
    'self-test',
    new Map([[child, { label: 'self-test', pid: 42 }]]),
    new Set(),
    new Set(),
  )
  inactiveChildSkipped = decision.owned && !decision.active

  let childProcessErrorBoundary = false
  const listeners = new Map()
  const fakeChild = {
    on(type, listener) {
      const group = listeners.get(type) ?? new Set()
      group.add(listener)
      listeners.set(type, group)
    },
    emit(type, value) {
      for (const listener of listeners.get(type) ?? []) listener(value)
    },
  }
  let captured
  attachChildProcessErrorListener(fakeChild, (category) => {
    captured = category
  })
  const privateSpawnError = new Error('C:\\Users\\private\\secret\\spawn.exe')
  privateSpawnError.code = 'ENOENT'
  fakeChild.emit('error', privateSpawnError)
  childProcessErrorBoundary =
    listeners.get('error')?.size === 1 &&
    captured?.name === 'Error' &&
    captured?.code === 'ENOENT' &&
    isPublicSafe(captured)

  const privateWriteError = new Error(
    'C:\\Users\\private\\secret\\results.json',
  )
  privateWriteError.code = 'EACCES'
  const writeAttempt = attemptResultWrite(
    () => {
      throw privateWriteError
    },
    'ignored.json',
    {},
  )
  const writeBoundary =
    writeAttempt.ok === false &&
    writeAttempt.error?.name === 'Error' &&
    writeAttempt.error?.code === 'EACCES' &&
    isPublicSafe(writeAttempt)

  const topLevelBoundary = verifyTopLevelSafetyStructure(main)
  const childProcessErrorStructure = verifyChildProcessErrorStructure()
  const httpFetchStructure = verifyHttpFetchStructure()
  return {
    ok:
      sendTimeout &&
      socketClose &&
      connectionTimeout &&
      httpFetchTimeout &&
      inactiveChildSkipped &&
      childProcessErrorBoundary &&
      writeBoundary &&
      topLevelBoundary &&
      childProcessErrorStructure &&
      httpFetchStructure,
    checked: 10,
    sendTimeout,
    socketClose,
    connectionTimeout,
    httpFetchTimeout,
    inactiveChildSkipped,
    childProcessErrorBoundary,
    writeBoundary,
    topLevelBoundary,
    childProcessErrorStructure,
    httpFetchStructure,
  }
}

async function runAssertionSelfTest() {
  const panel = {
    present: true,
    title: 'Clubhouse',
    level: '等级 1 / 10',
    radioCount: 0,
    radiogroupCount: 0,
    progressbarCount: 0,
    childOptionCount: 0,
    sharedUpgradeCount: 0,
    confirmSubmitCount: 0,
    confirmBackCount: 0,
    confirmTitleCount: 0,
    powers: ['当前建筑战力 250', '本次战力 +60', '升级后战力 310'],
    cost: ['钱 25', '油 0', '物资 0'],
    mainButtonLabel: '直接升级 Clubhouse 至 Lv.2 · 钱 25',
    mainButtonDisabled: false,
  }
  const screenshots = Object.fromEntries(
    EXPECTED_SHOTS.map((name) => [
      name,
      { width: 1, height: 1, bytes: 1, sha256: 'a'.repeat(64) },
    ]),
  )
  const good = {
    release: {
      mainCommit: MAIN_COMMIT,
      pagesCommit: RELEASE_COMMIT,
      url: `?release=${RELEASE_TAG}`,
    },
    preflight: {
      cdpPortSource: 'DevToolsActivePort',
      cdpPortAssigned: true,
      cdpBrowserWsPathValidated: true,
      cdpOwnedProfile: true,
    },
    processSafety: {
      profilePrefixVerified: true,
      registeredProcesses: [{ label: 'chrome', owned: true }],
      childErrors: [],
      killAttempts: [{ label: 'chrome', owned: true, active: true }],
      unknownProcessesTerminated: false,
    },
    http: {
      htmlStatus: 200,
      jsStatus: 200,
      cssStatus: 200,
      htmlBytes: 1,
      jsBytes: 1,
      cssBytes: 1,
      baseOk: true,
      assetRefs: [EXPECTED_JS, EXPECTED_CSS],
      jsMatchesExpected: true,
      cssMatchesExpected: true,
      jsRef: EXPECTED_JS,
      cssRef: EXPECTED_CSS,
    },
    fresh: {
      injectedCityVersion: 4,
      injectedGangReputation: GANG_LV40_REPUTATION,
      injectedWallet: { money: STARTING_MONEY, oil: 0, materials: 0 },
      cityVersion: 4,
      gangReputation: GANG_LV40_REPUTATION,
      wallet: { money: STARTING_MONEY, oil: 0, materials: 0 },
      productionSincePreset: { money: 0, oil: 0, materials: 0 },
      clubhouse: { level: 1, childLevels: Array(10).fill(0) },
      panel,
    },
    firstUpgrade: {
      levelBefore: 1,
      levelAfter: 2,
      spent: { money: 25, oil: 0, materials: 0 },
      children: Array(10).fill(0),
      panel: {
        ...panel,
        level: '等级 2 / 10',
        mainButtonLabel: '直接升级 Clubhouse 至 Lv.3 · 钱 60',
      },
    },
    persistence: {
      cityVersion: 4,
      level: 2,
      wallet: { money: STARTING_MONEY - 25, oil: 0, materials: 0 },
      productionSinceClick: { money: 0, oil: 0, materials: 0 },
      children: Array(10).fill(0),
    },
    layout: {
      mobile: {
        present: true,
        viewport: { width: 390, height: 844 },
        noHorizontalOverflow: true,
        withinHorizontalBounds: true,
        scrollableOrFits: true,
        button: {
          width: 44,
          height: 44,
          withinViewport: true,
        },
      },
    },
    screenshots,
    teardown: { cdpPortReleased: true, tempProfileRemoved: true },
    assertions: [],
  }
  const goodChecks = evaluateAssertions(good, { checkFiles: false })
  const emptyChecks = evaluateAssertions({}, { checkFiles: false })
  const windowsError = new Error('C:\\Users\\private\\secret\\file.mjs')
  windowsError.stack = 'at C:\\Users\\private\\secret\\file.mjs:1:1'
  windowsError.code = 'ENOENT'
  const unixError = new TypeError('/Users/private/secret/file.mjs')
  unixError.stack = 'at /Users/private/secret/file.mjs:1:1'
  const outputs = [
    toPublicErrorCategory(windowsError),
    toPublicErrorCategory(unixError),
  ]
  const redacted =
    isPublicSafe(outputs) &&
    JSON.stringify(outputs) ===
      JSON.stringify([{ name: 'Error', code: 'ENOENT' }, { name: 'TypeError' }])
  const transportSafety = await runTransportSafetySelfTest()
  return {
    ok:
      goodChecks.every((item) => item.pass) &&
      emptyChecks.every((item) => !item.pass) &&
      redacted &&
      transportSafety.ok,
    checked: goodChecks.length + 1 + transportSafety.checked,
    failuresOnGoodData: goodChecks
      .filter((item) => !item.pass)
      .map((item) => item.name),
    passesOnEmptyData: emptyChecks
      .filter((item) => item.pass)
      .map((item) => item.name),
    pathRedaction: {
      ok: redacted,
      outputs,
      forbiddenDataPresent: !redacted,
    },
    transportSafety,
  }
}

async function runFlow() {
  await checkPublicHttp()
  launchChrome()
  await connectCdp()
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Input.setIgnoreInputEvents', { ignore: false })
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  })
  await send('Page.navigate', { url: PUBLIC_URL })
  await waitForApp()
  await sleep(700)

  await inject(citySave(), gangSave())
  const hit = await findBuilding('Clubhouse')
  const freshStorage = await readStorage()
  const injectedWallet = { money: STARTING_MONEY, oil: 0, materials: 0 }
  const freshWallet = freshStorage.city?.state?.resources ?? null
  results.fresh = {
    injectedCityVersion: 4,
    injectedGangReputation: GANG_LV40_REPUTATION,
    injectedWallet,
    cityVersion: freshStorage.city?.version ?? null,
    gangReputation: freshStorage.gang?.state?.totalReputation ?? null,
    wallet: freshWallet,
    productionSincePreset: freshWallet
      ? {
          money: freshWallet.money - injectedWallet.money,
          oil: freshWallet.oil - injectedWallet.oil,
          materials: freshWallet.materials - injectedWallet.materials,
        }
      : null,
    clubhouse: freshStorage.city?.state?.buildingProgress?.clubhouse ?? null,
    panel: hit.panel,
  }
  await screenshot('clubhouse-public-desktop-before.png', {
    viewport: '1440x900',
    level: 1,
  })

  const walletBefore = freshStorage.city?.state?.resources
  await clickSelector('.building-panel__main-button')
  await sleep(450)
  const afterStorage = await readStorage()
  const afterPanel = await readPanel()
  const afterProgress = afterStorage.city?.state?.buildingProgress?.clubhouse
  results.firstUpgrade = {
    levelBefore: 1,
    levelAfter: afterProgress?.level ?? null,
    walletBefore,
    walletAfter: afterStorage.city?.state?.resources ?? null,
    spent: walletDelta(walletBefore, afterStorage.city?.state?.resources),
    children: afterProgress?.childLevels ?? null,
    panel: afterPanel,
  }
  await screenshot('clubhouse-public-desktop-after.png', {
    viewport: '1440x900',
    level: 2,
  })

  await reloadAndWait()
  const persistedStorage = await readStorage()
  const persistedProgress =
    persistedStorage.city?.state?.buildingProgress?.clubhouse
  results.persistence = {
    cityVersion: persistedStorage.city?.version ?? null,
    level: persistedProgress?.level ?? null,
    wallet: persistedStorage.city?.state?.resources ?? null,
    productionSinceClick:
      persistedStorage.city?.state?.resources &&
      results.firstUpgrade.walletAfter
        ? {
            money:
              persistedStorage.city.state.resources.money -
              results.firstUpgrade.walletAfter.money,
            oil:
              persistedStorage.city.state.resources.oil -
              results.firstUpgrade.walletAfter.oil,
            materials:
              persistedStorage.city.state.resources.materials -
              results.firstUpgrade.walletAfter.materials,
          }
        : null,
    children: persistedProgress?.childLevels ?? null,
  }

  await findBuilding('Clubhouse')
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  })
  await sleep(450)
  results.layout.mobile = await measureBuildingPanel()
  await screenshot('clubhouse-public-mobile.png', {
    viewport: '390x844',
    level: 2,
  })
}

async function removeProfileSafely() {
  if (!profileDir) return null
  const expectedRoot = path.join(os.tmpdir(), PROFILE_PREFIX)
  if (
    !profileDir.startsWith(expectedRoot) ||
    !path.basename(profileDir).startsWith(PROFILE_PREFIX)
  ) {
    throw createPublicError('SafetyAbortError', 'BAD_PROFILE_PREFIX')
  }
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      fs.rmSync(profileDir, { recursive: true, force: true })
    } catch {
      // Windows Chrome can briefly retain profile files after taskkill.
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
  await sleep(1200)
  results.teardown.cdpPortReleased = cdpPort
    ? !(await isPortInUse(cdpPort))
    : null
  results.teardown.tempProfileRemoved = await removeProfileSafely()
}

async function main() {
  let runError
  let teardownError
  try {
    try {
      results.assertionSelfTest = await runAssertionSelfTest()
      console.log(
        `ASSERTION SELF-TEST: ${results.assertionSelfTest.ok ? 'PASS' : 'FAIL'} (${results.assertionSelfTest.checked} pure-data checks)`,
      )
      if (!results.assertionSelfTest.ok) {
        throw createPublicError(
          'AssertionSelfTestError',
          'ASSERTION_SELF_TEST_FAILED',
        )
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

    try {
      results.assertions = evaluateAssertions(results)
    } catch (error) {
      runError ||= error
      results.assertionEvaluationError = toPublicErrorCategory(error)
      results.assertions = []
    }
    const failures = results.assertions.filter((assertion) => !assertion.pass)
    const writeAttempt = attemptResultWrite(fs.writeFileSync, OUT_JSON, results)
    if (writeAttempt.ok) {
      console.log(`WROTE ${path.basename(OUT_JSON)}`)
    } else {
      results.writeError = writeAttempt.error
      const writeError = createPublicError(
        writeAttempt.error?.name ?? 'ResultWriteError',
        writeAttempt.error?.code ?? 'RESULT_WRITE_FAILED',
      )
      runError ||= writeError
      emitPublicError('WRITE ERROR', writeError)
    }
    for (const assertion of results.assertions) {
      console.log(
        `${assertion.pass ? 'PASS' : 'FAIL'} ${assertion.name}: ${assertion.detail}`,
      )
    }
    if (runError) emitPublicError('RUN ERROR', runError)
    if (teardownError && teardownError !== runError) {
      emitPublicError('TEARDOWN ERROR', teardownError)
    }
    if (failures.length) {
      console.error(
        `FAILED ASSERTIONS: ${failures.map((item) => item.name).join(', ')}`,
      )
    }
    const ok =
      !runError &&
      results.assertionSelfTest.ok &&
      failures.length === 0 &&
      writeAttempt.ok
    console.log(
      ok
        ? `ALL ASSERTIONS PASSED (${results.assertions.length}/${results.assertions.length})`
        : 'ACCEPTANCE FAILED',
    )
    process.exitCode = ok ? 0 : 1
  } catch (error) {
    emitPublicError('FATAL ERROR', error)
    process.exitCode = 1
  }
}

void main().catch((error) => {
  emitPublicError('FATAL ERROR', error)
  process.exitCode = 1
})
