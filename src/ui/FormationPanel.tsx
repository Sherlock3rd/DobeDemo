import { useEffect, useState, type JSX } from 'react'
import { heroesConfig } from '../config/heroesConfig'
import type { FormationAssignment } from '../game/combat/power'
import {
  HERO_IDS,
  heroUnlockLevel,
  isHeroUnlocked,
  type HeroId,
  type Row,
} from '../game/heroes'
import { getGangLevel } from '../game/gangProgression'
import { useAdventureStore } from '../store/useAdventureStore'
import { useGangStore } from '../store/useGangStore'
import {
  computeEnemyPowerForStage,
  computeTeamPowerForFormation,
} from './formationPower'

export interface FormationPanelProps {
  stage: number
  onCancel: () => void
  onStart: (stage: number) => void
}

const TITLE_ID = 'formation-panel-title'

const SLOTS: ReadonlyArray<{ row: Row; index: number }> = [
  { row: 'front', index: 0 },
  { row: 'front', index: 1 },
  { row: 'back', index: 0 },
  { row: 'back', index: 1 },
  { row: 'back', index: 2 },
]

function cloneFormation(formation: FormationAssignment): FormationAssignment {
  return formation.map((s) => ({ ...s }))
}

function slotKey(row: Row, index: number): string {
  return `${row}:${index}`
}

export function FormationPanel({
  stage,
  onCancel,
  onStart,
}: FormationPanelProps): JSX.Element {
  const totalReputation = useGangStore((s) => s.totalReputation)
  const storedFormation = useAdventureStore((s) => s.formation)
  const heroLevels = useAdventureStore((s) => s.heroLevels)
  const setFormation = useAdventureStore((s) => s.setFormation)
  const gangLevel = getGangLevel(totalReputation)
  const [draft, setDraft] = useState<FormationAssignment>(() =>
    cloneFormation(storedFormation),
  )
  const [selectedHero, setSelectedHero] = useState<HeroId | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [status, setStatus] = useState('')

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onCancel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onCancel])

  const stopPropagation = (event: { stopPropagation: () => void }): void => {
    event.stopPropagation()
  }

  const ourPower = computeTeamPowerForFormation(draft, heroLevels)
  const enemyPower = computeEnemyPowerForStage(stage)
  const occupied = new Set(draft.map((s) => s.heroId))

  const placeHero = (heroId: HeroId, row: Row, index: number): void => {
    setDraft((current) => {
      const withoutHero = current.filter((s) => s.heroId !== heroId)
      const withoutSlot = withoutHero.filter(
        (s) => !(s.row === row && s.index === index),
      )
      return [...withoutSlot, { heroId, row, index }]
    })
    setSelectedHero(null)
    setSelectedSlot(null)
  }

  const handleSlotClick = (row: Row, index: number): void => {
    const key = slotKey(row, index)
    const occupant = draft.find((s) => s.row === row && s.index === index)

    if (selectedHero) {
      placeHero(selectedHero, row, index)
      return
    }

    if (selectedSlot && selectedSlot !== key) {
      const [fromRow, fromIndexRaw] = selectedSlot.split(':')
      const fromIndex = Number(fromIndexRaw)
      const fromRowTyped = fromRow as Row
      const fromOcc = draft.find(
        (s) => s.row === fromRowTyped && s.index === fromIndex,
      )
      setDraft((current) => {
        const next = current.filter(
          (s) =>
            !(
              (s.row === row && s.index === index) ||
              (s.row === fromRowTyped && s.index === fromIndex)
            ),
        )
        if (fromOcc) next.push({ ...fromOcc, row, index })
        if (occupant) {
          next.push({ ...occupant, row: fromRowTyped, index: fromIndex })
        }
        return next
      })
      setSelectedSlot(null)
      return
    }

    setSelectedSlot(occupant ? key : null)
  }

  const quickDeploy = (): void => {
    const unlocked = HERO_IDS.filter((id) => isHeroUnlocked(id, gangLevel))
    const next: FormationAssignment = []
    const usedSlots = new Set<string>()
    for (const heroId of unlocked) {
      const preferred = heroesConfig.heroes[heroId].defaultSlot
      const preferredKey = slotKey(preferred.row, preferred.index)
      if (!usedSlots.has(preferredKey)) {
        next.push({
          heroId,
          row: preferred.row,
          index: preferred.index,
        })
        usedSlots.add(preferredKey)
        continue
      }
      const free = SLOTS.find(
        (slot) => !usedSlots.has(slotKey(slot.row, slot.index)),
      )
      if (!free) break
      next.push({ heroId, row: free.row, index: free.index })
      usedSlots.add(slotKey(free.row, free.index))
    }
    setDraft(next.length > 0 ? next : cloneFormation(storedFormation))
    setStatus('已快速部署')
  }

  const handleStart = (): void => {
    if (!setFormation(draft, gangLevel)) {
      setStatus('阵容无效：请检查空阵、重复或未解锁英雄')
      return
    }
    onStart(stage)
  }

  return (
    <div
      className="formation-panel__overlay"
      onPointerDown={stopPropagation}
      onClick={stopPropagation}
    >
      <section
        className="formation-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        onPointerDown={stopPropagation}
        onClick={stopPropagation}
      >
        <button
          type="button"
          className="formation-panel__close"
          aria-label="取消编队"
          onClick={onCancel}
        >
          取消
        </button>
        <h2 id={TITLE_ID} className="formation-panel__title">
          {`编队 · 关卡 ${stage}`}
        </h2>

        <div className="formation-panel__powers">
          <p aria-label={`我方战力 ${ourPower}`}>{`我方战力 ${ourPower}`}</p>
          <p
            aria-label={`敌方战力 ${enemyPower}`}
          >{`敌方战力 ${enemyPower}`}</p>
        </div>

        <div className="formation-panel__slots" aria-label="阵位">
          {SLOTS.map((slot) => {
            const occupant = draft.find(
              (s) => s.row === slot.row && s.index === slot.index,
            )
            const name = occupant
              ? heroesConfig.heroes[occupant.heroId].name
              : '空'
            return (
              <button
                key={slotKey(slot.row, slot.index)}
                type="button"
                className={`formation-panel__slot formation-panel__slot--${slot.row}`}
                aria-label={`阵位 ${slot.row} ${slot.index}`}
                aria-pressed={selectedSlot === slotKey(slot.row, slot.index)}
                onClick={() => handleSlotClick(slot.row, slot.index)}
              >
                {`${slot.row}[${slot.index}] ${name}`}
              </button>
            )
          })}
        </div>

        <ul className="formation-panel__heroes">
          {HERO_IDS.map((heroId) => {
            const def = heroesConfig.heroes[heroId]
            const unlocked = isHeroUnlocked(heroId, gangLevel)
            if (!unlocked) {
              return (
                <li key={heroId} className="formation-panel__hero-locked">
                  {`${def.name}·${def.alias} · 帮派 Lv.${heroUnlockLevel(heroId)} 解锁`}
                </li>
              )
            }
            return (
              <li key={heroId}>
                <button
                  type="button"
                  className="formation-panel__hero"
                  aria-pressed={selectedHero === heroId}
                  disabled={occupied.has(heroId) && selectedHero !== heroId}
                  onClick={() =>
                    setSelectedHero((current) =>
                      current === heroId ? null : heroId,
                    )
                  }
                >
                  {`${def.name} Lv.${heroLevels[heroId]}`}
                </button>
              </li>
            )
          })}
        </ul>

        <div className="formation-panel__actions">
          <button
            type="button"
            className="formation-panel__quick"
            onClick={quickDeploy}
          >
            快速部署
          </button>
          <button
            type="button"
            className="formation-panel__start"
            onClick={handleStart}
          >
            开始
          </button>
        </div>
        <p className="formation-panel__status" role="status" aria-live="polite">
          {status}
        </p>
      </section>
    </div>
  )
}
