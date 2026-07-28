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
  | 'prologue:police-chase'
  | 'prologue:bo-invitation'
  | 'prologue:garage'
  | 'prologue:ambush'
  | 'prologue:prospect'
  | 'prologue:tasks'
  | 'prologue:gun-gift'
  | 'prologue:gang-training'
  | 'special-vote:formal-member'
  | 'special-vote:president'
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
  artwork?: 'police-chase' | 'bo-invitation'
  lines: readonly NarrativeLine[]
}

const CHAPTER_OPENING_LINES: Readonly<Record<number, readonly string[]>> = {
  1: [
    'Thomas，博已经替你争取到见习资格。先让修车厂重新运转，再证明你能守住这把钥匙。',
    '完成三项转正任务后，博会把真正的武器交给你；活着回来，再去权力树参加转正会议。',
  ],
  2: [
    '正式成员席位已经登记，你在会议上选择的任务包也已写入第二章。',
    '先从章节任务接过废车回收厂管理权。完成这次交接后，再处理推关、SUP 与其他本章职责。',
  ],
  3: [
    '委员会已经就商业街现金流与机械线做出安排，你选择的任务包构成第三章的重点职责。',
    '先去权力树完成技术骨干席位交接，再让商业街的现金与消息进入帮派账本。',
  ],
  4: [
    '会议已经划定金属加工厂的日常调度重点，你接下的任务包构成第四章职责。',
    '先完成酒吧联络人席位交接，再让负责人把工厂账本和排产权限交到你手里。',
  ],
  5: [
    '评定会议已经记录你的投票，并将加油站、车队和长途行动整理成第五章任务包。',
    '先去权力树接过路线队长席位，再按你选择的职责打通新的燃油与公路路线。',
  ],
  6: [
    '会议已经确定 Clubhouse 的整编方向，你选定的任务包将生意、车队和火力汇总为第六章职责。',
    '先完成副主席席位交接，再接过会所的日常权限，把各条产业线收拢到同一张桌上。',
  ],
  7: [
    '最后一次评定会议已经结束，你选择的任务包将所有产业汇入第七章的最终职责。',
    '去权力树接过主席席位，再用同一套命令统筹账本、车队、工厂和整座城市的帮派秩序。',
  ],
}

const CHAPTER_END_LINES: Readonly<Record<number, readonly string[]>> = {
  1: [
    '修车厂重新冒烟，街口也认得我们的车了。你已经完成见习该做的一切。',
    '现在参加评定会议。委员会会表决下一件事，再由你选择第二章要承担的任务包。',
  ],
  2: [
    '废车场开始吐出零件，帮派不必再向别人低头买装备。',
    '回到评定会议处理新的事件，并从三个任务包中选出第三章的职责。',
  ],
  3: [
    '商业街的账目已经归拢，现金和消息都会先经过我们。',
    '下一轮评定会议已经备好事件记录；投票后选择第四章要承担的职责。',
  ],
  4: [
    '金属厂已经在你的调度下恢复炉火，车与枪都能在帮派产业内完成强化。',
    '现在参加评定会议，让委员会把下一阶段路线拆成三个可接取的任务包。',
  ],
  5: [
    '燃油线和车队路线已经打通，城里再没有人能轻易截断我们的运输。',
    '回到评定会议记录你的立场，再选择第六章要承担的整编职责。',
  ],
  6: [
    'Clubhouse 的门已经打开，所有核心生意都在同一张桌上。',
    '最后一轮评定会议将决定主席阶段的工作重点；投票后选定最终任务包。',
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
  if (id === 'prologue:police-chase') {
    return {
      id,
      kicker: 'PROLOGUE · ON THE RUN',
      title: '警灯咬住后轮',
      artwork: 'police-chase',
      lines: [
        {
          speaker: 'Thomas Shelby',
          speakerRole: '逃亡中的骑手',
          portraitIndex: 0,
          text: '警察咬住我了。先甩掉他们，再想办法找个地方藏身。',
        },
      ],
    }
  }

  if (id === 'prologue:bo-invitation') {
    return {
      id,
      kicker: 'PROLOGUE · A ROAD OFFER',
      title: '金发骑手',
      artwork: 'bo-invitation',
      lines: [
        {
          speaker: '博',
          speakerRole: '剃刀党骑手领队',
          portraitIndex: 6,
          text: '你把警察甩得够远，但这台车撑不到天亮。跟我们去前面的小镇，那里有剃刀党的修车厂。',
        },
        {
          speaker: '博',
          speakerRole: '剃刀党骑手领队',
          portraitIndex: 6,
          text: '把摩托整修好，先避过这阵风头。至于能不能留下，看你接下来怎么做。',
        },
      ],
    }
  }

  if (id === 'prologue:garage') {
    return {
      id,
      kicker: 'PROLOGUE · THE COLD GARAGE',
      title: '坏掉的引擎',
      lines: [
        {
          speaker: '博',
          speakerRole: '剃刀党骑手领队',
          portraitIndex: 6,
          text: '到了。你车上的引擎支架已经裂了，再跑一次就会把你扔在路中央。',
        },
        {
          speaker: '博',
          speakerRole: '剃刀党骑手领队',
          portraitIndex: 6,
          text: '这块调校引擎是好货。打开车辆养成，把锈狐上那块坏件换下来。',
        },
      ],
    }
  }

  if (id === 'prologue:ambush') {
    return {
      id,
      kicker: 'PROLOGUE · NO SAFE EXIT',
      title: '追兵又来了',
      lines: [
        {
          speaker: '博',
          speakerRole: '剃刀党骑手领队',
          portraitIndex: 6,
          text: '听见外面的引擎声了吗？不是警察，是一路追着你的仇家。新引擎正好该试一试。',
        },
        {
          speaker: 'Thomas Shelby',
          speakerRole: '锈狐骑手',
          portraitIndex: 0,
          text: '那就让他们在镇外吃灰。',
        },
      ],
    }
  }

  if (id === 'prologue:prospect') {
    return {
      id,
      kicker: 'PROLOGUE · PROSPECT',
      title: '一块见习补丁',
      lines: [
        {
          speaker: '博',
          speakerRole: '剃刀党骑手领队',
          portraitIndex: 6,
          text: '两次都能活着回来，说明你不是只会逃。先以见习身份留下，替帮派把修车厂重新点起来。',
        },
        {
          speaker: '博',
          speakerRole: '剃刀党骑手领队',
          portraitIndex: 6,
          text: '后面那辆敌车还没死心。借我的枪，点准他的摩托，把他从这条路上赶下去。',
        },
      ],
    }
  }

  if (id === 'prologue:tasks') {
    return {
      id,
      kicker: 'PROLOGUE · EARN THE PATCH',
      title: '转正之前',
      lines: [
        {
          speaker: '博',
          speakerRole: '剃刀党骑手领队',
          portraitIndex: 6,
          text: '这座城本来就是剃刀党的。见习能碰多少产业、调多少人，只看职位和功劳。',
        },
        {
          speaker: '博',
          speakerRole: '剃刀党骑手领队',
          portraitIndex: 6,
          text: '接过修车厂管理权，把主建筑升到二级，再确认新引擎已经装好。三项任务的奖励都领完，我再给你真正的武器。',
        },
      ],
    }
  }

  if (id === 'prologue:gun-gift') {
    return {
      id,
      kicker: 'PROLOGUE · LIVE AMMUNITION',
      title: '铆钉冲锋枪',
      lines: [
        {
          speaker: '博',
          speakerRole: '剃刀党骑手领队',
          portraitIndex: 6,
          text: '修车厂已经重新冒烟，你也把每项差事都做完了。这把铆钉冲锋枪归你。',
        },
        {
          speaker: '博',
          speakerRole: '剃刀党骑手领队',
          portraitIndex: 6,
          text: '它已经装到你的装备里。追上敌人的头车，把整辆摩托打烂，活着回来证明你配得上完整补丁。',
        },
      ],
    }
  }

  if (id === 'prologue:gang-training') {
    return {
      id,
      kicker: 'PROLOGUE · THE TABLE WAITS',
      title: '去争取一张票',
      lines: [
        {
          speaker: '博',
          speakerRole: '剃刀党骑手领队',
          portraitIndex: 6,
          text: '目标车已经变成废铁。现在去帮派权力树，把见习声望逐级升到 Lv.7。',
        },
        {
          speaker: '博',
          speakerRole: '剃刀党骑手领队',
          portraitIndex: 6,
          text: '声望到顶后再点一次晋升，委员会就会开会表决你能不能成为正式成员。',
        },
      ],
    }
  }

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
          text: 'Maeve 已把第一章任务写进章节体。先接过修车厂钥匙并证明自己，章节完成后委员会才会表决你能否成为正式成员。',
        },
      ],
    }
  }

  if (id === 'special-vote:formal-member') {
    return {
      id,
      kicker: 'COUNCIL VERDICT · FULL PATCH',
      title: '正式成员资格通过',
      lines: [
        {
          speaker: 'Maeve “Red” Quinn',
          speakerRole: '正式成员 · 正式成员头目',
          portraitIndex: 2,
          text: '五票赞成，一票保留。按剃刀党的规矩，你已经有资格佩戴完整补丁；正式成员席位会在权力树上完成交接。',
        },
        {
          speaker: 'Thomas Shelby',
          speakerRole: '见习 · 待完成席位交接',
          portraitIndex: 0,
          text: '补丁不是奖赏，是新的责任。转正已经通过，现在把下一章可接的任务包摆到桌上，由我挑一份。',
        },
      ],
    }
  }

  if (id === 'special-vote:president') {
    return {
      id,
      kicker: 'COUNCIL VERDICT · PRESIDENT',
      title: '主席继任资格通过',
      lines: [
        {
          speaker: 'Winston Cole',
          speakerRole: '主席 · 剃刀党最高席位',
          portraitIndex: 7,
          text: '六席一致赞成。主席的钥匙不属于个人，它代表整条指挥链；完成最后交接后，这份责任由你承担。',
        },
        {
          speaker: 'Thomas Shelby',
          speakerRole: '副主席 · 主席候任人',
          portraitIndex: 0,
          text: '城市仍属于剃刀党。我接下的是让每一本账、每一辆车和每一条命令都对得上的责任。继续最后的评定。',
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
