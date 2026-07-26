import { useEffect, useMemo, useState, type JSX } from 'react'
import { equipmentConfig } from '../config/equipmentConfig'
import { getRacingStage } from '../config/racingConfig'
import { HERO_IDS, isHeroUnlocked, type HeroId } from '../game/heroes'
import { heroesConfig } from '../config/heroesConfig'
import { useAdventureStore } from '../store/useAdventureStore'
import { useGangStore } from '../store/useGangStore'
import { useInitialFocus } from './useInitialFocus'
import { ResourceAmount } from './ResourceAmount'

export interface RacingPanelProps {
  onClose: () => void
  onStart: (stage: number, heroId: HeroId) => void
}

const TITLE_ID = 'racing-panel-title'

export function RacingPanel({
  onClose,
  onStart,
}: RacingPanelProps): JSX.Element {
  const gangLevel = useGangStore((state) => state.currentLevel)
  const highestCleared = useAdventureStore(
    (state) => state.highestClearedRacingStage,
  )
  const equipmentByHero = useAdventureStore((state) => state.equipmentByHero)
  const availableHeroes = useMemo(
    () => HERO_IDS.filter((heroId) => isHeroUnlocked(heroId, gangLevel)),
    [gangLevel],
  )
  const firstReadyHero =
    availableHeroes.find((heroId) => equipmentByHero[heroId].carId) ??
    availableHeroes[0] ??
    'foreman'
  const [selectedHero, setSelectedHero] = useState<HeroId>(firstReadyHero)
  const [status, setStatus] = useState('')
  const titleRef = useInitialFocus<HTMLHeadingElement>()
  const stageNumber = highestCleared + 1
  const complete = stageNumber > 10
  const stage = complete ? null : getRacingStage(stageNumber)
  const equipment = equipmentByHero[selectedHero]
  const canStart =
    stage !== null &&
    equipment.carId !== null &&
    (stage.mode === 'race' || equipment.gunId !== null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const start = (): void => {
    if (!stage) return
    if (!equipment.carId) {
      setStatus('请先在英雄培养中给该英雄装备车辆')
      return
    }
    if (stage.mode === 'pursuit' && !equipment.gunId) {
      setStatus('追击关需要先给该英雄装备枪械')
      return
    }
    onStart(stage.order, selectedHero)
  }

  return (
    <div className="racing-panel__overlay">
      <section
        className="racing-panel"
        role="dialog"
        aria-labelledby={TITLE_ID}
      >
        <button type="button" className="racing-panel__close" onClick={onClose}>
          关闭
        </button>
        <header className="racing-panel__header">
          <p>ROAD SUPREMACY</p>
          <h2 ref={titleRef} id={TITLE_ID} tabIndex={-1}>
            公路争霸
          </h2>
          <span>{`已完成 ${highestCleared}/10`}</span>
        </header>

        {complete ? (
          <div className="racing-panel__complete" role="status">
            <strong>十关全部完成</strong>
            <p>你已经统治这片公路。已通关关卡不可重复挑战。</p>
          </div>
        ) : stage ? (
          <>
            <article className="racing-panel__stage">
              <div>
                <span>{`第 ${stage.order} 关`}</span>
                <h3>{stage.title}</h3>
                <p>{stage.mode === 'race' ? '竞速关卡' : '追击枪战'}</p>
              </div>
              <dl>
                <div>
                  <dt>目标里程</dt>
                  <dd>{`${stage.distance} m`}</dd>
                </div>
                <div>
                  <dt>限时</dt>
                  <dd>{`${Math.round(stage.durationMs / 1000)} 秒`}</dd>
                </div>
                <div>
                  <dt>首通经验</dt>
                  <dd>
                    <ResourceAmount
                      kind="experience"
                      amount={stage.firstClearExp}
                      showLabel={false}
                    />
                  </dd>
                </div>
                <div>
                  <dt>首通钱</dt>
                  <dd>
                    <ResourceAmount
                      kind="money"
                      amount={stage.firstClearMoney}
                      showLabel={false}
                    />
                  </dd>
                </div>
                <div>
                  <dt>配件概率</dt>
                  <dd>
                    <ResourceAmount
                      kind="part"
                      amount={`${Math.round(stage.partDropChance * 100)}%`}
                      showLabel={false}
                    />
                  </dd>
                </div>
              </dl>
            </article>

            <div className="racing-panel__heroes" aria-label="选择驾驶英雄">
              {availableHeroes.map((heroId) => {
                const gear = equipmentByHero[heroId]
                return (
                  <button
                    type="button"
                    key={heroId}
                    aria-pressed={selectedHero === heroId}
                    onClick={() => {
                      setSelectedHero(heroId)
                      setStatus('')
                    }}
                  >
                    <strong>{heroesConfig.heroes[heroId].name}</strong>
                    <span>
                      {gear.carId
                        ? equipmentConfig.cars[gear.carId].name
                        : '未装备车辆'}
                    </span>
                    <span>
                      {gear.gunId
                        ? equipmentConfig.guns[gear.gunId].name
                        : '未装备枪械'}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="racing-panel__brief">
              <p>
                {stage.mode === 'race'
                  ? '点按 ←→ / A D 换道 · 按住方向漂移 · 空中按方向做特技 · 空格释放氮气 · 满三格双击超级飞跃'
                  : '点按 ←→ / A D 换道并保持射界 · 普通攻击自动开火 · F 短时强化火力'}
              </p>
              <p>
                {stage.mode === 'race'
                  ? '七车同场：落后车辆会更快补充氮气，利用尾流、冲撞、跳台和特技持续争夺。'
                  : stage.escortCount === 0
                    ? '纯追击枪战不使用氮气加速；本关目标没有护卫，保持射界并摧毁目标车。'
                    : `纯追击枪战不使用氮气加速；突破 ${stage.escortCount} 辆护卫取得射界，并在敌方反击下摧毁目标车。`}
              </p>
            </div>
            <button
              type="button"
              className="racing-panel__start"
              disabled={!canStart}
              onClick={start}
            >
              发车
            </button>
          </>
        ) : null}
        <p className="racing-panel__status" role="status">
          {status}
        </p>
      </section>
    </div>
  )
}
