import type { Framework, PackageManager } from '../types'

export interface TemplateOption {
  id: string
  label: string
  default: boolean
}

export interface ProjectTemplate {
  id: Framework
  name: string
  description: string
  category: 'frontend' | 'backend' | 'fullstack' | 'other'
  /** Lucide icon component name */
  iconName: string
  color: string
  requirements: string[]
  optionalRequirements: string[]
  options: TemplateOption[]
  defaultPackageManager: PackageManager
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'react',
    name: 'React',
    description: 'Build UIs with React + Vite',
    category: 'frontend',
    iconName: 'Atom',
    color: '#61DAFB',
    requirements: ['node', 'npm'],
    optionalRequirements: [],
    defaultPackageManager: 'npm',
    options: [
      { id: 'typescript', label: 'TypeScript', default: true },
      { id: 'eslint', label: 'ESLint', default: true },
      { id: 'initGit', label: 'Initialize Git', default: false },
      { id: 'installDeps', label: 'Install dependencies', default: true },
      { id: 'openAfter', label: 'Open after creation', default: false }
    ]
  },
  {
    id: 'nextjs',
    name: 'Next.js',
    description: 'Full-stack React framework',
    category: 'fullstack',
    iconName: 'Triangle',
    color: '#E2E8F0',
    requirements: ['node', 'npm'],
    optionalRequirements: [],
    defaultPackageManager: 'npm',
    options: [
      { id: 'typescript', label: 'TypeScript', default: true },
      { id: 'eslint', label: 'ESLint', default: true },
      { id: 'initGit', label: 'Initialize Git', default: false },
      { id: 'installDeps', label: 'Install dependencies', default: true },
      { id: 'openAfter', label: 'Open after creation', default: false }
    ]
  },
  {
    id: 'vue',
    name: 'Vue',
    description: 'Progressive JavaScript framework',
    category: 'frontend',
    iconName: 'Wind',
    color: '#42B883',
    requirements: ['node', 'npm'],
    optionalRequirements: [],
    defaultPackageManager: 'npm',
    options: [
      { id: 'typescript', label: 'TypeScript', default: true },
      { id: 'eslint', label: 'ESLint', default: true },
      { id: 'initGit', label: 'Initialize Git', default: false },
      { id: 'installDeps', label: 'Install dependencies', default: true },
      { id: 'openAfter', label: 'Open after creation', default: false }
    ]
  },
  {
    id: 'nodejs',
    name: 'Node.js',
    description: 'JavaScript backend / API',
    category: 'backend',
    iconName: 'Server',
    color: '#68D391',
    requirements: ['node', 'npm'],
    optionalRequirements: [],
    defaultPackageManager: 'npm',
    options: [
      { id: 'typescript', label: 'TypeScript', default: true },
      { id: 'initGit', label: 'Initialize Git', default: false },
      { id: 'installDeps', label: 'Install dependencies', default: true },
      { id: 'openAfter', label: 'Open after creation', default: false }
    ]
  },
  {
    id: 'symfony',
    name: 'Symfony',
    description: 'PHP web application framework',
    category: 'backend',
    iconName: 'Code2',
    color: '#A78BFA',
    requirements: ['php', 'composer'],
    optionalRequirements: ['symfony_cli'],
    defaultPackageManager: 'npm',
    options: [
      { id: 'initGit', label: 'Initialize Git', default: false },
      { id: 'openAfter', label: 'Open after creation', default: false }
    ]
  },
  {
    id: 'laravel',
    name: 'Laravel',
    description: 'PHP framework with Eloquent and Artisan',
    category: 'backend',
    iconName: 'Code2',
    color: '#F87171',
    requirements: ['php', 'composer'],
    optionalRequirements: [],
    defaultPackageManager: 'npm',
    options: [
      { id: 'initGit', label: 'Initialize Git', default: false },
      { id: 'openAfter', label: 'Open after creation', default: false }
    ]
  },
  {
    id: 'empty',
    name: 'Empty Project',
    description: 'Start from scratch',
    category: 'other',
    iconName: 'FolderPlus',
    color: '#6B7280',
    requirements: [],
    optionalRequirements: [],
    defaultPackageManager: 'npm',
    options: [
      { id: 'initGit', label: 'Initialize Git', default: false }
    ]
  }
]
