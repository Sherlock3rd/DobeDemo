import { useEffect, useRef, type CSSProperties, type JSX } from 'react'
import {
  STORY_STEPS,
  type StoryArtworkId,
  type StoryStep,
} from '../game/storyPlanC'
import assassinationRescue from '../assets/story/assassination-hero-rescue.webp'
import blondSacrifice from '../assets/story/blond-ally-sacrifice.webp'
import cargoAmbush from '../assets/story/cargo-ambush-rescue.webp'
import policeChase from '../assets/story/chase-police.webp'
import councilPromotion from '../assets/story/council-promotion.webp'
import gangConvoy from '../assets/story/gang-convoy-formation.webp'
import garageExplosion from '../assets/story/garage-explosion.webp'
import garageRepair from '../assets/story/garage-repair-nitrous.webp'
import highwayGunfight from '../assets/story/highway-gunfight.webp'
import informantInterrogation from '../assets/story/informant-interrogation.webp'
import memorialSuccession from '../assets/story/memorial-succession.webp'
import oneOnOneRace from '../assets/story/one-on-one-race.webp'
import scrapyardSalvage from '../assets/story/scrapyard-salvage.webp'
import towConvoy from '../assets/story/tow-convoy.webp'
import workshopTakeover from '../assets/story/workshop-takeover-dispatch.webp'

const ARTWORK: Readonly<Record<StoryArtworkId, string>> = {
  'police-chase': policeChase,
  'gang-convoy': gangConvoy,
  'cargo-ambush': cargoAmbush,
  'highway-gunfight': highwayGunfight,
  'tow-convoy': towConvoy,
  'garage-repair': garageRepair,
  'workshop-takeover': workshopTakeover,
  'scrapyard-salvage': scrapyardSalvage,
  'one-on-one-race': oneOnOneRace,
  'blond-sacrifice': blondSacrifice,
  'memorial-succession': memorialSuccession,
  'assassination-rescue': assassinationRescue,
  'informant-interrogation': informantInterrogation,
  'council-promotion': councilPromotion,
  'garage-explosion': garageExplosion,
}

export interface StoryBeatOverlayProps {
  step: StoryStep
  onAction: () => void
  onOpenRoadmap?: () => void
}

export function StoryBeatOverlay({
  step,
  onAction,
  onOpenRoadmap,
}: StoryBeatOverlayProps): JSX.Element {
  const actionRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    actionRef.current?.focus()
  }, [step.number])

  return (
    <section
      className="story-beat"
      role="dialog"
      aria-modal="true"
      aria-labelledby="story-beat-title"
      style={
        { '--story-art': `url(${ARTWORK[step.artwork]})` } as CSSProperties
      }
    >
      <div className="story-beat__art" aria-hidden="true" />
      <div className="story-beat__shade" aria-hidden="true" />
      <header className="story-beat__header">
        <span>{`ACT ${step.act} · ${step.time}`}</span>
        <strong>{`L${String(step.number).padStart(2, '0')} / ${STORY_STEPS.length}`}</strong>
      </header>
      <article className="story-beat__card">
        <p className="story-beat__kicker">{step.kicker}</p>
        <h1 id="story-beat-title">{step.title}</h1>
        <div className="story-beat__dialogue">
          <strong>{step.speaker}</strong>
          {step.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        <div className="story-beat__objective">
          <span>当前目标</span>
          <p>{step.objective}</p>
        </div>
        <footer>
          {onOpenRoadmap ? (
            <button type="button" onClick={onOpenRoadmap}>
              查看当前幕
            </button>
          ) : null}
          <button
            ref={actionRef}
            type="button"
            className="story-beat__primary"
            onClick={onAction}
          >
            {step.action.label}
          </button>
        </footer>
      </article>
    </section>
  )
}
