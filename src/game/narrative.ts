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
    '城南修车厂一直是剃刀党的产业，只是闲置太久。见习席位能让你先负责这里。',
    '完成修车厂管理权交接，把工位重新点亮；你的职位越高，能调度的帮派产业就越多。',
  ],
  2: [
    '晋升正式成员后，你不再只是替人跑腿，帮派会把废车回收厂交由你负责。',
    '接过管理权，让每一辆报废车都继续为剃刀党产出零件和收益。',
  ],
  3: [
    '车库有了规模，技术骨干还要负责商业街的现金流和日常调度。',
    '强化主力和装备，再接过商业街管理权，让这条既有产业线更有效率。',
  ],
  4: [
    '金属加工厂一直由更高席位调度。如今酒吧联络人可以协调它的订单和材料。',
    '完成管理权交接，用稳定产能强化车辆与枪械，为下一次晋升做好准备。',
  ],
  5: [
    '路线队长有权调度帮派的道路、燃油和车队，这些资源决定谁能最后抵达。',
    '接过加油站管理权，带车队赢下更长的比赛，把运输线安排到城外。',
  ],
  6: [
    '生意、车队和火力都已成形，副主席需要把它们汇总到帮派会所统一管理。',
    '准备接过 Clubhouse 的管理权限；在那之前，把各条线的旧账清干净。',
  ],
  7: [
    '你已经站在最高席位门前。城市一直属于剃刀党，现在要证明你能统筹它在城里的全部产业。',
    '完成最后的战役与车队行动，让所有核心席位在你的指挥下高效运转。',
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
    '金属厂已经在你的调度下恢复炉火，车与枪都能在帮派产业内完成强化。',
    '去见 Charlie，接过路线队长的席位，把力量送到更远的地方。',
  ],
  5: [
    '燃油线和车队路线已经打通，城里再没有人能轻易截断我们的运输。',
    'Michael 会交出副主席的权限；去权力树接下整片生意。',
  ],
  6: [
    'Clubhouse 的门已经打开，所有核心生意都在同一张桌上。',
    'Winston 正等着最后一次交接。去权力树，接掌主席席位。',
  ],
  7: [
    '所有账本、车队与工厂都已经纳入同一套帮派管理体系。',
    '你已坐上主席席位；城市仍属于剃刀党，而你要为它在城里的全部秩序负责。',
  ],
}

const BUILDING_LINES: Readonly<Record<BuildingId, readonly [string, string]>> =
  {
    'repair-shop': [
      '修车厂一直是剃刀党的产业。从今晚起，它的钥匙、人员和账本由你负责。',
      '先修好第一条工位并提升主建筑，车队需要一个能持续运转的总部。',
    ],
    'recycling-yard': [
      '回收厂的废车、吊机和看守已经按帮派命令转入你的调度。',
      '让回收线开始生产配件；留下好货，其余拆成零件继续强化装备。',
    ],
    'commercial-street': [
      '商业街的账本已经交到你手里，现金和消息仍归剃刀党统一使用。',
      '升级店面与主街，稳定收入后再把人手投向更远的战线。',
    ],
    'metalworking-plant': [
      '炉火、冲床和仓库原本就归帮派，现在由你的席位负责排产与调度。',
      '扩建生产线，为车辆配件和枪械强化准备足够的物资。',
    ],
    'gas-station': [
      '油罐和泵岛一直挂着剃刀党的旗，现在补给安排由你签字。',
      '提高站点等级，支撑更长的竞速路线和更危险的追击任务。',
    ],
    clubhouse: [
      '会所本就是剃刀党的权力中心，副主席席位让你开始负责这里的日常运转。',
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
          text: 'Thomas，城市一直是剃刀党的，但不是每一扇门都听你命令。你的职位决定能调动哪些人和产业。',
        },
        {
          speaker: 'Eddie “Pins” Doyle',
          speakerRole: '前任见习 · 货场领路人',
          portraitIndex: 1,
          text: '修车、挣钱、完成帮派交给你的任务，再沿着权力树晋升——职位越高，你获得的管理权限就越多。',
        },
        {
          speaker: 'Eddie “Pins” Doyle',
          speakerRole: '前任见习 · 货场领路人',
          portraitIndex: 1,
          text: '先看地图上的金色管理权标记。接过修车厂的管理权，这是帮派交给见习成员的第一项产业职责。',
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
      kicker: 'AUTHORITY BRIEFING',
      title: `${buildingCatalogById[buildingId].name}管理权交接`,
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
          `按照帮派规矩，这把钥匙和这张名单现在由你负责。${seat.holder} 从此进入你的直属管辖。`,
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
