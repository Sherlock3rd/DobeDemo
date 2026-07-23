// Repeatable HTTP + Chrome/CDP acceptance for the fragmented 1–10 building-upgrade epic.
//
// SAFETY MODEL (important):
//   - Preflight requires BOTH the dev port (5188) and the CDP port (9234) to be
//     FREE. If either is already in use, the script throws and exits 1 WITHOUT
//     connecting to or terminating any existing process. It only ever starts its
//     own dev server + headless Chrome and only kills the process trees it started.
//   - The throwaway Chrome profile is created under the OS temp dir (os.tmpdir),
//     so the script contains no hard-coded user-specific sensitive path.
//   - On any failure it prints exactly which assertion failed and exits non-zero.
//
// FLOW:
//   1. Preflight: assert 5188 and 9234 are free (record preflight in JSON).
//   2. Verify the production build's dist/index.html references the `/DobeDemo/` base.
//   3. Start dev server on 5188 (--strictPort); wait for HTTP 200.
//   4. HTTP body checks: status 200, `#root`, `/src/main.tsx`.
//   5. Launch headless Chrome (1440x900) on 9234 with a temp profile.
//   6. Clear city + gang storage, reload; find + click 修车厂; assert Lv.1/10, 0/2,
//      named progressbar, 2 cells; screenshot Lv.1.
//   7. Complete first fragment; assert 1/2 and that the 3D canvas (excluding HUD +
//      panel) visibly changed; screenshot the partial state.
//   8. Reload; re-open 修车厂; assert progress persisted at 1/2.
//   9. Complete second fragment; assert ready-to-confirm and that main level is
//      still 1; confirm; assert Lv.2/10 and 0/3.
//  10. Inject a valid Lv.10 save; reload; re-open 修车厂; assert maxed UI, 10 cells,
//      disabled button; screenshot Lv.10.
//  11. Panel boundary / overflow at desktop 1440x900 and mobile 390x844.
//  12. finally: tear down only what we started; verify port release + profile cleanup.
//  13. Assert every result item; a pure-data negative self-test also runs every time.
//
// Config via env: DEV_PORT, DEV_URL, CDP_PORT, CHROME_PATH.
// Run: node .superpowers/sdd/fragmented-upgrades-cdp.mjs

import zlib from 'node:zlib'
import fs from 'node:fs'
import os from 'node:os'
import net from 'node:net'
import path from 'node:path'
import { spawn, execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '..', '..')
const DEV_PORT = Number(process.env.DEV_PORT || 5188)
const DEV_URL = process.env.DEV_URL || `http://127.0.0.1:${DEV_PORT}/`
const CDP_PORT = Number(process.env.CDP_PORT || 9234)
const OUT_JSON = path.join(HERE, 'fragmented-upgrades-results.json')
const DIST_INDEX = path.join(REPO, 'dist', 'index.html')

const CITY_KEY = 'dobe-city-progression-v1'
const GANG_KEY = 'gang-progression-v1'
// Minimum number of changed pixels inside the building ROI that proves the 3D
// model actually re-rendered after completing a fragment.
const CANVAS_MIN_CHANGED = 40
// Half-extents of the region-of-interest box centred on the 修车厂 screen
// coordinate. Isometric buildings grow up-and-left, so the box reaches a bit
// further above/left of the click point than below/right.
const ROI_LEFT = 200
const ROI_RIGHT = 150
const ROI_UP = 220
const ROI_DOWN = 130

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---------- port / process helpers ----------
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

// Counts changed pixels between two PNGs, restricted to an optional region of
// interest (`roi`, clipped to the image) and ignoring any pixel inside one of
// the `excludes` rectangles. The ROI is used to measure only the small screen
// area around the building, so unrelated environment does not count; `excludes`
// still masks the live HUD / panel in case they clip the ROI.
function diffPixels(a, b, { roi = null, excludes = [], tol = 18 } = {}) {
  const A = decodePng(a)
  const B = decodePng(b)
  if (A.width !== B.width || A.height !== B.height) {
    return { changedPixels: -1, consideredPixels: 0, totalPixels: 0, changedPct: 100 }
  }
  const rx0 = roi ? Math.max(0, Math.floor(roi.x)) : 0
  const ry0 = roi ? Math.max(0, Math.floor(roi.y)) : 0
  const rx1 = roi ? Math.min(A.width, Math.ceil(roi.x + roi.w)) : A.width
  const ry1 = roi ? Math.min(A.height, Math.ceil(roi.y + roi.h)) : A.height
  const inExcluded = (x, y) =>
    excludes.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)
  const ca = A.channels, cb = B.channels
  let changed = 0
  let considered = 0
  for (let y = ry0; y < ry1; y++) {
    for (let x = rx0; x < rx1; x++) {
      if (inExcluded(x, y)) continue
      considered++
      const i = y * A.width + x
      const ai = i * ca, bi = i * cb
      if (
        Math.abs(A.data[ai] - B.data[bi]) > tol ||
        Math.abs(A.data[ai + 1] - B.data[bi + 1]) > tol ||
        Math.abs(A.data[ai + 2] - B.data[bi + 2]) > tol
      ) {
        changed++
      }
    }
  }
  return {
    changedPixels: changed,
    consideredPixels: considered,
    roiClipped: { x: rx0, y: ry0, w: rx1 - rx0, h: ry1 - ry0 },
    imageSize: { width: A.width, height: A.height },
    totalPixels: A.width * A.height,
    changedPct: +((changed / Math.max(1, considered)) * 100).toFixed(3),
  }
}

// ---------- input ----------
async function mouseClick(x, y) {
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1,
  })
  await sleep(30)
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased', x, y, button: 'left', buttons: 1, clickCount: 1,
  })
}

// ---------- DOM readers ----------
const PANEL_STATE_EXPR = `(() => {
  const p = document.querySelector('.building-panel')
  if (!p) return JSON.stringify({ present: false })
  const q = (s) => p.querySelector(s)
  const t = q('.building-panel__title')
  const lvl = q('.building-panel__level')
  const count = q('.building-panel__progress-count')
  const goal = q('.building-panel__goal')
  const bar = q('[role=progressbar]')
  const cells = p.querySelectorAll('.building-panel__fragment')
  const confirm = q('.building-panel__confirm')
  const facilityName = q('.building-panel__facility-name')
  const confirmBtn = q('.building-panel__upgrade--confirm')
  const upgrade = confirmBtn || q('.building-panel__upgrade')
  return JSON.stringify({
    present: true,
    locked: !!q('.building-panel__lock-status'),
    title: t ? t.textContent : null,
    level: lvl ? lvl.textContent : null,
    progressCount: count ? count.textContent : null,
    goal: goal ? goal.textContent : null,
    hasProgressbar: !!bar,
    progressbarName: bar ? bar.getAttribute('aria-label') : null,
    valuemax: bar ? bar.getAttribute('aria-valuemax') : null,
    valuenow: bar ? bar.getAttribute('aria-valuenow') : null,
    cellCount: cells.length,
    ready: !!confirm,
    facilityName: facilityName ? facilityName.textContent : null,
    upgradeLabel: upgrade ? (upgrade.getAttribute('aria-label') || upgrade.textContent) : null,
    upgradeDisabled: upgrade ? !!upgrade.disabled : null,
  })
})()`

const rectExpr = (sel, pad = 4) => `(() => {
  const el = document.querySelector(${JSON.stringify(sel)})
  if (!el) return null
  const r = el.getBoundingClientRect()
  return JSON.stringify({
    x: Math.floor(r.left) - ${pad},
    y: Math.floor(r.top) - ${pad},
    w: Math.ceil(r.width) + ${pad * 2},
    h: Math.ceil(r.height) + ${pad * 2},
  })
})()`

const VIEWPORT_MEASURE_EXPR = `(() => {
  const p = document.querySelector('.building-panel')
  const de = document.documentElement
  if (!p) return JSON.stringify({ panelPresent: false })
  const r = p.getBoundingClientRect()
  const iw = window.innerWidth, ih = window.innerHeight
  const cs = getComputedStyle(p)
  const withinBounds = r.left >= -1 && r.top >= -1 && r.right <= iw + 1 && r.bottom <= ih + 1
  const noHorizontalOverflow = p.scrollWidth <= p.clientWidth + 1 && de.scrollWidth <= iw + 1
  const scrollableOrFits =
    p.scrollHeight <= p.clientHeight + 1 || cs.overflowY === 'auto' || cs.overflowY === 'scroll'
  return JSON.stringify({
    panelPresent: true, iw, ih,
    rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height },
    scrollWidth: p.scrollWidth, clientWidth: p.clientWidth,
    scrollHeight: p.scrollHeight, clientHeight: p.clientHeight,
    deScrollWidth: de.scrollWidth, overflowY: cs.overflowY,
    withinBounds, noHorizontalOverflow, scrollableOrFits,
  })
})()`

async function readPanel() {
  return JSON.parse(await evaluate(PANEL_STATE_EXPR))
}

async function closePanel() {
  await evaluate("document.querySelector('.building-panel__close')?.click()")
  await sleep(150)
}

async function clickSelector(sel) {
  const rectJson = await evaluate(
    `(() => { const el=document.querySelector(${JSON.stringify(sel)}); if(!el) return null; const r=el.getBoundingClientRect(); return JSON.stringify({x:r.left+r.width/2,y:r.top+r.height/2}); })()`,
  )
  if (!rectJson) return false
  const r = JSON.parse(rectJson)
  await mouseClick(Math.round(r.x), Math.round(r.y))
  return true
}

// Real CDP clicks on the 3D scene until the unlocked 修车厂 panel opens; leaves
// it open. Reuses a preferred coordinate first so reloads are cheap.
async function findRepairShop(grid, prefer) {
  const tryAt = async (x, y) => {
    await mouseClick(x, y)
    await sleep(170)
    const s = await readPanel()
    if (s.present && s.title && s.title.includes('修车厂') && !s.locked) {
      return { x, y, state: s }
    }
    if (s.present) await closePanel()
    return null
  }
  if (prefer) {
    const hit = await tryAt(prefer.x, prefer.y)
    if (hit) return hit
  }
  for (let y = grid.y0; y <= grid.y1; y += grid.step) {
    for (let x = grid.x0; x <= grid.x1; x += grid.step) {
      const hit = await tryAt(x, y)
      if (hit) return hit
    }
  }
  throw new Error('repair-shop (修车厂) not found via click scan')
}

async function excludeRects() {
  const rects = []
  for (const sel of ['.city-hud', '.building-panel']) {
    const j = await evaluate(rectExpr(sel))
    if (j) rects.push(JSON.parse(j))
  }
  return rects
}

// ---------- assertions (pure, testable) ----------
function evaluateAssertions(r) {
  const checks = []
  const add = (name, pass, detail) =>
    checks.push({ name, pass: !!pass, detail: detail === undefined ? '' : String(detail) })

  add('preflight.ok', r.preflight?.ok === true, `ok=${r.preflight?.ok}`)
  add('http.status===200', r.http?.status === 200, `status=${r.http?.status}`)
  add('http.hasRoot', r.http?.hasRoot === true, `hasRoot=${r.http?.hasRoot}`)
  add('http.hasMainTsx', r.http?.hasMainTsx === true, `hasMainTsx=${r.http?.hasMainTsx}`)
  add('dist base /DobeDemo/', r.distBaseOk === true, `distBaseOk=${r.distBaseOk}`)

  add('lv1.title 修车厂', !!r.lv1?.title && r.lv1.title.includes('修车厂'), `title=${r.lv1?.title}`)
  add('lv1.level 等级 1 / 10', r.lv1?.level === '等级 1 / 10', `level=${r.lv1?.level}`)
  add('lv1.progress 0 / 2', r.lv1?.progressCount === '0 / 2 个子建筑', `count=${r.lv1?.progressCount}`)
  add(
    'lv1.progressbar named',
    r.lv1?.hasProgressbar === true && r.lv1?.progressbarName === '修车厂升级进度',
    `name=${r.lv1?.progressbarName}`,
  )
  add('lv1.valuemax 2', r.lv1?.valuemax === '2', `valuemax=${r.lv1?.valuemax}`)
  add('lv1.two cells', r.lv1?.cellCount === 2, `cellCount=${r.lv1?.cellCount}`)

  add(
    'first fragment 1 / 2',
    r.firstFragment?.progressCount === '1 / 2 个子建筑',
    `count=${r.firstFragment?.progressCount}`,
  )
  add(
    `ROI canvas changed >= ${CANVAS_MIN_CHANGED}`,
    typeof r.firstFragment?.canvas?.changedPixels === 'number' &&
      r.firstFragment.canvas.changedPixels >= CANVAS_MIN_CHANGED,
    `changed=${r.firstFragment?.canvas?.changedPixels}/${r.firstFragment?.canvas?.consideredPixels} (${r.firstFragment?.canvas?.changedPct}%) roi=${JSON.stringify(r.firstFragment?.canvas?.roiClipped)}`,
  )

  add(
    'refresh persists 1 / 2',
    r.afterRefresh?.progressCount === '1 / 2 个子建筑',
    `count=${r.afterRefresh?.progressCount}`,
  )

  add('ready to confirm', r.ready?.ready === true, `ready=${r.ready?.ready}`)
  add('ready level still 1', r.ready?.level === '等级 1 / 10', `level=${r.ready?.level}`)

  add('confirm -> level 2', r.afterConfirm?.level === '等级 2 / 10', `level=${r.afterConfirm?.level}`)
  add(
    'confirm -> 0 / 3',
    r.afterConfirm?.progressCount === '0 / 3 个子建筑',
    `count=${r.afterConfirm?.progressCount}`,
  )

  add('lv10.level 10 / 10', r.lv10?.level === '等级 10 / 10', `level=${r.lv10?.level}`)
  add('lv10.ten cells', r.lv10?.cellCount === 10, `cellCount=${r.lv10?.cellCount}`)
  add('lv10.button disabled', r.lv10?.upgradeDisabled === true, `disabled=${r.lv10?.upgradeDisabled}`)
  add(
    'lv10.maxed label',
    typeof r.lv10?.upgradeLabel === 'string' && r.lv10.upgradeLabel.includes('已满级'),
    `label=${r.lv10?.upgradeLabel}`,
  )

  add(
    'desktop within bounds',
    r.viewport?.desktop?.withinBounds === true,
    `withinBounds=${r.viewport?.desktop?.withinBounds}`,
  )
  add(
    'desktop no h-overflow',
    r.viewport?.desktop?.noHorizontalOverflow === true,
    `noHOverflow=${r.viewport?.desktop?.noHorizontalOverflow}`,
  )
  add(
    'mobile within bounds',
    r.viewport?.mobile?.withinBounds === true,
    `withinBounds=${r.viewport?.mobile?.withinBounds}`,
  )
  add(
    'mobile no h-overflow',
    r.viewport?.mobile?.noHorizontalOverflow === true,
    `noHOverflow=${r.viewport?.mobile?.noHorizontalOverflow}`,
  )
  add(
    'mobile scrollable/fits',
    r.viewport?.mobile?.scrollableOrFits === true,
    `scrollableOrFits=${r.viewport?.mobile?.scrollableOrFits}`,
  )

  add('cdpPortReleased', r.ports?.cdpPortReleased === true, `cdpPortReleased=${r.ports?.cdpPortReleased}`)
  add('devPortReleased', r.ports?.devPortReleased === true, `devPortReleased=${r.ports?.devPortReleased}`)
  add('tempProfileRemoved', r.tempProfileRemoved === true, `tempProfileRemoved=${r.tempProfileRemoved}`)
  return checks
}

// Pure-data negative self-test: bad data should fail every check; good data
// should pass every check. No processes touched.
function runAssertionSelfTest() {
  const good = {
    preflight: { ok: true },
    http: { status: 200, hasRoot: true, hasMainTsx: true },
    distBaseOk: true,
    lv1: {
      title: '修车厂',
      level: '等级 1 / 10',
      progressCount: '0 / 2 个子建筑',
      hasProgressbar: true,
      progressbarName: '修车厂升级进度',
      valuemax: '2',
      cellCount: 2,
    },
    firstFragment: { progressCount: '1 / 2 个子建筑', canvas: { changedPixels: 5000 } },
    afterRefresh: { progressCount: '1 / 2 个子建筑' },
    ready: { ready: true, level: '等级 1 / 10' },
    afterConfirm: { level: '等级 2 / 10', progressCount: '0 / 3 个子建筑' },
    lv10: { level: '等级 10 / 10', cellCount: 10, upgradeDisabled: true, upgradeLabel: '已满级 · 10 个子建筑' },
    viewport: {
      desktop: { withinBounds: true, noHorizontalOverflow: true },
      mobile: { withinBounds: true, noHorizontalOverflow: true, scrollableOrFits: true },
    },
    ports: { cdpPortReleased: true, devPortReleased: true },
    tempProfileRemoved: true,
  }
  const bad = {
    preflight: { ok: false },
    http: { status: 500, hasRoot: false, hasMainTsx: false },
    distBaseOk: false,
    lv1: {
      title: '加油站',
      level: '等级 2 / 10',
      progressCount: '1 / 2 个子建筑',
      hasProgressbar: false,
      progressbarName: '错误',
      valuemax: '3',
      cellCount: 3,
    },
    firstFragment: { progressCount: '0 / 2 个子建筑', canvas: { changedPixels: 0 } },
    afterRefresh: { progressCount: '0 / 2 个子建筑' },
    ready: { ready: false, level: '等级 2 / 10' },
    afterConfirm: { level: '等级 1 / 10', progressCount: '1 / 3 个子建筑' },
    lv10: { level: '等级 9 / 10', cellCount: 9, upgradeDisabled: false, upgradeLabel: '升级子建筑 1/10' },
    viewport: {
      desktop: { withinBounds: false, noHorizontalOverflow: false },
      mobile: { withinBounds: false, noHorizontalOverflow: false, scrollableOrFits: false },
    },
    ports: { cdpPortReleased: false, devPortReleased: false },
    tempProfileRemoved: false,
  }
  const goodFailures = evaluateAssertions(good).filter((c) => !c.pass)
  const badChecks = evaluateAssertions(bad)
  const badFailures = badChecks.filter((c) => !c.pass)
  return {
    ok: goodFailures.length === 0 && badFailures.length === badChecks.length,
    totalChecks: badChecks.length,
    failuresOnGoodData: goodFailures.map((c) => c.name),
    passesOnBadData: badChecks.filter((c) => c.pass).map((c) => c.name),
  }
}

// ---------- main ----------
const results = {
  generatedAt: new Date().toISOString(),
  devUrl: DEV_URL,
  cdpPort: CDP_PORT,
  distIndex: 'dist/index.html',
  preflight: {},
  distBaseOk: null,
  http: {},
  storageCleared: null,
  repairShopCoordinate: null,
  lv1: {},
  firstFragment: {},
  afterRefresh: {},
  ready: {},
  afterConfirm: {},
  lv10Save: null,
  lv10: {},
  viewport: { desktop: {}, mobile: {} },
  screenshots: {},
  ports: {},
  tempProfileRemoved: null,
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

function checkDistBase() {
  if (!fs.existsSync(DIST_INDEX)) {
    results.distBaseOk = false
    results.distBaseDetail = 'dist/index.html missing; run `npm run build` first'
    return
  }
  const html = fs.readFileSync(DIST_INDEX, 'utf8')
  const scripts = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1])
  const assetRefs = scripts.filter((s) => s.includes('/assets/'))
  const allUnderBase = assetRefs.length > 0 && assetRefs.every((s) => s.startsWith('/DobeDemo/'))
  results.distBaseOk = allUnderBase
  results.distBaseDetail = { assetRefs }
}

async function startDevServer() {
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

function launchChrome(width = 1440, height = 900) {
  profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dobe-fragmented-cdp-'))
  const chrome = resolveChromePath()
  chromeProc = spawn(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      `--window-size=${width},${height}`,
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${profileDir}`,
      DEV_URL,
    ],
    { stdio: 'ignore', detached: false },
  )
  startedChrome = true
}

// Polls until the CDP page is actually on the dev origin with a rendered scene.
// Guards against the initial about:blank document whose opaque origin throws a
// SecurityError on any localStorage access.
async function waitForApp() {
  for (let i = 0; i < 80; i++) {
    try {
      const info = await evaluate(
        "JSON.stringify({href:location.href, ready:document.readyState, hasCanvas:!!document.querySelector('canvas')})",
      )
      const s = JSON.parse(info)
      if (s.href && s.href.startsWith('http') && s.ready === 'complete') return s
    } catch {
      /* about:blank opaque origin -> retry */
    }
    await sleep(250)
  }
  throw new Error('app did not become ready in CDP page')
}

async function reloadAndWait() {
  await send('Page.reload', { ignoreCache: false })
  await waitForApp()
  await sleep(1800) // let the 3D canvas finish its first frames
}

async function clearStorageAndReload() {
  await evaluate(
    `localStorage.removeItem(${JSON.stringify(CITY_KEY)});localStorage.removeItem(${JSON.stringify(GANG_KEY)});localStorage.clear();`,
  )
  await reloadAndWait()
}

const DESKTOP_GRID = { x0: 320, x1: 1120, y0: 280, y1: 700, step: 45 }

async function run() {
  await preflight()
  checkDistBase()
  await startDevServer()
  await httpCheck()

  launchChrome(1440, 900)
  await connectCdp()
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Input.setIgnoreInputEvents', { ignore: false })

  // Ensure we are on the dev origin (not the initial about:blank) before any
  // localStorage access.
  await send('Page.navigate', { url: DEV_URL })
  await waitForApp()
  await sleep(1200)

  // ---- fresh storage ----
  await clearStorageAndReload()
  results.storageCleared = {
    city: await evaluate(`localStorage.getItem(${JSON.stringify(CITY_KEY)})`),
    gang: await evaluate(`localStorage.getItem(${JSON.stringify(GANG_KEY)})`),
  }

  // ---- Lv.1 open 修车厂 ----
  const found = await findRepairShop(DESKTOP_GRID)
  results.repairShopCoordinate = { x: found.x, y: found.y }
  results.lv1 = found.state
  await screenshot('fragmented-upgrades-lv1.png')
  results.screenshots.lv1 = 'fragmented-upgrades-lv1.png'

  // ---- first fragment: assert 1/2 + canvas changed inside the building ROI ----
  // ROI is derived from the real 修车厂 click coordinate and clipped to the
  // viewport, so only the area around the building is measured; the HUD/panel
  // are additionally masked in case they clip the box.
  const masks = await excludeRects()
  const roi = {
    x: found.x - ROI_LEFT,
    y: found.y - ROI_UP,
    w: ROI_LEFT + ROI_RIGHT,
    h: ROI_UP + ROI_DOWN,
  }
  const beforeShot = await screenshot('fragmented-upgrades-canvas-before.png')
  await clickSelector('.building-panel__upgrade')
  await sleep(900) // 400ms entrance + settle
  const afterFirst = await readPanel()
  const afterShot = await screenshot('fragmented-upgrades-partial.png')
  results.screenshots.partial = 'fragmented-upgrades-partial.png'
  results.firstFragment = {
    progressCount: afterFirst.progressCount,
    valuenow: afterFirst.valuenow,
    roiRequested: roi,
    canvas: diffPixels(beforeShot, afterShot, { roi, excludes: masks }),
    canvasMasks: masks,
  }

  // ---- refresh persists 1/2 ----
  await reloadAndWait()
  const reopened = await findRepairShop(DESKTOP_GRID, results.repairShopCoordinate)
  results.afterRefresh = { progressCount: reopened.state.progressCount, level: reopened.state.level }

  // ---- second fragment -> ready (level still 1) -> confirm -> Lv.2 0/3 ----
  await clickSelector('.building-panel__upgrade')
  await sleep(900)
  const readyState = await readPanel()
  results.ready = { ready: readyState.ready, level: readyState.level, progressCount: readyState.progressCount }

  await clickSelector('.building-panel__upgrade--confirm')
  await sleep(700)
  const confirmed = await readPanel()
  results.afterConfirm = { level: confirmed.level, progressCount: confirmed.progressCount, cellCount: confirmed.cellCount }

  // ---- inject a valid Lv.10 save -> maxed UI ----
  const lv10Save = {
    state: {
      buildingProgress: {
        'repair-shop': { level: 10, completedFragments: 0 },
        'recycling-yard': { level: 1, completedFragments: 0 },
        'commercial-street': { level: 1, completedFragments: 0 },
        'metalworking-plant': { level: 1, completedFragments: 0 },
        'gas-station': { level: 1, completedFragments: 0 },
        clubhouse: { level: 1, completedFragments: 0 },
      },
    },
    version: 1,
  }
  results.lv10Save = lv10Save
  await evaluate(
    `localStorage.setItem(${JSON.stringify(CITY_KEY)}, ${JSON.stringify(JSON.stringify(lv10Save))})`,
  )
  await reloadAndWait()
  const maxed = await findRepairShop(DESKTOP_GRID, results.repairShopCoordinate)
  results.lv10 = maxed.state
  await screenshot('fragmented-upgrades-lv10.png')
  results.screenshots.lv10 = 'fragmented-upgrades-lv10.png'

  // ---- desktop viewport boundary/overflow (panel open on Lv.10) ----
  results.viewport.desktop = JSON.parse(await evaluate(VIEWPORT_MEASURE_EXPR))

  // ---- mobile 390x844 ----
  // Reflow the already-open Lv.10 panel to the mobile bottom-drawer layout via a
  // metrics override (no reload) so the responsive boundary is measured on the
  // exact same open panel; CSS media queries react to the new viewport instantly.
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 1, mobile: true,
  })
  await sleep(700)
  const mobilePanel = await readPanel()
  results.viewport.mobilePanel = {
    present: mobilePanel.present,
    title: mobilePanel.title,
    level: mobilePanel.level,
    cellCount: mobilePanel.cellCount,
  }
  await screenshot('fragmented-upgrades-mobile.png')
  results.screenshots.mobile = 'fragmented-upgrades-mobile.png'
  results.viewport.mobile = JSON.parse(await evaluate(VIEWPORT_MEASURE_EXPR))
  await send('Emulation.clearDeviceMetricsOverride')

  try {
    ws.close()
  } catch {
    /* ignore */
  }
}

async function teardown() {
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
  console.log(JSON.stringify(results.assertions, null, 2))
  process.exitCode = 0
} else {
  process.exitCode = 1
}
