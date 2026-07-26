import { GANG_ROLES, getGangRole, type GangRole } from './gangProgression'

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

export type GangSeatState = 'superior' | 'current' | 'subordinate'

export const GANG_CORE_SEATS: readonly GangCoreSeat[] = [
  {
    threshold: 1,
    holder: 'Eddie “Pins” Doyle',
    seatDescription: '货场领路人',
    portraitIndex: 1,
    support: [
      { name: 'Nora Bell', position: '账房跑腿' },
      { name: 'Alfie Ward', position: '街口眼线' },
    ],
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
    support: [{ name: 'Finn Cooper', position: '零件监工' }],
  },
  {
    threshold: 24,
    holder: 'Polly Gray',
    seatDescription: '酒吧与账本联络人',
    portraitIndex: 4,
    support: [{ name: 'Ruby Keane', position: '酒吧掌柜' }],
  },
  {
    threshold: 32,
    holder: 'Charlie Strong',
    seatDescription: '车队路线指挥',
    portraitIndex: 5,
    support: [{ name: 'Jonah Pike', position: '车队领航员' }],
  },
  {
    threshold: 40,
    holder: 'Michael Gray',
    seatDescription: '生意与地盘副手',
    portraitIndex: 6,
    support: [{ name: 'Ada Moss', position: '区域管事' }],
  },
  {
    threshold: 50,
    holder: 'Winston Cole',
    seatDescription: '剃刀党最高席位',
    portraitIndex: 7,
    support: [{ name: 'Solomon Price', position: '会所总管' }],
  },
]

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
