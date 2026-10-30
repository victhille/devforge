import type { Cardinality, McdAttribute, McdModel } from '../src/shared/types/modeling'

/** v3.9: the shop of the roadmap, 6 entities and 5 associations (unit tests and e2e) */

const attr = (id: string, name: string, type: McdAttribute['type'], more: Partial<McdAttribute> = {}): McdAttribute => ({ id, name, type, ...more })
export const identifier = (x: string, name: string) => attr(x, name, 'int', { identifier: true })
export { attr }

export const shop = (): McdModel => {
  const leg = (n: number, entity: string, association: string, card: Cardinality) => ({ id: `l${n}`, entity, association, card })
  const id = identifier
  return {
    entities: [
      { id: 'cl', name: 'CLIENT', x: 0, y: 0, attributes: [id('cl1', 'id_client'), attr('cl2', 'nom', 'varchar', { length: 80 }), attr('cl3', 'email', 'varchar', { length: 180 }), attr('cl4', 'inscrit_le', 'datetime')] },
      { id: 'ad', name: 'ADRESSE', x: 0, y: 300, attributes: [id('ad1', 'id_adresse'), attr('ad2', 'rue', 'varchar'), attr('ad3', 'ville', 'varchar', { length: 80 })] },
      { id: 'co', name: 'COMMANDE', x: 400, y: 0, attributes: [id('co1', 'id_commande'), attr('co2', 'passee_le', 'datetime'), attr('co3', 'statut', '')] },
      { id: 'ca', name: 'CATEGORIE', x: 800, y: 300, attributes: [id('ca1', 'id_categorie'), attr('ca2', 'nom', 'varchar')] },
      { id: 'pr', name: 'PRODUIT', x: 800, y: 0, attributes: [id('pr1', 'id_produit'), attr('pr2', 'libelle', 'varchar', { length: 120 }), attr('pr3', 'prix', 'decimal'), attr('pr4', 'stock', 'int')] },
      { id: 'av', name: 'AVIS', x: 400, y: 300, attributes: [id('av1', 'id_avis'), attr('av2', 'note', 'int'), attr('av3', 'commentaire', 'text')] }
    ],
    associations: [
      { id: 'pa', name: 'PASSER', x: 200, y: 0, attributes: [] },
      { id: 'ha', name: 'HABITER', x: 0, y: 150, attributes: [] },
      { id: 'cn', name: 'CONTENIR', x: 600, y: 0, attributes: [attr('cn1', 'quantite', 'int')] },
      { id: 'ap', name: 'APPARTENIR', x: 800, y: 150, attributes: [] },
      { id: 'ec', name: 'ECRIRE', x: 200, y: 300, attributes: [attr('ec1', 'ecrit_le', 'date')] }
    ],
    links: [
      leg(1, 'cl', 'pa', '0,n'), leg(2, 'co', 'pa', '1,1'),
      leg(3, 'cl', 'ha', '0,n'), leg(4, 'ad', 'ha', '1,1'),
      leg(5, 'co', 'cn', '1,n'), leg(6, 'pr', 'cn', '0,n'),
      leg(7, 'pr', 'ap', '1,1'), leg(8, 'ca', 'ap', '0,n'),
      leg(9, 'cl', 'ec', '0,n'), leg(10, 'av', 'ec', '1,1')
    ],
    notes: []
  }
}
