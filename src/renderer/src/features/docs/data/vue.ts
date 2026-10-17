import type { DocTech } from './types'

const vue: DocTech = {
  id: 'vue', name: 'Vue 3', color: '#42B883',
  sections: [
    {
      title: 'Composition API', entries: [
        { cmd: 'ref(value)',              desc: 'Valeur réactive primitive', example: 'const count = ref(0); count.value++' },
        { cmd: 'reactive(obj)',           desc: 'Objet entièrement réactif', example: 'const state = reactive({ name: "", age: 0 })' },
        { cmd: 'computed(() => ...)',     desc: 'Valeur dérivée calculée automatiquement', example: 'const double = computed(() => count.value * 2)' },
        { cmd: 'watch(source, fn)',       desc: 'Observer un changement de réf/computed' },
        { cmd: 'watchEffect(fn)',         desc: 'Effet automatique qui piste ses dépendances' },
        { cmd: 'onMounted(fn)',           desc: 'Hook exécuté après le montage du composant' },
        { cmd: 'onUnmounted(fn)',         desc: 'Nettoyage avant destruction' },
        { cmd: 'onUpdated(fn)',           desc: 'Après chaque mise à jour du DOM' },
        { cmd: 'provide / inject',        desc: 'Passer des données en profondeur sans props' },
      ]
    },
    {
      title: 'Template', entries: [
        { cmd: 'v-bind  :prop="val"',    desc: 'Liaison d\'attribut dynamique' },
        { cmd: 'v-on  @click="fn"',      desc: 'Écouter un événement' },
        { cmd: 'v-model',                desc: 'Liaison bidirectionnelle (input ↔ réf)' },
        { cmd: 'v-if / v-else',          desc: 'Rendu conditionnel' },
        { cmd: 'v-for="item in list"',   desc: 'Boucle de rendu', example: '<li v-for="i in items" :key="i.id">{{ i.name }}</li>' },
        { cmd: 'v-show',                 desc: 'Masquer avec display:none (reste monté)' },
        { cmd: ':class="{ active: ok }"',desc: 'Classes conditionnelles' },
        { cmd: 'defineProps / defineEmits',desc: 'Déclarer props et événements dans <script setup>' },
      ]
    },
  ]
}

export default vue
