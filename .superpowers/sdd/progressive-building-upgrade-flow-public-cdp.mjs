// Safe, repeatable public-Pages acceptance for the progressive building
// upgrade flow. Drives the deployed GitHub Pages build via real Chrome/CDP at
// desktop 1440x900 and mobile 390x844 and verifies the published HTML/JS/CSS
// plus the fresh 10000 wallet, one-slot repair, debug resources, a real shared
// child upgrade, the independent main-upgrade confirmation, the one-time v2
// refund, reset, and the 390x844 layout.
//
// SAFETY MODEL (matches the local script):
// - Selects a free CDP port dynamically; never connects to or kills a listener
//   found during preflight (existing dev servers are safe).
// - Tracks only the Chrome PID this script spawned and refuses to terminate any
//   other PID.
// - Creates an isolated Chrome profile under os.tmpdir() with the exact prefix
//   'dobe-progressive-upgrade-public-cdp-' and only removes that verified
//   profile, with a bounded cleanup retry.
// - The result JSON records only basenames, HTTP statuses and numeric
//   measurements, never absolute paths.
// - Errors record a whitelisted name/code only; raw stacks go to stderr.
// - A pure-data assertion self-test fails on empty/bad data and includes a
//   Windows/Unix path redaction self-check.
// - Exits non-zero on any failed assertion, runtime error, cleanup failure or
//   missing screenshot.
//
// Config via env: CDP_PORT, CHROME_PATH, PUBLIC_URL, RELEASE_COMMIT.
// Run: node .superpowers/sdd/progressive-building-upgrade-flow-public-cdp.mjs

import zlib from 'node:zlib'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { execFileSync, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT_JSON = path.join(
  HERE,
  'progressive-building-upgrade-flow-public-results.json',
)
const PROFILE_PREFIX = 'dobe-progressive-upgrade-public-cdp-'

const RELEASE_COMMIT =
  process.env.RELEASE_COMMIT ||
  '0425b41ca9dfc1b5bfaae111860aab1e6b6a489a'
const PUBLIC_ORIGIN =
  process.env.PUBLIC_URL || 'https://sherlock3rd.github.io/DobeDemo/'
const PUBLIC_URL = `${PUBLIC_ORIGIN}?release=${RELEASE_COMMIT}`
const EXPECTED_JS = '/DobeDemo/assets/index-BYWUWufE.js'
const EXPECTED_CSS = '/DobeDemo/assets/index-WW1HS-D7.css'

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
const LARGE_MONEY = 100_000
const CANVAS_MIN_CHANGED = 30
const ROI_LEFT = 220
const ROI_RIGHT = 180
const ROI_UP = 240
const ROI_DOWN = 150

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const results = {
  generatedAt: new Date().toISOString(),
  script: 'progressive-building-upgrade-flow-public-cdp.mjs',
  release: { commit: RELEASE_COMMIT, url: `?release=${RELEASE_COMMIT}` },
  preflight: {
    portCheckPerformed: true,
    strategy: 'skip occupied preferred port; never terminate unknown PID',
    attemptedCdpPorts: [],
  },
  processSafety: {
    ownedPids: [],
    killAttempts: [],
    unknownProcessesTerminated: false,
  },
  http: {},
  fresh: {},
  grant: {},
  slotUpgrade: {},
  hundred: {},
  confirmView: {},
  confirmApply: {},
  migration: {},
  reset: {},
  layout: {},
  screenshots: {},
  teardown: {},
  assertionSelfTest: {},
  assertions: [],
}

let cdpPort
let chromeProc
let profileDir
let ws
let nextId = 1
const pending = new Map()
const ownedPids = new Set()
const spots = {}

// ---------- port / process safety ----------
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
      process.kill(pid, 'SIGKILL')
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
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ].filter(Boolean)
  const found = candidates.find((candidate) => fs.existsSync(candidate))
  if (!found) throw new Error('Chrome not found; set CHROME_PATH')
  return found
}

// ---------- CDP plumbing ----------
function send(method, params = {}) {
  const id = nextId++
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })
}

async function connectCdp() {
  let targets
  for (let attempt = 0; attempt < 80; attempt += 1) {
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

// Real pointer press/release. No DOM.click is ever used.
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
    const els = document.querySelectorAll(${JSON.stringify(selector)})
    const element = els[${index}]
    if (!element) return null
    element.scrollIntoView({ block: 'center', inline: 'center' })
    const rect = element.getBoundingClientRect()
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  })()`
}

// Real pointer click on the nth match of a selector (default first).
async function clickSelector(selector, index = 0) {
  const point = await evaluate(pointExpression(selector, index))
  if (!point) {
    throw new Error(`Element not found for real click: ${selector}#${index}`)
  }
  await sleep(80)
  const settled = await evaluate(pointExpression(selector, index))
  const target = settled ?? point
  await mouseClick(Math.round(target.x), Math.round(target.y))
}

async function screenshot(fileName) {
  const response = await send('Page.captureScreenshot', { format: 'png' })
  const buffer = Buffer.from(response.data, 'base64')
  fs.writeFileSync(path.join(HERE, fileName), buffer)
  results.screenshots[fileName] = fileName
  return buffer
}

// ---------- PNG decode + ROI diff ----------
function decodePng(buffer) {
  let pos = 8
  let width
  let height
  let colorType
  let bitDepth
  const idat = []
  while (pos < buffer.length) {
    const len = buffer.readUInt32BE(pos)
    const type = buffer.toString('ascii', pos + 4, pos + 8)
    const data = buffer.subarray(pos + 8, pos + 8 + len)
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
    pos += 12 + len
  }
  if (bitDepth !== 8) throw new Error(`unsupported bitDepth ${bitDepth}`)
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : null
  if (!channels) throw new Error(`unsupported colorType ${colorType}`)
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const out = Buffer.alloc(height * stride)
  let rp = 0
  for (let y = 0; y < height; y += 1) {
    const filter = raw[rp++]
    for (let x = 0; x < stride; x += 1) {
      const cur = raw[rp++]
      const a = x >= channels ? out[y * stride + x - channels] : 0
      const b = y > 0 ? out[(y - 1) * stride + x] : 0
      const c =
        x >= channels && y > 0 ? out[(y - 1) * stride + x - channels] : 0
      let val
      switch (filter) {
        case 0:
          val = cur
          break
        case 1:
          val = cur + a
          break
        case 2:
          val = cur + b
          break
        case 3:
          val = cur + ((a + b) >> 1)
          break
        case 4: {
          const p = a + b - c
          const pa = Math.abs(p - a)
          const pb = Math.abs(p - b)
          const pc = Math.abs(p - c)
          const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
          val = cur + pr
          break
        }
        default:
          throw new Error(`bad filter ${filter}`)
      }
      out[y * stride + x] = val & 0xff
    }
  }
  return { width, height, channels, data: out }
}

function diffPixels(a, b, { roi = null, excludes = [], tol = 18 } = {}) {
  const A = decodePng(a)
  const B = decodePng(b)
  if (A.width !== B.width || A.height !== B.height) {
    return { changedPixels: -1, consideredPixels: 0, changedPct: 100 }
  }
  const rx0 = roi ? Math.max(0, Math.floor(roi.x)) : 0
  const ry0 = roi ? Math.max(0, Math.floor(roi.y)) : 0
  const rx1 = roi ? Math.min(A.width, Math.ceil(roi.x + roi.w)) : A.width
  const ry1 = roi ? Math.min(A.height, Math.ceil(roi.y + roi.h)) : A.height
  const inExcluded = (x, y) =>
    excludes.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)
  const ca = A.channels
  const cb = B.channels
  let changed = 0
  let considered = 0
  for (let y = ry0; y < ry1; y += 1) {
    for (let x = rx0; x < rx1; x += 1) {
      if (inExcluded(x, y)) continue
      considered += 1
      const i = y * A.width + x
      const ai = i * ca
      const bi = i * cb
      if (
        Math.abs(A.data[ai] - B.data[bi]) > tol ||
        Math.abs(A.data[ai + 1] - B.data[bi + 1]) > tol ||
        Math.abs(A.data[ai + 2] - B.data[bi + 2]) > tol
      ) {
        changed += 1
      }
    }
  }
  return {
    changedPixels: changed,
    consideredPixels: considered,
    roiClipped: { x: rx0, y: ry0, w: rx1 - rx0, h: ry1 - ry0 },
    changedPct: +((changed / Math.max(1, considered)) * 100).toFixed(3),
  }
}

// ---------- DOM readers ----------
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

async function readPanel() {
  return evaluate(`(() => {
    const panel = document.querySelector('.building-panel')
    if (!panel) return { present: false }
    const text = (s) => panel.querySelector(s)?.textContent?.trim() ?? null
    const options = [
      ...panel.querySelectorAll('.building-panel__child-option'),
    ].map((o) => ({
      name: o.querySelector('.building-panel__child-name')?.textContent?.trim() ?? null,
      status: o.querySelector('.building-panel__child-status')?.textContent?.trim() ?? null,
      checked: o.getAttribute('aria-checked') === 'true',
    }))
    const progressbar = panel.querySelector('.building-panel__progress-bar')
    const mainButton = panel.querySelector('.building-panel__main-button')
    const sharedButton = panel.querySelector('.building-panel__shared-upgrade')
    const confirmSubmit = panel.querySelector('.building-panel__confirm-submit')
    return {
      present: true,
      unlocked: Boolean(panel.querySelector('.building-panel__level')),
      view: confirmSubmit
        ? 'confirm'
        : panel.querySelector('.building-panel__lock-status')
          ? 'locked'
          : 'details',
      title: text('.building-panel__title'),
      level: text('.building-panel__level'),
      childCount: options.length,
      options,
      selectedIndex: options.findIndex((o) => o.checked),
      progressPresent: Boolean(progressbar),
      progressNow: progressbar
        ? Number(progressbar.getAttribute('aria-valuenow'))
        : null,
      sharedButtonPresent: Boolean(sharedButton),
      mainButtonPresent: Boolean(mainButton),
      mainButtonLabel: mainButton?.textContent?.trim() ?? null,
      confirmCost: [
        ...panel.querySelectorAll('.building-panel__confirm-cost li'),
      ].map((li) => li.textContent.trim()),
      confirmPower: [
        ...panel.querySelectorAll('.building-panel__confirm-power'),
      ].map((p) => p.textContent.trim()),
      confirmSubmitDisabled: confirmSubmit ? Boolean(confirmSubmit.disabled) : null,
    }
  })()`)
}

async function readSettings() {
  return evaluate(`(() => {
    const panel = document.querySelector('.settings-panel')
    if (!panel) return { present: false }
    return {
      present: true,
      feedback: panel.querySelector('.settings-panel__feedback')?.textContent?.trim() ?? null,
    }
  })()`)
}

async function readHud() {
  return evaluate(`(() => {
    const t = (s) => document.querySelector(s)?.textContent?.trim() ?? null
    return {
      level: t('.city-hud__level'),
      rate: t('.city-hud__rate'),
    }
  })()`)
}

async function excludeRects() {
  return evaluate(`(() => {
    const rects = []
    for (const sel of ['.city-hud', '.building-panel', '.settings-panel']) {
      const el = document.querySelector(sel)
      if (!el) continue
      const r = el.getBoundingClientRect()
      rects.push({
        x: Math.floor(r.left) - 4,
        y: Math.floor(r.top) - 4,
        w: Math.ceil(r.width) + 8,
        h: Math.ceil(r.height) + 8,
      })
    }
    return rects
  })()`)
}

async function closePanel() {
  const present = await evaluate(
    `Boolean(document.querySelector('.building-panel__close'))`,
  )
  if (present) {
    await clickSelector('.building-panel__close')
    await sleep(150)
  }
}

async function waitForApp(previousTimeOrigin = null) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
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
  throw new Error('Public app did not become ready')
}

async function reloadAndWait(extraDelay = 1600) {
  const previousTimeOrigin = await evaluate('performance.timeOrigin')
  await send('Page.reload', { ignoreCache: false })
  await waitForApp(previousTimeOrigin)
  if (extraDelay) await sleep(extraDelay)
}

// ---------- save builders + injection ----------
function childArray(id, fill) {
  return Array(id === 'repair-shop' ? 5 : 10).fill(fill)
}

function buildBuildingProgress(overrides = {}) {
  const progress = {}
  for (const id of BUILDING_IDS) {
    progress[id] = { level: 1, childLevels: childArray(id, 0) }
  }
  for (const [id, value] of Object.entries(overrides)) {
    progress[id] = value
  }
  return progress
}

function citySave({
  buildingProgress,
  resources = { money: 0, oil: 0, materials: 0 },
  lastResourceUpdatedAt,
  activeProducerIds = ['repair-shop'],
  version = 3,
}) {
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

function gangSave(totalReputation, lastUpdatedAt) {
  return { state: { totalReputation, lastUpdatedAt }, version: 0 }
}

// Seed localStorage at document-start on the next reload, before the app
// bundle runs, so the app rehydrates from the injected save. This beats the
// running app, which rewrites localStorage roughly once per second and would
// otherwise clobber a value written after load. The seed script is removed
// after the reload so later plain reloads use the persisted (migrated) save.
async function reloadWithSeed(seedSource) {
  const { identifier } = await send(
    'Page.addScriptToEvaluateOnNewDocument',
    { source: `try { ${seedSource} } catch (error) { /* seed best-effort */ }` },
  )
  const previousTimeOrigin = await evaluate('performance.timeOrigin')
  await send('Page.reload', { ignoreCache: false })
  await waitForApp(previousTimeOrigin)
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier })
  await sleep(1600)
}

async function inject(city, gang) {
  const seed =
    `localStorage.setItem(${JSON.stringify(CITY_KEY)}, ${JSON.stringify(JSON.stringify(city))});` +
    `localStorage.setItem(${JSON.stringify(GANG_KEY)}, ${JSON.stringify(JSON.stringify(gang))});`
  await reloadWithSeed(seed)
}

async function clearStorageAndReload() {
  await reloadWithSeed('localStorage.clear();')
}

async function cityMoney() {
  return (await readStorage()).city?.state?.resources?.money ?? null
}

// Real CDP clicks on the 3D scene until the requested building panel opens;
// leaves it open. Caches the coordinate per title so reloads stay cheap.
async function findBuilding(title, { requireUnlocked = true } = {}) {
  const tryAt = async (x, y) => {
    await mouseClick(x, y)
    await sleep(180)
    const panel = await readPanel()
    if (
      panel.present &&
      panel.title === title &&
      (!requireUnlocked || panel.unlocked)
    ) {
      return { x, y, panel }
    }
    if (panel.present) await closePanel()
    return null
  }
  const cached = spots[title]
  if (cached) {
    const hit = await tryAt(cached.x, cached.y)
    if (hit) return hit
  }
  for (let y = 280; y <= 720; y += 42) {
    for (let x = 300; x <= 1160; x += 42) {
      const hit = await tryAt(x, y)
      if (hit) {
        spots[title] = { x, y }
        return hit
      }
    }
  }
  throw new Error(`Building not found via real CDP click scan: ${title}`)
}

async function measurePanel() {
  return evaluate(`(() => {
    const panel = document.querySelector('.building-panel')
    const root = document.documentElement
    if (!panel) return { present: false }
    const rect = panel.getBoundingClientRect()
    const cs = getComputedStyle(panel)
    const btn = panel.querySelector(
      '.building-panel__main-button, .building-panel__shared-upgrade, .building-panel__confirm-submit',
    )
    const b = btn ? btn.getBoundingClientRect() : null
    return {
      present: true,
      viewport: { width: innerWidth, height: innerHeight },
      withinBounds:
        rect.left >= -1 &&
        rect.top >= -1 &&
        rect.right <= innerWidth + 1 &&
        rect.bottom <= innerHeight + 1,
      noHorizontalOverflow:
        panel.scrollWidth <= panel.clientWidth + 1 &&
        root.scrollWidth <= innerWidth + 1,
      scrollableOrFits:
        panel.scrollHeight <= panel.clientHeight + 1 ||
        cs.overflowY === 'auto' ||
        cs.overflowY === 'scroll',
      control44: b ? b.height >= 44 || b.width >= 44 : false,
    }
  })()`)
}

// ---------- public HTTP checks ----------
async function fetchNoCache(url) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { 'cache-control': 'no-cache', pragma: 'no-cache' },
  })
  const body = await response.text()
  return { status: response.status, body }
}

async function checkPublicHttp() {
  const html = await fetchNoCache(PUBLIC_URL)
  const refs = [...html.body.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((reference) => reference.includes('/assets/'))
  const jsRef = refs.find((reference) => reference.endsWith('.js')) ?? null
  const cssRef = refs.find((reference) => reference.endsWith('.css')) ?? null
  const absolute = (reference) =>
    new URL(reference, PUBLIC_ORIGIN).toString()
  const js = jsRef ? await fetchNoCache(absolute(jsRef)) : { status: 0 }
  const css = cssRef ? await fetchNoCache(absolute(cssRef)) : { status: 0 }
  results.http = {
    url: `?release=${RELEASE_COMMIT}`,
    htmlStatus: html.status,
    assetRefs: refs,
    jsRef,
    cssRef,
    jsStatus: js.status,
    cssStatus: css.status,
    jsMatchesExpected: jsRef === EXPECTED_JS,
    cssMatchesExpected: cssRef === EXPECTED_CSS,
    baseOk:
      refs.length > 0 &&
      refs.every((reference) => reference.startsWith('/DobeDemo/')),
  }
}

// ---------- assertions (pure, testable) ----------
function arraysEqual(a, b) {
  return (
    Array.isArray(a) &&
    Array.isArray(b) &&
    a.length === b.length &&
    a.every((value, index) => value === b[index])
  )
}

function evaluateAssertions(value) {
  const checks = []
  const add = (name, pass, detail) =>
    checks.push({ name, pass: pass === true, detail: String(detail ?? '') })

  add(
    'preflight selected free CDP port',
    value.preflight?.cdpPortFree === true,
    value.preflight?.cdpPort,
  )

  // HTTP.
  add(
    'H1. public HTML/JS/CSS all return HTTP 200',
    value.http?.htmlStatus === 200 &&
      value.http?.jsStatus === 200 &&
      value.http?.cssStatus === 200,
    JSON.stringify({
      html: value.http?.htmlStatus,
      js: value.http?.jsStatus,
      css: value.http?.cssStatus,
    }),
  )
  add(
    'H2. assets use /DobeDemo/ and match current hashes',
    value.http?.baseOk === true &&
      value.http?.jsMatchesExpected === true &&
      value.http?.cssMatchesExpected === true,
    JSON.stringify({ js: value.http?.jsRef, css: value.http?.cssRef }),
  )

  // 1. Fresh v3 save: wallet 10000/0/0 and only the first repair slot visible.
  const fc = value.fresh?.storage?.city
  const fr = fc?.state?.buildingProgress?.['repair-shop']
  const fw = fc?.state?.resources
  add(
    '1. fresh v3 wallet {10000,0,0}, repair Lv.1 only first slot in UI',
    fc?.version === 3 &&
      fr?.level === 1 &&
      arraysEqual(fr?.childLevels, [0, 0, 0, 0, 0]) &&
      fw?.money === 10000 &&
      fw?.oil === 0 &&
      fw?.materials === 0 &&
      value.fresh?.repairPanel?.childCount === 1 &&
      value.fresh?.repairPanel?.selectedIndex === 0 &&
      value.fresh?.repairPanel?.options?.[0]?.status === 'Lv.0 / Lv.1',
    JSON.stringify({ version: fc?.version, fr, fw, panel: value.fresh?.repairPanel }),
  )

  // 2. Debug resources twice: cumulative +20000 with polite feedback.
  const g = value.grant
  add(
    '2. 钱/油/物资各 +10000 twice adds +20000 oil & materials, panel open',
    g?.oilDelta === 20000 &&
      g?.materialsDelta === 20000 &&
      typeof g?.moneyDelta === 'number' &&
      g.moneyDelta >= 20000 &&
      g?.panelStillOpen === true &&
      g?.feedback === '钱、油、物资各增加 10000',
    JSON.stringify(g),
  )

  // 3. Real shared child upgrade changes progress and only the building ROI.
  const su = value.slotUpgrade
  add(
    '3. shared button advanced progress and only target 3D ROI changed',
    typeof su?.progressBefore === 'number' &&
      typeof su?.progressAfter === 'number' &&
      su.progressAfter > su.progressBefore &&
      typeof su?.canvasTarget?.changedPixels === 'number' &&
      su.canvasTarget.changedPixels >= CANVAS_MIN_CHANGED &&
      typeof su?.canvasControl?.changedPct === 'number' &&
      su.canvasControl.changedPct <= 2,
    JSON.stringify({
      before: su?.progressBefore,
      after: su?.progressAfter,
      target: su?.canvasTarget?.changedPixels,
      controlPct: su?.canvasControl?.changedPct,
    }),
  )

  // 4. Reaching 100% replaces the progress region with the main-upgrade button.
  add(
    '4. at 100% the region is replaced by 升级主建筑至 Lv.3',
    value.hundred?.progressPresent === false &&
      value.hundred?.sharedButtonPresent === false &&
      value.hundred?.mainButtonPresent === true &&
      value.hundred?.mainButtonLabel === '升级主建筑至 Lv.3',
    JSON.stringify(value.hundred),
  )

  // 5. Clicking the main button opens confirm with no early deduction.
  const cv = value.confirmView
  add(
    '5. main button opens confirm with no wallet/level change',
    cv?.view === 'confirm' &&
      cv?.walletUnchanged === true &&
      cv?.levelUnchanged === true &&
      arraysEqual(cv?.confirmCost, ['钱 60', '油 0', '物资 0']),
    JSON.stringify(cv),
  )

  // 6. Confirm deducts exactly once, main +1, new Lv.0 slot auto-selected.
  const ca = value.confirmApply
  add(
    '6. confirm deducts 60 once, repair -> Lv.3, new Lv.0 slot auto-selected',
    ca?.moneySpent === 60 &&
      ca?.levelAfter === 3 &&
      ca?.childCountAfter === 3 &&
      ca?.newSlotStatus === 'Lv.0 / Lv.3' &&
      ca?.selectedIndexAfter === 2,
    JSON.stringify(ca),
  )

  // 7. v2 -> v3 one-time refund across two reloads.
  const m = value.migration
  add(
    '7. v2 injection refunds 40 money once and zeroes hidden slots',
    m?.moneyFirst === 140 &&
      arraysEqual(m?.repairChildFirst, [2, 1, 0, 0, 0]) &&
      arraysEqual(m?.commercialChildFirst, [3, 2, 1, 0, 0, 0, 0, 0, 0, 0]) &&
      m?.versionFirst === 3 &&
      m?.versionSecond === 3 &&
      m?.moneySecond === 140,
    JSON.stringify(m),
  )

  // 8. Reset through two confirmations.
  const rs = value.reset
  add(
    '8. reset restores wallet 10000/0/0, all Lv.1, repair childLevels zero',
    rs?.money === 10000 &&
      rs?.oil === 0 &&
      rs?.materials === 0 &&
      rs?.allLevelsOne === true &&
      arraysEqual(rs?.repairChildLevels, [0, 0, 0, 0, 0]) &&
      rs?.panelClosed === true,
    JSON.stringify(rs),
  )

  // 9. 390x844 layout.
  const l = value.layout
  add(
    '9. 390x844 panel scrolls without overflow and 44px controls reachable',
    l?.mobile?.noHorizontalOverflow === true &&
      l?.mobile?.withinBounds === true &&
      l?.mobile?.scrollableOrFits === true &&
      l?.mobile?.control44 === true,
    JSON.stringify(l?.mobile),
  )

  // Teardown / process safety.
  const shots = [
    'public-initial.png',
    'public-grant.png',
    'public-slot-before.png',
    'public-slot-after.png',
    'public-confirm.png',
    'public-new-slot.png',
    'public-migration.png',
    'public-reset.png',
    'public-mobile.png',
  ]
  add(
    'all expected screenshots written and nonempty',
    value.screenshots &&
      shots.every((name) => {
        const file = path.join(HERE, name)
        return (
          value.screenshots[name] === name &&
          fs.existsSync(file) &&
          fs.statSync(file).size > 0
        )
      }),
    JSON.stringify(Object.keys(value.screenshots ?? {})),
  )
  add(
    'teardown: only owned PIDs targeted',
    value.processSafety?.unknownProcessesTerminated === false &&
      Array.isArray(value.processSafety?.killAttempts) &&
      value.processSafety.killAttempts.every((a) => a.owned === true),
    JSON.stringify(value.processSafety?.killAttempts),
  )
  add(
    'teardown: CDP port released',
    value.teardown?.cdpPortReleased === true,
    value.teardown?.cdpPortReleased,
  )
  add(
    'teardown: temporary Chrome profile removed',
    value.teardown?.tempProfileRemoved === true,
    value.teardown?.tempProfileRemoved,
  )
  return checks
}

// ---------- error sanitization ----------
function toPublicErrorCategory(error) {
  const candidateName =
    error && typeof error === 'object' && typeof error.name === 'string'
      ? error.name
      : 'Error'
  const name = /^[A-Za-z][A-Za-z0-9]*$/.test(candidateName)
    ? candidateName.slice(0, 64)
    : 'Error'
  const candidateCode =
    error && typeof error === 'object' && typeof error.code === 'string'
      ? error.code
      : null
  const code =
    candidateCode && /^[A-Z0-9_-]{1,40}$/.test(candidateCode)
      ? candidateCode
      : null
  return code ? { name, code } : { name }
}

function runPublicErrorSelfTest() {
  const windowsError = new Error(
    'failed at C:\\Users\\private\\secret\\progressive-building-upgrade-flow-public-cdp.mjs',
  )
  windowsError.stack =
    'Error: secret\n at C:\\Users\\private\\secret\\progressive-building-upgrade-flow-public-cdp.mjs:1:1'
  windowsError.code = 'ENOENT'
  const unixError = new TypeError(
    'failed at /Users/private/secret/progressive-building-upgrade-flow-public-cdp.mjs',
  )
  unixError.stack =
    'TypeError: secret\n at /Users/private/secret/progressive-building-upgrade-flow-public-cdp.mjs:1:1'
  const outputs = [
    toPublicErrorCategory(windowsError),
    toPublicErrorCategory(unixError),
  ]
  const serialized = JSON.stringify(outputs)
  const forbidden = /Users|secret|[A-Za-z]:\\|\/Users\/|message|stack/i.test(
    serialized,
  )
  const expected =
    serialized ===
    JSON.stringify([{ name: 'Error', code: 'ENOENT' }, { name: 'TypeError' }])
  return {
    ok: !forbidden && expected,
    checked: 1,
    outputs,
    forbiddenDataPresent: forbidden,
  }
}

function runAssertionSelfTest() {
  const good = {
    preflight: { cdpPortFree: true, cdpPort: 2 },
    processSafety: {
      unknownProcessesTerminated: false,
      killAttempts: [{ owned: true }],
    },
    http: {
      htmlStatus: 200,
      jsStatus: 200,
      cssStatus: 200,
      baseOk: true,
      jsRef: EXPECTED_JS,
      cssRef: EXPECTED_CSS,
      jsMatchesExpected: true,
      cssMatchesExpected: true,
    },
    fresh: {
      storage: {
        city: {
          version: 3,
          state: {
            buildingProgress: buildBuildingProgress(),
            resources: { money: 10000, oil: 0, materials: 0 },
          },
        },
      },
      repairPanel: {
        childCount: 1,
        selectedIndex: 0,
        options: [{ status: 'Lv.0 / Lv.1' }],
      },
    },
    grant: {
      oilDelta: 20000,
      materialsDelta: 20000,
      moneyDelta: 20000,
      panelStillOpen: true,
      feedback: '钱、油、物资各增加 10000',
    },
    slotUpgrade: {
      progressBefore: 75,
      progressAfter: 100,
      canvasTarget: { changedPixels: 5000 },
      canvasControl: { changedPct: 0.1 },
    },
    hundred: {
      progressPresent: false,
      sharedButtonPresent: false,
      mainButtonPresent: true,
      mainButtonLabel: '升级主建筑至 Lv.3',
    },
    confirmView: {
      view: 'confirm',
      walletUnchanged: true,
      levelUnchanged: true,
      confirmCost: ['钱 60', '油 0', '物资 0'],
    },
    confirmApply: {
      moneySpent: 60,
      levelAfter: 3,
      childCountAfter: 3,
      newSlotStatus: 'Lv.0 / Lv.3',
      selectedIndexAfter: 2,
    },
    migration: {
      moneyFirst: 140,
      repairChildFirst: [2, 1, 0, 0, 0],
      commercialChildFirst: [3, 2, 1, 0, 0, 0, 0, 0, 0, 0],
      versionFirst: 3,
      moneySecond: 140,
      versionSecond: 3,
    },
    reset: {
      money: 10000,
      oil: 0,
      materials: 0,
      allLevelsOne: true,
      repairChildLevels: [0, 0, 0, 0, 0],
      panelClosed: true,
    },
    layout: {
      mobile: {
        noHorizontalOverflow: true,
        withinBounds: true,
        scrollableOrFits: true,
        control44: true,
      },
    },
    screenshots: {},
    teardown: { cdpPortReleased: true, tempProfileRemoved: true },
  }
  const skipRuntimeFiles = (check) =>
    check.name !== 'all expected screenshots written and nonempty'
  const pureChecks = evaluateAssertions(good).filter(skipRuntimeFiles)
  const badChecks = evaluateAssertions({}).filter(skipRuntimeFiles)
  const errorSanitization = runPublicErrorSelfTest()
  return {
    ok:
      pureChecks.every((check) => check.pass) &&
      badChecks.every((check) => !check.pass) &&
      errorSanitization.ok,
    checked: pureChecks.length + errorSanitization.checked,
    failuresOnGoodData: pureChecks
      .filter((check) => !check.pass)
      .map((check) => check.name),
    passesOnBadData: badChecks
      .filter((check) => check.pass)
      .map((check) => check.name),
    errorSanitization,
  }
}

// ---------- infrastructure ----------
async function preflight() {
  const preferredCdp = Number(process.env.CDP_PORT || 9411)
  cdpPort = await selectFreePort(preferredCdp, results.preflight.attemptedCdpPorts)
  results.preflight.cdpPort = cdpPort
  results.preflight.cdpPortFree = true
  results.preflight.ok = true
}

function launchChrome() {
  const chromePath = resolveChromePath()
  profileDir = fs.mkdtempSync(path.join(os.tmpdir(), PROFILE_PREFIX))
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
      PUBLIC_URL,
    ],
    { stdio: 'ignore', windowsHide: true },
  )
  registerOwnedProcess(chromeProc, 'chrome')
}

// ---------- the browser flow ----------
async function runFlow() {
  await preflight()
  await checkPublicHttp()
  launchChrome()
  await connectCdp()
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Input.setIgnoreInputEvents', { ignore: false })
  await send('Page.navigate', { url: PUBLIC_URL })
  await waitForApp()
  await sleep(1200)

  // 1. Fresh v3 save from a cleared store.
  await clearStorageAndReload()
  const freshStorage = await readStorage()
  const freshRepair = await findBuilding('修车厂')
  results.fresh = {
    storage: freshStorage,
    hud: await readHud(),
    repairPanel: freshRepair.panel,
  }
  await screenshot('public-initial.png')
  await closePanel()

  // 2. Debug resources twice (gang Lv.1 so oil/materials do not produce).
  await inject(
    citySave({
      buildingProgress: buildBuildingProgress(),
      resources: { money: 10_000, oil: 0, materials: 0 },
      lastResourceUpdatedAt: Date.now(),
    }),
    gangSave(0, Date.now()),
  )
  const grantBefore = (await readStorage()).city?.state?.resources
  await clickSelector('.city-hud__open-settings')
  await sleep(220)
  await clickSelector('.settings-panel__debug-action', 1)
  await sleep(240)
  await clickSelector('.settings-panel__debug-action', 1)
  await sleep(320)
  const grantAfter = (await readStorage()).city?.state?.resources
  const grantSettings = await readSettings()
  await screenshot('public-grant.png')
  results.grant = {
    oilDelta:
      typeof grantAfter?.oil === 'number' && typeof grantBefore?.oil === 'number'
        ? grantAfter.oil - grantBefore.oil
        : null,
    materialsDelta:
      typeof grantAfter?.materials === 'number' &&
      typeof grantBefore?.materials === 'number'
        ? grantAfter.materials - grantBefore.materials
        : null,
    moneyDelta:
      typeof grantAfter?.money === 'number' &&
      typeof grantBefore?.money === 'number'
        ? grantAfter.money - grantBefore.money
        : null,
    panelStillOpen: grantSettings.present,
    feedback: grantSettings.feedback,
  }
  await clickSelector('.settings-panel__close')
  await sleep(160)

  // 3 + 4 + 5 + 6. Real shared upgrade (stays below 100% for a numeric
  // progress delta), then a second real upgrade reaches 100%, then a real
  // main confirmation. Starting at repair Lv.2 [1,1,0,0,0] (50%): the first
  // real click lifts slot 0 to Lv.2 (75%), the second lifts slot 1 to Lv.2
  // (100%).
  await inject(
    citySave({
      buildingProgress: buildBuildingProgress({
        'repair-shop': { level: 2, childLevels: [1, 1, 0, 0, 0] },
      }),
      resources: { money: LARGE_MONEY, oil: 0, materials: 0 },
      // Keep the 10-second producer tick outside this short cost assertion
      // window so net wallet movement equals the exact upgrade cost.
      lastResourceUpdatedAt: Date.now() + 60_000,
    }),
    gangSave(0, Date.now()),
  )
  const repair = await findBuilding('修车厂')
  const repairSpot = { x: repair.x, y: repair.y }
  const beforePanel = repair.panel
  const roi = {
    x: repairSpot.x - ROI_LEFT,
    y: repairSpot.y - ROI_UP,
    w: ROI_LEFT + ROI_RIGHT,
    h: ROI_UP + ROI_DOWN,
  }
  const uiRects = await excludeRects()
  const beforeShot = await screenshot('public-slot-before.png')
  await clickSelector('.building-panel__shared-upgrade')
  await sleep(220)
  const afterShot = await screenshot('public-slot-after.png')
  const afterUpgrade = await readPanel()
  results.slotUpgrade = {
    progressBefore: beforePanel.progressNow,
    progressAfter: afterUpgrade.progressNow,
    canvasTarget: diffPixels(beforeShot, afterShot, { roi, excludes: uiRects }),
    canvasControl: diffPixels(beforeShot, afterShot, {
      excludes: [...uiRects, { x: roi.x, y: roi.y, w: roi.w, h: roi.h }],
    }),
  }
  // Second real click completes the last unlocked slot and reaches 100%.
  await clickSelector('.building-panel__shared-upgrade')
  await sleep(280)

  // 4. 100% state.
  const hundred = await readPanel()
  results.hundred = {
    progressPresent: hundred.progressPresent,
    sharedButtonPresent: hundred.sharedButtonPresent,
    mainButtonPresent: hundred.mainButtonPresent,
    mainButtonLabel: hundred.mainButtonLabel,
  }

  // 5. Open the confirm page: no deduction, full cost.
  const walletBeforeConfirm = await cityMoney()
  const levelBeforeConfirm =
    (await readStorage()).city?.state?.buildingProgress?.['repair-shop']?.level
  await clickSelector('.building-panel__main-button')
  await sleep(240)
  const confirmPanel = await readPanel()
  const walletAfterConfirm = await cityMoney()
  const levelAfterConfirm =
    (await readStorage()).city?.state?.buildingProgress?.['repair-shop']?.level
  results.confirmView = {
    view: confirmPanel.view,
    confirmCost: confirmPanel.confirmCost,
    confirmPower: confirmPanel.confirmPower,
    walletUnchanged:
      typeof walletAfterConfirm === 'number' &&
      typeof walletBeforeConfirm === 'number' &&
      walletAfterConfirm >= walletBeforeConfirm,
    levelUnchanged: levelAfterConfirm === levelBeforeConfirm,
  }
  await screenshot('public-confirm.png')

  // 6. Confirm deducts exactly once and reveals the auto-selected new slot.
  const moneyBeforeApply = await cityMoney()
  await clickSelector('.building-panel__confirm-submit')
  await sleep(380)
  const applyPanel = await readPanel()
  const applyStorage = await readStorage()
  const moneyAfterApply = await cityMoney()
  results.confirmApply = {
    moneySpent:
      typeof moneyBeforeApply === 'number' && typeof moneyAfterApply === 'number'
        ? moneyBeforeApply - moneyAfterApply
        : null,
    levelAfter:
      applyStorage.city?.state?.buildingProgress?.['repair-shop']?.level ?? null,
    childCountAfter: applyPanel.childCount,
    newSlotStatus: applyPanel.options?.[2]?.status ?? null,
    selectedIndexAfter: applyPanel.selectedIndex,
  }
  await screenshot('public-new-slot.png')
  await closePanel()

  // 7. v2 -> v3 one-time hidden-slot refund across two reloads.
  await inject(
    citySave({
      version: 2,
      buildingProgress: {
        'repair-shop': { level: 2, childLevels: [2, 1, 2, 0, 1] },
        'commercial-street': {
          level: 3,
          childLevels: [3, 2, 1, 2, 1, 0, 0, 0, 0, 0],
        },
      },
      resources: { money: 100, oil: 7, materials: 9 },
      lastResourceUpdatedAt: Date.now(),
    }),
    gangSave(0, Date.now()),
  )
  const migratedCity = (await readStorage()).city
  results.migration = {
    moneyFirst: migratedCity?.state?.resources?.money ?? null,
    repairChildFirst:
      migratedCity?.state?.buildingProgress?.['repair-shop']?.childLevels ?? null,
    commercialChildFirst:
      migratedCity?.state?.buildingProgress?.['commercial-street']
        ?.childLevels ?? null,
    versionFirst: migratedCity?.version ?? null,
  }
  await screenshot('public-migration.png')
  await reloadAndWait()
  const remigratedCity = (await readStorage()).city
  results.migration.moneySecond =
    remigratedCity?.state?.resources?.money ?? null
  results.migration.versionSecond = remigratedCity?.version ?? null

  // 8. Reset through two confirmations.
  await inject(
    citySave({
      buildingProgress: buildBuildingProgress({
        'repair-shop': { level: 3, childLevels: [3, 3, 3, 0, 0] },
      }),
      resources: { money: LARGE_MONEY, oil: 500, materials: 500 },
      lastResourceUpdatedAt: Date.now(),
    }),
    gangSave(500, Date.now()),
  )
  await clickSelector('.city-hud__open-settings')
  await sleep(220)
  await clickSelector('.settings-panel__reset')
  await sleep(200)
  await clickSelector('.settings-panel__confirm-reset')
  await sleep(450)
  const resetStorage = await readStorage()
  const resetCity = resetStorage.city?.state
  const resetPanelPresent = await evaluate(
    `Boolean(document.querySelector('.building-panel'))`,
  )
  results.reset = {
    money: resetCity?.resources?.money ?? null,
    oil: resetCity?.resources?.oil ?? null,
    materials: resetCity?.resources?.materials ?? null,
    allLevelsOne: BUILDING_IDS.every(
      (id) => resetCity?.buildingProgress?.[id]?.level === 1,
    ),
    repairChildLevels:
      resetCity?.buildingProgress?.['repair-shop']?.childLevels ?? null,
    panelClosed: resetPanelPresent === false,
  }
  await screenshot('public-reset.png')

  // 9. 390x844 layout.
  await inject(
    citySave({
      buildingProgress: buildBuildingProgress({
        'repair-shop': { level: 2, childLevels: [2, 2, 0, 0, 0] },
      }),
      resources: { money: LARGE_MONEY, oil: 0, materials: 0 },
      lastResourceUpdatedAt: Date.now(),
    }),
    gangSave(0, Date.now()),
  )
  // Open the panel at desktop width first, then emulate 390x844 so the scan
  // never runs against a narrow viewport with desktop coordinates.
  await findBuilding('修车厂')
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  })
  await sleep(600)
  const mobile = await measurePanel()
  await screenshot('public-mobile.png')
  await send('Emulation.clearDeviceMetricsOverride')
  results.layout = { mobile }
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
  if (profileDir) {
    const expectedPrefix = path.join(os.tmpdir(), PROFILE_PREFIX)
    if (!profileDir.startsWith(expectedPrefix)) {
      throw new Error(
        `SAFETY_ABORT: refusing to remove unexpected profile ${path.basename(profileDir)}`,
      )
    }
    let removed = false
    for (let attempt = 0; attempt < 5 && !removed; attempt += 1) {
      try {
        fs.rmSync(profileDir, { recursive: true, force: true })
        removed = !fs.existsSync(profileDir)
      } catch {
        removed = false
      }
      if (!removed) await sleep(400)
    }
    results.teardown.tempProfileRemoved = removed
  } else {
    results.teardown.tempProfileRemoved = null
  }
}

results.assertionSelfTest = runAssertionSelfTest()
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

results.assertions = evaluateAssertions(results)
const failures = results.assertions.filter((assertion) => !assertion.pass)
fs.writeFileSync(OUT_JSON, `${JSON.stringify(results, null, 2)}\n`)
console.log(`WROTE ${path.basename(OUT_JSON)}`)
console.log(
  `ASSERTION SELF-TEST: ${results.assertionSelfTest.ok ? 'PASS' : 'FAIL'} (${results.assertionSelfTest.checked} pure-data checks)`,
)
if (!results.assertionSelfTest.ok) {
  console.error(
    'SELF-TEST FAILURES:',
    JSON.stringify({
      failuresOnGoodData: results.assertionSelfTest.failuresOnGoodData,
      passesOnBadData: results.assertionSelfTest.passesOnBadData,
    }),
  )
}
for (const assertion of results.assertions) {
  console.log(
    `${assertion.pass ? 'PASS' : 'FAIL'} ${assertion.name}: ${assertion.detail}`,
  )
}
if (runError) console.error('RUN ERROR:', runError?.stack || runError)
if (teardownError && teardownError !== runError) {
  console.error('TEARDOWN ERROR:', teardownError?.stack || teardownError)
}
if (failures.length) {
  console.error(
    `FAILED ASSERTIONS: ${failures.map((item) => item.name).join(', ')}`,
  )
}
const ok = !runError && results.assertionSelfTest.ok && failures.length === 0
console.log(ok ? 'ALL ASSERTIONS PASSED' : 'ACCEPTANCE FAILED')
process.exitCode = ok ? 0 : 1
