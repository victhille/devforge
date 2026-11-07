import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Teach tailwind-merge the custom font sizes and colors from styles/index.css,
// so `text-md` is merged as a size and `text-fg-muted` as a color.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['2xs', 'md', 'page'],
      radius: ['control', 'card'],
      color: [
        'canvas', 'surface', 'elevated', 'hover', 'active', 'console',
        'line', 'line-subtle', 'fg', 'fg-secondary', 'fg-muted', 'fg-disabled',
        'sidebar', 'chrome',
        'accent', 'accent-hover', 'accent-soft', 'accent-fg',
        'success', 'success-soft', 'success-fg', 'warning', 'warning-soft', 'danger', 'danger-soft', 'danger-fg',
        'forgy', 'forgy-soft', 'forgy-fg',
        'term', 'term-block', 'term-fg', 'term-dim'
      ]
    }
  }
})

/** Merge class names, later Tailwind classes win over earlier ones. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
