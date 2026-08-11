import { GANG_ROLES, getGangRole, type GangRole } from './gangProgression'
import type { HeroId } from './heroes'

export const GANG_NAME = '剃刀党'
export const PLAYER_GANG_LEADER = 'Thomas Shelby'

export interface GangSupportMember {
  name: string
  position: string
}

export interface GangCoreSeat {
  threshold: number
  holder: string
  seatDescription: string
  portraitIndex: number
  support: readonly GangSupportMember[]
}

export interface GangHeroProfile {
  seatThreshold: number
  portraitIndex: number
  relation: string
}

export type GangSeatState = 'superior' | 'current' | 'subordinate'

export const GANG_CORE_SEATS: readonly GangCoreSeat[] = [
  {
    threshold: 1,
    holder: 'Eddie “Pins” Doyle',
    seatDescription: '货场领路人',
    portraitIndex: 1,
    support: [],
  },
  {
    threshold: 8,
    holder: 'Maeve “Red” Quinn',
    seatDescription: '正式成员头目',
    portraitIndex: 2,
    support: [{ name: 'Liam Moss', position: '收账人' }],
  },
  {
    threshold: 16,
    holder: 'Arthur Shelby',
    seatDescription: '首席机械师',
    portraitIndex: 3,
    support: [
      { name: 'Finn Cooper', position: '零件监工' },
      { name: 'Isaac Bell', position: '车库技工' },
    ],
  },
  {
    threshold: 24,
    holder: 'Polly Gray',
    seatDescription: '酒吧与账本联络人',
    portraitIndex: 4,
    support: [
      { name: 'Ruby Keane', position: '酒吧掌柜' },
      { name: 'Nora Bell', position: '账房管事' },
      { name: 'Alfie Ward', position: '街区联络人' },
    ],
  },
  {
    threshold: 32,
    holder: 'Charlie Strong',
    seatDescription: '车队路线指挥',
    portraitIndex: 5,
    support: [
      { name: 'Jonah Pike', position: '车队领航员' },
      { name: 'Evan Shaw', position: '护送队长' },
      { name: 'Mara Finch', position: '路线情报员' },
      { name: 'Noah Briggs', position: '车库调度员' },
    ],
  },
  {
    threshold: 40,
    holder: 'Michael Gray',
    seatDescription: '生意与地盘副手',
    portraitIndex: 6,
    support: [
      { name: 'Ada Moss', position: '区域管事' },
      { name: 'Hector Lane', position: '码头监工' },
      { name: 'Ivy Quinn', position: '账本审计人' },
      { name: 'Leon Drake', position: '货运负责人' },
      { name: 'Grace Holt', position: '街区代表' },
    ],
  },
  {
    threshold: 50,
    holder: 'Winston Cole',
    seatDescription: '剃刀党最高席位',
    portraitIndex: 7,
    support: [
      { name: 'Solomon Price', position: '会所总管' },
      { name: 'Duke Mercer', position: '纪律官' },
      { name: 'Vera Cole', position: '财务主管' },
      { name: 'Caleb Frost', position: '地盘总管' },
      { name: 'Mabel Shaw', position: '关系协调人' },
      { name: 'Silas Reed', position: '行动队长' },
    ],
  },
]

export const GANG_HERO_PROFILES: Readonly<Record<HeroId, GangHeroProfile>> = {
  foreman: {
    seatThreshold: 8,
    portraitIndex: 2,
    relation: '主席派来的调查员',
  },
  anvil: {
    seatThreshold: 16,
    portraitIndex: 3,
    relation: '技术骨干席位成员',
  },
  skyline: {
    seatThreshold: 24,
    portraitIndex: 4,
    relation: '酒吧联络人席位成员',
  },
}

const SEAT_BY_THRESHOLD = new Map(
  GANG_CORE_SEATS.map((seat) => [seat.threshold, seat]),
)

export function getGangCoreSeat(threshold: number): GangCoreSeat {
  const seat = SEAT_BY_THRESHOLD.get(threshold)
  if (!seat) {
    throw new Error(`Unknown gang core seat: ${threshold}`)
  }
  return seat
}

export function getGangSeatState(
  threshold: number,
  currentLevel: number,
): GangSeatState {
  const currentRole = getGangRole(currentLevel)
  if (threshold > currentRole.threshold) return 'superior'
  if (threshold === currentRole.threshold) return 'current'
  return 'subordinate'
}

export function getManagedCoreSeatCount(currentLevel: number): number {
  const currentRole = getGangRole(currentLevel)
  return GANG_CORE_SEATS.filter(
    (seat) => seat.threshold <= currentRole.threshold,
  ).length
}

export function roleForCoreSeat(seat: GangCoreSeat): GangRole {
  const role = GANG_ROLES.find(
    (candidate) => candidate.threshold === seat.threshold,
  )
  if (!role) {
    throw new Error(`Missing gang role for core seat: ${seat.threshold}`)
  }
  return role
}
