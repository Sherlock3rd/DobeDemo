// Repeatable HTTP + Chrome/CDP acceptance for the city layout / pan-drag epic.
//
// SAFETY MODEL (important):
//   - Preflight requires BOTH the dev port (5177) and the CDP port (9224) to be
//     FREE. If either is already in use, the script throws and exits 1 WITHOUT
//     connecting to or terminating any existing process. It only ever starts its
//     own dev server + headless Chrome and only kills the process trees it started.
//   - The throwaway Chrome profile is created under the OS temp dir (os.tmpdir),
//     so the script contains no hard-coded user-specific sensitive path.
//
// FLOW:
//   1. Preflight: assert 5177 and 9224 are free (record preflight in JSON).
//   2. Start dev server on 5177 (--strictPort); wait for HTTP 200.
//   3. HTTP body checks: status 200, `#root`, `/src/main.tsx`.
//   4. Launch headless Chrome (1440x900) on 9224 with temp profile.
//   5. Clear `gang-progression-v1`, reload, screenshot default view.
//   6. Real gestures via CDP Input: left PAN, right PAN, single-finger touch PAN,
//      each with before/after screenshots and decoded per-pixel change counts.
//   7. Click suppression: plain click opens `.building-panel`; >6px drag does not.
//   8. finally: tear down only what we started; verify port release + profile cleanup.
//   9. Assert every result item; on any failure print which item and exit 1.
//
// A pure-data negative self-test of the assertion function also runs every time,
// proving the checker rejects bad data without touching any real process.
//
// Config via env: DEV_PORT, DEV_URL, CDP_PORT, CHROME_PATH.
// Run: node .superpowers/sdd/layout-task-5-cdp.mjs

import zlib from 'node:zlib'
import fs from 'node:fs'
import os from 'node:os'
import net from 'node:net'
import path from 'node:path'
import { spawn, execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '..', '..')
const DEV_PORT = Number(process.env.DEV_PORT || 5177)
const DEV_URL = process.env.DEV_URL || `http://127.0.0.1:${DEV_PORT}/`
const CDP_PORT = Number(process.env.CDP_PORT || 9224)
const OUT_JSON = path.join(HERE, 'layout-task-5-browser-results.json')
const MAIN_SHOT = 'layout-pan-drag-screenshot.png'
const PAN_MIN_CHANGED_PCT = 1 // reasonable non-zero threshold for "screen changed"

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---------- port / process helpers ----------
// Resolves true if something is listening on the port (i.e. port is IN USE).
function isPortInUse(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const sock = net.connect({ port, host })
    let done = false
    const finish = (inUse) => {
      if (done) return
      done = true
      sock.destroy()
      resolve(inUse)
    }
    sock.setTimeout(800)
    sock.once('connect', () => finish(true))
    sock.once('timeout', () => finish(false))
    sock.once('error', () => finish(false))
  })
}

function killTree(pid) {
  if (!pid) return
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' })
    } else {
      process.kill(-pid, 'SIGKILL')
    }
  } catch {
    /* already gone */
  }
}

function resolveChromePath() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH
  }
  const candidates =
    process.platform === 'win32'
      ? [
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          path.join(
            os.homedir(),
            'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
          ),
        ]
      : process.platform === 'darwin'
        ? [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
          ]
        : ['/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium']
  for (const c of candidates) {
    if (fs.existsSync(c)) return c
  }
  throw new Error('Chrome not found; set CHROME_PATH')
}

// ---------- CDP plumbing ----------
let ws
let nextId = 1
const pending = new Map()

function send(method, params = {}) {
  const id = nextId++
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })
}

async function connectCdp() {
  let targets
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json`)
      targets = await res.json()
      if (targets.find((t) => t.type === 'page')) break
    } catch {
      /* not ready */
    }
    await sleep(250)
  }
  const page = targets?.find((t) => t.type === 'page')
  if (!page) throw new Error('no CDP page target')
  ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener('error', reject, { once: true })
  })
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) reject(new Error(JSON.stringify(msg.error)))
      else resolve(msg.result)
    }
  })
}

async function evaluate(expression) {
  const r = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  })
  if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails))
  return r.result.value
}

async function screenshot(fileName) {
  const r = await send('Page.captureScreenshot', { format: 'png' })
  const buf = Buffer.from(r.data, 'base64')
  if (fileName) fs.writeFileSync(path.join(HERE, fileName), buf)
  return buf
}

// ---------- PNG decode + diff ----------
function decodePng(buf) {
  let pos = 8
  let width, height, colorType, bitDepth
  const idat = []
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.toString('ascii', pos + 4, pos + 8)
    const data = buf.subarray(pos + 8, pos + 8 + len)
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
  if (bitDepth !== 8) throw new Error('unsupported bitDepth ' + bitDepth)
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : null
  if (!channels) throw new Error('unsupported colorType ' + colorType)
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const out = Buffer.alloc(height * stride)
  let rp = 0
  for (let y = 0; y < height; y++) {
    const filter = raw[rp++]
    for (let x = 0; x < stride; x++) {
      const cur = raw[rp++]
      const a = x >= channels ? out[y * stride + x - channels] : 0
      const b = y > 0 ? out[(y - 1) * stride + x] : 0
      const c = x >= channels && y > 0 ? out[(y - 1) * stride + x - channels] : 0
      let val
      switch (filter) {
        case 0: val = cur; break
        case 1: val = cur + a; break
        case 2: val = cur + b; break
        case 3: val = cur + ((a + b) >> 1); break
        case 4: {
          const p = a + b - c
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
          const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
          val = cur + pr
          break
        }
        default: throw new Error('bad filter ' + filter)
      }
      out[y * stride + x] = val & 0xff
    }
  }
  return { width, height, channels, data: out }
}

function diffPixels(a, b, tol = 12) {
  const A = decodePng(a)
  const B = decodePng(b)
  if (A.width !== B.width || A.height !== B.height) {
    return { changedPixels: -1, totalPixels: 0, changedPct: 100 }
  }
  const total = A.width * A.height
  let changed = 0
  const ca = A.channels, cb = B.channels
  for (let i = 0; i < total; i++) {
    const ai = i * ca, bi = i * cb
    if (
      Math.abs(A.data[ai] - B.data[bi]) > tol ||
      Math.abs(A.data[ai + 1] - B.data[bi + 1]) > tol ||
      Math.abs(A.data[ai + 2] - B.data[bi + 2]) > tol
    ) {
      changed++
    }
  }
  return {
    changedPixels: changed,
    totalPixels: total,
    changedPct: +((changed / total) * 100).toFixed(2),
  }
}

// ---------- gestures ----------
async function mouseDrag(button, x0, y0, dx, dy, steps = 10) {
  const buttons = button === 'right' ? 2 : 1
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed', x: x0, y: y0, button, buttons, clickCount: 1,
  })
  for (let i = 1; i <= steps; i++) {
    await send('Input.dispatchMouseEvent', {
      type: 'mouseMoved', x: x0 + (dx * i) / steps, y: y0 + (dy * i) / steps, button, buttons,
    })
    await sleep(16)
  }
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased', x: x0 + dx, y: y0 + dy, button, buttons, clickCount: 1,
  })
}

async function touchDrag(x0, y0, dx, dy, steps = 10) {
  await send('Input.dispatchTouchEvent', {
    type: 'touchStart', touchPoints: [{ x: x0, y: y0, id: 1 }],
  })
  for (let i = 1; i <= steps; i++) {
    await send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x0 + (dx * i) / steps, y: y0 + (dy * i) / steps, id: 1 }],
    })
    await sleep(16)
  }
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

async function mouseClick(x, y) {
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1,
  })
  await sleep(30)
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased', x, y, button: 'left', buttons: 1, clickCount: 1,
  })
}

const hasPanel = () => evaluate("!!document.querySelector('.building-panel')")
const closePanel = () =>
  evaluate(
    "(()=>{const b=document.querySelector('.building-panel__close');if(b){b.click();return true}return false})()",
  )

// ---------- assertions (pure, testable) ----------
// Returns an array of { name, pass, detail }. Used both for the live results and
// for a synthetic negative self-test.
function evaluateAssertions(r) {
  const checks = []
  const add = (name, pass, detail) => checks.push({ name, pass: !!pass, detail: String(detail) })
  const gesture = (n) => (r.gestures || []).find((g) => g.name === n)

  add('http.status===200', r.http?.status === 200, `status=${r.http?.status}`)
  add('http.hasRoot', r.http?.hasRoot === true, `hasRoot=${r.http?.hasRoot}`)
  add('http.hasMainTsx', r.http?.hasMainTsx === true, `hasMainTsx=${r.http?.hasMainTsx}`)
  add('canvas present', r.hasCanvas === true, `hasCanvas=${r.hasCanvas}`)

  for (const name of ['left-button-pan', 'right-button-pan', 'single-finger-touch-pan']) {
    const g = gesture(name)
    add(
      `${name} changedPct>=${PAN_MIN_CHANGED_PCT}`,
      !!g && typeof g.changedPct === 'number' && g.changedPct >= PAN_MIN_CHANGED_PCT,
      g ? `changedPct=${g.changedPct}` : 'gesture missing',
    )
  }

  add(
    'panelAfterClick===true',
    r.clickSuppression?.panelAfterClick === true,
    `panelAfterClick=${r.clickSuppression?.panelAfterClick}`,
  )
  add(
    'panelAfterDrag===false',
    r.clickSuppression?.panelAfterDrag === false,
    `panelAfterDrag=${r.clickSuppression?.panelAfterDrag}`,
  )
  add('cdpPortReleased', r.ports?.cdpPortReleased === true, `cdpPortReleased=${r.ports?.cdpPortReleased}`)
  add('devPortReleased', r.ports?.devPortReleased === true, `devPortReleased=${r.ports?.devPortReleased}`)
  add('tempProfileRemoved', r.tempProfileRemoved === true, `tempProfileRemoved=${r.tempProfileRemoved}`)
  return checks
}

// Pure-data negative self-test: feed deliberately-bad data and confirm the
// checker flags exactly the broken items. No processes touched.
function runAssertionSelfTest() {
  const bad = {
    http: { status: 500, hasRoot: false, hasMainTsx: false },
    hasCanvas: false,
    gestures: [
      { name: 'left-button-pan', changedPct: 0 },
      { name: 'right-button-pan', changedPct: 0.2 },
      // single-finger-touch-pan intentionally missing
    ],
    clickSuppression: { panelAfterClick: false, panelAfterDrag: true },
    ports: { cdpPortReleased: false, devPortReleased: false },
    tempProfileRemoved: false,
  }
  const checks = evaluateAssertions(bad)
  const failed = checks.filter((c) => !c.pass).map((c) => c.name)
  // Also confirm good data passes fully.
  const good = {
    http: { status: 200, hasRoot: true, hasMainTsx: true },
    hasCanvas: true,
    gestures: [
      { name: 'left-button-pan', changedPct: 26.5 },
      { name: 'right-button-pan', changedPct: 28.8 },
      { name: 'single-finger-touch-pan', changedPct: 27.9 },
    ],
    clickSuppression: { panelAfterClick: true, panelAfterDrag: false },
    ports: { cdpPortReleased: true, devPortReleased: true },
    tempProfileRemoved: true,
  }
  const goodFailures = evaluateAssertions(good).filter((c) => !c.pass)
  // Every check should fail on bad data; none should fail on good data.
  const allBadDetected = failed.length === checks.length
  const goodAllPass = goodFailures.length === 0
  return {
    ok: allBadDetected && goodAllPass,
    totalChecks: checks.length,
    detectedFailuresOnBadData: failed,
    failuresOnGoodData: goodFailures.map((c) => c.name),
  }
}

// ---------- main ----------
const results = {
  generatedAt: new Date().toISOString(),
  devUrl: DEV_URL,
  cdpPort: CDP_PORT,
  preflight: {},
  http: {},
  window: { requested: { width: 1440, height: 900 } },
  viewport: {},
  storageClearedThenReseededFresh: null,
  gestures: [],
  clickSuppression: {},
  screenshots: {},
  ports: {},
  assertionSelfTest: {},
  assertions: [],
}

let devProc = null
let chromeProc = null
let profileDir = null
let startedDev = false
let startedChrome = false

async function preflight() {
  const cdpInUse = await isPortInUse(CDP_PORT)
  const devInUse = await isPortInUse(DEV_PORT)
  results.preflight = {
    cdpPort: CDP_PORT,
    cdpPortFree: !cdpInUse,
    devPort: DEV_PORT,
    devPortFree: !devInUse,
    ok: !cdpInUse && !devInUse,
  }
  if (cdpInUse || devInUse) {
    const busy = []
    if (cdpInUse) busy.push(`CDP ${CDP_PORT}`)
    if (devInUse) busy.push(`dev ${DEV_PORT}`)
    throw new Error(
      `PREFLIGHT_ABORT: port(s) already in use: ${busy.join(', ')}. ` +
        'Refusing to connect to or terminate any existing process.',
    )
  }
}

async function startDevServer() {
  // On Windows, npm is a .cmd shim and must be launched through a shell.
  devProc = spawn(
    'npm',
    ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(DEV_PORT), '--strictPort'],
    { cwd: REPO, stdio: 'ignore', shell: true, detached: false },
  )
  startedDev = true
  for (let i = 0; i < 60; i++) {
    await sleep(500)
    try {
      const res = await fetch(DEV_URL)
      if (res.ok) return
    } catch {
      /* not up yet */
    }
  }
  throw new Error('dev server did not become ready')
}

async function httpCheck() {
  const res = await fetch(DEV_URL)
  const body = await res.text()
  results.http = {
    url: DEV_URL,
    status: res.status,
    ok: res.ok,
    hasRoot: /id="root"/.test(body),
    hasMainTsx: body.includes('/src/main.tsx'),
  }
}

function launchChrome() {
  profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dobe-layout-cdp-'))
  const chrome = resolveChromePath()
  chromeProc = spawn(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--window-size=1440,900',
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${profileDir}`,
      DEV_URL,
    ],
    { stdio: 'ignore', detached: false },
  )
  startedChrome = true
}

async function run() {
  await preflight()
  await startDevServer()
  await httpCheck()

  launchChrome()
  await connectCdp()
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Input.setIgnoreInputEvents', { ignore: false })

  await evaluate("localStorage.removeItem('gang-progression-v1')")
  await send('Page.reload', { ignoreCache: false })
  await sleep(3500)

  const reseeded = await evaluate("localStorage.getItem('gang-progression-v1')")
  const showsLevel1 = await evaluate(
    "(()=>{const el=[...document.querySelectorAll('*')].find(n=>/Lv\\.\\s*1\\b/.test(n.textContent||''));return !!el})()",
  )
  results.storageClearedThenReseededFresh = { rawStorage: reseeded, showsLevel1 }

  results.viewport = JSON.parse(
    await evaluate(
      'JSON.stringify({width:window.innerWidth,height:window.innerHeight,devicePixelRatio:window.devicePixelRatio})',
    ),
  )
  results.window.outer = JSON.parse(
    await evaluate('JSON.stringify({width:window.outerWidth,height:window.outerHeight})'),
  )
  results.hasCanvas = await evaluate("!!document.querySelector('canvas')")

  await screenshot(MAIN_SHOT)
  results.screenshots.main = MAIN_SHOT

  const cx = 720, cy = 470

  {
    const before = await screenshot('layout-leftpan-before.png')
    await mouseDrag('left', cx, cy, 220, 140)
    await sleep(400)
    const after = await screenshot('layout-leftpan-after.png')
    results.gestures.push({
      name: 'left-button-pan',
      before: 'layout-leftpan-before.png',
      after: 'layout-leftpan-after.png',
      ...diffPixels(before, after),
    })
    await mouseDrag('left', cx, cy, -220, -140)
    await sleep(300)
  }

  {
    const before = await screenshot('layout-rightpan-before.png')
    await mouseDrag('right', cx, cy, -200, 120)
    await sleep(400)
    const after = await screenshot('layout-rightpan-after.png')
    results.gestures.push({
      name: 'right-button-pan',
      before: 'layout-rightpan-before.png',
      after: 'layout-rightpan-after.png',
      ...diffPixels(before, after),
    })
    await mouseDrag('right', cx, cy, 200, -120)
    await sleep(300)
  }

  {
    const before = await screenshot('layout-touchpan-before.png')
    await touchDrag(cx, cy, 200, 150)
    await sleep(400)
    const after = await screenshot('layout-touchpan-after.png')
    results.gestures.push({
      name: 'single-finger-touch-pan',
      before: 'layout-touchpan-before.png',
      after: 'layout-touchpan-after.png',
      ...diffPixels(before, after),
    })
    await touchDrag(cx, cy, -200, -150)
    await sleep(300)
  }

  let found = null
  const xs = []
  for (let x = 380; x <= 1060; x += 40) xs.push(x)
  const ys = []
  for (let y = 300; y <= 640; y += 40) ys.push(y)
  outer: for (const y of ys) {
    for (const x of xs) {
      await mouseClick(x, y)
      await sleep(120)
      if (await hasPanel()) {
        found = { x, y }
        await closePanel()
        await sleep(150)
        break outer
      }
    }
  }
  results.clickSuppression.buildingCoordinate = found

  if (found) {
    await mouseClick(found.x, found.y)
    await sleep(250)
    const panelAfterClick = await hasPanel()
    await closePanel()
    await sleep(200)

    await mouseDrag('left', found.x, found.y, 60, 40, 8)
    await sleep(300)
    const panelAfterDrag = await hasPanel()
    if (panelAfterDrag) await closePanel()

    results.clickSuppression.panelAfterClick = panelAfterClick
    results.clickSuppression.panelAfterDrag = panelAfterDrag
  }

  try {
    ws.close()
  } catch {
    /* ignore */
  }
}

async function teardown() {
  // Only kill process trees this script started.
  if (startedChrome) killTree(chromeProc?.pid)
  if (startedDev) killTree(devProc?.pid)
  await sleep(1200)
  const cdpStillInUse = startedChrome ? await isPortInUse(CDP_PORT) : false
  const devStillInUse = startedDev ? await isPortInUse(DEV_PORT) : false
  results.ports = {
    cdpPort: CDP_PORT,
    cdpStartedByScript: startedChrome,
    cdpPortReleased: startedChrome ? !cdpStillInUse : null,
    devPort: DEV_PORT,
    devStartedByScript: startedDev,
    devPortReleased: startedDev ? !devStillInUse : null,
  }
  if (profileDir) {
    try {
      fs.rmSync(profileDir, { recursive: true, force: true })
      results.tempProfileRemoved = true
    } catch {
      results.tempProfileRemoved = false
    }
  }
}

// Always run the pure-data self-test (no processes involved).
results.assertionSelfTest = runAssertionSelfTest()

let runError = null
try {
  await run()
} catch (e) {
  runError = e
  results.error = String(e && e.stack ? e.stack : e)
} finally {
  await teardown()
}

// Assert every live result item (only meaningful if the run reached the browser
// phase; a preflight abort is a hard failure on its own).
let assertionFailures = []
if (!runError) {
  results.assertions = evaluateAssertions(results)
  assertionFailures = results.assertions.filter((c) => !c.pass)
}

fs.writeFileSync(OUT_JSON, JSON.stringify(results, null, 2))
console.log('WROTE ' + OUT_JSON)

if (!results.assertionSelfTest.ok) {
  console.error('ASSERTION SELF-TEST FAILED:', JSON.stringify(results.assertionSelfTest))
}
if (runError) {
  console.error('RUN ERROR:', results.error)
}
if (assertionFailures.length) {
  console.error('FAILED ASSERTIONS:')
  for (const c of assertionFailures) console.error(`  - ${c.name} (${c.detail})`)
}

const ok = !runError && !assertionFailures.length && results.assertionSelfTest.ok
if (ok) {
  console.log('ALL ASSERTIONS PASSED')
  console.log(JSON.stringify(results, null, 2))
  process.exitCode = 0
} else {
  process.exitCode = 1
}
