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
    'Thomas，你被叫到这张桌前，是因为见习席位空出了第一份产业职责。委员会要决定是否把修车厂重启写进你的评定任务。',
    '先听完任务宣讲。你现在没有投票权，只能接受委员会决议；会议结束后，才会安排修车厂管理权交接。',
  ],
  2: [
    '你刚接过正式成员席位。按照帮派规矩，新增管理权限与本章行动都必须先在评定会议上宣讲。',
    '废车回收厂会成为议案核心；从这次会议起，你拥有正式投票权。',
  ],
  3: [
    '技术骨干不能只守着车库。委员会召集你，是要表决商业街现金流和机械线的联合调度方案。',
    '听清每项任务后投下你的票；议案通过，商业街管理权才会进入交接流程。',
  ],
  4: [
    '酒吧联络人开始接触工厂订单和材料账本，因此委员会要重新划定金属加工厂的日常调度权限。',
    '本章任务会在会上逐项宣讲；形成决议后，再让负责人把工厂账本交给你。',
  ],
  5: [
    '路线队长有权调度道路、燃油和车队，但每条新路线都要经过核心席位共同评定。',
    '委员会将表决加油站、长途改装与公路行动安排；你的投票会被正式记录。',
  ],
  6: [
    '副主席要把生意、车队和火力汇总到 Clubhouse。今晚叫你来，是为了确认统一管理方案。',
    '会议会决定本章最后的整编任务；决议通过后，会所的日常权限才进入交接。',
  ],
  7: [
    '你已经坐到最高席位前。城市始终属于剃刀党，最后一次会议要确认所有产业由同一套命令统筹。',
    '听完最终议案并投票；这是主席留下的第一份正式会议决议。',
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
          text: 'Maeve 让你先去会议室。委员会会宣讲见习成员的第一章任务，形成决议后，你才有资格接过修车厂的管理钥匙。',
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
