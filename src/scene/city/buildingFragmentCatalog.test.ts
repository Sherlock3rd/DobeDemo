import { Euler, Matrix4, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { buildingCatalog } from '../../game/buildingCatalog'
import {
  BUILDING_HITBOX_HEIGHT,
  BUILDING_RENDER_SCALE,
} from '../../game/cityLayout'
import {
  BUILDING_LEVELS,
  type BuildingKind,
  type BuildingLevel,
  type BuildingProgress,
  type ChildBuildingLevel,
} from '../../game/cityTypes'
import {
  getBuildingFragments,
  getRenderedBuildingFragments,
  type FragmentRenderState,
} from './buildingFragmentCatalog'
import type { BuildingVisualPart } from './buildingVisualTypes'

const buildingKinds = [
  'repair',
  'recycling',
  'commercial',
  'metalworking',
  'gas',
  'clubhouse',
] as const satisfies readonly BuildingKind[]

function progress(
  kind: BuildingKind,
  level: BuildingLevel,
  childLevel: ChildBuildingLevel = level,
): BuildingProgress {
  const childCount = kind === 'repair' ? 5 : 10
  return {
    level,
    childLevels: Array(childCount).fill(childLevel),
  }
}

const expectedFragmentNames: Readonly<Record<BuildingKind, readonly string[]>> =
  {
    repair: [
      '基础维修棚',
      '零件货架',
      '举升工位',
      '排气设施',
      '诊断工位',
      '轮胎工位',
      '小型起重机',
      '喷漆间',
      '调校工位',
      '控制室',
    ],
    recycling: [
      '废车堆场',
      '抓机',
      '压块车间',
      '分拣货架',
      '打包机',
      '磁吸吊机',
      '破碎机',
      '输送分选线',
      '金属分离器',
      '控制塔',
    ],
    commercial: [
      '主街商铺',
      '装卸后巷',
      '二号商铺',
      '街区广告牌',
      '餐饮摊位',
      '商业连廊',
      '转角商铺',
      '中央广场',
      '综合塔楼',
      '中央灯塔',
    ],
    metalworking: [
      '基础加工车间',
      '熔炉',
      '材料堆',
      '冲压车间',
      '主烟囱',
      '龙门吊架',
      '二号炉体',
      '切割线',
      '重型天车',
      '生产控制塔',
    ],
    gas: [
      '一号泵岛',
      '二号泵岛',
      '金属顶棚',
      '便利店',
      '价格立柱',
      '三号泵岛',
      '洗车间',
      '卡车加注区',
      '储油标识',
      '综合服务楼',
    ],
    clubhouse: [
      '主会所',
      '门廊',
      '会所招牌',
      '二层露台',
      '二层会馆',
      '霓虹标识',
      '车库',
      '休息室',
      '屋顶观景台',
      '会馆灯塔',
    ],
  }

// A curated tag that must show up in a specific fragment, proving the geometry
// is authored per design name rather than reusing a single template.
const semanticTagSpotChecks: readonly {
  kind: BuildingKind
  index: number
  tagFragment: string
}[] = [
  { kind: 'repair', index: 4, tagFragment: 'diagnostic' },
  { kind: 'recycling', index: 5, tagFragment: 'magnet' },
  { kind: 'recycling', index: 9, tagFragment: 'control' },
  { kind: 'commercial', index: 9, tagFragment: 'beacon' },
  { kind: 'commercial', index: 3, tagFragment: 'billboard' },
  { kind: 'metalworking', index: 4, tagFragment: 'chimney' },
  { kind: 'gas', index: 6, tagFragment: 'wash' },
  { kind: 'clubhouse', index: 5, tagFragment: 'neon' },
]

// Rooftop attachments that must stay on top of their owning body once the
// level enhancement scales the fragment. Body is always the first part.
const rooftopAttachments: readonly {
  kind: BuildingKind
  index: number
  attachmentTag: string
}[] = [
  {
    kind: 'metalworking',
    index: 4,
    attachmentTag: 'metalworking-main-chimney',
  },
  { kind: 'gas', index: 3, attachmentTag: 'gas-store-sign' },
  { kind: 'clubhouse', index: 9, attachmentTag: 'clubhouse-beacon-lantern' },
]

const footprintByKind = Object.fromEntries(
  buildingCatalog.map((building) => [building.kind, building.footprint]),
) as Record<BuildingKind, readonly [number, number]>

const FRAGMENT_SLOT_COLUMNS = 5
const FRAGMENT_SLOT_ROWS = 2

function expectedAnchor(
  kind: BuildingKind,
  index: number,
): readonly [number, number, number] {
  const [footprintX, footprintZ] = footprintByKind[kind]
  const column = index % FRAGMENT_SLOT_COLUMNS
  const row = Math.floor(index / FRAGMENT_SLOT_COLUMNS)
  const cellWidth = footprintX / FRAGMENT_SLOT_COLUMNS
  const rows = kind === 'repair' ? 1 : FRAGMENT_SLOT_ROWS
  const cellDepth = footprintZ / rows

  return [
    -footprintX / 2 + cellWidth * (column + 0.5),
    0,
    -footprintZ / 2 + cellDepth * (row + 0.5),
  ]
}

interface LocalAabb {
  min: Vector3
  max: Vector3
}

// Analytic axis-aligned bounds — never allocates BoxGeometry/CylinderGeometry.
// Boxes transform the 8 corners; cylinders use the exact rotated-axis extent
// h*|a·e| + r*sqrt(1 - (a·e)^2) with a conservative radius bound.
function partLocalAabb(part: BuildingVisualPart): LocalAabb {
  const rotation = part.rotation ?? [0, 0, 0]
  const rotationMatrix = new Matrix4().makeRotationFromEuler(
    new Euler(rotation[0], rotation[1], rotation[2], 'XYZ'),
  )
  const center = new Vector3(
    part.position[0],
    part.position[1],
    part.position[2],
  )

  if (part.shape === 'box') {
    const halfX = part.size[0] / 2
    const halfY = part.size[1] / 2
    const halfZ = part.size[2] / 2
    const min = new Vector3(Infinity, Infinity, Infinity)
    const max = new Vector3(-Infinity, -Infinity, -Infinity)

    for (const signX of [-1, 1]) {
      for (const signY of [-1, 1]) {
        for (const signZ of [-1, 1]) {
          const corner = new Vector3(
            signX * halfX,
            signY * halfY,
            signZ * halfZ,
          )
            .applyMatrix4(rotationMatrix)
            .add(center)
          min.min(corner)
          max.max(corner)
        }
      }
    }

    return { min, max }
  }

  const axis = new Vector3(0, 1, 0).applyMatrix4(rotationMatrix).normalize()
  const halfHeight = part.height / 2
  const half = new Vector3(
    Math.abs(axis.x) * halfHeight +
      part.radius * Math.sqrt(Math.max(0, 1 - axis.x * axis.x)),
    Math.abs(axis.y) * halfHeight +
      part.radius * Math.sqrt(Math.max(0, 1 - axis.y * axis.y)),
    Math.abs(axis.z) * halfHeight +
      part.radius * Math.sqrt(Math.max(0, 1 - axis.z * axis.z)),
  )

  return {
    min: center.clone().sub(half),
    max: center.clone().add(half),
  }
}

function worldPartAabb(
  part: BuildingVisualPart,
  anchor: readonly [number, number, number],
): LocalAabb {
  const anchorVector = new Vector3(anchor[0], anchor[1], anchor[2])
  const local = partLocalAabb(part)

  return {
    min: local.min
      .clone()
      .add(anchorVector)
      .multiplyScalar(BUILDING_RENDER_SCALE),
    max: local.max
      .clone()
      .add(anchorVector)
      .multiplyScalar(BUILDING_RENDER_SCALE),
  }
}

function expectPartWithinBuildingEnvelope(
  part: BuildingVisualPart,
  kind: BuildingKind,
  anchor: readonly [number, number, number],
  label: string,
) {
  const [footprintX, footprintZ] = footprintByKind[kind]
  const halfX = (footprintX * BUILDING_RENDER_SCALE) / 2
  const halfZ = (footprintZ * BUILDING_RENDER_SCALE) / 2
  const epsilon = 1e-6
  const { min, max } = worldPartAabb(part, anchor)

  expect(min.y, `${label} floor`).toBeGreaterThanOrEqual(-epsilon)
  expect(max.y, `${label} top`).toBeLessThanOrEqual(
    BUILDING_HITBOX_HEIGHT + epsilon,
  )
  expect(min.x, `${label} -x`).toBeGreaterThanOrEqual(-halfX - epsilon)
  expect(max.x, `${label} +x`).toBeLessThanOrEqual(halfX + epsilon)
  expect(min.z, `${label} -z`).toBeGreaterThanOrEqual(-halfZ - epsilon)
  expect(max.z, `${label} +z`).toBeLessThanOrEqual(halfZ + epsilon)
}

function expectPositiveGeometry(part: BuildingVisualPart) {
  part.position.forEach((coordinate) =>
    expect(Number.isFinite(coordinate)).toBe(true),
  )

  if (part.shape === 'box') {
    part.size.forEach((dimension) => expect(dimension).toBeGreaterThan(0))
    return
  }

  expect(part.radius).toBeGreaterThan(0)
  expect(part.height).toBeGreaterThan(0)
}

function fragmentSignature(parts: readonly BuildingVisualPart[]): string {
  return parts
    .map((part) => `${part.shape}:${part.tag}`)
    .sort()
    .join('|')
}

function fragmentTopFromParts(parts: readonly BuildingVisualPart[]): number {
  return parts.reduce(
    (tallest, part) => Math.max(tallest, partLocalAabb(part).max.y),
    Number.NEGATIVE_INFINITY,
  )
}

function renderedTop(kind: BuildingKind, level: BuildingLevel, index: number) {
  const rendered = getRenderedBuildingFragments(kind, progress(kind, level))

  return fragmentTopFromParts(rendered[index].parts)
}

describe('getBuildingFragments', () => {
  it('provides five repair fragments and ten for every other kind', () => {
    buildingKinds.forEach((kind) => {
      expect(getBuildingFragments(kind)).toHaveLength(
        kind === 'repair' ? 5 : 10,
      )
    })
  })

  it('stores only five repair blueprints instead of slicing per lookup', () => {
    const first = getBuildingFragments('repair')
    const second = getBuildingFragments('repair')
    const [footprintX, footprintZ] = footprintByKind.repair

    expect(first).toBe(second)
    expect(first).toHaveLength(5)
    first.forEach(({ anchor }) => {
      expect(Math.abs(anchor[0])).toBeLessThanOrEqual(footprintX / 2)
      expect(Math.abs(anchor[2])).toBeLessThanOrEqual(footprintZ / 2)
    })
  })

  it('uses the exact design table names in order', () => {
    buildingKinds.forEach((kind) => {
      expect(
        getBuildingFragments(kind).map((fragment) => fragment.name),
      ).toEqual(
        kind === 'repair'
          ? expectedFragmentNames[kind].slice(0, 5)
          : expectedFragmentNames[kind],
      )
    })
  })

  it('keeps fragment ids stable, non-empty and globally unique', () => {
    const allIds = buildingKinds.flatMap((kind) =>
      getBuildingFragments(kind).map((fragment) => fragment.id),
    )

    allIds.forEach((id) => expect(id.length).toBeGreaterThan(0))
    expect(new Set(allIds).size).toBe(allIds.length)
  })

  it('gives every fragment a non-empty, unique name and description', () => {
    buildingKinds.forEach((kind) => {
      const descriptions = getBuildingFragments(kind).map(
        (fragment) => fragment.description,
      )
      getBuildingFragments(kind).forEach((fragment) => {
        expect(fragment.name.trim().length).toBeGreaterThan(0)
        expect(fragment.description.trim().length).toBeGreaterThan(0)
      })
      expect(new Set(descriptions).size).toBe(descriptions.length)
    })
  })

  it('exposes a local animation anchor and origin-relative parts', () => {
    buildingKinds.forEach((kind) => {
      getBuildingFragments(kind).forEach((fragment, index) => {
        expect(fragment.anchor).toEqual(expectedAnchor(kind, index))
      })
    })
  })

  it('defines valid geometry for at least one part per fragment', () => {
    buildingKinds.forEach((kind) => {
      getBuildingFragments(kind).forEach((fragment) => {
        expect(fragment.parts.length).toBeGreaterThan(0)
        fragment.parts.forEach(expectPositiveGeometry)
      })
    })
  })

  it('gives each of the ten slots a unique geometry/tag signature', () => {
    buildingKinds.forEach((kind) => {
      const signatures = getBuildingFragments(kind).map((fragment) =>
        fragmentSignature(fragment.parts),
      )
      expect(new Set(signatures).size).toBe(signatures.length)
    })
  })

  it('varies the part composition, not just the height, across slots', () => {
    buildingKinds.forEach((kind) => {
      const partCounts = getBuildingFragments(kind).map(
        (fragment) => fragment.parts.length,
      )
      expect(new Set(partCounts).size).toBeGreaterThanOrEqual(2)
    })
  })

  it('authors design-specific semantic tags per fragment', () => {
    semanticTagSpotChecks.forEach(({ kind, index, tagFragment }) => {
      const fragment = getBuildingFragments(kind)[index]
      const hasTag = fragment.parts.some((part) =>
        part.tag.includes(tagFragment),
      )
      expect(
        hasTag,
        `${kind}[${index}] should include tag "${tagFragment}"`,
      ).toBe(true)
    })
  })
})

describe('getRenderedBuildingFragments render states', () => {
  it('renders every child slot as scaffold at child level zero', () => {
    buildingKinds.forEach((kind) => {
      const childCount = kind === 'repair' ? 5 : 10
      const rendered = getRenderedBuildingFragments(kind, {
        level: 1,
        childLevels: Array(childCount).fill(0),
      })

      expect(rendered).toHaveLength(childCount)
      expect(rendered.every(({ state }) => state === 'scaffold')).toBe(true)
    })
  })

  it('renders each slot from its own child level regardless of index order', () => {
    const rendered = getRenderedBuildingFragments('repair', {
      level: 3,
      childLevels: [1, 0, 1, 0, 0],
    })

    expect(rendered.map(({ state }) => state)).toEqual([
      'current',
      'scaffold',
      'current',
      'scaffold',
      'scaffold',
    ] satisfies FragmentRenderState[])
    expect(rendered[0].parts.some(({ tag }) => tag.includes('scaffold'))).toBe(
      false,
    )
    expect(rendered[2].parts.some(({ tag }) => tag.includes('scaffold'))).toBe(
      false,
    )
  })

  it('uses each child level instead of the main building level', () => {
    const mixedProgress: BuildingProgress = {
      level: 3,
      childLevels: [1, 2, 3, 0, 0, 0, 0, 0, 0, 0],
    }
    const rendered = getRenderedBuildingFragments('commercial', mixedProgress)
    const levelOne = getRenderedBuildingFragments('commercial', {
      ...mixedProgress,
      childLevels: [1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
    })
    const sameChildrenDifferentMain = getRenderedBuildingFragments(
      'commercial',
      { ...mixedProgress, level: 1 },
    )

    expect(fragmentTopFromParts(rendered[0].parts)).toBe(
      fragmentTopFromParts(levelOne[0].parts),
    )
    expect(fragmentTopFromParts(rendered[1].parts)).toBeGreaterThan(
      fragmentTopFromParts(levelOne[1].parts),
    )
    expect(fragmentTopFromParts(rendered[2].parts)).toBeGreaterThan(
      fragmentTopFromParts(levelOne[2].parts),
    )
    expect(rendered.map(({ parts }) => fragmentTopFromParts(parts))).toEqual(
      sameChildrenDifferentMain.map(({ parts }) => fragmentTopFromParts(parts)),
    )
    expect(rendered.slice(3).every(({ state }) => state === 'scaffold')).toBe(
      true,
    )
  })

  it('renders every built child as current without a session animation id', () => {
    buildingKinds.forEach((kind) => {
      const levels =
        kind === 'clubhouse' ? ([1, 4, 9] as const) : ([1, 4, 5] as const)
      levels.forEach((level) => {
        const rendered = getRenderedBuildingFragments(
          kind,
          progress(kind, level),
        )

        expect(rendered).toHaveLength(getBuildingFragments(kind).length)
        rendered.forEach((fragment) => {
          expect(fragment.state).toBe<FragmentRenderState>('current')
          expect(fragment.animate).toBe(false)
        })
      })
    })
  })

  it('keeps a max-level building at its canonical child count', () => {
    buildingKinds.forEach((kind) => {
      const level = kind === 'clubhouse' ? 10 : 5
      const rendered = getRenderedBuildingFragments(kind, progress(kind, level))

      expect(rendered).toHaveLength(kind === 'repair' ? 5 : 10)
      rendered.forEach((fragment) => {
        expect(fragment.state).toBe<FragmentRenderState>('current')
      })
    })
  })

  it('carries the blueprint anchor and stable ids through rendering', () => {
    buildingKinds.forEach((kind) => {
      const blueprint = getBuildingFragments(kind)
      const rendered = getRenderedBuildingFragments(
        kind,
        progress(kind, kind === 'clubhouse' ? 6 : 5, 2),
      )

      rendered.forEach((fragment, index) => {
        expect(fragment.id).toBe(blueprint[index].id)
        expect(fragment.name).toBe(blueprint[index].name)
        expect(fragment.anchor).toEqual(blueprint[index].anchor)
      })
    })
  })
})

describe('getRenderedBuildingFragments animation control', () => {
  it('never animates when no animated fragment id is supplied', () => {
    buildingKinds.forEach((kind) => {
      const rendered = getRenderedBuildingFragments(kind, progress(kind, 5, 3))

      expect(rendered.some((fragment) => fragment.animate)).toBe(false)
    })
  })

  it('animates only the fragment whose id matches animatedFragmentId', () => {
    buildingKinds.forEach((kind) => {
      const target = getBuildingFragments(kind)[2]
      const rendered = getRenderedBuildingFragments(
        kind,
        progress(kind, 5, 3),
        target.id,
      )

      const animated = rendered
        .filter((fragment) => fragment.animate)
        .map((fragment) => fragment.id)
      expect(animated).toEqual([target.id])
    })
  })

  it('ignores an animated fragment id that is not in the blueprint catalog', () => {
    buildingKinds.forEach((kind) => {
      const rendered = getRenderedBuildingFragments(
        kind,
        progress(kind, 2, 1),
        `${kind}-fragment-missing`,
      )

      expect(rendered.some((fragment) => fragment.animate)).toBe(false)
    })
  })

  it('never animates a scaffold slot even when its id is supplied', () => {
    buildingKinds.forEach((kind) => {
      const childCount = kind === 'repair' ? 5 : 10
      const rendered = getRenderedBuildingFragments(
        kind,
        { level: 3, childLevels: Array(childCount).fill(0) },
        getBuildingFragments(kind)[3].id,
      )

      const scaffoldSlot = rendered[3]
      expect(scaffoldSlot.state).toBe<FragmentRenderState>('scaffold')
      expect(rendered.some((fragment) => fragment.animate)).toBe(false)
    })
  })
})

describe('getRenderedBuildingFragments level enhancement', () => {
  it('applies a visible but bounded enhancement as the level grows', () => {
    buildingKinds.forEach((kind) => {
      const lowTop = renderedTop(kind, 1, 0)
      const highTop = renderedTop(kind, 10, 0)

      expect(highTop).toBeGreaterThan(lowTop * 1.05)
      expect(highTop * BUILDING_RENDER_SCALE).toBeLessThanOrEqual(
        BUILDING_HITBOX_HEIGHT,
      )
    })
  })

  it('makes an existing fragment visibly stronger at the target level for every L1-L9', () => {
    buildingKinds.forEach((kind) => {
      const maxLevel = kind === 'clubhouse' ? 10 : 5
      for (let level = 1; level < maxLevel; level += 1) {
        const index = level - 1
        const currentTop = renderedTop(kind, level as BuildingLevel, index)
        const targetTop = renderedTop(kind, (level + 1) as BuildingLevel, index)

        expect(
          targetTop,
          `${kind} fragment ${index} target Lv${level + 1} vs current Lv${level}`,
        ).toBeGreaterThan(currentTop + 0.1)
      }
    })
  })

  it('keeps rooftop attachments resting on their body top at level 10', () => {
    rooftopAttachments.forEach(({ kind, index, attachmentTag }) => {
      const level = kind === 'clubhouse' ? 10 : 5
      const rendered = getRenderedBuildingFragments(kind, progress(kind, level))
      const fragment = rendered[index]
      const bodyTop = partLocalAabb(fragment.parts[0]).max.y
      const attachment = fragment.parts.find(
        (part) => part.tag === attachmentTag,
      )

      expect(attachment, `${kind}[${index}] ${attachmentTag}`).toBeDefined()
      const attachmentBottom = partLocalAabb(attachment!).min.y
      expect(
        attachmentBottom,
        `${kind}[${index}] ${attachmentTag} bottom vs body top`,
      ).toBeGreaterThanOrEqual(bodyTop - 0.05)
    })
  })
})

describe('getRenderedBuildingFragments spatial invariants', () => {
  it('keeps every rendered part inside the footprint and under the hitbox for all full levels', () => {
    buildingKinds.forEach((kind) => {
      BUILDING_LEVELS.forEach((level) => {
        const rendered = getRenderedBuildingFragments(
          kind,
          progress(kind, level),
        )

        rendered.forEach((fragment) => {
          fragment.parts.forEach((part) => {
            expectPartWithinBuildingEnvelope(
              part,
              kind,
              fragment.anchor,
              `${kind} Lv${level} ${fragment.id} (${fragment.state})`,
            )
          })
        })
      })
    })
  })

  it('keeps every rendered part inside the envelope for all partial upgrade states', () => {
    buildingKinds.forEach((kind) => {
      BUILDING_LEVELS.forEach((level) => {
        if (level === 10) {
          return
        }

        const target = level + 1
        for (let completed = 1; completed <= target; completed += 1) {
          const rendered = getRenderedBuildingFragments(
            kind,
            progress(kind, level, completed as ChildBuildingLevel),
          )

          rendered.forEach((fragment) => {
            fragment.parts.forEach((part) => {
              expectPartWithinBuildingEnvelope(
                part,
                kind,
                fragment.anchor,
                `${kind} Lv${level} ${completed}/${target} ${fragment.id} (${fragment.state})`,
              )
            })
          })
        }
      })
    })
  })
})
