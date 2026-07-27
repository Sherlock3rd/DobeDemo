import { buildingCatalogById } from './buildingCatalog'
import { CHAPTERS } from './chapterProgression'
import type { BuildingId } from './cityTypes'
import {
  getGangCoreSeat,
  roleForCoreSeat,
  type GangCoreSeat,
} from './gangHierarchy'
import { getGangRole } from './gangProgression'
import { getBuildingUnlock } from './progressionUnlocks'

export type NarrativeEventId =
  | 'first-entry'
  | `chapter-start:${number}`
  | `chapter-end:${number}`
  | `building-claimed:${BuildingId}`
  | `promotion:${number}`

export interface NarrativeLine {
  speaker: string
  speakerRole: string
  portraitIndex: number
  text: string
}

export interface NarrativeEvent {
  id: NarrativeEventId
  kicker: string
  title: string
  lines: readonly NarrativeLine[]
}

const CHAPTER_OPENING_LINES: Readonly<Record<number, readonly string[]>> = {
  1: [
    '城南那间修车厂空了很久，但机器骨架还在。你需要一块真正属于自己的落脚点。',
    '先摘下门上的锁，接管修车厂；之后把车、人和街口一件件收回来。',
  ],
  2: [
    '现在你不再只是替人跑腿。废铁、零件和车队都能变成我们扩张的筹码。',
    '接管废车回收厂，让每一辆报废车都继续为剃刀党挣钱。',
  ],
  3: [
    '车库有了规模，下一步是把商业街的现金流攥在手里。',
    '强化你的主力和装备，再把那条街变成我们的补给线。',
  ],
  4: [
    '账本显示，城里的金属生意正被人卡住。没有稳定材料，车队走不远。',
    '接管金属加工厂，用更硬的装备打开下一片地盘。',
  ],
  5: [
    '道路已经向外延伸，燃油和路线决定谁能最后抵达。',
    '拿下加油站，带车队赢下更长的比赛，把运输线接到城外。',
  ],
  6: [
    '生意、车队和火力都已成形，但帮派还缺一处真正的核心据点。',
    '准备接管 Clubhouse；在那之前，把所有旧账清干净。',
  ],
  7: [
    '你已经站在最高席位门前。剩下的不是证明自己，而是让整座城市服从。',
    '完成最后的战役与车队行动，带着所有核心席位走进会所。',
  ],
}

const CHAPTER_END_LINES: Readonly<Record<number, readonly string[]>> = {
  1: [
    '修车厂重新冒烟，街口也认得我们的车了。你已经完成见习该做的一切。',
    '去帮派权力树，Maeve 手里的正式成员席位正在等你接掌。',
  ],
  2: [
    '废车场开始吐出零件，帮派不必再向别人低头买装备。',
    '去权力树见 Arthur；技术骨干的位置只交给能让机器运转的人。',
  ],
  3: [
    '商业街的账目已经归拢，现金和消息都会先经过我们。',
    'Polly 会在权力树等你，下一步是接管酒吧联络人的网络。',
  ],
  4: [
    '金属厂的炉火属于我们了，车与枪都能在自己的地盘完成强化。',
    '去见 Charlie，接过路线队长的席位，把力量送到更远的地方。',
  ],
  5: [
    '燃油线和车队路线已经打通，城里再没有人能轻易截断我们的运输。',
    'Michael 会交出副主席的权限；去权力树接下整片生意。',
  ],
  6: [
    'Clubhouse 的门已经打开，所有核心生意都在同一张桌上。',
    'Winston 正等着最后一次交接。去权力树，拿下主席席位。',
  ],
  7: [
    '最后一条街已经安静，所有账本、车队与工厂都听从同一个名字。',
    '剃刀党已经属于你；接下来要守住的，是整座城市的秩序。',
  ],
}

const BUILDING_LINES: Readonly<Record<BuildingId, readonly [string, string]>> =
  {
    'repair-shop': [
      '钥匙已经换了主人。从今晚起，这间修车厂只为剃刀党的车开门。',
      '先修好第一条工位并提升主建筑，车队需要一个能持续运转的总部。',
    ],
    'recycling-yard': [
      '场里的废车、吊机和看守都已经接受新规矩。',
      '让回收线开始生产配件；留下好货，其余拆成零件继续强化装备。',
    ],
    'commercial-street': [
      '商户已经在新账本上签字，这条街的现金和消息都会流向我们。',
      '升级店面与主街，稳定收入后再把人手投向更远的战线。',
    ],
    'metalworking-plant': [
      '炉火、冲床和仓库现在归帮派调度，没人再能截住我们的材料。',
      '扩建生产线，为车辆配件和枪械强化准备足够的物资。',
    ],
    'gas-station': [
      '油罐和泵岛已经插上我们的旗，车队终于有了自己的补给节点。',
      '提高站点等级，支撑更长的竞速路线和更危险的追击任务。',
    ],
    clubhouse: [
      '会所的大门已经向你的核心成员打开，所有生意会在这里汇总。',
      '完成最后的扩建，把这地方变成剃刀党真正的权力中心。',
    ],
  }

function linesForSeat(
  seat: GangCoreSeat,
  texts: readonly string[],
): NarrativeLine[] {
  const role = roleForCoreSeat(seat)
  return texts.map((text) => ({
    speaker: seat.holder,
    speakerRole: `${role.chineseTitle} · ${seat.seatDescription}`,
    portraitIndex: seat.portraitIndex,
    text,
  }))
}

function readNumberSuffix(id: string, prefix: string): number | null {
  if (!id.startsWith(prefix)) return null
  const value = Number(id.slice(prefix.length))
  return Number.isInteger(value) ? value : null
}

export function getNarrativeEvent(id: string): NarrativeEvent | null {
  if (id === 'first-entry') {
    return {
      id,
      kicker: 'WELCOME TO THE RAZORS',
      title: '第一把钥匙',
      lines: [
        {
          speaker: 'Eddie “Pins” Doyle',
          speakerRole: '前任见习 · 货场领路人',
          portraitIndex: 1,
          text: 'Thomas，这座城不缺野心家，缺的是能让一群人照同一套规矩办事的人。',
        },
        {
          speaker: 'Eddie “Pins” Doyle',
          speakerRole: '前任见习 · 货场领路人',
          portraitIndex: 1,
          text: '修车、挣钱、赢下街口，再沿着帮派权力树接掌更高的席位——这就是你往上走的路。',
        },
        {
          speaker: 'Eddie “Pins” Doyle',
          speakerRole: '前任见习 · 货场领路人',
          portraitIndex: 1,
          text: '先看地图上的金色接管标记。拿下修车厂，我们才算真正有了第一块地盘。',
        },
      ],
    }
  }

  const chapterStart = readNumberSuffix(id, 'chapter-start:')
  if (chapterStart !== null) {
    const chapter = CHAPTERS.find(
      (candidate) => candidate.number === chapterStart,
    )
    const texts = CHAPTER_OPENING_LINES[chapterStart]
    if (!chapter || !texts) return null
    const seat = getGangCoreSeat(chapter.role.threshold)
    return {
      id: `chapter-start:${chapterStart}`,
      kicker: `CHAPTER ${chapterStart} · BRIEFING`,
      title: chapter.title,
      lines: linesForSeat(seat, texts),
    }
  }

  const chapterEnd = readNumberSuffix(id, 'chapter-end:')
  if (chapterEnd !== null) {
    const chapter = CHAPTERS.find(
      (candidate) => candidate.number === chapterEnd,
    )
    const texts = CHAPTER_END_LINES[chapterEnd]
    if (!chapter || !texts) return null
    const seat = getGangCoreSeat(chapter.role.threshold)
    return {
      id: `chapter-end:${chapterEnd}`,
      kicker: `CHAPTER ${chapterEnd} · COMPLETE`,
      title: `${chapter.title} · 收尾`,
      lines: linesForSeat(seat, texts),
    }
  }

  if (id.startsWith('building-claimed:')) {
    const buildingId = id.slice('building-claimed:'.length) as BuildingId
    const texts = BUILDING_LINES[buildingId]
    const unlock = getBuildingUnlock(buildingId)
    if (!texts || !unlock) return null
    const seat = getGangCoreSeat(unlock.requiredLevel)
    return {
      id: `building-claimed:${buildingId}`,
      kicker: 'TERRITORY REPORT',
      title: `${buildingCatalogById[buildingId].name}已接管`,
      lines: linesForSeat(seat, texts),
    }
  }

  const promotionLevel = readNumberSuffix(id, 'promotion:')
  if (promotionLevel !== null) {
    try {
      const seat = getGangCoreSeat(promotionLevel)
      const role = getGangRole(promotionLevel)
      return {
        id: `promotion:${promotionLevel}`,
        kicker: 'NEW CHAIN OF COMMAND',
        title: `${role.chineseTitle}席位交接`,
        lines: linesForSeat(seat, [
          `这把钥匙和这张名单现在归你。${seat.holder} 从此进入你的直属管辖。`,
          `先听完下一章的安排，再决定把人手、车辆和资源投到哪里。`,
        ]),
      }
    } catch {
      return null
    }
  }

  return null
}

export function isNarrativeEventId(value: unknown): value is NarrativeEventId {
  return typeof value === 'string' && getNarrativeEvent(value) !== null
}
