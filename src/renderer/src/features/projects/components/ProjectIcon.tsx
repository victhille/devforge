import { cn } from '@renderer/lib/cn'
import FrameworkIcon, { FRAMEWORK_COLOR } from '@renderer/components/ui/FrameworkIcon'
import { paleClass } from '@renderer/lib/brand'

const SIZES = {
  xs: { box: 'size-4.5 rounded-md', icon: 11 },
  sm: { box: 'size-8 rounded-lg',  icon: 15 },
  md: { box: 'size-9 rounded-lg',  icon: 16 },
  lg: { box: 'size-12 rounded-xl', icon: 24 }
}

/** Framework icon on a tinted tile using the framework color. */
export default function ProjectIcon({ framework, size = 'md', className }: {
  framework: string
  size?: keyof typeof SIZES
  className?: string
}) {
  const color = FRAMEWORK_COLOR[framework] ?? '#6B7280'
  const s = SIZES[size]
  return (
    <div
      className={cn('flex shrink-0 items-center justify-center border', s.box, className)}
      style={{ background: `${color}18`, borderColor: `${color}30` }}
    >
      <FrameworkIcon name={framework} size={s.icon} style={{ color }} className={paleClass(color)} />
    </div>
  )
}
