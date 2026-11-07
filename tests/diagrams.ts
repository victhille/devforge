import type { DiagramEdge, DiagramKind, DiagramModel, DiagramNode } from '../src/shared/types/modeling'

/** v3.9 lot 5: one sample of each diagram (unit tests and e2e) */

const n = (id: string, type: DiagramNode['type'], name: string, x: number, y: number, more: Partial<DiagramNode> = {}): DiagramNode => ({ id, type, name, x, y, ...more })
const e = (id: string, type: DiagramEdge['type'], from: string, to: string, more: Partial<DiagramEdge> = {}): DiagramEdge => ({ id, type, from, to, ...more })

export const samples: Record<DiagramKind, () => DiagramModel> = {
  usecase: () => ({
    nodes: [
      n('sys', 'system', 'Boutique en ligne', 160, 0, { w: 520, h: 420 }),
      n('cli', 'actor', 'Client', 0, 120), n('pay', 'actor', 'Prestataire de paiement', 760, 220), n('adm', 'actor', 'Admin', 0, 300),
      n('cat', 'case', 'Parcourir le catalogue', 200, 50), n('cmd', 'case', 'Passer une commande', 230, 150, { steps: ['Le client valide son panier', 'Il paie'] }),
      n('pai', 'case', 'Payer', 470, 220), n('cou', 'case', 'Appliquer un coupon', 470, 80), n('pro', 'case', 'Gérer les produits', 220, 320)
    ],
    edges: [
      e('a1', 'association', 'cli', 'cat'), e('a2', 'association', 'cli', 'cmd'), e('a3', 'association', 'pai', 'pay'), e('a4', 'association', 'adm', 'pro'),
      e('i1', 'include', 'cmd', 'pai'), e('x1', 'extend', 'cou', 'cmd')
    ],
    notes: []
  }),
  class: () => ({
    nodes: [
      n('cl', 'class', 'Client', 0, 0, { attributes: ['- id : int', '- email : string'], methods: ['+ commandes() : Commande[]'] }),
      n('co', 'class', 'Commande', 320, 0, { attributes: ['- id : int', '- statut : Statut'], methods: ['+ total() : float'] }),
      n('li', 'class', 'Ligne', 320, 220, { attributes: ['- quantite : int'], methods: [] }),
      n('st', 'enum', 'Statut', 620, 0, { attributes: ['PANIER', 'PAYEE', 'LIVREE'] }),
      n('pa', 'interface', 'Payable', 0, 220, { attributes: [], methods: ['+ payer() : void'] })
    ],
    edges: [e('r1', 'association', 'cl', 'co', { label: '1..*' }), e('r2', 'composition', 'co', 'li'), e('r3', 'implementation', 'co', 'pa'), e('r4', 'dependency', 'co', 'st')],
    notes: [{ id: 'nt', x: 620, y: 200, text: 'Une commande payée ne change plus.' }]
  }),
  sequence: () => ({
    nodes: [n('u', 'actor', 'Client', 0, 0), n('f', 'participant', 'Front', 160, 28), n('a', 'participant', 'API', 340, 28), n('d', 'participant', 'Base', 520, 28)],
    edges: [
      e('m1', 'message', 'u', 'f', { label: 'valider le panier', y: 130 }), e('m2', 'message', 'f', 'a', { label: 'POST /commandes', y: 174 }),
      e('m3', 'message', 'a', 'd', { label: 'INSERT commande', y: 218 }), e('m4', 'return', 'a', 'f', { label: '201', y: 262 }), e('m5', 'message', 'a', 'a', { label: 'vérifier le stock', y: 306 })
    ],
    notes: []
  }),
  flow: () => ({
    nodes: [
      n('s', 'start', 'Début', 60, 0), n('i', 'io', 'Saisir le panier', 30, 80), n('d', 'decision', 'Stock suffisant ?', 30, 170),
      n('p', 'step', 'Payer', 40, 300), n('r', 'step', 'Prévenir le client', 300, 187), n('f', 'end', 'Fin', 60, 390)
    ],
    edges: [e('f1', 'flow', 's', 'i'), e('f2', 'flow', 'i', 'd'), e('f3', 'flow', 'd', 'p', { label: 'oui' }), e('f4', 'flow', 'd', 'r', { label: 'non' }), e('f5', 'flow', 'p', 'f')],
    notes: []
  }),
  architecture: () => ({
    nodes: [
      n('c', 'client', 'Navigateur', 0, 80), n('g', 'gateway', 'Nginx', 200, 80), n('a', 'service', 'API Symfony', 420, 30), n('w', 'service', 'Worker', 420, 170),
      n('d', 'database', 'PostgreSQL', 660, 20), n('q', 'queue', 'RabbitMQ', 640, 170), n('x', 'external', 'Stripe', 660, 300)
    ],
    edges: [
      e('k1', 'link', 'c', 'g', { label: 'HTTPS' }), e('k2', 'link', 'g', 'a'), e('k3', 'link', 'a', 'd', { label: 'SQL' }), e('k4', 'link', 'a', 'q'),
      e('k5', 'link', 'q', 'w'), e('k6', 'link', 'a', 'x', { label: 'paiement' })
    ],
    notes: []
  })
}
