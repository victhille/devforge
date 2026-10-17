import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Teach tailwind-merge the custom font sizes and colors from styles/index.css,
// so `text-md` is merged as a size and `text-fg-muted` as a color.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['2xs', 'md'],
      color: [
        'canvas', 'surface', 'elevated', 'hover', 'active', 'console',
        'line', 'line-subtle', 'fg', 'fg-secondary', 'fg-muted', 'fg-disabled',
        'accent', 'accent-hover', 'accent-soft',
        'success', 'success-soft', 'warning', 'warning-soft', 'danger', 'danger-soft'
      ]
    }
  }
})

/** Merge class names, later Tailwind classes win over earlier ones. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
