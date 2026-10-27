import type { Framework } from '../types'

export type LibraryCategory =
  | 'styling' | 'state' | 'data-fetching' | 'routing'
  | 'forms' | 'validation' | 'ui' | 'animation'
  | 'utils' | 'i18n' | 'testing' | 'database' | 'auth' | 'api'

export interface LibraryDef {
  id: string
  name: string
  description: string
  packages: string[]
  devPackages?: string[]
  category: LibraryCategory
  /** frameworks that support this library, or 'all' */
  frameworks: Framework[] | 'all'
  color: string
}

/** "@scope/pkg@7" → "@scope/pkg" */
export const packageName = (spec: string) => spec.replace(/^(@?[^@]+)@.*$/, '$1')

// JS-capable frameworks — only these get the library step
export const JS_FRAMEWORKS: Framework[] = [
  'react', 'nextjs', 'vue', 'angular', 'svelte', 'nodejs', 'express', 'typescript'
]

export const PROJECT_LIBRARIES: LibraryDef[] = [
  // ── Styling ───────────────────────────────────────────────────────────────────
  {
    id: 'tailwindcss', name: 'Tailwind CSS',
    description: 'Utility-first CSS framework',
    // Tailwind 4: its Vite or PostCSS plugin comes with DevForge's setup
    packages: [], devPackages: ['tailwindcss'],
    category: 'styling', frameworks: ['react', 'nextjs', 'vue', 'svelte', 'angular'], color: '#06B6D4'
  },
  {
    id: 'styled-components', name: 'Styled Components',
    description: 'CSS-in-JS with tagged template literals',
    packages: ['styled-components'], category: 'styling',
    frameworks: ['react', 'nextjs'], color: '#DB7093'
  },
  {
    id: 'emotion', name: 'Emotion',
    description: 'Performant CSS-in-JS library',
    packages: ['@emotion/react', '@emotion/styled'], category: 'styling',
    frameworks: ['react', 'nextjs'], color: '#D36AC2'
  },
  {
    id: 'sass', name: 'Sass',
    description: 'CSS preprocessor with variables & nesting',
    packages: [], devPackages: ['sass'],
    category: 'styling', frameworks: 'all', color: '#CF649A'
  },

  // ── State Management ──────────────────────────────────────────────────────────
  {
    id: 'zustand', name: 'Zustand',
    description: 'Lightweight, scalable state management',
    packages: ['zustand'], category: 'state',
    frameworks: ['react', 'nextjs'], color: '#FF6B35'
  },
  {
    id: 'redux-toolkit', name: 'Redux Toolkit',
    description: 'Official, opinionated Redux toolset',
    packages: ['@reduxjs/toolkit', 'react-redux'], category: 'state',
    frameworks: ['react', 'nextjs'], color: '#764ABC'
  },
  {
    id: 'jotai', name: 'Jotai',
    description: 'Primitive and flexible atomic state',
    packages: ['jotai'], category: 'state',
    frameworks: ['react', 'nextjs'], color: '#6DAEDB'
  },
  {
    id: 'recoil', name: 'Recoil',
    description: 'Atomic state management by Meta',
    packages: ['recoil'], category: 'state',
    frameworks: ['react', 'nextjs'], color: '#3578E5'
  },
  {
    id: 'mobx', name: 'MobX',
    description: 'Simple, scalable reactive state',
    packages: ['mobx', 'mobx-react-lite'], category: 'state',
    frameworks: ['react', 'nextjs'], color: '#FF7102'
  },
  {
    id: 'pinia', name: 'Pinia',
    description: 'Intuitive Vue state management',
    packages: ['pinia'], category: 'state',
    frameworks: ['vue'], color: '#FFD859'
  },
  {
    id: 'ngrx', name: 'NgRx',
    description: 'Reactive state management for Angular',
    packages: ['@ngrx/store', '@ngrx/effects', '@ngrx/entity'], category: 'state',
    frameworks: ['angular'], color: '#BA2BD2'
  },

  // ── Data Fetching ─────────────────────────────────────────────────────────────
  {
    id: 'tanstack-query', name: 'TanStack Query',
    description: 'Async state management & data fetching',
    packages: ['@tanstack/react-query'], category: 'data-fetching',
    frameworks: ['react', 'nextjs'], color: '#FF4154'
  },
  {
    id: 'swr', name: 'SWR',
    description: 'React Hooks for data fetching by Vercel',
    packages: ['swr'], category: 'data-fetching',
    frameworks: ['react', 'nextjs'], color: '#888888'
  },
  {
    id: 'axios', name: 'Axios',
    description: 'Promise-based HTTP client',
    packages: ['axios'], category: 'data-fetching',
    frameworks: 'all', color: '#5A29E4'
  },
  {
    id: 'ky', name: 'ky',
    description: 'Tiny elegant HTTP client based on Fetch',
    packages: ['ky'], category: 'data-fetching',
    frameworks: 'all', color: '#FF6900'
  },

  // ── Notifications / Toast ─────────────────────────────────────────────────────
  {
    id: 'sonner', name: 'Sonner',
    description: 'Beautiful, accessible toast notifications',
    packages: ['sonner'], category: 'ui',
    frameworks: ['react', 'nextjs'], color: '#000000'
  },
  {
    id: 'react-hot-toast', name: 'React Hot Toast',
    description: 'Smoking hot React notifications',
    packages: ['react-hot-toast'], category: 'ui',
    frameworks: ['react', 'nextjs'], color: '#F97316'
  },
  {
    id: 'react-toastify', name: 'React Toastify',
    description: 'Easily add notifications to your app',
    packages: ['react-toastify'], category: 'ui',
    frameworks: ['react', 'nextjs'], color: '#FEBC2E'
  },

  // ── Charts / Data Viz ─────────────────────────────────────────────────────────
  {
    id: 'recharts', name: 'Recharts',
    description: 'Composable charting library built on React & D3',
    packages: ['recharts'], category: 'ui',
    frameworks: ['react', 'nextjs'], color: '#22A699'
  },
  {
    id: 'chartjs', name: 'Chart.js',
    description: 'Simple yet flexible JavaScript charting',
    packages: ['chart.js', 'react-chartjs-2'], category: 'ui',
    frameworks: ['react', 'nextjs', 'vue'], color: '#FF6384'
  },
  {
    id: 'victory', name: 'Victory',
    description: 'Modular charting components for React',
    packages: ['victory'], category: 'ui',
    frameworks: ['react', 'nextjs'], color: '#9C27B0'
  },
  {
    id: 'tremor', name: 'Tremor',
    description: 'React components to build dashboards fast',
    packages: ['@tremor/react'], category: 'ui',
    frameworks: ['react', 'nextjs'], color: '#6366F1'
  },

  // ── Tables ────────────────────────────────────────────────────────────────────
  {
    id: 'tanstack-table', name: 'TanStack Table',
    description: 'Headless, type-safe table & datagrids',
    packages: ['@tanstack/react-table'], category: 'ui',
    frameworks: ['react', 'nextjs'], color: '#FF4154'
  },
  {
    id: 'ag-grid', name: 'AG Grid',
    description: 'Feature-rich data grid for heavy datasets',
    packages: ['ag-grid-community', 'ag-grid-react'], category: 'ui',
    frameworks: ['react', 'nextjs', 'vue', 'angular'], color: '#009BC9'
  },

  // ── Drag & Drop ───────────────────────────────────────────────────────────────
  {
    id: 'dnd-kit', name: 'dnd kit',
    description: 'Lightweight, performant drag-and-drop',
    packages: ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'], category: 'ui',
    frameworks: ['react', 'nextjs'], color: '#007AFF'
  },
  {
    id: 'react-dnd', name: 'React DnD',
    description: 'Drag and drop for React with hooks',
    packages: ['react-dnd', 'react-dnd-html5-backend'], category: 'ui',
    frameworks: ['react', 'nextjs'], color: '#FF5733'
  },

  // ── Icons ─────────────────────────────────────────────────────────────────────
  {
    id: 'lucide-react', name: 'Lucide React',
    description: 'Beautiful & consistent open-source icons',
    packages: ['lucide-react'], category: 'ui',
    frameworks: ['react', 'nextjs'], color: '#F97316'
  },
  {
    id: 'react-icons', name: 'React Icons',
    description: '10 000+ icons from popular icon packs',
    packages: ['react-icons'], category: 'ui',
    frameworks: ['react', 'nextjs'], color: '#E11D48'
  },
  {
    id: 'heroicons', name: 'Heroicons',
    description: 'Beautiful hand-crafted SVG icons by Tailwind Labs',
    packages: ['@heroicons/react'], category: 'ui',
    frameworks: ['react', 'nextjs'], color: '#7C3AED'
  },
  {
    id: 'phosphor', name: 'Phosphor Icons',
    description: 'Flexible icon family with 6 weights',
    packages: ['@phosphor-icons/react'], category: 'ui',
    frameworks: ['react', 'nextjs'], color: '#1A1A2E'
  },

  // ── File / Media ──────────────────────────────────────────────────────────────
  {
    id: 'react-dropzone', name: 'React Dropzone',
    description: 'HTML5-compliant drag-and-drop file upload',
    packages: ['react-dropzone'], category: 'ui',
    frameworks: ['react', 'nextjs'], color: '#2196F3'
  },
  {
    id: 'react-player', name: 'React Player',
    description: 'React component for playing media files',
    packages: ['react-player'], category: 'ui',
    frameworks: ['react', 'nextjs'], color: '#FF0000'
  },

  // ── Maps ──────────────────────────────────────────────────────────────────────
  {
    id: 'react-leaflet', name: 'React Leaflet',
    description: 'React components for Leaflet maps',
    packages: ['react-leaflet', 'leaflet'], devPackages: ['@types/leaflet'],
    category: 'ui', frameworks: ['react', 'nextjs'], color: '#3D9970'
  },
  {
    id: 'mapbox', name: 'Mapbox GL',
    description: 'Interactive, customizable maps via WebGL',
    packages: ['mapbox-gl', 'react-map-gl'], devPackages: ['@types/mapbox-gl'],
    category: 'ui', frameworks: ['react', 'nextjs'], color: '#4264FB'
  },

  // ── Rich Text / Markdown ──────────────────────────────────────────────────────
  {
    id: 'tiptap', name: 'Tiptap',
    description: 'Headless, framework-agnostic rich-text editor',
    packages: ['@tiptap/react', '@tiptap/pm', '@tiptap/starter-kit'], category: 'ui',
    frameworks: ['react', 'nextjs', 'vue'], color: '#1A1A1A'
  },
  {
    id: 'react-markdown', name: 'React Markdown',
    description: 'Safely render Markdown in React',
    packages: ['react-markdown'], category: 'ui',
    frameworks: ['react', 'nextjs'], color: '#083FA1'
  },
  {
    id: 'monaco-editor', name: 'Monaco Editor',
    description: 'VS Code editor as a React component',
    packages: ['@monaco-editor/react'], category: 'ui',
    frameworks: ['react', 'nextjs'], color: '#007ACC'
  },

  // ── 3D / Canvas ───────────────────────────────────────────────────────────────
  {
    id: 'react-three-fiber', name: 'React Three Fiber',
    description: 'React renderer for Three.js — build 3D scenes',
    packages: ['three', '@react-three/fiber', '@react-three/drei'], devPackages: ['@types/three'],
    category: 'animation', frameworks: ['react', 'nextjs'], color: '#049EF4'
  },
  {
    id: 'konva', name: 'Konva / React Konva',
    description: '2D canvas library with React bindings',
    packages: ['konva', 'react-konva'], category: 'ui',
    frameworks: ['react', 'nextjs'], color: '#0D6EFD'
  },

  // ── Carousels / Sliders ───────────────────────────────────────────────────────
  {
    id: 'embla-carousel', name: 'Embla Carousel',
    description: 'Extensible, touch-friendly carousel library',
    packages: ['embla-carousel-react'], category: 'ui',
    frameworks: ['react', 'nextjs'], color: '#3E1BDB'
  },
  {
    id: 'swiper', name: 'Swiper',
    description: 'Most modern touch-enabled slider',
    packages: ['swiper'], category: 'ui',
    frameworks: ['react', 'nextjs', 'vue'], color: '#007AFF'
  },

  // ── Backend-as-a-Service ──────────────────────────────────────────────────────
  {
    id: 'supabase', name: 'Supabase',
    description: 'Open source Firebase alternative (Postgres + Auth + Storage)',
    packages: ['@supabase/supabase-js'], category: 'database',
    frameworks: ['react', 'nextjs', 'vue', 'svelte', 'nodejs', 'express'], color: '#3ECF8E'
  },
  {
    id: 'firebase', name: 'Firebase',
    description: 'Google platform — Firestore, Auth, Storage, Functions',
    packages: ['firebase'], category: 'database',
    frameworks: ['react', 'nextjs', 'vue', 'angular', 'svelte'], color: '#FFCA28'
  },

  // ── Payments ─────────────────────────────────────────────────────────────────
  {
    id: 'stripe', name: 'Stripe.js',
    description: 'Accept payments & manage subscriptions',
    packages: ['@stripe/stripe-js', '@stripe/react-stripe-js'], category: 'api',
    frameworks: ['react', 'nextjs'], color: '#635BFF'
  },

  // ── Realtime ─────────────────────────────────────────────────────────────────
  {
    id: 'pusher', name: 'Pusher',
    description: 'Hosted realtime websocket API',
    packages: ['pusher-js'], category: 'api',
    frameworks: ['react', 'nextjs', 'vue', 'nodejs', 'express'], color: '#300D4F'
  },
  {
    id: 'partykit', name: 'PartyKit',
    description: 'Realtime collaboration infrastructure',
    packages: ['partysocket'], category: 'api',
    frameworks: ['react', 'nextjs'], color: '#0C1322'
  },

  // ── AI / LLM ─────────────────────────────────────────────────────────────────
  {
    id: 'ai-sdk', name: 'Vercel AI SDK',
    description: 'Build AI-powered streaming chat UIs',
    packages: ['ai', '@ai-sdk/openai'], category: 'api',
    frameworks: ['react', 'nextjs', 'svelte'], color: '#000000'
  },
  {
    id: 'openai', name: 'OpenAI',
    description: 'Official OpenAI Node.js / TypeScript client',
    packages: ['openai'], category: 'api',
    frameworks: ['nodejs', 'express', 'nextjs'], color: '#10A37F'
  },

  // ── Routing ───────────────────────────────────────────────────────────────────
  {
    id: 'react-router', name: 'React Router',
    description: 'Declarative routing for React',
    packages: ['react-router-dom'], category: 'routing',
    frameworks: ['react'], color: '#CA4245'
  },
  {
    id: 'tanstack-router', name: 'TanStack Router',
    description: 'Fully type-safe React router',
    packages: ['@tanstack/react-router'], category: 'routing',
    frameworks: ['react'], color: '#FF4154'
  },
  {
    id: 'vue-router', name: 'Vue Router',
    description: 'Official router for Vue.js',
    packages: ['vue-router'], category: 'routing',
    frameworks: ['vue'], color: '#41B883'
  },

  // ── Forms ─────────────────────────────────────────────────────────────────────
  {
    id: 'react-hook-form', name: 'React Hook Form',
    description: 'Performant, flexible & extensible forms',
    packages: ['react-hook-form'], category: 'forms',
    frameworks: ['react', 'nextjs'], color: '#EC5990'
  },
  {
    id: 'formik', name: 'Formik',
    description: 'Build forms in React without the tears',
    packages: ['formik'], category: 'forms',
    frameworks: ['react', 'nextjs'], color: '#172B4D'
  },
  {
    id: 'veevalidate', name: 'VeeValidate',
    description: 'Form validation for Vue.js',
    packages: ['vee-validate'], category: 'forms',
    frameworks: ['vue'], color: '#41B883'
  },

  // ── Validation ────────────────────────────────────────────────────────────────
  {
    id: 'zod', name: 'Zod',
    description: 'TypeScript-first schema validation',
    packages: ['zod'], category: 'validation',
    frameworks: 'all', color: '#3068B7'
  },
  {
    id: 'yup', name: 'Yup',
    description: 'Schema builder for value parsing',
    packages: ['yup'], category: 'validation',
    frameworks: 'all', color: '#FF6B6B'
  },
  {
    id: 'valibot', name: 'Valibot',
    description: 'Modular & type-safe schema validation',
    packages: ['valibot'], category: 'validation',
    frameworks: 'all', color: '#EFB000'
  },

  // ── UI Components ─────────────────────────────────────────────────────────────
  {
    id: 'mantine', name: 'Mantine',
    description: 'Full-featured React component library',
    packages: ['@mantine/core', '@mantine/hooks'], category: 'ui',
    frameworks: ['react', 'nextjs'], color: '#339AF0'
  },
  {
    id: 'chakra-ui', name: 'Chakra UI',
    description: 'Accessible, themeable component library',
    packages: ['@chakra-ui/react'], category: 'ui',
    frameworks: ['react', 'nextjs'], color: '#319795'
  },
  {
    id: 'ant-design', name: 'Ant Design',
    description: 'Enterprise-grade UI design system',
    packages: ['antd'], category: 'ui',
    frameworks: ['react', 'nextjs'], color: '#1677FF'
  },
  {
    id: 'material-ui', name: 'Material UI',
    description: "Google's Material Design for React",
    packages: ['@mui/material', '@emotion/react', '@emotion/styled'], category: 'ui',
    frameworks: ['react', 'nextjs'], color: '#0081CB'
  },
  {
    id: 'shadcn', name: 'shadcn/ui',
    description: 'Beautifully designed Radix-based components',
    packages: ['class-variance-authority', 'clsx', 'tailwind-merge', 'lucide-react'],
    devPackages: ['@types/node'],
    category: 'ui', frameworks: ['react', 'nextjs'], color: '#111111'
  },
  {
    id: 'radix-themes', name: 'Radix Themes',
    description: 'Unstyled, accessible UI primitives',
    packages: ['@radix-ui/themes'], category: 'ui',
    frameworks: ['react', 'nextjs'], color: '#E95A34'
  },
  {
    id: 'daisyui', name: 'DaisyUI',
    description: 'Tailwind CSS component library',
    packages: [], devPackages: ['daisyui'],
    category: 'ui', frameworks: ['react', 'nextjs', 'vue', 'svelte'], color: '#FF45A4'
  },
  {
    id: 'headlessui', name: 'Headless UI',
    description: 'Unstyled accessible components by Tailwind Labs',
    packages: ['@headlessui/react'], category: 'ui',
    frameworks: ['react', 'nextjs'], color: '#7B73F0'
  },
  {
    id: 'vuetify', name: 'Vuetify',
    description: 'Material Design component framework for Vue',
    packages: ['vuetify'], category: 'ui',
    frameworks: ['vue'], color: '#1697F6'
  },
  {
    id: 'primevue', name: 'PrimeVue',
    description: 'Rich UI components for Vue',
    packages: ['primevue'], category: 'ui',
    frameworks: ['vue'], color: '#41B883'
  },
  {
    id: 'angular-material', name: 'Angular Material',
    description: 'Material Design components for Angular',
    packages: ['@angular/material', '@angular/cdk'], category: 'ui',
    frameworks: ['angular'], color: '#E91E63'
  },

  // ── Animation ─────────────────────────────────────────────────────────────────
  {
    id: 'framer-motion', name: 'Framer Motion',
    description: 'Production-ready motion for React',
    packages: ['framer-motion'], category: 'animation',
    frameworks: ['react', 'nextjs'], color: '#0055FF'
  },
  {
    id: 'gsap', name: 'GSAP',
    description: 'Professional-grade animation library',
    packages: ['gsap'], category: 'animation',
    frameworks: 'all', color: '#88CE02'
  },
  {
    id: 'react-spring', name: 'React Spring',
    description: 'Spring-physics based animations',
    packages: ['@react-spring/web'], category: 'animation',
    frameworks: ['react', 'nextjs'], color: '#FF6B6B'
  },
  {
    id: 'auto-animate', name: 'AutoAnimate',
    description: 'Zero-config animations for any framework',
    packages: ['@formkit/auto-animate'], category: 'animation',
    frameworks: 'all', color: '#7B73F0'
  },

  // ── Utilities ─────────────────────────────────────────────────────────────────
  {
    id: 'lodash', name: 'Lodash',
    description: 'Utility library for common operations',
    packages: ['lodash'], devPackages: ['@types/lodash'],
    category: 'utils', frameworks: 'all', color: '#3492FF'
  },
  {
    id: 'date-fns', name: 'date-fns',
    description: 'Modern JavaScript date utility library',
    packages: ['date-fns'], category: 'utils',
    frameworks: 'all', color: '#770C56'
  },
  {
    id: 'dayjs', name: 'Day.js',
    description: 'Fast 2kB Moment.js alternative',
    packages: ['dayjs'], category: 'utils',
    frameworks: 'all', color: '#FF5F09'
  },
  {
    id: 'clsx', name: 'clsx',
    description: 'Tiny utility for constructing class names',
    packages: ['clsx'], category: 'utils',
    frameworks: 'all', color: '#888888'
  },
  {
    id: 'immer', name: 'Immer',
    description: 'Immutable state via mutable draft syntax',
    packages: ['immer'], category: 'utils',
    frameworks: 'all', color: '#00D27A'
  },
  {
    id: 'uuid', name: 'uuid',
    description: 'RFC-compliant UUID generation',
    packages: ['uuid'], devPackages: ['@types/uuid'],
    category: 'utils', frameworks: 'all', color: '#F59E0B'
  },

  // ── Internationalisation ──────────────────────────────────────────────────────
  {
    id: 'i18next', name: 'i18next + react-i18next',
    description: 'i18n framework with React bindings',
    packages: ['i18next', 'react-i18next'], category: 'i18n',
    frameworks: ['react', 'nextjs'], color: '#26A69A'
  },
  {
    id: 'vue-i18n', name: 'Vue I18n',
    description: 'Internationalization for Vue.js',
    packages: ['vue-i18n'], category: 'i18n',
    frameworks: ['vue'], color: '#41B883'
  },

  // ── Testing ───────────────────────────────────────────────────────────────────
  {
    id: 'vitest', name: 'Vitest',
    description: 'Vite-native unit testing framework',
    packages: [], devPackages: ['vitest', '@testing-library/react', '@testing-library/jest-dom'],
    category: 'testing', frameworks: ['react', 'vue', 'svelte'], color: '#6E9F18'
  },
  {
    id: 'jest', name: 'Jest',
    description: 'Delightful JavaScript testing framework',
    packages: [], devPackages: ['jest', '@types/jest', 'ts-jest'],
    category: 'testing', frameworks: 'all', color: '#C21325'
  },
  {
    id: 'playwright', name: 'Playwright',
    description: 'End-to-end browser testing',
    packages: [], devPackages: ['@playwright/test'],
    category: 'testing', frameworks: 'all', color: '#2EAD33'
  },
  {
    id: 'cypress', name: 'Cypress',
    description: 'Fast, reliable end-to-end testing',
    packages: [], devPackages: ['cypress'],
    category: 'testing', frameworks: ['react', 'nextjs', 'vue', 'svelte', 'angular'], color: '#69D3A7'
  },
  {
    id: 'storybook', name: 'Storybook',
    description: 'Build & document UI components in isolation',
    packages: [], devPackages: ['storybook', '@storybook/react-vite'],
    category: 'testing', frameworks: ['react', 'nextjs', 'vue'], color: '#FF4785'
  },

  // ── Database / ORM ────────────────────────────────────────────────────────────
  {
    id: 'prisma', name: 'Prisma',
    description: 'Next-generation ORM for Node.js',
    packages: ['@prisma/client@7'], devPackages: ['prisma@7'],
    category: 'database', frameworks: ['nextjs', 'nodejs', 'express'], color: '#2D3748'
  },
  {
    id: 'drizzle', name: 'Drizzle ORM',
    description: 'Lightweight TypeScript ORM',
    packages: ['drizzle-orm'], devPackages: ['drizzle-kit'],
    category: 'database', frameworks: ['nextjs', 'nodejs', 'express'], color: '#C5F74F'
  },
  {
    id: 'mongoose', name: 'Mongoose',
    description: 'MongoDB object modeling for Node.js',
    packages: ['mongoose'], category: 'database',
    frameworks: ['nodejs', 'express'], color: '#880000'
  },
  {
    id: 'typeorm', name: 'TypeORM',
    description: 'ORM for TypeScript and JavaScript',
    packages: ['typeorm', 'reflect-metadata'], category: 'database',
    frameworks: ['nodejs', 'express', 'nextjs'], color: '#E83524'
  },

  // ── Auth ──────────────────────────────────────────────────────────────────────
  {
    id: 'nextauth', name: 'NextAuth.js',
    description: 'Complete auth solution for Next.js',
    packages: ['next-auth'], category: 'auth',
    frameworks: ['nextjs'], color: '#4C6EF5'
  },
  {
    id: 'clerk', name: 'Clerk',
    description: 'Authentication & user management platform',
    packages: ['@clerk/nextjs'], category: 'auth',
    frameworks: ['nextjs'], color: '#6C47FF'
  },
  {
    id: 'lucia', name: 'Lucia',
    description: 'Simple session-based authentication',
    packages: ['lucia'], category: 'auth',
    frameworks: ['nextjs', 'nodejs', 'express'], color: '#FFBE45'
  },
  {
    id: 'jwt', name: 'jsonwebtoken',
    description: 'JSON Web Token implementation',
    packages: ['jsonwebtoken'], devPackages: ['@types/jsonwebtoken'],
    category: 'auth', frameworks: ['nodejs', 'express'], color: '#D63AFF'
  },
  {
    id: 'bcrypt', name: 'bcrypt',
    description: 'Password hashing library',
    packages: ['bcrypt'], devPackages: ['@types/bcrypt'],
    category: 'auth', frameworks: ['nodejs', 'express', 'nextjs'], color: '#FF7676'
  },

  // ── API / Server ──────────────────────────────────────────────────────────────
  {
    id: 'trpc', name: 'tRPC',
    description: 'End-to-end type-safe APIs',
    packages: ['@trpc/server', '@trpc/client', '@trpc/react-query'], category: 'api',
    frameworks: ['nextjs', 'nodejs'], color: '#398CCB'
  },
  {
    id: 'express', name: 'Express',
    description: 'Minimal & flexible Node.js web framework',
    packages: ['express'], devPackages: ['@types/express'],
    category: 'api', frameworks: ['nodejs'], color: '#555555'
  },
  {
    id: 'fastify', name: 'Fastify',
    description: 'Fast and low overhead web framework',
    packages: ['fastify'], category: 'api',
    frameworks: ['nodejs', 'express'], color: '#000000'
  },
  {
    id: 'hono', name: 'Hono',
    description: 'Ultrafast web framework for the edges',
    packages: ['hono'], category: 'api',
    frameworks: ['nodejs', 'nextjs'], color: '#FF6900'
  },
  {
    id: 'socket-io', name: 'Socket.IO',
    description: 'Bidirectional event-based communication',
    packages: ['socket.io'], category: 'api',
    frameworks: ['nodejs', 'express'], color: '#010101'
  },
]
