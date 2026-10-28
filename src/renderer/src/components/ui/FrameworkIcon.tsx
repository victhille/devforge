import {
  Atom, Triangle, Wind, Server, Code2, FolderPlus,
  Hexagon, Zap, Globe, Layers, Coffee, Gem, Hash,
  Braces, Binary, Wrench, FolderOpen, FileCode2,
  Smartphone, Terminal, FileCode, Box, Cpu, FolderTree,
  type LucideProps
} from 'lucide-react'
import type { ComponentType } from 'react'

const ICONS: Record<string, ComponentType<LucideProps>> = {
  // Template icon names (Lucide component names)
  Atom, Triangle, Wind, Server, Code2, FolderPlus,

  // Framework IDs
  react:      Atom,
  nextjs:     Triangle,
  vue:        Wind,
  angular:    Hexagon,
  svelte:     Zap,
  nodejs:     Server,
  express:    Globe,
  typescript: FileCode2,
  symfony:    Code2,
  laravel:    Layers,
  php:        FileCode,
  python:     Braces,
  go:         Binary,
  rust:       Wrench,
  java:       Coffee,
  kotlin:     Hexagon,
  ruby:       Gem,
  dotnet:     Hash,
  swift:      Box,
  flutter:    Smartphone,
  cpp:        Cpu,
  c:          Cpu,
  shell:      Terminal,
  docker:     Box,
  html:       Globe,
  empty:      FolderPlus,
  unknown:    FolderOpen,
  group:      FolderTree
}

export const FRAMEWORK_COLOR: Record<string, string> = {
  react:      '#61DAFB',
  nextjs:     '#E2E8F0',
  vue:        '#42B883',
  angular:    '#DD0031',
  svelte:     '#FF3E00',
  nodejs:     '#68D391',
  express:    '#8A91A8',
  typescript: '#3178C6',
  symfony:    '#A78BFA',
  laravel:    '#FB7185',
  php:        '#8892BF',
  python:     '#F5CC5A',
  go:         '#00ADD8',
  rust:       '#F4A261',
  java:       '#F89820',
  kotlin:     '#7F52FF',
  ruby:       '#CC342D',
  dotnet:     '#512BD4',
  swift:      '#F05138',
  flutter:    '#54C5F8',
  cpp:        '#659AD2',
  c:          '#A8B9CC',
  shell:      '#4EAA25',
  docker:     '#2496ED',
  html:       '#E34F26',
  empty:      '#6B7280',
  unknown:    '#4A5068',
  group:      '#5B9BFF'
}

export const FRAMEWORK_LABEL: Record<string, string> = {
  react:      'React',
  nextjs:     'Next.js',
  vue:        'Vue',
  angular:    'Angular',
  svelte:     'Svelte',
  nodejs:     'Node.js',
  express:    'Express',
  typescript: 'TypeScript',
  symfony:    'Symfony',
  laravel:    'Laravel',
  php:        'PHP',
  python:     'Python',
  go:         'Go',
  rust:       'Rust',
  java:       'Java',
  kotlin:     'Kotlin',
  ruby:       'Ruby',
  dotnet:     '.NET',
  swift:      'Swift',
  flutter:    'Flutter',
  cpp:        'C++',
  c:          'C',
  shell:      'Shell',
  docker:     'Docker',
  html:       'HTML / CSS',
  empty:      'Empty',
  unknown:    'Unknown',
  group:      'Group'
}

interface Props extends LucideProps {
  name: string
}

export default function FrameworkIcon({ name, ...props }: Props) {
  const Icon = ICONS[name] ?? FolderOpen
  return <Icon {...props} />
}
