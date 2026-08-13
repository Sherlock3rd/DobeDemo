import { useState, type JSX } from 'react'
import './WreckCollectionOverlay.css'

const WRECKS = [
  {
    id: 'canal',
    label: '运河桥下废车',
    detail: '车架完整 · 可拆悬挂',
    position: 'north',
  },
  {
    id: 'depot',
    label: '旧货站残车',
    detail: '动力舱完整 · 可拆引擎',
    position: 'east',
  },
  {
    id: 'mill',
    label: '纺织厂后巷废车',
    detail: '轮组完整 · 可拆轮胎',
    position: 'south',
  },
] as const

export function WreckCollectionOverlay({
  onComplete,
}: {
  onComplete: () => void
}): JSX.Element {
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([])
  const allSelected = selectedIds.length === WRECKS.length

  return (
    <section
      className="wreck-collection"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wreck-collection-title"
    >
      <header>
        <span>RAZOR CREW · RECOVERY MAP</span>
        <strong>{`${selectedIds.length} / ${WRECKS.length}`}</strong>
      </header>
      <div className="wreck-collection__body">
        <div>
          <p className="wreck-collection__eyebrow">全员任务 · 收车</p>
          <h2 id="wreck-collection-title">标记全部可回收废车</h2>
          <p>根据博给出的线索逐个确认点位。三处全部标记后，拖车队才会出发。</p>
        </div>
        <div className="wreck-collection__map" aria-label="废车回收地图">
          <span className="wreck-collection__road wreck-collection__road--a" />
          <span className="wreck-collection__road wreck-collection__road--b" />
          {WRECKS.map((wreck, index) => {
            const selected = selectedIds.includes(wreck.id)
            return (
              <button
                key={wreck.id}
                type="button"
                className={`wreck-collection__marker wreck-collection__marker--${wreck.position}`}
                data-selected={selected}
                disabled={selected}
                onClick={() => setSelectedIds([...selectedIds, wreck.id])}
              >
                <span>{selected ? '✓' : index + 1}</span>
                <strong>{wreck.label}</strong>
                <small>{selected ? '已通知拖车队' : wreck.detail}</small>
              </button>
            )
          })}
          <div className="wreck-collection__garage">
            <span>终点</span>
            <strong>废车回收厂</strong>
          </div>
        </div>
        <button
          type="button"
          className="wreck-collection__confirm"
          disabled={!allSelected}
          onClick={onComplete}
        >
          {allSelected
            ? '派出拖车队'
            : `还需标记 ${WRECKS.length - selectedIds.length} 处`}
        </button>
      </div>
    </section>
  )
}
