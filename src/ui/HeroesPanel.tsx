import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type JSX,
} from 'react'
import { equipmentConfig } from '../config/equipmentConfig'
import { expToLevel, heroesConfig } from '../config/heroesConfig'
import { unitPower } from '../game/combat/power'
import {
  CAR_PART_INVENTORY_LIMIT,
  CAR_PART_QUALITY_INFO,
  CAR_PART_SLOT_INFO,
  getCarPartRecycleValue,
  getCarPartUpgradeCost,
  getGunHeroAtk,
  getGunPursuitDamage,
  getGunUpgradeCost,
  isPartInstalled,
} from '../game/equipmentProgression'
import {
  CAR_IDS,
  CAR_PART_QUALITY_IDS,
  CAR_PART_SLOT_IDS,
  GUN_IDS,
  type CarId,
  type CarPartInstance,
  type CarPartQuality,
  type CarPartSlot,
  type GunId,
} from '../game/equipmentTypes'
import { isBuildingUnlocked } from '../game/gangProgression'
import { getHeroCombatStats } from '../game/heroEquipment'
import {
  HERO_IDS,
  getHeroLevelCap,
  heroUnlockLevel,
  isHeroUnlocked,
  type HeroId,
} from '../game/heroes'
import { isCarUnlocked, isGunUnlocked } from '../game/progressionUnlocks'
import { useAdventureStore } from '../store/useAdventureStore'
import { useGangStore } from '../store/useGangStore'
import { useInitialFocus } from './useInitialFocus'
import { ResourceAmount } from './ResourceAmount'

export interface HeroesPanelProps {
  onClose: () => void
  initialTab?: DevelopmentTab
}

export type DevelopmentTab = 'level' | 'car' | 'gun'
type EquipmentPicker = Exclude<DevelopmentTab, 'level'>

const TITLE_ID = 'heroes-panel-title'
const SKILL_LABEL_ID = 'heroes-panel-skill-label'
const SKILL_TITLE_ID = 'heroes-panel-skill-title'

function upgradeFeedback(
  reason: string,
  name: string,
  level: number,
  sharedExp: number,
): string {
  switch (reason) {
    case 'ready':
      return `已升级 ${name} 至 Lv.${level + 1}`
    case 'hero-level-capped-by-gang':
      return '英雄等级不能超过帮派等级'
    case 'hero-maxed':
      return '已达到最高等级 Lv.50'
    case 'insufficient-shared-exp':
      return `英雄经验不足，还需 ${expToLevel(level) - sharedExp}`
    default:
      return '无法升级'
  }
}

function HeroPortrait({ heroId }: { heroId: HeroId }): JSX.Element {
  const appearance = heroesConfig.heroes[heroId].appearance
  const style = {
    '--hero-primary': appearance.primaryColor,
    '--hero-accent': appearance.accentColor,
  } as CSSProperties
  return (
    <div
      className={`heroes-panel__portrait heroes-panel__portrait--${appearance.silhouette}`}
      style={style}
      aria-hidden="true"
    >
      <span className="heroes-panel__portrait-glow" />
      <span className="heroes-panel__portrait-head" />
      <span className="heroes-panel__portrait-body" />
      <span
        className={`heroes-panel__portrait-weapon heroes-panel__portrait-weapon--${appearance.weapon}`}
      />
      <span className="heroes-panel__portrait-badge">{appearance.weapon}</span>
    </div>
  )
}

function PartCard({
  part,
  compact = false,
}: {
  part: CarPartInstance
  compact?: boolean
}): JSX.Element {
  const quality = CAR_PART_QUALITY_INFO[part.quality]
  return (
    <span
      className={`heroes-panel__part-card${
        compact ? ' heroes-panel__part-card--compact' : ''
      }`}
      style={{ '--part-quality': quality.color } as CSSProperties}
    >
      <span className="heroes-panel__part-icon">
        {CAR_PART_SLOT_INFO[part.slot].shortName.slice(0, 1)}
      </span>
      <span>
        <strong>{CAR_PART_SLOT_INFO[part.slot].name}</strong>
        <span className="heroes-panel__part-tags">
          <em>{CAR_PART_SLOT_INFO[part.slot].shortName}</em>
          <em>{quality.name}</em>
          <em>{`Lv.${part.level}`}</em>
        </span>
      </span>
    </span>
  )
}

export function HeroesPanel({
  onClose,
  initialTab = 'level',
}: HeroesPanelProps): JSX.Element {
  const gangLevel = useGangStore((state) => state.currentLevel)
  const heroLevels = useAdventureStore((state) => state.heroLevels)
  const sharedExp = useAdventureStore((state) => state.sharedExp)
  const equipmentByHero = useAdventureStore((state) => state.equipmentByHero)
  const spareParts = useAdventureStore((state) => state.spareParts)
  const gunLevels = useAdventureStore((state) => state.gunLevels)
  const carPartInventory = useAdventureStore((state) => state.carPartInventory)
  const carPartSlotsByCar = useAdventureStore(
    (state) => state.carPartSlotsByCar,
  )
  const chapterUnlockedCarIds = useAdventureStore(
    (state) => state.chapterUnlockedCarIds,
  )
  const chapterUnlockedGunIds = useAdventureStore(
    (state) => state.chapterUnlockedGunIds,
  )
  const upgradeHero = useAdventureStore((state) => state.upgradeHero)
  const equipCar = useAdventureStore((state) => state.equipCar)
  const equipGun = useAdventureStore((state) => state.equipGun)
  const equipCarPart = useAdventureStore((state) => state.equipCarPart)
  const unequipCarPart = useAdventureStore((state) => state.unequipCarPart)
  const recycleCarPart = useAdventureStore((state) => state.recycleCarPart)
  const recycleCarPartsByQuality = useAdventureStore(
    (state) => state.recycleCarPartsByQuality,
  )
  const upgradeCarPart = useAdventureStore((state) => state.upgradeCarPart)
  const upgradeGun = useAdventureStore((state) => state.upgradeGun)
  const [selectedHero, setSelectedHero] = useState<HeroId>('foreman')
  const [activeTab, setActiveTab] = useState<DevelopmentTab>(initialTab)
  const [equipmentPicker, setEquipmentPicker] =
    useState<EquipmentPicker | null>(null)
  const [partPickerSlot, setPartPickerSlot] = useState<CarPartSlot | null>(null)
  const [status, setStatus] = useState('')
  const titleRef = useInitialFocus<HTMLHeadingElement>()
  const cap = getHeroLevelCap(gangLevel)
  const equipmentLevelCap = Math.max(1, ...Object.values(heroLevels))
  const progression = useMemo(
    () => ({ gunLevels, carPartInventory, carPartSlotsByCar }),
    [carPartInventory, carPartSlotsByCar, gunLevels],
  )
  const selectedDefinition = heroesConfig.heroes[selectedHero]
  const selectedLevel = heroLevels[selectedHero]
  const selectedEquipment = equipmentByHero[selectedHero]
  const selectedCarName = selectedEquipment.carId
    ? equipmentConfig.cars[selectedEquipment.carId].name
    : '未装备'
  const selectedGunName = selectedEquipment.gunId
    ? equipmentConfig.guns[selectedEquipment.gunId].name
    : '未装备'
  const selectedStats = getHeroCombatStats(
    selectedHero,
    selectedLevel,
    selectedEquipment,
    progression,
  )
  const selectedPower = unitPower(selectedDefinition.role, selectedStats)
  const selectedSkill = selectedDefinition.skill
  const inventoryById = useMemo(
    () => new Map(carPartInventory.map((part) => [part.id, part])),
    [carPartInventory],
  )
  const availableParts = carPartInventory.filter(
    (part) => !isPartInstalled(part.id, carPartSlotsByCar),
  )
  const yardUnlocked = isBuildingUnlocked('recycling-yard', gangLevel)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      if (partPickerSlot) {
        setPartPickerSlot(null)
        return
      }
      if (equipmentPicker) {
        setEquipmentPicker(null)
        return
      }
      onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [equipmentPicker, onClose, partPickerSlot])

  const stopPropagation = (event: { stopPropagation: () => void }): void => {
    event.stopPropagation()
  }

  const carOwner = (carId: CarId): HeroId | null =>
    HERO_IDS.find((heroId) => equipmentByHero[heroId].carId === carId) ?? null

  const gunOwner = (gunId: GunId): HeroId | null =>
    HERO_IDS.find((heroId) => equipmentByHero[heroId].gunId === gunId) ?? null

  const partCar = (part: CarPartInstance): CarId | null =>
    CAR_IDS.find((carId) => carPartSlotsByCar[carId][part.slot] === part.id) ??
    null

  const handleHeroUpgrade = (): void => {
    const result = upgradeHero(selectedHero, gangLevel)
    setStatus(
      upgradeFeedback(
        result.reason,
        selectedDefinition.name,
        selectedLevel,
        sharedExp,
      ),
    )
  }

  const handleCar = (carId: CarId): void => {
    if (!equipCar(selectedHero, carId, gangLevel)) {
      setStatus('无法装备该车辆')
      return
    }
    setStatus(
      `${equipmentConfig.cars[carId].name} 已装备给 ${selectedDefinition.name}`,
    )
    setEquipmentPicker(null)
    setPartPickerSlot(null)
  }

  const handleGun = (gunId: GunId): void => {
    if (!equipGun(selectedHero, gunId, gangLevel)) {
      setStatus('无法装备该枪械')
      return
    }
    setStatus(
      `${equipmentConfig.guns[gunId].name} 已装备给 ${selectedDefinition.name}`,
    )
    setEquipmentPicker(null)
  }

  const handleInstallPart = (part: CarPartInstance): void => {
    if (!selectedEquipment.carId) {
      setStatus('请先给英雄装备车辆')
      return
    }
    const result = equipCarPart(selectedEquipment.carId, part.id, gangLevel)
    setStatus(
      result.applied
        ? `${CAR_PART_SLOT_INFO[part.slot].name} 已安装到 ${
            equipmentConfig.cars[selectedEquipment.carId].name
          }`
        : '无法安装该配件',
    )
    if (result.applied) setPartPickerSlot(null)
  }

  const handleUpgradePart = (part: CarPartInstance): void => {
    const result = upgradeCarPart(part.id)
    setStatus(
      result.applied
        ? `${CAR_PART_SLOT_INFO[part.slot].name} 已升级至 Lv.${part.level + 1}`
        : result.reason === 'insufficient-spare-parts'
          ? `零件不足，需要 ${result.cost ?? 0}`
          : result.reason === 'max-level'
            ? '该配件已经满级'
            : '无法升级该配件',
    )
  }

  const handleRecyclePart = (part: CarPartInstance): void => {
    const result = recycleCarPart(part.id)
    setStatus(
      result.applied
        ? `已回收 ${CAR_PART_SLOT_INFO[part.slot].name}，零件 +${
            result.gained ?? 0
          }`
        : result.reason === 'part-installed'
          ? '已安装的配件需要先卸下'
          : '无法回收该配件',
    )
  }

  const handleRecycleQuality = (quality: CarPartQuality): void => {
    const result = recycleCarPartsByQuality(quality)
    setStatus(
      result.applied
        ? `已回收 ${result.recycledCount ?? 0} 件${
            CAR_PART_QUALITY_INFO[quality].name
          }配件，零件 +${result.gained ?? 0}`
        : `没有可回收的${CAR_PART_QUALITY_INFO[quality].name}配件`,
    )
  }

  const handleUpgradeGun = (gunId: GunId): void => {
    const result = upgradeGun(gunId, gangLevel)
    setStatus(
      result.applied
        ? `${equipmentConfig.guns[gunId].name} 已升级至 Lv.${
            gunLevels[gunId] + 1
          }`
        : result.reason === 'insufficient-spare-parts'
          ? `零件不足，需要 ${result.cost ?? 0}`
          : result.reason === 'max-level'
            ? '该枪械已经满级'
            : '无法升级该枪械',
    )
  }

  return (
    <div
      className="heroes-panel__overlay"
      onPointerDown={stopPropagation}
      onClick={stopPropagation}
    >
      <section
        className="heroes-panel"
        role="dialog"
        aria-labelledby={TITLE_ID}
        onPointerDown={stopPropagation}
        onClick={stopPropagation}
      >
        <header className="heroes-panel__header">
          <div>
            <p>CREW DEVELOPMENT</p>
            <h2 ref={titleRef} id={TITLE_ID} tabIndex={-1}>
              英雄培养
            </h2>
          </div>
          <div className="heroes-panel__resources" aria-label="养成资源">
            <ResourceAmount kind="experience" amount={sharedExp} />
            <ResourceAmount kind="spare-parts" amount={spareParts} />
            <span>
              <small>等级上限</small>
              <strong>{`Lv.${cap}`}</strong>
            </span>
          </div>
          <button
            type="button"
            className="heroes-panel__close"
            aria-label="关闭英雄培养"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="heroes-panel__layout">
          <nav className="heroes-panel__roster" aria-label="英雄列表">
            {HERO_IDS.map((heroId) => {
              const definition = heroesConfig.heroes[heroId]
              const unlocked = isHeroUnlocked(heroId, gangLevel)
              return (
                <button
                  type="button"
                  key={heroId}
                  className="heroes-panel__hero-button"
                  aria-pressed={selectedHero === heroId}
                  disabled={!unlocked}
                  onClick={() => {
                    setSelectedHero(heroId)
                    setEquipmentPicker(null)
                    setPartPickerSlot(null)
                    setStatus('')
                  }}
                >
                  <span
                    className="heroes-panel__hero-swatch"
                    style={{
                      background: definition.appearance.primaryColor,
                    }}
                  />
                  <span>
                    <strong>{definition.name}</strong>
                    <small>
                      {unlocked
                        ? `${definition.alias} · Lv.${heroLevels[heroId]}`
                        : `${definition.alias} · 帮派 Lv.${heroUnlockLevel(heroId)} 解锁`}
                    </small>
                  </span>
                  {unlocked ? (
                    <b>
                      {unitPower(
                        definition.role,
                        getHeroCombatStats(
                          heroId,
                          heroLevels[heroId],
                          equipmentByHero[heroId],
                          progression,
                        ),
                      )}
                    </b>
                  ) : (
                    <b>锁定</b>
                  )}
                </button>
              )
            })}
          </nav>

          <article className="heroes-panel__showcase">
            <div className="heroes-panel__identity">
              <p>{`${selectedDefinition.alias} · ${
                selectedDefinition.role === 'front' ? '前排防卫' : '后排火力'
              }`}</p>
              <div className="heroes-panel__identity-copy">
                <h3>{selectedDefinition.name}</h3>
                <span className="heroes-panel__identity-level">{`Lv.${selectedLevel}`}</span>
                <ResourceAmount
                  kind="power"
                  label="英雄战力"
                  amount={selectedPower}
                />
              </div>
            </div>
            <HeroPortrait heroId={selectedHero} />
            <dl className="heroes-panel__stats">
              <div>
                <dt>HP</dt>
                <dd>{selectedStats.hp}</dd>
              </div>
              <div>
                <dt>ATK</dt>
                <dd>{selectedStats.atk}</dd>
              </div>
              <div>
                <dt>DEF</dt>
                <dd>{selectedStats.def}</dd>
              </div>
            </dl>
            <section
              className="heroes-panel__skill"
              aria-labelledby={`${SKILL_LABEL_ID} ${SKILL_TITLE_ID}`}
            >
              <header>
                <span id={SKILL_LABEL_ID}>主动技能</span>
                <h4 id={SKILL_TITLE_ID}>{selectedSkill.name}</h4>
              </header>
              <p>{selectedSkill.description}</p>
              <div className="heroes-panel__skill-rage">
                <strong>满怒自动释放</strong>
              </div>
            </section>
          </article>

          <section className="heroes-panel__development">
            <nav className="heroes-panel__tabs" aria-label="养成分类">
              {(
                [
                  ['level', '等级', `Lv.${selectedLevel}`],
                  ['car', '车辆', selectedCarName],
                  ['gun', '枪械', selectedGunName],
                ] as const
              ).map(([tab, label, equipmentName]) => (
                <button
                  type="button"
                  key={tab}
                  aria-pressed={activeTab === tab}
                  aria-label={`${label} · ${equipmentName}`}
                  onClick={() => {
                    setActiveTab(tab)
                    setEquipmentPicker(null)
                    setPartPickerSlot(null)
                    setStatus('')
                  }}
                >
                  <strong>{label}</strong>
                  <small>{equipmentName}</small>
                </button>
              ))}
            </nav>

            {activeTab === 'level' ? (
              <div className="heroes-panel__level-pane">
                <div className="heroes-panel__level-ring">
                  <small>当前等级</small>
                  <strong>{selectedLevel}</strong>
                  <span>{`/ ${cap}`}</span>
                </div>
                <div className="heroes-panel__level-growth">
                  <h4>升级成长</h4>
                  <p>{`HP +${selectedDefinition.hpPerLevel}`}</p>
                  <p>{`ATK +${selectedDefinition.atkPerLevel}`}</p>
                  <p>{`DEF +${selectedDefinition.defPerLevel}`}</p>
                </div>
                <button
                  type="button"
                  className="heroes-panel__primary-action"
                  onClick={handleHeroUpgrade}
                >
                  {selectedLevel >= 50
                    ? '等级已满'
                    : `提升至 Lv.${selectedLevel + 1} · 经验 ${expToLevel(
                        selectedLevel,
                      )}`}
                </button>
              </div>
            ) : null}

            {equipmentPicker === 'car' ? (
              <div className="heroes-panel__picker" aria-label="选择装备车辆">
                <header className="heroes-panel__picker-header">
                  <button
                    type="button"
                    onClick={() => setEquipmentPicker(null)}
                  >
                    ← 返回当前车辆
                  </button>
                  <div>
                    <p>VEHICLE LOADOUT</p>
                    <h4>选择车辆</h4>
                    <span>{`为 ${selectedDefinition.name} 选择座驾，装备后自动返回养成页。`}</span>
                  </div>
                </header>
                <div className="heroes-panel__picker-grid">
                  {CAR_IDS.filter((carId) =>
                    isCarUnlocked(carId, gangLevel, chapterUnlockedCarIds),
                  ).map((carId) => {
                    const owner = carOwner(carId)
                    const definition = equipmentConfig.cars[carId]
                    const equipped = selectedEquipment.carId === carId
                    const installedCount = CAR_PART_SLOT_IDS.filter(
                      (slot) => carPartSlotsByCar[carId][slot] !== null,
                    ).length
                    return (
                      <article
                        key={carId}
                        className="heroes-panel__picker-card"
                        aria-current={equipped ? 'true' : undefined}
                      >
                        <div
                          className="heroes-panel__picker-car"
                          style={
                            {
                              '--car-body': definition.appearance.body,
                              '--car-accent': definition.appearance.accent,
                            } as CSSProperties
                          }
                          aria-hidden="true"
                        >
                          <span />
                          <i />
                        </div>
                        <div className="heroes-panel__picker-copy">
                          <span>
                            {equipped
                              ? '当前装备'
                              : owner
                                ? `${heroesConfig.heroes[owner].name} 使用中`
                                : '车库待命'}
                          </span>
                          <h5>{definition.name}</h5>
                          <p>{definition.description}</p>
                          <dl>
                            <div>
                              <dt>英雄增益</dt>
                              <dd>{`HP +${definition.heroBonus.hp} / DEF +${definition.heroBonus.def}`}</dd>
                            </div>
                            <div>
                              <dt>车辆性能</dt>
                              <dd>{`极速 ${definition.racing.maxSpeed} / 耐久 ${definition.racing.durability}`}</dd>
                            </div>
                            <div>
                              <dt>已装配件</dt>
                              <dd>{`${installedCount}/4`}</dd>
                            </div>
                          </dl>
                        </div>
                        <button
                          type="button"
                          disabled={equipped}
                          onClick={() => handleCar(carId)}
                        >
                          {equipped
                            ? '当前已装备'
                            : owner
                              ? '转移并装备'
                              : '装备此车辆'}
                        </button>
                      </article>
                    )
                  })}
                </div>
              </div>
            ) : null}

            {equipmentPicker === 'gun' ? (
              <div className="heroes-panel__picker" aria-label="选择装备枪械">
                <header className="heroes-panel__picker-header">
                  <button
                    type="button"
                    onClick={() => setEquipmentPicker(null)}
                  >
                    ← 返回当前枪械
                  </button>
                  <div>
                    <p>WEAPON LOADOUT</p>
                    <h4>选择枪械</h4>
                    <span>{`为 ${selectedDefinition.name} 选择武器，装备后自动返回养成页。`}</span>
                  </div>
                </header>
                <div className="heroes-panel__picker-grid">
                  {GUN_IDS.filter((gunId) =>
                    isGunUnlocked(gunId, gangLevel, chapterUnlockedGunIds),
                  ).map((gunId) => {
                    const owner = gunOwner(gunId)
                    const definition = equipmentConfig.guns[gunId]
                    const equipped = selectedEquipment.gunId === gunId
                    return (
                      <article
                        key={gunId}
                        className="heroes-panel__picker-card"
                        aria-current={equipped ? 'true' : undefined}
                      >
                        <div
                          className="heroes-panel__picker-gun"
                          style={
                            {
                              '--gun-metal': definition.appearance.metal,
                              '--gun-flash': definition.appearance.flash,
                            } as CSSProperties
                          }
                          aria-hidden="true"
                        >
                          <span />
                        </div>
                        <div className="heroes-panel__picker-copy">
                          <span>
                            {equipped
                              ? '当前装备'
                              : owner
                                ? `${heroesConfig.heroes[owner].name} 使用中`
                                : '武器库待命'}
                          </span>
                          <h5>{definition.name}</h5>
                          <p>{definition.description}</p>
                          <dl>
                            <div>
                              <dt>强化等级</dt>
                              <dd>{`Lv.${gunLevels[gunId]}/${equipmentLevelCap}`}</dd>
                            </div>
                            <div>
                              <dt>英雄 ATK</dt>
                              <dd>{`+${getGunHeroAtk(gunId, progression)}`}</dd>
                            </div>
                            <div>
                              <dt>追击性能</dt>
                              <dd>{`伤害 ${getGunPursuitDamage(
                                gunId,
                                gunLevels[gunId],
                              )} / 射程 ${definition.pursuit.range}`}</dd>
                            </div>
                          </dl>
                        </div>
                        <button
                          type="button"
                          disabled={equipped}
                          onClick={() => handleGun(gunId)}
                        >
                          {equipped
                            ? '当前已装备'
                            : owner
                              ? '转移并装备'
                              : '装备此枪械'}
                        </button>
                      </article>
                    )
                  })}
                </div>
              </div>
            ) : null}

            {activeTab === 'car' &&
            equipmentPicker === null &&
            partPickerSlot &&
            selectedEquipment.carId ? (
              <div className="heroes-panel__picker" aria-label="选择车辆配件">
                <header className="heroes-panel__picker-header">
                  <button type="button" onClick={() => setPartPickerSlot(null)}>
                    ← 返回当前车辆
                  </button>
                  <div>
                    <p>PART LOADOUT · FIXED SLOT</p>
                    <h4>{`选择${CAR_PART_SLOT_INFO[partPickerSlot].shortName}`}</h4>
                    <span>{`为 ${
                      equipmentConfig.cars[selectedEquipment.carId].name
                    } 的${CAR_PART_SLOT_INFO[partPickerSlot].shortName}部位选择兼容配件。`}</span>
                  </div>
                </header>
                <div className="heroes-panel__picker-grid">
                  {carPartInventory.filter(
                    (part) => part.slot === partPickerSlot,
                  ).length > 0 ? (
                    carPartInventory
                      .filter((part) => part.slot === partPickerSlot)
                      .map((part) => {
                        const installedCarId = partCar(part)
                        const equipped =
                          installedCarId === selectedEquipment.carId
                        const quality = CAR_PART_QUALITY_INFO[part.quality]
                        return (
                          <article
                            key={part.id}
                            className="heroes-panel__picker-card heroes-panel__picker-card--part"
                            aria-current={equipped ? 'true' : undefined}
                            style={
                              {
                                '--part-quality': quality.color,
                              } as CSSProperties
                            }
                          >
                            <div
                              className="heroes-panel__picker-part"
                              aria-hidden="true"
                            >
                              {CAR_PART_SLOT_INFO[part.slot].shortName.slice(
                                0,
                                1,
                              )}
                            </div>
                            <div className="heroes-panel__picker-copy">
                              <span>
                                {equipped
                                  ? '当前安装'
                                  : installedCarId
                                    ? `${
                                        equipmentConfig.cars[installedCarId]
                                          .name
                                      } 使用中`
                                    : '仓库待命'}
                              </span>
                              <h5>{CAR_PART_SLOT_INFO[part.slot].name}</h5>
                              <span className="heroes-panel__part-tags">
                                <em>
                                  {CAR_PART_SLOT_INFO[part.slot].shortName}
                                </em>
                                <em>{quality.name}</em>
                                <em>{`Lv.${part.level}`}</em>
                              </span>
                              <p>{CAR_PART_SLOT_INFO[part.slot].description}</p>
                              <dl>
                                <div>
                                  <dt>品质强度</dt>
                                  <dd>{`${quality.strength}×`}</dd>
                                </div>
                                <div>
                                  <dt>升级成本</dt>
                                  <dd>
                                    {part.level >= equipmentLevelCap
                                      ? '已满级'
                                      : `${getCarPartUpgradeCost(part)} 零件`}
                                  </dd>
                                </div>
                                <div>
                                  <dt>回收价值</dt>
                                  <dd>{`${getCarPartRecycleValue(part)} 零件`}</dd>
                                </div>
                              </dl>
                            </div>
                            <div className="heroes-panel__picker-actions">
                              <button
                                type="button"
                                disabled={equipped}
                                onClick={() => handleInstallPart(part)}
                              >
                                {equipped
                                  ? '当前已安装'
                                  : installedCarId
                                    ? '转移并安装'
                                    : `安装到${CAR_PART_SLOT_INFO[part.slot].shortName}`}
                              </button>
                              <button
                                type="button"
                                disabled={installedCarId !== null}
                                onClick={() => handleRecyclePart(part)}
                              >
                                {installedCarId
                                  ? '使用中不可回收'
                                  : `回收 +${getCarPartRecycleValue(part)}`}
                              </button>
                            </div>
                          </article>
                        )
                      })
                  ) : (
                    <p className="heroes-panel__empty">
                      {yardUnlocked
                        ? `仓库暂无${CAR_PART_SLOT_INFO[partPickerSlot].shortName}配件，请前往废车回收厂生产页领取。`
                        : '解锁废车回收厂后即可在生产页累计并领取车辆配件。'}
                    </p>
                  )}
                </div>
              </div>
            ) : null}

            {activeTab === 'car' &&
            equipmentPicker === null &&
            partPickerSlot === null ? (
              <div className="heroes-panel__car-pane">
                {selectedEquipment.carId ? (
                  <>
                    <div className="heroes-panel__car-focus">
                      <div
                        className="heroes-panel__car-art"
                        style={
                          {
                            '--car-body':
                              equipmentConfig.cars[selectedEquipment.carId]
                                .appearance.body,
                            '--car-accent':
                              equipmentConfig.cars[selectedEquipment.carId]
                                .appearance.accent,
                          } as CSSProperties
                        }
                        aria-hidden="true"
                      >
                        <span />
                        <i />
                        <b />
                      </div>
                      <div>
                        <small>{`当前装备 · ${selectedDefinition.name}`}</small>
                        <strong>
                          {equipmentConfig.cars[selectedEquipment.carId].name}
                        </strong>
                        <p>
                          {
                            equipmentConfig.cars[selectedEquipment.carId]
                              .description
                          }
                        </p>
                      </div>
                      <button
                        type="button"
                        className="heroes-panel__change-equipment"
                        onClick={() => {
                          setEquipmentPicker('car')
                          setPartPickerSlot(null)
                          setStatus('')
                        }}
                      >
                        更换车辆
                      </button>
                    </div>

                    <div
                      className="heroes-panel__part-slots"
                      aria-label="车辆配件槽"
                    >
                      {CAR_PART_SLOT_IDS.map((slot) => {
                        const partId =
                          carPartSlotsByCar[selectedEquipment.carId as CarId][
                            slot
                          ]
                        const part = partId
                          ? inventoryById.get(partId)
                          : undefined
                        return (
                          <article key={slot}>
                            <header>
                              <span>
                                {CAR_PART_SLOT_INFO[slot].shortName}
                                <em>固定部位</em>
                              </span>
                              <small>
                                {CAR_PART_SLOT_INFO[slot].description}
                              </small>
                            </header>
                            {part ? (
                              <>
                                <PartCard part={part} compact />
                                <div className="heroes-panel__part-slot-actions">
                                  <button
                                    type="button"
                                    onClick={() => handleUpgradePart(part)}
                                  >
                                    {part.level >= equipmentLevelCap
                                      ? '已满级'
                                      : `升级 · ${getCarPartUpgradeCost(part)} 零件`}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPartPickerSlot(slot)
                                      setStatus('')
                                    }}
                                  >
                                    更换
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!selectedEquipment.carId) return
                                      unequipCarPart(
                                        selectedEquipment.carId,
                                        slot,
                                        gangLevel,
                                      )
                                      setStatus(
                                        `已卸下 ${CAR_PART_SLOT_INFO[slot].name}`,
                                      )
                                    }}
                                  >
                                    卸下
                                  </button>
                                </div>
                              </>
                            ) : (
                              <div className="heroes-panel__part-slot-empty">
                                <p>尚未安装兼容配件</p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPartPickerSlot(slot)
                                    setStatus('')
                                  }}
                                >
                                  {`选择${CAR_PART_SLOT_INFO[slot].shortName}`}
                                </button>
                              </div>
                            )}
                          </article>
                        )
                      })}
                    </div>

                    <div className="heroes-panel__part-storage-summary">
                      <div>
                        <strong>{`配件仓库 ${carPartInventory.length}/${CAR_PART_INVENTORY_LIMIT}`}</strong>
                        <span>
                          点击固定部位后，只会显示可以安装到该部位的配件。
                        </span>
                        <div
                          className="heroes-panel__bulk-recycle"
                          aria-label="按品质一键回收"
                        >
                          {CAR_PART_QUALITY_IDS.map((quality) => {
                            const parts = availableParts.filter(
                              (part) => part.quality === quality,
                            )
                            const value = parts.reduce(
                              (total, part) =>
                                total + getCarPartRecycleValue(part),
                              0,
                            )
                            return (
                              <button
                                type="button"
                                key={quality}
                                disabled={parts.length === 0}
                                onClick={() => handleRecycleQuality(quality)}
                              >
                                {`一键回收${
                                  CAR_PART_QUALITY_INFO[quality].name
                                } ${parts.length}件 · +${value}`}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                      <b>{`待命 ${availableParts.length}`}</b>
                    </div>
                  </>
                ) : (
                  <div className="heroes-panel__empty">
                    <p>当前没有装备车辆。</p>
                    <button
                      type="button"
                      onClick={() => {
                        setEquipmentPicker('car')
                        setPartPickerSlot(null)
                      }}
                    >
                      选择车辆
                    </button>
                  </div>
                )}
              </div>
            ) : null}

            {activeTab === 'gun' && equipmentPicker === null ? (
              <div className="heroes-panel__gun-pane">
                {selectedEquipment.gunId ? (
                  <div className="heroes-panel__gun-focus">
                    <div
                      className="heroes-panel__gun-art"
                      style={
                        {
                          '--gun-metal':
                            equipmentConfig.guns[selectedEquipment.gunId]
                              .appearance.metal,
                          '--gun-flash':
                            equipmentConfig.guns[selectedEquipment.gunId]
                              .appearance.flash,
                        } as CSSProperties
                      }
                      aria-hidden="true"
                    >
                      <span />
                      <i />
                    </div>
                    <div className="heroes-panel__gun-info">
                      <p>{`当前装备 · ${selectedDefinition.name}`}</p>
                      <h4>
                        {equipmentConfig.guns[selectedEquipment.gunId].name}
                      </h4>
                      <span>{`强化 Lv.${
                        gunLevels[selectedEquipment.gunId]
                      }/${equipmentLevelCap}`}</span>
                      <dl>
                        <div>
                          <dt>英雄 ATK</dt>
                          <dd>
                            {getGunHeroAtk(
                              selectedEquipment.gunId,
                              progression,
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt>追击伤害</dt>
                          <dd>
                            {getGunPursuitDamage(
                              selectedEquipment.gunId,
                              gunLevels[selectedEquipment.gunId],
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt>射程</dt>
                          <dd>
                            {
                              equipmentConfig.guns[selectedEquipment.gunId]
                                .pursuit.range
                            }
                          </dd>
                        </div>
                      </dl>
                      <div className="heroes-panel__gun-actions">
                        <button
                          type="button"
                          className="heroes-panel__change-equipment"
                          onClick={() => {
                            setEquipmentPicker('gun')
                            setStatus('')
                          }}
                        >
                          更换枪械
                        </button>
                        <button
                          type="button"
                          className="heroes-panel__primary-action"
                          onClick={() =>
                            handleUpgradeGun(selectedEquipment.gunId as GunId)
                          }
                        >
                          {gunLevels[selectedEquipment.gunId] >=
                          equipmentLevelCap
                            ? '枪械已满级'
                            : `升级至 Lv.${
                                gunLevels[selectedEquipment.gunId] + 1
                              } · ${getGunUpgradeCost(
                                selectedEquipment.gunId,
                                gunLevels[selectedEquipment.gunId],
                              )} 零件`}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="heroes-panel__empty">
                    <p>当前没有装备枪械。</p>
                    <button
                      type="button"
                      onClick={() => setEquipmentPicker('gun')}
                    >
                      选择枪械
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </section>
        </div>

        <p className="heroes-panel__status" role="status" aria-live="polite">
          {status}
        </p>
      </section>
    </div>
  )
}
