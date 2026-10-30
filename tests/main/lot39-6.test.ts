import { describe, expect, it } from 'vitest'
import { DEFAULT_NAMING, generateMpd } from '@shared/lib/mpd'
import { saveModel } from '../../src/main/services/modeling/models'
import { runTool } from '../../src/main/services/assistant/assistantTools'
import { saveProjects, tempDir } from '../helpers'
import { shop } from '../shopMcd'
import { samples } from '../diagrams'

/** v3.9 lot 6: Forgy reads the Modeling page's models */

describe("Forgy's modeling tools", () => {
  it('lists the models, then reads an MCD, an MPD and a diagram as text', async () => {
    const project = tempDir('shop')
    saveProjects([{ name: 'shop', path: project }])
    expect(await runTool('project_models', { project: 'shop' })).toMatch(/has no model yet/)

    saveModel(project, 'boutique.mcd.json', { v: 1, kind: 'mcd', name: 'Boutique', updatedAt: '', mcd: shop() })
    saveModel(project, 'boutique.mpd.json', { v: 1, kind: 'mpd', name: 'Boutique', updatedAt: '', mpd: { ...generateMpd(shop(), DEFAULT_NAMING, 'mysql', null, 'boutique.mcd.json'), connection: 'dev' } })
    saveModel(project, 'parcours.usecase.json', { v: 1, kind: 'usecase', name: 'Parcours', updatedAt: '', diagram: samples.usecase() })
    saveModel(project, 'commande.sequence.json', { v: 1, kind: 'sequence', name: 'Commande', updatedAt: '', diagram: samples.sequence() })

    const list = await runTool('project_models', { project: 'shop' })
    expect(list).toContain('- boutique.mcd.json · mcd · "Boutique" · 6 entities, 5 associations')
    expect(list).toContain('- boutique.mpd.json · mpd · "Boutique" · 7 tables, mysql, linked to a database')
    expect(list).toContain('- parcours.usecase.json · usecase · "Parcours" · 9 parts, 6 links')

    const mcd = await runTool('read_model', { project: 'shop', file: 'boutique.mcd.json' })
    expect(mcd).toContain('- PASSER: CLIENT 0,n — COMMANDE 1,1')
    expect(mcd).toContain('COMMANDE (*id_commande, passee_le, statut, #id_client)')
    expect(mcd).toContain('CONTENIR (*#id_commande, *#id_produit, quantite)')
    expect(mcd).toContain('Check: warning noType COMMANDE.statut')

    const mpd = await runTool('read_model', { project: 'shop', file: 'boutique.mpd.json' })
    expect(mpd).toContain('Engine mysql · made from boutique.mcd.json · linked to a database connection')
    expect(mpd).toContain('- commande: *id INT NOT NULL, passee_le DATETIME, statut VARCHAR(255), client_id INT NOT NULL → client')
    expect(mpd).toContain('id INT AUTO_INCREMENT PRIMARY KEY')

    const uc = await runTool('read_model', { project: 'shop', file: 'parcours.usecase.json' })
    expect(uc).toContain('- case "Passer une commande" · actors Client · includes Payer · extended by Appliquer un coupon\n  scenario: 1. Le client valide son panier 2. Il paie')
    expect(uc).toContain('- include: Passer une commande → Payer')
    const seq = await runTool('read_model', { project: 'shop', file: 'commande.sequence.json' })
    expect(seq.indexOf('"valider le panier"')).toBeLessThan(seq.indexOf('"POST /commandes"'))

    await expect(runTool('read_model', { project: 'shop', file: '../../projects.json' })).rejects.toThrow(/Give "file"/)
    await expect(runTool('read_model', { project: 'shop', file: 'absent.mcd.json' })).rejects.toThrow(/No model absent.mcd.json/)
  })
})
