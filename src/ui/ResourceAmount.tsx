import type { JSX, ReactNode } from 'react'

export type ResourceKind =
  | 'money'
  | 'oil'
  | 'materials'
  | 'experience'
  | 'spare-parts'
  | 'part'
  | 'power'

const RESOURCE_LABELS: Readonly<Record<ResourceKind, string>> = {
  money: '钱',
  oil: '油',
  materials: '物资',
  experience: '英雄经验',
  'spare-parts': '零件',
  part: '配件',
  power: '战力',
}

function ResourceIcon({ kind }: { kind: ResourceKind }): JSX.Element {
  const paths: Readonly<Record<ResourceKind, ReactNode>> = {
    money: (
      <>
        <ellipse cx="12" cy="7" rx="7" ry="3" />
        <path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7" />
        <path d="M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" />
      </>
    ),
    oil: <path d="M12 3s-6 7.1-6 11a6 6 0 0 0 12 0c0-3.9-6-11-6-11Z" />,
    materials: (
      <>
        <path d="m4 8 8-4 8 4-8 4-8-4Z" />
        <path d="m4 8 8 4 8-4v8l-8 4-8-4V8Z" />
      </>
    ),
    experience: (
      <path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3Z" />
    ),
    'spare-parts': (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9 7 7m10 10 2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
      </>
    ),
    part: (
      <>
        <path d="M7 3h10l3 5-8 13L4 8l3-5Z" />
        <path d="M4 8h16M9 3l3 5 3-5" />
      </>
    ),
    power: <path d="m13 2-8 12h6l-1 8 9-13h-6V2Z" />,
  }
  return (
    <svg
      className={`resource-icon resource-icon--${kind}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {paths[kind]}
    </svg>
  )
}

export function ResourceAmount({
  kind,
  amount,
  showLabel = true,
  suffix,
  label: customLabel,
}: {
  kind: ResourceKind
  amount: number | string
  showLabel?: boolean
  suffix?: string
  label?: string
}): JSX.Element {
  const label = customLabel ?? RESOURCE_LABELS[kind]
  return (
    <span
      className="resource-amount"
      aria-label={`${label} ${amount}${suffix ?? ''}`}
    >
      <ResourceIcon kind={kind} />
      {showLabel ? (
        <span className="resource-amount__label">{`${label} ${amount}`}</span>
      ) : (
        <strong>{amount}</strong>
      )}
      {suffix ? <small>{suffix}</small> : null}
    </span>
  )
}
