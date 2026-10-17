import type { DocTech } from './types'

const react: DocTech = {
  id: 'react', name: 'React', color: '#61DAFB',
  sections: [
    {
      title: 'Hooks essentiels', entries: [
        { cmd: 'useState(initialValue)',           desc: 'État local du composant', example: 'const [count, setCount] = useState(0)' },
        { cmd: 'useEffect(fn, deps)',              desc: 'Effets de bord, fetch, abonnements', example: 'useEffect(() => { fetch(url) }, [url])' },
        { cmd: 'useRef(initial)',                  desc: 'Référence DOM ou valeur persistante', example: 'const ref = useRef<HTMLDivElement>(null)' },
        { cmd: 'useContext(Context)',              desc: 'Consommer un contexte React', example: 'const theme = useContext(ThemeContext)' },
        { cmd: 'useMemo(fn, deps)',                desc: 'Mémoïser une valeur calculée coûteuse', example: 'const sorted = useMemo(() => list.sort(), [list])' },
        { cmd: 'useCallback(fn, deps)',            desc: 'Mémoïser une fonction (éviter les re-renders)', example: 'const fn = useCallback(() => doSomething(), [dep])' },
        { cmd: 'useReducer(reducer, init)',        desc: 'Gestion d\'état complexe avec reducer', example: 'const [state, dispatch] = useReducer(reducer, {})' },
        { cmd: 'useId()',                          desc: 'Générer un ID stable et unique' },
        { cmd: 'useTransition()',                  desc: 'Marquer des mises à jour non urgentes' },
        { cmd: 'useDeferredValue(value)',          desc: 'Reporter la mise à jour d\'une valeur' },
      ]
    },
    {
      title: 'Patterns & Composition', entries: [
        { cmd: 'React.memo(Component)',            desc: 'Éviter le re-render si les props n\'ont pas changé' },
        { cmd: 'createContext(defaultValue)',      desc: 'Créer un contexte partageable entre composants', example: 'const ThemeCtx = createContext("light")' },
        { cmd: 'forwardRef((props, ref) => ...)', desc: 'Passer une ref vers un composant enfant' },
        { cmd: 'React.lazy(() => import(...))',   desc: 'Charger un composant en code-splitting' },
        { cmd: '<Suspense fallback={...}>',        desc: 'Afficher un fallback pendant le chargement lazy' },
        { cmd: '<ErrorBoundary>',                  desc: 'Capturer les erreurs de rendu enfant' },
        { cmd: 'children prop',                    desc: 'Composition de composants via enfants', example: '<Card><Content /></Card>' },
        { cmd: 'Custom Hook',                      desc: 'Extraire de la logique dans un hook réutilisable', example: 'function useDebounce(value, delay) { ... }' },
      ]
    },
    {
      title: 'Performance', entries: [
        { cmd: 'React DevTools Profiler',          desc: 'Identifier les composants qui re-rendent inutilement' },
        { cmd: 'key={id}',                         desc: 'Toujours utiliser une clé stable dans les listes' },
        { cmd: 'Virtualisation (react-window)',    desc: 'Rendre uniquement les éléments visibles d\'une longue liste' },
        { cmd: 'Code splitting (lazy + Suspense)', desc: 'Charger les routes/composants à la demande' },
        { cmd: 'Éviter les objets inline',         desc: 'Créer des objets/tableaux en dehors du JSX pour éviter les re-renders' },
      ]
    },
  ]
}

export default react
