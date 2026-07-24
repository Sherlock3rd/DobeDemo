// Safe local Chrome/CDP acceptance for Clubhouse direct upgrades.
// All visible actions use Input.dispatchMouseEvent; no DOM click is used.
import crypto from 'node:crypto'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import { execFileSync, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '..', '..')
const OUT_JSON = path.join(HERE, 'clubhouse-direct-upgrade-results.json')
const DIST_INDEX = path.join(REPO, 'dist', 'index.html')
const VITE_BIN = path.join(REPO, 'node_modules', 'vite', 'bin', 'vite.js')
const PROFILE_PREFIX = 'dobe-clubhouse-direct-cdp-'
const CDP_REQUEST_TIMEOUT_MS = 10_000
const HTTP_FETCH_TIMEOUT_MS = 10_000
const CITY_KEY = 'dobe-city-progression-v1'
const GANG_KEY = 'gang-progression-v1'
const GANG_LV40_REPUTATION = 1170
const GANG_LV39_REPUTATION = 1140
const LARGE_MONEY = 100_000
const BUILDING_IDS = [
  'repair-shop',
  'recycling-yard',
  'commercial-street',
  'metalworking-plant',
  'gas-station',
  'clubhouse',
]
const MAIN_COSTS = {
  2: { money: 25, oil: 0, materials: 0 },
  3: { money: 60, oil: 0, materials: 0 },
}
const CLUBHOUSE_POWERS = { 1: 250, 2: 310, 3: 380 }
const EXPECTED_ASSETS = [
  '/DobeDemo/assets/index-781xcY6f.js',
  '/DobeDemo/assets/index-CoMhGqEJ.css',
]
const EXPECTED_SHOTS = [
  'clubhouse-desktop-before.png',
  'clubhouse-desktop-after.png',
  'clubhouse-consecutive.png',
  'clubhouse-insufficient.png',
  'clubhouse-maxed.png',
  'clubhouse-locked.png',
  'clubhouse-migration.png',
  'clubhouse-repair-regression.png',
  'clubhouse-mobile.png',
]
const CANVAS_MIN_CHANGED_PIXELS = 30

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const results = {
  generatedAt: new Date().toISOString(),
  script: 'clubhouse-direct-upgrade-cdp.mjs',
  preflight: {
    strategy:
      'strict owned Vite port; Chrome port 0 read from isolated-profile DevToolsActivePort',
    attemptedDevPorts: [],
    cdpPortSource: 'DevToolsActivePort',
  },
  processSafety: {
    registeredProcesses: [],
    childErrors: [],
    killAttempts: [],
    unknownProcessesTerminated: false,
  },
  dist: {},
  http: {},
  fresh: {},
  firstUpgrade: {},
  consecutive: {},
  blocked: {},
  migration: {},
  storeUiBoundary: {},
  visual: {},
  regression: {},
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
const activeChildren = new Set()
const registeredChildren = new WeakMap()
const childProcessStates = new WeakMap()
const buildingSpots = {}

function check(name, pass, detail = '') {
  const assertion = { name, pass: pass === true, detail: String(detail ?? '') }
  results.assertions.push(assertion)
  console.log(
    `${assertion.pass ? 'PASS' : 'FAIL'} ${name}: ${assertion.detail}`,
  )
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
      // The final fallback must never escape to Node's default stack printer.
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
      .call(startDevServer)
      .includes('throwIfChildProcessFailed(') &&
    Function.prototype.toString
      .call(connectCdp)
      .includes('throwIfChildProcessFailed(') &&
    Function.prototype.toString
      .call(killOwnedTree)
      .includes('childProcessStates')
  )
}

function verifyHttpFetchStructure() {
  const sources = [connectCdp, startDevServer, checkHttp].map((fn) =>
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
  const closeError = new Error('self-test close')
  closeError.name = 'CdpSocketClosedError'
  closeError.code = 'CDP_SOCKET_CLOSED'
  const closePromise = new Promise((resolve, reject) => {
    closePending.set(2, {
      resolve,
      reject,
      timer: setTimeout(() => {}, 1000),
    })
  })
  try {
    handleCdpSocketFailure(closePending, closeError.name, closeError.code)
    const settled = await closePromise.then(
      () => ({ rejected: false }),
      (error) => ({ rejected: true, code: error?.code }),
    )
    socketClose =
      settled.rejected &&
      settled.code === 'CDP_SOCKET_CLOSED' &&
      closePending.size === 0
  } catch {
    socketClose = false
  }

  let inactiveChildSkipped = false
  try {
    const child = {
      pid: 42,
      exitCode: 0,
      signalCode: null,
      killed: false,
    }
    const registrations = new Map([
      [child, { label: 'self-test', pid: child.pid }],
    ])
    const decision = getOwnedChildDecision(
      child,
      'self-test',
      registrations,
      new Set(),
      new Set(),
    )
    inactiveChildSkipped = decision.owned && !decision.active
  } catch {
    inactiveChildSkipped = false
  }

  let connectionTimeout = false
  const connectionListeners = new Map()
  try {
    const socket = {
      addEventListener(type, listener) {
        const group = connectionListeners.get(type) ?? new Set()
        group.add(listener)
        connectionListeners.set(type, group)
      },
      removeEventListener(type, listener) {
        connectionListeners.get(type)?.delete(listener)
      },
    }
    await waitForSocketOpen(socket, 5)
  } catch (error) {
    connectionTimeout =
      error?.code === 'CDP_CONNECT_TIMEOUT' &&
      [...connectionListeners.values()].every((group) => group.size === 0)
  }

  let writeBoundary = false
  try {
    const privateError = new Error('C:\\Users\\private\\secret\\results.json')
    privateError.code = 'EACCES'
    const attempt = attemptResultWrite(
      () => {
        throw privateError
      },
      'ignored.json',
      {},
    )
    const serialized = JSON.stringify(attempt)
    writeBoundary =
      attempt.ok === false &&
      attempt.error?.name === 'Error' &&
      attempt.error?.code === 'EACCES' &&
      !/Users|private|secret|[A-Za-z]:\\|message|stack/i.test(serialized)
  } catch {
    writeBoundary = false
  }

  let topLevelBoundary = false
  try {
    topLevelBoundary = verifyTopLevelSafetyStructure(main)
  } catch {
    topLevelBoundary = false
  }

  let childProcessErrorBoundary = false
  try {
    const listeners = new Map()
    const child = {
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
    attachChildProcessErrorListener(child, (category) => {
      captured = category
    })
    const privateError = new Error('C:\\Users\\private\\secret\\spawn.exe')
    privateError.code = 'ENOENT'
    child.emit('error', privateError)
    const serialized = JSON.stringify(captured)
    childProcessErrorBoundary =
      listeners.get('error')?.size === 1 &&
      captured?.name === 'Error' &&
      captured?.code === 'ENOENT' &&
      !/Users|private|secret|[A-Za-z]:\\|message|stack/i.test(serialized)
  } catch {
    childProcessErrorBoundary = false
  }

  let childProcessErrorStructure = false
  try {
    childProcessErrorStructure = verifyChildProcessErrorStructure()
  } catch {
    childProcessErrorStructure = false
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

  let httpFetchStructure = false
  try {
    httpFetchStructure = verifyHttpFetchStructure()
  } catch {
    httpFetchStructure = false
  }

  return {
    ok:
      sendTimeout &&
      socketClose &&
      inactiveChildSkipped &&
      connectionTimeout &&
      writeBoundary &&
      topLevelBoundary &&
      childProcessErrorBoundary &&
      childProcessErrorStructure &&
      httpFetchTimeout &&
      httpFetchStructure,
    checked: 10,
    sendTimeout,
    socketClose,
    inactiveChildSkipped,
    connectionTimeout,
    writeBoundary,
    topLevelBoundary,
    childProcessErrorBoundary,
    childProcessErrorStructure,
    httpFetchTimeout,
    httpFetchStructure,
  }
}

async function runAssertionSelfTest() {
  const verify = (value) => [
    value?.preflight?.cdpPortSource === 'DevToolsActivePort',
    value?.preflight?.cdpOwnedProfile === true,
    value?.http?.ownedProcessAlive === true,
    value?.http?.appFeatureVerified === true,
    value?.fresh?.cityVersion === 4,
    value?.firstUpgrade?.levelAfter === 2,
    value?.firstUpgrade?.childrenAllZero === true,
    value?.consecutive?.levelAfter === 3,
    value?.migration?.versionSecond === 4,
    value?.teardown?.devPortReleased === true,
    value?.teardown?.cdpPortReleased === true,
    value?.teardown?.tempProfileRemoved === true,
  ]
  const good = {
    preflight: {
      cdpPortSource: 'DevToolsActivePort',
      cdpOwnedProfile: true,
    },
    http: { ownedProcessAlive: true, appFeatureVerified: true },
    fresh: { cityVersion: 4 },
    firstUpgrade: { levelAfter: 2, childrenAllZero: true },
    consecutive: { levelAfter: 3 },
    migration: { versionSecond: 4 },
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
  const outputs = [
    toPublicErrorCategory(windowsError),
    toPublicErrorCategory(unixError),
  ]
  const serialized = JSON.stringify(outputs)
  const redacted =
    !/Users|private|secret|[A-Za-z]:\\|\/Users\/|message|stack/i.test(
      serialized,
    ) &&
    serialized ===
      JSON.stringify([{ name: 'Error', code: 'ENOENT' }, { name: 'TypeError' }])
  const goodChecks = verify(good)
  const emptyChecks = verify({})
  const transportSafety = await runTransportSafetySelfTest()
  return {
    ok:
      goodChecks.every(Boolean) &&
      emptyChecks.every((value) => value === false) &&
      redacted &&
      transportSafety.ok,
    checked: goodChecks.length + 1 + transportSafety.checked,
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
      outputs,
      forbiddenDataPresent: !redacted,
    },
    transportSafety,
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

function attachChildProcessErrorListener(child, onError) {
  const handler = (error) => {
    try {
      onError(toPublicErrorCategory(error))
    } catch {
      // Never let an observer failure restore EventEmitter's default throw.
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

function throwIfChildProcessFailed(child, label) {
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
    throw new Error(`SAFETY_ABORT: refusing to terminate unowned ${label}`)
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
    // An owned child may already have exited.
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
  if (!found) throw new Error('Chrome not found; set CHROME_PATH')
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

async function connectCdp() {
  const activePortFile = path.join(profileDir, 'DevToolsActivePort')
  let activePortText
  for (let attempt = 0; attempt < 80; attempt += 1) {
    throwIfChildProcessFailed(chromeProc, 'chrome')
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
  results.preflight.cdpOwnedProfile = true
  results.preflight.cdpBrowserWsPathValidated = true

  let targets
  for (let attempt = 0; attempt < 40; attempt += 1) {
    throwIfChildProcessFailed(chromeProc, 'chrome')
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
  if (!page) throw new Error('No CDP page target')
  const targetUrl = new URL(page.webSocketDebuggerUrl)
  if (
    targetUrl.hostname !== '127.0.0.1' ||
    Number(targetUrl.port) !== cdpPort
  ) {
    throw new Error('CDP page target does not belong to owned Chrome port')
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
  if (response.exceptionDetails) throw new Error('CDP evaluate failed')
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

function decodePng(buffer) {
  let position = 8
  let width
  let height
  let colorType
  let bitDepth
  const idat = []
  while (position < buffer.length) {
    const length = buffer.readUInt32BE(position)
    const type = buffer.toString('ascii', position + 4, position + 8)
    const data = buffer.subarray(position + 8, position + 8 + length)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data.readUInt8(8)
      colorType = data.readUInt8(9)
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') {
      break
    }
    position += 12 + length
  }
  if (bitDepth !== 8) throw new Error(`Unsupported PNG bit depth ${bitDepth}`)
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : null
  if (!channels) throw new Error(`Unsupported PNG color type ${colorType}`)
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const output = Buffer.alloc(height * stride)
  let readPosition = 0
  for (let y = 0; y < height; y += 1) {
    const filter = raw[readPosition++]
    for (let x = 0; x < stride; x += 1) {
      const current = raw[readPosition++]
      const a = x >= channels ? output[y * stride + x - channels] : 0
      const b = y > 0 ? output[(y - 1) * stride + x] : 0
      const c =
        x >= channels && y > 0 ? output[(y - 1) * stride + x - channels] : 0
      let value
      if (filter === 0) value = current
      else if (filter === 1) value = current + a
      else if (filter === 2) value = current + b
      else if (filter === 3) value = current + ((a + b) >> 1)
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        value = current + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)
      } else {
        throw new Error(`Unsupported PNG filter ${filter}`)
      }
      output[y * stride + x] = value & 0xff
    }
  }
  return { width, height, channels, data: output }
}

function diffPixels(
  left,
  right,
  { roi = null, excludes = [], tolerance = 18 } = {},
) {
  const a = decodePng(left)
  const b = decodePng(right)
  if (a.width !== b.width || a.height !== b.height) {
    return { changedPixels: -1, consideredPixels: 0, changedPct: 100 }
  }
  const x0 = roi ? Math.max(0, Math.floor(roi.x)) : 0
  const y0 = roi ? Math.max(0, Math.floor(roi.y)) : 0
  const x1 = roi ? Math.min(a.width, Math.ceil(roi.x + roi.w)) : a.width
  const y1 = roi ? Math.min(a.height, Math.ceil(roi.y + roi.h)) : a.height
  const excluded = (x, y) =>
    excludes.some(
      (rect) =>
        x >= rect.x &&
        x < rect.x + rect.w &&
        y >= rect.y &&
        y < rect.y + rect.h,
    )
  let changedPixels = 0
  let consideredPixels = 0
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      if (excluded(x, y)) continue
      consideredPixels += 1
      const pixel = y * a.width + x
      const ai = pixel * a.channels
      const bi = pixel * b.channels
      if (
        Math.abs(a.data[ai] - b.data[bi]) > tolerance ||
        Math.abs(a.data[ai + 1] - b.data[bi + 1]) > tolerance ||
        Math.abs(a.data[ai + 2] - b.data[bi + 2]) > tolerance
      ) {
        changedPixels += 1
      }
    }
  }
  return {
    changedPixels,
    consideredPixels,
    changedPct: +(
      (changedPixels / Math.max(1, consideredPixels)) *
      100
    ).toFixed(3),
    roiClipped: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 },
  }
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

async function reloadAndWait(delay = 1000) {
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
      gang: parse(${JSON.stringify(GANG_KEY)})
    }
  })()`)
}

async function inject(city, gang, { clear = false } = {}) {
  const previousTimeOrigin = await evaluate('performance.timeOrigin')
  try {
    await evaluate(`(() => {
      if (${clear}) localStorage.clear()
      localStorage.setItem(${JSON.stringify(CITY_KEY)}, ${JSON.stringify(JSON.stringify(city))})
      localStorage.setItem(${JSON.stringify(GANG_KEY)}, ${JSON.stringify(JSON.stringify(gang))})
      location.reload()
      return true
    })()`)
  } catch {
    // The execution context can be destroyed by the intentional reload.
  }
  await waitForApp(previousTimeOrigin)
  await sleep(1000)
}

function childArray(id, fill = 0) {
  return Array(id === 'repair-shop' ? 5 : 10).fill(fill)
}

function buildBuildingProgress(overrides = {}) {
  const progress = {}
  for (const id of BUILDING_IDS) {
    progress[id] = { level: 1, childLevels: childArray(id) }
  }
  return { ...progress, ...overrides }
}

function citySave({
  version = 4,
  buildingProgress = buildBuildingProgress(),
  resources = { money: LARGE_MONEY, oil: 0, materials: 0 },
  lastResourceUpdatedAt = Date.now(),
  activeProducerIds = ['repair-shop'],
} = {}) {
  return {
    state: {
      buildingProgress,
      resources,
      lastResourceUpdatedAt,
      activeProducerIds,
    },
    version,
  }
}

function gangSave(totalReputation, lastUpdatedAt = Date.now()) {
  return { state: { totalReputation, lastUpdatedAt }, version: 0 }
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
      mainButtonCount: panel.querySelectorAll('.building-panel__main-button').length,
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
      powers: [...panel.querySelectorAll('.building-panel__confirm-power')].map((item) => item.textContent.trim()),
      blocker: text('.building-panel__main-blocker'),
      status: text('.building-panel__main-status'),
      lockStatus: text('.building-panel__lock-status'),
      lockRequirement: text('.building-panel__lock-requirement')
    }
  })()`)
}

async function closePanel() {
  const present = await evaluate(
    `Boolean(document.querySelector('.building-panel__close'))`,
  )
  if (present) {
    await clickSelector('.building-panel__close')
    await sleep(140)
  }
}

async function findBuilding(title, { requireUnlocked = true } = {}) {
  const tryAt = async (x, y) => {
    await mouseClick(x, y)
    await sleep(150)
    const panel = await readPanel()
    if (
      panel.present &&
      panel.title === title &&
      (!requireUnlocked || panel.level !== null)
    ) {
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
  throw new Error(`Building not found via real CDP pointer scan: ${title}`)
}

async function renderProbe() {
  return evaluate(`import('/src/scene/city/buildingFragmentCatalog.ts').then(
    ({ getRenderedBuildingFragments }) =>
      import('/src/store/useCityStore.ts').then(({ useCityStore }) => {
        const progress = useCityStore.getState().buildingProgress.clubhouse
        const fragments = getRenderedBuildingFragments('clubhouse', progress)
        return {
          level: progress.level,
          childLevels: progress.childLevels,
          fragmentCount: fragments.length,
          states: fragments.map((fragment) => fragment.state),
          scaffoldCount: fragments.filter((fragment) => fragment.state === 'scaffold').length,
          animatedCount: fragments.filter((fragment) => fragment.animate).length
        }
      })
  )`)
}

async function exclusionRects() {
  return evaluate(`(() => {
    const rects = []
    for (const selector of ['.building-panel', '.global-hud', '.city-hud']) {
      const element = document.querySelector(selector)
      if (!element) continue
      const rect = element.getBoundingClientRect()
      rects.push({
        x: Math.floor(rect.left) - 5,
        y: Math.floor(rect.top) - 5,
        w: Math.ceil(rect.width) + 10,
        h: Math.ceil(rect.height) + 10
      })
    }
    return rects
  })()`)
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
      panel: {
        left: panelRect.left,
        right: panelRect.right,
        top: panelRect.top,
        bottom: panelRect.bottom,
        width: panelRect.width,
        height: panelRect.height,
        clientWidth: panel.clientWidth,
        scrollWidth: panel.scrollWidth,
        clientHeight: panel.clientHeight,
        scrollHeight: panel.scrollHeight
      },
      noHorizontalOverflow:
        panel.scrollWidth <= panel.clientWidth + 1 &&
        root.scrollWidth <= innerWidth + 1,
      withinHorizontalBounds:
        panelRect.left >= -1 && panelRect.right <= innerWidth + 1,
      scrollable:
        style.overflowY === 'auto' || style.overflowY === 'scroll',
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

async function preflight() {
  devPort = await selectFreePort(
    Number(process.env.DEV_PORT || 5332),
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
    expectedAssetsExact: arraysEqual(assetRefs, EXPECTED_ASSETS),
  }
  check(
    'dist contains the expected JS/CSS assets under /DobeDemo/',
    results.dist.baseOk && results.dist.expectedAssetsExact,
    JSON.stringify(assetRefs),
  )
}

async function startDevServer() {
  if (!fs.existsSync(VITE_BIN)) throw new Error('Vite CLI missing')
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
  for (let attempt = 0; attempt < 80; attempt += 1) {
    throwIfChildProcessFailed(devProc, 'vite')
    let response
    let body
    try {
      response = await fetchWithTimeout(devUrl)
      body = await response.text()
    } catch {
      // Vite is still starting.
    }
    throwIfChildProcessFailed(devProc, 'vite')
    const appFeatureOk =
      response?.ok === true &&
      /id="root"/.test(body ?? '') &&
      (body ?? '').includes('/src/main.tsx')
    if (appFeatureOk && ownedPids.has(devProc.pid)) {
      results.http.fetchTimeoutMs = HTTP_FETCH_TIMEOUT_MS
      results.http.ownedProcessAlive = true
      results.http.appFeatureVerified = true
      return
    }
    await sleep(250)
  }
  throw new Error('Owned Vite server did not become ready')
}

async function checkHttp() {
  const response = await fetchWithTimeout(devUrl)
  const body = await response.text()
  results.http = {
    ...results.http,
    status: response.status,
    hasRoot: /id="root"/.test(body),
    hasMainTsx: body.includes('/src/main.tsx'),
  }
  check(
    'owned Vite is alive and serves the expected app',
    response.status === 200 &&
      results.http.ownedProcessAlive === true &&
      results.http.appFeatureVerified === true &&
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
    'Chrome uses owned port-0 DevToolsActivePort',
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

  // 1-3. Legal fresh v4 preset; open Clubhouse and upgrade exactly once.
  const freshCity = citySave({
    version: 4,
    resources: { money: LARGE_MONEY, oil: 0, materials: 0 },
  })
  await inject(freshCity, gangSave(GANG_LV40_REPUTATION), { clear: true })
  const freshHit = await findBuilding('Clubhouse')
  const freshStorage = await readStorage()
  const freshPanel = freshHit.panel
  const renderBefore = await renderProbe()
  results.fresh = {
    cityVersion: freshStorage.city?.version ?? null,
    injectedGangReputation: GANG_LV40_REPUTATION,
    gangReputation: freshStorage.gang?.state?.totalReputation ?? null,
    clubhouse: freshStorage.city?.state?.buildingProgress?.clubhouse ?? null,
    panel: freshPanel,
    renderProbe: renderBefore,
  }
  check(
    '1. legal fresh v4 Clubhouse opens at gang Lv.40',
    results.fresh.cityVersion === 4 &&
      results.fresh.gangReputation >= GANG_LV40_REPUTATION &&
      results.fresh.gangReputation < GANG_LV40_REPUTATION + 30 &&
      freshPanel.present &&
      freshPanel.title === 'Clubhouse' &&
      freshPanel.level === '等级 1 / 10',
    JSON.stringify({
      version: results.fresh.cityVersion,
      reputation: results.fresh.gangReputation,
      title: freshPanel.title,
      level: freshPanel.level,
    }),
  )
  check(
    '1b. Clubhouse has no child, radio, progress, or confirmation controls',
    freshPanel.radioCount === 0 &&
      freshPanel.radiogroupCount === 0 &&
      freshPanel.progressbarCount === 0 &&
      freshPanel.childOptionCount === 0 &&
      freshPanel.sharedUpgradeCount === 0 &&
      freshPanel.confirmSubmitCount === 0 &&
      freshPanel.confirmBackCount === 0 &&
      freshPanel.confirmTitleCount === 0 &&
      !/升级「|升级主建筑至|确认升级/.test(freshPanel.text),
    JSON.stringify({
      radio: freshPanel.radioCount,
      radiogroup: freshPanel.radiogroupCount,
      progress: freshPanel.progressbarCount,
      child: freshPanel.childOptionCount,
      confirm: freshPanel.confirmSubmitCount,
    }),
  )
  check(
    '2. Clubhouse shows current/delta/target power, main cost, and direct button',
    arraysEqual(freshPanel.powers, [
      `当前建筑战力 ${CLUBHOUSE_POWERS[1]}`,
      `本次战力 +${CLUBHOUSE_POWERS[2] - CLUBHOUSE_POWERS[1]}`,
      `升级后战力 ${CLUBHOUSE_POWERS[2]}`,
    ]) &&
      arraysEqual(freshPanel.cost, ['钱 25', '油 0', '物资 0']) &&
      freshPanel.mainButtonLabel === '直接升级 Clubhouse 至 Lv.2 · 钱 25' &&
      freshPanel.mainButtonDisabled === false,
    JSON.stringify({
      powers: freshPanel.powers,
      cost: freshPanel.cost,
      button: freshPanel.mainButtonLabel,
    }),
  )

  const roi = {
    x: freshHit.x - 210,
    y: freshHit.y - 240,
    w: 420,
    h: 390,
  }
  const excludes = await exclusionRects()
  const beforeImage = await screenshot('clubhouse-desktop-before.png', {
    viewport: '1440x900',
    level: 1,
  })
  const walletBeforeFirst = freshStorage.city.state.resources
  await clickSelector('.building-panel__main-button')
  await sleep(500)
  const afterFirstStorage = await readStorage()
  const afterFirstPanel = await readPanel()
  const renderAfter = await renderProbe()
  const afterImage = await screenshot('clubhouse-desktop-after.png', {
    viewport: '1440x900',
    level: 2,
  })
  const firstProgress =
    afterFirstStorage.city?.state?.buildingProgress?.clubhouse
  results.firstUpgrade = {
    levelBefore: 1,
    levelAfter: firstProgress?.level ?? null,
    walletBefore: walletBeforeFirst,
    walletAfter: afterFirstStorage.city?.state?.resources ?? null,
    spent: walletDelta(
      walletBeforeFirst,
      afterFirstStorage.city?.state?.resources,
    ),
    children: firstProgress?.childLevels ?? null,
    childrenAllZero: arraysEqual(firstProgress?.childLevels, Array(10).fill(0)),
    panel: afterFirstPanel,
  }
  check(
    '3. one real click upgrades Clubhouse Lv.1 to Lv.2 and charges target-2 cost',
    results.firstUpgrade.levelAfter === 2 &&
      results.firstUpgrade.spent?.money === MAIN_COSTS[2].money &&
      results.firstUpgrade.spent?.oil === MAIN_COSTS[2].oil &&
      results.firstUpgrade.spent?.materials === MAIN_COSTS[2].materials &&
      results.firstUpgrade.childrenAllZero,
    JSON.stringify({
      level: results.firstUpgrade.levelAfter,
      spent: results.firstUpgrade.spent,
      children: results.firstUpgrade.children,
    }),
  )
  check(
    '3b. direct click remains on details and opens no confirmation page',
    afterFirstPanel.level === '等级 2 / 10' &&
      afterFirstPanel.confirmSubmitCount === 0 &&
      afterFirstPanel.confirmBackCount === 0 &&
      afterFirstPanel.confirmTitleCount === 0 &&
      afterFirstPanel.mainButtonLabel === '直接升级 Clubhouse 至 Lv.3 · 钱 60',
    JSON.stringify({
      level: afterFirstPanel.level,
      confirm: afterFirstPanel.confirmSubmitCount,
      button: afterFirstPanel.mainButtonLabel,
    }),
  )

  const targetDiff = diffPixels(beforeImage, afterImage, { roi, excludes })
  const controlDiff = diffPixels(beforeImage, afterImage, {
    excludes: [...excludes, roi],
  })
  results.visual = {
    roi,
    before: renderBefore,
    after: renderAfter,
    targetDiff,
    controlDiff,
    screenshotBefore: 'clubhouse-desktop-before.png',
    screenshotAfter: 'clubhouse-desktop-after.png',
  }
  check(
    '8. Clubhouse main upgrade adds one completed visual layer with no scaffold',
    renderBefore.fragmentCount === 1 &&
      renderAfter.fragmentCount === 2 &&
      renderBefore.scaffoldCount === 0 &&
      renderAfter.scaffoldCount === 0 &&
      renderBefore.animatedCount === 0 &&
      renderAfter.animatedCount === 0 &&
      renderAfter.states.every((state) => state === 'current'),
    JSON.stringify({ before: renderBefore, after: renderAfter }),
  )
  check(
    `8b. Clubhouse canvas ROI changes visibly (>=${CANVAS_MIN_CHANGED_PIXELS} pixels)`,
    targetDiff.changedPixels >= CANVAS_MIN_CHANGED_PIXELS &&
      results.screenshots['clubhouse-desktop-before.png'].sha256 !==
        results.screenshots['clubhouse-desktop-after.png'].sha256 &&
      controlDiff.changedPct <= 2,
    JSON.stringify({
      targetChangedPixels: targetDiff.changedPixels,
      targetChangedPct: targetDiff.changedPct,
      controlChangedPct: controlDiff.changedPct,
    }),
  )

  await reloadAndWait()
  const persistedFirst = await readStorage()
  const persistedProgress =
    persistedFirst.city?.state?.buildingProgress?.clubhouse
  results.firstUpgrade.persistedAfterReload = {
    version: persistedFirst.city?.version ?? null,
    level: persistedProgress?.level ?? null,
    children: persistedProgress?.childLevels ?? null,
    wallet: persistedFirst.city?.state?.resources ?? null,
    productionSinceClick: {
      money:
        persistedFirst.city?.state?.resources?.money -
        results.firstUpgrade.walletAfter.money,
      oil:
        persistedFirst.city?.state?.resources?.oil -
        results.firstUpgrade.walletAfter.oil,
      materials:
        persistedFirst.city?.state?.resources?.materials -
        results.firstUpgrade.walletAfter.materials,
    },
  }
  const persistedProduction =
    results.firstUpgrade.persistedAfterReload.productionSinceClick
  check(
    '3c. refresh persists Lv.2 and ten zero children with only legal production',
    persistedFirst.city?.version === 4 &&
      persistedProgress?.level === 2 &&
      arraysEqual(persistedProgress?.childLevels, Array(10).fill(0)) &&
      persistedProduction.money >= 0 &&
      persistedProduction.oil >= 0 &&
      persistedProduction.materials >= 0 &&
      persistedProduction.money === persistedProduction.oil * 3 &&
      persistedProduction.materials === persistedProduction.oil,
    JSON.stringify(results.firstUpgrade.persistedAfterReload),
  )

  // 4. Consecutive direct upgrade uses target-3 cost.
  await findBuilding('Clubhouse')
  const beforeSecond = await readStorage()
  await clickSelector('.building-panel__main-button')
  await sleep(400)
  const afterSecond = await readStorage()
  const secondPanel = await readPanel()
  const secondProgress = afterSecond.city?.state?.buildingProgress?.clubhouse
  results.consecutive = {
    levelBefore:
      beforeSecond.city?.state?.buildingProgress?.clubhouse?.level ?? null,
    levelAfter: secondProgress?.level ?? null,
    walletBefore: beforeSecond.city?.state?.resources ?? null,
    walletAfter: afterSecond.city?.state?.resources ?? null,
    spent: walletDelta(
      beforeSecond.city?.state?.resources,
      afterSecond.city?.state?.resources,
    ),
    children: secondProgress?.childLevels ?? null,
    panel: secondPanel,
  }
  await screenshot('clubhouse-consecutive.png', {
    viewport: '1440x900',
    level: 3,
  })
  check(
    '4. second real click upgrades Lv.2 to Lv.3 and charges target-3 cost',
    results.consecutive.levelBefore === 2 &&
      results.consecutive.levelAfter === 3 &&
      results.consecutive.spent?.money === MAIN_COSTS[3].money &&
      results.consecutive.spent?.oil === MAIN_COSTS[3].oil &&
      results.consecutive.spent?.materials === MAIN_COSTS[3].materials &&
      arraysEqual(results.consecutive.children, Array(10).fill(0)) &&
      secondPanel.confirmSubmitCount === 0,
    JSON.stringify({
      before: results.consecutive.levelBefore,
      after: results.consecutive.levelAfter,
      spent: results.consecutive.spent,
    }),
  )

  // 5. Insufficient resources, max level, and gang Lv.39.
  await inject(
    citySave({
      resources: { money: 0, oil: 0, materials: 0 },
    }),
    gangSave(GANG_LV40_REPUTATION),
  )
  const insufficientHit = await findBuilding('Clubhouse')
  const insufficientBefore = await readStorage()
  results.blocked.insufficient = insufficientHit.panel
  await screenshot('clubhouse-insufficient.png', {
    viewport: '1440x900',
    state: 'insufficient',
  })
  await sleep(180)
  const insufficientAfter = await readStorage()
  results.blocked.insufficient.stateUnchanged =
    JSON.stringify(
      insufficientBefore.city?.state?.buildingProgress?.clubhouse,
    ) ===
      JSON.stringify(
        insufficientAfter.city?.state?.buildingProgress?.clubhouse,
      ) &&
    JSON.stringify(insufficientBefore.city?.state?.resources) ===
      JSON.stringify(insufficientAfter.city?.state?.resources)
  check(
    '5. insufficient resources disables direct upgrade with exact shortfall',
    insufficientHit.panel.mainButtonDisabled === true &&
      insufficientHit.panel.blocker === '资源不足，还需 钱 25' &&
      results.blocked.insufficient.stateUnchanged,
    JSON.stringify({
      disabled: insufficientHit.panel.mainButtonDisabled,
      blocker: insufficientHit.panel.blocker,
      unchanged: results.blocked.insufficient.stateUnchanged,
    }),
  )

  await inject(
    citySave({
      buildingProgress: buildBuildingProgress({
        clubhouse: { level: 10, childLevels: Array(10).fill(10) },
      }),
    }),
    gangSave(GANG_LV40_REPUTATION),
  )
  const maxedHit = await findBuilding('Clubhouse')
  const maxedStorage = await readStorage()
  results.blocked.maxed = {
    panel: maxedHit.panel,
    persisted: maxedStorage.city?.state?.buildingProgress?.clubhouse ?? null,
  }
  await screenshot('clubhouse-maxed.png', {
    viewport: '1440x900',
    state: 'maxed',
  })
  check(
    '5b. Lv.10 is maxed with no direct button and normalized zero children',
    maxedHit.panel.status === '已达到最高等级 Lv.10' &&
      maxedHit.panel.mainButtonCount === 0 &&
      arraysEqual(
        results.blocked.maxed.persisted?.childLevels,
        Array(10).fill(0),
      ),
    JSON.stringify({
      status: maxedHit.panel.status,
      buttonCount: maxedHit.panel.mainButtonCount,
      children: results.blocked.maxed.persisted?.childLevels,
    }),
  )

  await inject(citySave(), gangSave(GANG_LV39_REPUTATION))
  const lockedHit = await findBuilding('Clubhouse', {
    requireUnlocked: false,
  })
  results.blocked.locked = lockedHit.panel
  await screenshot('clubhouse-locked.png', {
    viewport: '1440x900',
    state: 'gang-lv39',
  })
  check(
    '5c. gang Lv.39 keeps Clubhouse locked with no direct button',
    lockedHit.panel.lockStatus === '尚未解锁' &&
      lockedHit.panel.lockRequirement?.includes('需要 Lv. 40') &&
      lockedHit.panel.mainButtonCount === 0,
    JSON.stringify({
      status: lockedHit.panel.lockStatus,
      requirement: lockedHit.panel.lockRequirement,
      buttonCount: lockedHit.panel.mainButtonCount,
    }),
  )

  // 6-7. v3 -> v4 refunds Clubhouse child investment once and clears it.
  const migrationChildren = [1, 2, 3, 0, 0, 0, 0, 0, 0, 0]
  const expectedRefund = 55
  await inject(
    citySave({
      version: 3,
      buildingProgress: buildBuildingProgress({
        clubhouse: { level: 3, childLevels: migrationChildren },
      }),
      resources: { money: 100, oil: 7, materials: 9 },
    }),
    gangSave(GANG_LV40_REPUTATION),
  )
  const migratedFirst = await readStorage()
  await screenshot('clubhouse-migration.png', {
    viewport: '1440x900',
    state: 'v3-to-v4',
  })
  await reloadAndWait()
  const migratedSecond = await readStorage()
  results.migration = {
    sourceVersion: 3,
    sourceChildren: migrationChildren,
    expectedRefund,
    versionFirst: migratedFirst.city?.version ?? null,
    walletFirst: migratedFirst.city?.state?.resources ?? null,
    clubhouseFirst:
      migratedFirst.city?.state?.buildingProgress?.clubhouse ?? null,
    versionSecond: migratedSecond.city?.version ?? null,
    walletSecond: migratedSecond.city?.state?.resources ?? null,
    clubhouseSecond:
      migratedSecond.city?.state?.buildingProgress?.clubhouse ?? null,
  }
  check(
    '6. v3 reload migrates to v4, refunds 55 once, and clears children',
    results.migration.versionFirst === 4 &&
      results.migration.walletFirst?.money === 100 + expectedRefund &&
      results.migration.walletFirst?.oil === 7 &&
      results.migration.walletFirst?.materials === 9 &&
      results.migration.clubhouseFirst?.level === 3 &&
      arraysEqual(
        results.migration.clubhouseFirst?.childLevels,
        Array(10).fill(0),
      ),
    JSON.stringify({
      version: results.migration.versionFirst,
      wallet: results.migration.walletFirst,
      clubhouse: results.migration.clubhouseFirst,
    }),
  )
  check(
    '6b. second reload stays v4 and does not refund again',
    results.migration.versionSecond === 4 &&
      JSON.stringify(results.migration.walletSecond) ===
        JSON.stringify(results.migration.walletFirst) &&
      arraysEqual(
        results.migration.clubhouseSecond?.childLevels,
        Array(10).fill(0),
      ),
    JSON.stringify({
      version: results.migration.versionSecond,
      wallet: results.migration.walletSecond,
    }),
  )
  results.storeUiBoundary = {
    clubhouseChildControlsObserved: 0,
    durableChildArrays: [
      results.fresh.clubhouse?.childLevels,
      results.firstUpgrade.children,
      results.consecutive.children,
      results.migration.clubhouseFirst?.childLevels,
      results.migration.clubhouseSecond?.childLevels,
    ],
    allDurableChildrenZero: [
      results.fresh.clubhouse?.childLevels,
      results.firstUpgrade.children,
      results.consecutive.children,
      results.migration.clubhouseFirst?.childLevels,
      results.migration.clubhouseSecond?.childLevels,
    ].every((children) => arraysEqual(children, Array(10).fill(0))),
    upgradeTransitionsUsedRealPointerOnly: true,
  }
  check(
    '7. no Clubhouse child path is exposed and every durable observation stays zero',
    results.storeUiBoundary.clubhouseChildControlsObserved === 0 &&
      results.storeUiBoundary.allDurableChildrenZero &&
      results.storeUiBoundary.upgradeTransitionsUsedRealPointerOnly,
    JSON.stringify({
      childControls: results.storeUiBoundary.clubhouseChildControlsObserved,
      arraysZero: results.storeUiBoundary.allDurableChildrenZero,
      realPointerOnly:
        results.storeUiBoundary.upgradeTransitionsUsedRealPointerOnly,
    }),
  )

  // 9. Repair shop retains radios, progress, and main confirmation.
  await inject(
    citySave({
      buildingProgress: buildBuildingProgress({
        'repair-shop': { level: 2, childLevels: [2, 2, 0, 0, 0] },
      }),
    }),
    gangSave(GANG_LV40_REPUTATION),
  )
  const repairHit = await findBuilding('修车厂')
  const repairBefore = repairHit.panel
  await clickSelector('.building-panel__main-button')
  await sleep(220)
  const repairConfirm = await readPanel()
  results.regression = {
    details: repairBefore,
    confirm: repairConfirm,
  }
  await screenshot('clubhouse-repair-regression.png', {
    viewport: '1440x900',
    state: 'repair-confirm',
  })
  check(
    '9. repair shop still has radios, progress, and a confirmation page',
    repairBefore.radioCount === 2 &&
      repairBefore.radiogroupCount === 1 &&
      repairBefore.progressbarCount === 1 &&
      repairBefore.mainButtonLabel === '升级主建筑至 Lv.3' &&
      repairConfirm.confirmSubmitCount === 1 &&
      repairConfirm.confirmBackCount === 1 &&
      repairConfirm.confirmTitleCount === 1 &&
      repairConfirm.text.includes('确认升级'),
    JSON.stringify({
      radio: repairBefore.radioCount,
      radiogroup: repairBefore.radiogroupCount,
      progress: repairBefore.progressbarCount,
      main: repairBefore.mainButtonLabel,
      confirm: repairConfirm.confirmSubmitCount,
    }),
  )

  // 10. Mobile Clubhouse panel: no horizontal overflow, scroll-capable, 44x44.
  await inject(citySave(), gangSave(GANG_LV40_REPUTATION))
  await findBuilding('Clubhouse')
  const desktopLayout = await measureBuildingPanel()
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  })
  await sleep(450)
  const mobileLayout = await measureBuildingPanel()
  results.layout = { desktop: desktopLayout, mobile: mobileLayout }
  await screenshot('clubhouse-mobile.png', {
    viewport: '390x844',
    state: 'direct-upgrade',
  })
  check(
    '10. desktop 1440x900 Clubhouse panel fits and button is at least 44x44',
    desktopLayout.present &&
      desktopLayout.viewport?.width === 1440 &&
      desktopLayout.viewport?.height === 900 &&
      desktopLayout.noHorizontalOverflow &&
      desktopLayout.withinHorizontalBounds &&
      desktopLayout.button?.width >= 44 &&
      desktopLayout.button?.height >= 44 &&
      desktopLayout.button?.withinViewport,
    JSON.stringify(desktopLayout),
  )
  check(
    '10b. mobile 390x844 has no horizontal overflow and remains scrollable',
    mobileLayout.present &&
      mobileLayout.viewport?.width === 390 &&
      mobileLayout.viewport?.height === 844 &&
      mobileLayout.noHorizontalOverflow &&
      mobileLayout.withinHorizontalBounds &&
      mobileLayout.scrollable,
    JSON.stringify(mobileLayout),
  )
  check(
    '10c. mobile direct-upgrade button is reachable and at least 44x44 on both axes',
    mobileLayout.button?.width >= 44 &&
      mobileLayout.button?.height >= 44 &&
      mobileLayout.button?.withinViewport,
    JSON.stringify(mobileLayout.button),
  )
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
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      fs.rmSync(profileDir, { recursive: true, force: true })
    } catch {
      // Windows Chrome can briefly hold files after taskkill.
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
      results.processSafety.killAttempts.every(
        (attempt) =>
          (attempt.owned &&
            (attempt.active === true ||
              (attempt.active === false && attempt.skipped === true))) ||
          (attempt.spawnError === true &&
            attempt.owned === false &&
            attempt.active === false &&
            attempt.skipped === true),
      ),
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
    'all expected screenshots are nonempty PNG files with recorded dimensions',
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
    JSON.stringify(
      Object.entries(results.screenshots).map(([name, metadata]) => ({
        name,
        width: metadata.width,
        height: metadata.height,
        bytes: metadata.bytes,
      })),
    ),
  )
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
