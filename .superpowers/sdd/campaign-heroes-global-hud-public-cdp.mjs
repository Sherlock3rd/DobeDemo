// Safe public GitHub Pages acceptance for campaign, heroes and GlobalHud.
// Visible controls are driven with Input.dispatchMouseEvent, never DOM.click().
//
// Safety:
// - Chrome selects its CDP port with --remote-debugging-port=0.
// - The port is read only from this run's isolated DevToolsActivePort file.
// - Only this script's spawned Chrome PID may be terminated.
// - Only a verified temporary profile with the exact prefix below is removed.
// - Result JSON contains no absolute paths, raw errors or stacks.
// - Any failed assertion, missing screenshot, runtime error or cleanup failure
//   produces a non-zero exit code.
//
// Config: CHROME_PATH, PUBLIC_URL, RELEASE_COMMIT, RELEASE_TAG.
// Run: node .superpowers/sdd/campaign-heroes-global-hud-public-cdp.mjs
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { execFileSync, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT_JSON = path.join(
  HERE,
  'campaign-heroes-global-hud-public-results.json',
)
const PROFILE_PREFIX = 'dobe-campaign-heroes-public-cdp-'
const CITY_KEY = 'dobe-city-progression-v1'
const GANG_KEY = 'gang-progression-v1'
const ADVENTURE_KEY = 'dobe-adventure-progression-v1'
const RELEASE_COMMIT =
  process.env.RELEASE_COMMIT ||
  'd7565826d5c11dabcfca63d8e46480e4a63dc225'
const RELEASE_TAG = process.env.RELEASE_TAG || RELEASE_COMMIT.slice(0, 7)
const PUBLIC_ORIGIN =
  process.env.PUBLIC_URL || 'https://sherlock3rd.github.io/DobeDemo/'
const PUBLIC_URL = new URL(
  `?release=${encodeURIComponent(RELEASE_TAG)}`,
  PUBLIC_ORIGIN,
).toString()
const EXPECTED_JS = '/DobeDemo/assets/index-C010nH2x.js'
const EXPECTED_CSS = '/DobeDemo/assets/index-CoMhGqEJ.css'
const EXPECTED_SHOTS = [
  'campaign-public-fresh-desktop.png',
  'campaign-public-adventure-desktop.png',
  'campaign-public-formation-desktop.png',
  'campaign-public-battle-desktop.png',
  'campaign-public-victory-desktop.png',
  'campaign-public-hud-mobile.png',
  'campaign-public-adventure-mobile.png',
  'campaign-public-battle-mobile.png',
]

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const results = {
  generatedAt: new Date().toISOString(),
  script: 'campaign-heroes-global-hud-public-cdp.mjs',
  release: {
    commit: RELEASE_COMMIT,
    url: `?release=${RELEASE_TAG}`,
  },
  preflight: {
    strategy:
      'Chrome assigns port 0; trust only isolated-profile DevToolsActivePort',
    cdpPortSource: 'DevToolsActivePort',
  },
  processSafety: {
    ownedProcessLabels: [],
    killAttempts: [],
    unknownProcessesTerminated: false,
  },
  http: {},
  fresh: {},
  desktop: {},
  battle: {},
  overlay: {},
  mobile: {},
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

function arraysEqual(left, right) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  )
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

function registerOwnedProcess(child, label) {
  if (!child?.pid) throw new Error(`${label} did not return a PID`)
  ownedPids.add(child.pid)
  results.processSafety.ownedProcessLabels.push(label)
}

function killOwnedTree(child, label) {
  const pid = child?.pid
  if (!pid) return
  if (!ownedPids.has(pid)) {
    results.processSafety.unknownProcessesTerminated = true
    throw new Error('SAFETY_ABORT: refusing to terminate unowned process')
  }
  results.processSafety.killAttempts.push({ label, owned: true })
  try {
    if (process.platform === 'win32') {
      execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
        stdio: 'ignore',
      })
    } else {
      process.kill(pid, 'SIGKILL')
    }
  } catch {
    // The owned Chrome process may already have exited.
  }
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
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (chromeProc?.exitCode !== null) {
      throw new Error(`Owned Chrome exited ${chromeProc.exitCode}`)
    }
    if (fs.existsSync(activePortFile)) {
      activePortText = fs.readFileSync(activePortFile, 'utf8')
      if (activePortText.trim()) break
    }
    await sleep(200)
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
  results.preflight.cdpPortAssigned = true
  results.preflight.cdpBrowserWsPathValidated = true
  results.preflight.cdpOwnedProfile = true

  let targets
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (chromeProc?.exitCode !== null) {
      throw new Error(`Owned Chrome exited ${chromeProc.exitCode}`)
    }
    try {
      const response = await fetch(`http://127.0.0.1:${cdpPort}/json`)
      targets = await response.json()
      if (targets.some((target) => target.type === 'page')) break
    } catch {
      // The owned endpoint is still starting.
    }
    await sleep(200)
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
    if (message.error) waiter.reject(new Error('CDP command failed'))
    else waiter.resolve(message.result)
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
  }
}

async function screenshot(fileName, phase) {
  const response = await send('Page.captureScreenshot', { format: 'png' })
  const buffer = Buffer.from(response.data, 'base64')
  fs.writeFileSync(path.join(HERE, fileName), buffer)
  results.screenshots[fileName] = {
    ...pngInfo(buffer),
    ...(phase ? { phase } : {}),
  }
  return buffer
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
        return
      }
    } catch {
      // The initial about:blank target has an opaque origin.
    }
    await sleep(250)
  }
  throw new Error('Public app did not become ready')
}

async function reloadAndWait(delay = 900) {
  const previous = await evaluate('performance.timeOrigin')
  await send('Page.reload', { ignoreCache: false })
  await waitForApp(previous)
  await sleep(delay)
}

async function clearStorageAndReload() {
  await evaluate('localStorage.clear()')
  await reloadAndWait()
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

async function readHud() {
  return evaluate(`(() => ({
    resources: [...document.querySelectorAll('.global-hud__resources span')].map((element) => element.textContent.trim()),
    adventureDot: Boolean(document.querySelector('.global-hud__nav .global-hud__dot'))
  }))()`)
}

async function readOverlay() {
  return evaluate(`(() => ({
    adventure: Boolean(document.querySelector('.adventure-panel')),
    formation: Boolean(document.querySelector('.formation-panel')),
    battle: Boolean(document.querySelector('.battle-screen')),
    globalHud: Boolean(document.querySelector('.global-hud') && !document.querySelector('.global-hud').closest('[hidden]'))
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
    const undersizedControls = controls.flatMap((control) => {
      const r = control.getBoundingClientRect()
      return r.width >= 44 && r.height >= 44
        ? []
        : [{ className: control.className, width: r.width, height: r.height }]
    })
    return {
      present: true,
      viewport: { width: innerWidth, height: innerHeight },
      withinHorizontalBounds: rect.left >= -1 && rect.right <= innerWidth + 1,
      noHorizontalOverflow:
        panel.scrollWidth <= panel.clientWidth + 1 &&
        root.scrollWidth <= innerWidth + 1,
      scrollableOrFits:
        panel.scrollHeight <= panel.clientHeight + 1 ||
        style.overflowY === 'auto' ||
        style.overflowY === 'scroll',
      controls: controls.length,
      controls44: controls.length > 0 && undersizedControls.length === 0,
      undersizedControls
    }
  })()`)
}

async function fetchNoCache(url) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { 'cache-control': 'no-cache', pragma: 'no-cache' },
  })
  return { status: response.status, body: await response.text() }
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
    url: `?release=${RELEASE_TAG}`,
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

function panelOk(panel, width, height) {
  return (
    panel?.present === true &&
    panel?.viewport?.width === width &&
    panel?.viewport?.height === height &&
    panel?.withinHorizontalBounds === true &&
    panel?.noHorizontalOverflow === true &&
    panel?.scrollableOrFits === true &&
    panel?.controls44 === true &&
    panel?.undersizedControls?.length === 0
  )
}

function evaluateAssertions(value, { checkFiles = true } = {}) {
  const checks = []
  const add = (name, pass, detail = '') =>
    checks.push({ name, pass: pass === true, detail: String(detail ?? '') })

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
    'H2. public asset hashes exactly match this release',
    value.http?.baseOk === true &&
      value.http?.jsMatchesExpected === true &&
      value.http?.cssMatchesExpected === true,
    JSON.stringify({ js: value.http?.jsRef, css: value.http?.cssRef }),
  )
  add(
    '1. fresh GlobalHud has wallet 10000 and four resources',
    value.fresh?.wallet?.money === 10000 &&
      value.fresh?.wallet?.oil === 0 &&
      value.fresh?.wallet?.materials === 0 &&
      value.fresh?.hud?.resources?.length === 4 &&
      value.fresh?.hud?.resources?.some((text) =>
        text.startsWith('钱 10000'),
      ) &&
      value.fresh?.hud?.resources?.some((text) =>
        text.includes('英雄经验 0'),
      ),
    JSON.stringify(value.fresh),
  )
  add(
    '1b. fresh adventure red dot and initial progress are present',
    value.fresh?.hud?.adventureDot === true &&
      value.fresh?.highestClearedStage === 0 &&
      value.fresh?.sharedExp === 0 &&
      arraysEqual(
        value.fresh?.formation?.map((slot) => slot.heroId),
        ['foreman'],
      ),
    JSON.stringify({
      dot: value.fresh?.hud?.adventureDot,
      highest: value.fresh?.highestClearedStage,
      shared: value.fresh?.sharedExp,
      formation: value.fresh?.formation,
    }),
  )
  add(
    '2. real push -> 1-1 -> formation -> start chain opened battle',
    value.desktop?.stage11Selected === true &&
      value.desktop?.formationSlots === 5 &&
      value.battle?.start?.dialog === true &&
      value.battle?.start?.banner === 'START',
    JSON.stringify({
      stage11: value.desktop?.stage11Selected,
      slots: value.desktop?.formationSlots,
      start: value.battle?.start,
    }),
  )
  add(
    '3. START hides GlobalHud and battle state advances',
    value.battle?.start?.globalHudPresent === false &&
      value.battle?.combatStateChanged === true,
    JSON.stringify({
      startHud: value.battle?.start?.globalHudPresent,
      changed: value.battle?.combatStateChanged,
    }),
  )
  add(
    '3b. basic, damage and death presentation callbacks fired',
    value.battle?.metrics?.basicHits > 0 &&
      value.battle?.metrics?.damageEvents > 0 &&
      value.battle?.metrics?.deaths > 0 &&
      value.battle?.metrics?.presentedBasic === true &&
      value.battle?.runningBasicCaptured === true,
    JSON.stringify(value.battle?.metrics),
  )
  add(
    '3c. first battle resolved VICTORY with highest=1/shared=500',
    value.battle?.resultText?.includes('VICTORY') === true &&
      value.battle?.highestAfter === 1 &&
      value.battle?.sharedAfter === 500,
    JSON.stringify({
      result: value.battle?.resultText,
      highest: value.battle?.highestAfter,
      shared: value.battle?.sharedAfter,
    }),
  )
  add(
    '4. GlobalHud remains visible on non-battle overlays',
    value.overlay?.fresh?.globalHud === true &&
      value.overlay?.adventure?.globalHud === true &&
      value.overlay?.formation?.globalHud === true &&
      value.overlay?.adventure?.adventure === true &&
      value.overlay?.formation?.formation === true,
    JSON.stringify(value.overlay),
  )
  add(
    '4b. victory continue returns to adventure with GlobalHud',
    value.overlay?.afterContinue?.adventure === true &&
      value.overlay?.afterContinue?.battle === false &&
      value.overlay?.afterContinue?.globalHud === true,
    JSON.stringify(value.overlay?.afterContinue),
  )
  add(
    '4c. confirmed battle exit returns to adventure with GlobalHud',
    value.overlay?.afterExit?.adventure === true &&
      value.overlay?.afterExit?.battle === false &&
      value.overlay?.afterExit?.globalHud === true,
    JSON.stringify(value.overlay?.afterExit),
  )
  add(
    '5. desktop 1440x900 HUD/adventure/battle fit and controls are 44x44',
    panelOk(value.desktop?.hud, 1440, 900) &&
      panelOk(value.desktop?.adventure, 1440, 900) &&
      panelOk(value.desktop?.battle, 1440, 900),
    JSON.stringify({
      hud: value.desktop?.hud,
      adventure: value.desktop?.adventure,
      battle: value.desktop?.battle,
    }),
  )
  add(
    '5b. mobile 390x844 HUD/adventure/battle fit and controls are 44x44',
    panelOk(value.mobile?.hud, 390, 844) &&
      panelOk(value.mobile?.adventure, 390, 844) &&
      panelOk(value.mobile?.battle, 390, 844),
    JSON.stringify(value.mobile),
  )
  const screenshotMetadataOk = EXPECTED_SHOTS.every((name) => {
    const metadata = value.screenshots?.[name]
    if (
      !metadata ||
      metadata.width < 1 ||
      metadata.height < 1 ||
      metadata.bytes < 1
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
    'T1. teardown targeted only the owned Chrome process',
    value.processSafety?.unknownProcessesTerminated === false &&
      arraysEqual(value.processSafety?.ownedProcessLabels, ['chrome']) &&
      value.processSafety?.killAttempts?.length === 1 &&
      value.processSafety?.killAttempts?.every(
        (attempt) => attempt.label === 'chrome' && attempt.owned === true,
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

function runAssertionSelfTest() {
  const panel = {
    present: true,
    viewport: { width: 1440, height: 900 },
    withinHorizontalBounds: true,
    noHorizontalOverflow: true,
    scrollableOrFits: true,
    controls44: true,
    undersizedControls: [],
  }
  const mobilePanel = {
    ...panel,
    viewport: { width: 390, height: 844 },
  }
  const screenshots = Object.fromEntries(
    EXPECTED_SHOTS.map((name) => [
      name,
      { width: 1, height: 1, bytes: 1 },
    ]),
  )
  const good = {
    preflight: {
      cdpPortSource: 'DevToolsActivePort',
      cdpPortAssigned: true,
      cdpBrowserWsPathValidated: true,
      cdpOwnedProfile: true,
    },
    processSafety: {
      profilePrefixVerified: true,
      unknownProcessesTerminated: false,
      ownedProcessLabels: ['chrome'],
      killAttempts: [{ label: 'chrome', owned: true }],
    },
    http: {
      htmlStatus: 200,
      jsStatus: 200,
      cssStatus: 200,
      baseOk: true,
      jsMatchesExpected: true,
      cssMatchesExpected: true,
      jsRef: EXPECTED_JS,
      cssRef: EXPECTED_CSS,
    },
    fresh: {
      wallet: { money: 10000, oil: 0, materials: 0 },
      hud: {
        resources: ['钱 10000', '油 0', '物资 0', '英雄经验 0'],
        adventureDot: true,
      },
      highestClearedStage: 0,
      sharedExp: 0,
      formation: [{ heroId: 'foreman' }],
    },
    desktop: {
      stage11Selected: true,
      formationSlots: 5,
      hud: panel,
      adventure: panel,
      battle: panel,
    },
    battle: {
      start: { dialog: true, banner: 'START', globalHudPresent: false },
      combatStateChanged: true,
      metrics: {
        basicHits: 1,
        damageEvents: 1,
        deaths: 1,
        presentedBasic: true,
      },
      runningBasicCaptured: true,
      resultText: 'VICTORY',
      highestAfter: 1,
      sharedAfter: 500,
    },
    overlay: {
      fresh: { globalHud: true },
      adventure: { globalHud: true, adventure: true },
      formation: { globalHud: true, formation: true },
      afterContinue: { adventure: true, battle: false, globalHud: true },
      afterExit: { adventure: true, battle: false, globalHud: true },
    },
    mobile: {
      hud: mobilePanel,
      adventure: mobilePanel,
      battle: mobilePanel,
    },
    screenshots,
    teardown: { cdpPortReleased: true, tempProfileRemoved: true },
  }
  const goodChecks = evaluateAssertions(good, { checkFiles: false })
  const emptyChecks = evaluateAssertions({}, { checkFiles: false })
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
  return {
    ok:
      goodChecks.every((item) => item.pass) &&
      emptyChecks.every((item) => !item.pass) &&
      redacted,
    checked: goodChecks.length + 1,
    failuresOnGoodData: goodChecks
      .filter((item) => !item.pass)
      .map((item) => item.name),
    passesOnEmptyData: emptyChecks
      .filter((item) => item.pass)
      .map((item) => item.name),
    pathRedaction: {
      ok: redacted,
      outputs: publicErrors,
      forbiddenDataPresent: !redacted,
    },
  }
}

async function readBattleState() {
  return evaluate(`(() => {
    const battle = document.querySelector('.battle-screen')
    return {
      result: document.querySelector('.battle-screen__result')?.textContent ?? null,
      hp: [...document.querySelectorAll('.battle-hud__hp')].map((element) => Number(element.getAttribute('aria-valuenow'))),
      cooldown: [...document.querySelectorAll('.battle-hud__cd')].map((element) => Number(element.getAttribute('aria-valuenow'))),
      basicHits: Number(battle?.dataset.basicHits ?? 0),
      damageEvents: Number(battle?.dataset.damageEvents ?? 0),
      deaths: Number(battle?.dataset.deaths ?? 0),
      presentedBasic: battle?.dataset.presentedBasic === 'true',
      currentPresentedBasic: battle?.dataset.currentPresentedBasic === 'true'
    }
  })()`)
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
  await sleep(800)

  // Desktop: fresh -> push -> 1-1 -> formation -> start -> victory.
  await clearStorageAndReload()
  const freshStorage = await readStorage()
  const freshHud = await readHud()
  results.fresh = {
    wallet: freshStorage.city?.state?.resources ?? null,
    sharedExp: freshStorage.adventure?.state?.sharedExp ?? null,
    highestClearedStage:
      freshStorage.adventure?.state?.highestClearedStage ?? null,
    formation: freshStorage.adventure?.state?.formation ?? null,
    hud: freshHud,
  }
  results.overlay.fresh = await readOverlay()
  results.desktop.hud = await measurePanel('.global-hud')
  await screenshot('campaign-public-fresh-desktop.png')

  await clickSelector('.global-hud__nav', 0)
  await sleep(180)
  results.overlay.adventure = await readOverlay()
  results.desktop.adventure = await measurePanel('.adventure-panel')
  await screenshot('campaign-public-adventure-desktop.png')
  results.desktop.stage11Selected =
    (await evaluate(
      `document.querySelectorAll('.adventure-panel__stage')[0]?.textContent?.includes('1-1') ?? false`,
    )) === true
  await clickSelector('.adventure-panel__stage', 0)
  await clickSelector('.adventure-panel__challenge')
  await sleep(160)
  results.overlay.formation = await readOverlay()
  results.desktop.formationSlots = await evaluate(
    `document.querySelectorAll('.formation-panel__slot').length`,
  )
  await screenshot('campaign-public-formation-desktop.png')
  await clickSelector('.formation-panel__start')
  await sleep(70)

  const battleStart = await evaluate(`(() => ({
    dialog: Boolean(document.querySelector('.battle-screen')),
    banner: document.querySelector('.battle-screen__banner')?.textContent?.trim() ?? null,
    globalHudPresent: Boolean(document.querySelector('.global-hud') && !document.querySelector('.global-hud').closest('[hidden]')),
    hp: [...document.querySelectorAll('.battle-hud__hp')].map((element) => Number(element.getAttribute('aria-valuenow'))),
    cooldown: [...document.querySelectorAll('.battle-hud__cd')].map((element) => Number(element.getAttribute('aria-valuenow')))
  }))()`)
  results.desktop.battle = await measurePanel('.battle-screen')
  results.battle.start = battleStart
  await clickSelector('.battle-hud__speed button', 1)

  let runningBasicCaptured = false
  let combatStateChanged = false
  let metrics
  for (let attempt = 0; attempt < 200; attempt += 1) {
    await sleep(150)
    metrics = await readBattleState()
    if (
      !arraysEqual(metrics.hp, battleStart.hp) ||
      !arraysEqual(metrics.cooldown, battleStart.cooldown)
    ) {
      combatStateChanged = true
    }
    if (
      !runningBasicCaptured &&
      !metrics.result &&
      metrics.basicHits > 0 &&
      metrics.currentPresentedBasic
    ) {
      await screenshot(
        'campaign-public-battle-desktop.png',
        'running-basic-hit',
      )
      runningBasicCaptured = true
    }
    if (metrics.result) break
  }
  const postBattle = await readStorage()
  results.battle = {
    ...results.battle,
    combatStateChanged,
    metrics,
    runningBasicCaptured,
    resultText: metrics?.result ?? null,
    highestAfter:
      postBattle.adventure?.state?.highestClearedStage ?? null,
    sharedAfter: postBattle.adventure?.state?.sharedExp ?? null,
  }
  await screenshot('campaign-public-victory-desktop.png', 'resolved')
  await clickSelector('.battle-screen__result button')
  await sleep(180)
  results.overlay.afterContinue = await readOverlay()

  // Mobile: fresh HUD -> adventure -> battle -> confirmed exit.
  await evaluate('localStorage.clear()')
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  })
  await reloadAndWait()
  results.mobile.hud = await measurePanel('.global-hud')
  await screenshot('campaign-public-hud-mobile.png')
  await clickSelector('.global-hud__nav', 0)
  await sleep(160)
  results.mobile.adventure = await measurePanel('.adventure-panel')
  await screenshot('campaign-public-adventure-mobile.png')
  await clickSelector('.adventure-panel__stage', 0)
  await clickSelector('.adventure-panel__challenge')
  await sleep(140)
  await clickSelector('.formation-panel__start')
  await sleep(90)
  results.mobile.battle = await measurePanel('.battle-screen')
  await screenshot('campaign-public-battle-mobile.png', 'start')
  await clickSelector('.battle-hud__exit')
  await sleep(80)
  await clickSelector('.battle-hud__exit-confirm button', 0)
  await sleep(160)
  results.overlay.afterExit = await readOverlay()
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
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      fs.rmSync(profileDir, { recursive: true, force: true })
    } catch {
      // Windows may briefly retain profile files after taskkill.
    }
    if (!fs.existsSync(profileDir)) return true
    await sleep(350)
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

results.assertions = evaluateAssertions(results)
const failures = results.assertions.filter((assertion) => !assertion.pass)
fs.writeFileSync(OUT_JSON, `${JSON.stringify(results, null, 2)}\n`)
console.log(`WROTE ${path.basename(OUT_JSON)}`)
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
const ok =
  !runError && results.assertionSelfTest.ok && failures.length === 0
console.log(
  ok
    ? `ALL ASSERTIONS PASSED (${results.assertions.length}/${results.assertions.length})`
    : 'ACCEPTANCE FAILED',
)
process.exitCode = ok ? 0 : 1
