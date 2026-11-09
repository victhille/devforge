import { beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import { addTasks, addTasksById, listNotes, openCounts, parseNote, readNote, removeNote, saveNote, serializeNote, slugify } from '../../src/main/services/notes/projectNotes'
import { notesText, taskPlan, undoNotes } from '../../src/main/services/assistant/notesTools'
import { saveProjects, tempDir, userData } from '../helpers'

/** A project's notes: files of the project (.devforge/notes), their checkboxes its tasks; Forgy; the notes of v3.8 moved in */
let shop: string
let blog: string
const project = () => ({ id: 'p0', name: 'shop', path: shop }) as never
const notesDir = () => join(shop, '.devforge', 'notes')
const legacy = () => join(userData(), 'project-notes.json')
const file = (id: string) => readFileSync(join(notesDir(), `${id}.md`), 'utf-8')

beforeEach(() => {
  shop = tempDir('shop')
  blog = tempDir('blog')
  saveProjects([{ name: 'shop', path: shop }, { name: 'blog', path: blog }])
  rmSync(legacy(), { force: true })
})

describe('notes in the project', () => {
  it('writes one file per note, named after its title, and lists them pinned first', () => {
    expect(listNotes('p0')).toEqual([])
    expect(existsSync(notesDir())).toBe(false)

    const a = saveNote('p0', { title: '  Comptes de test   Stripe ', pinned: false, body: '<p>carte <b>4242</b></p>' })
    expect(a).toMatchObject({ id: 'comptes-de-test-stripe', title: 'Comptes de test Stripe', pinned: false })
    expect(file(a.id)).toBe('---\ntitle: Comptes de test Stripe\npinned: false\n---\n<p>carte <b>4242</b></p>\n')

    // Same title: a free name; pinned: first
    const b = saveNote('p0', { title: 'Comptes de test Stripe', pinned: true, body: '' })
    expect(b.id).toBe('comptes-de-test-stripe-2')
    const c = saveNote('p0', { title: 'À faire : mise en ligne', pinned: false, body: '<ul data-checklist><li data-checked="false">DNS</li><li data-checked="true">TLS</li></ul>' })
    expect(c.id).toBe('a-faire-mise-en-ligne')
    // A title YAML would misread is quoted; the HTML one block per line
    expect(file(c.id)).toBe('---\ntitle: "À faire : mise en ligne"\npinned: false\n---\n<ul data-checklist>\n<li data-checked="false">DNS</li>\n<li data-checked="true">TLS</li>\n</ul>\n')
    const list = listNotes('p0')
    expect(list[0]).toMatchObject({ id: 'comptes-de-test-stripe-2', pinned: true, open: 0 })
    expect(list.slice(1).map(n => [n.id, n.open]).sort()).toEqual([['a-faire-mise-en-ligne', 1], ['comptes-de-test-stripe', 0]])

    // Read back as written
    expect(readNote('p0', c.id)).toMatchObject({ title: 'À faire : mise en ligne', pinned: false, body: '<ul data-checklist>\n<li data-checked="false">DNS</li>\n<li data-checked="true">TLS</li>\n</ul>\n' })
    expect(openCounts()).toEqual({ p0: 1 })
  })

  it('renames the file with the title, and deletes a note', () => {
    const a = saveNote('p0', { title: 'Sans titre', pinned: false, body: '' })
    expect(a.id).toBe('sans-titre')
    const b = saveNote('p0', { id: a.id, title: 'Idées pour le tunnel', pinned: false, body: '<p>x</p>' })
    expect(b.id).toBe('idees-pour-le-tunnel')
    expect(readdirSync(notesDir())).toEqual(['idees-pour-le-tunnel.md'])
    // Same title, same file
    expect(saveNote('p0', { id: b.id, title: 'idées pour le tunnel', pinned: true, body: '<p>y</p>' }).id).toBe(b.id)
    removeNote('p0', b.id)
    expect(readdirSync(notesDir())).toEqual([])
    expect(() => readNote('p0', b.id)).toThrow(/not found/)
  })

  it('refuses what is not a note of a saved project', () => {
    saveNote('p0', { title: 'a', pinned: false, body: '' })
    for (const id of ['../secret', '..', 'A', 'a/b', 'C:\\x', join(shop, 'x'), '-x', 'x'.repeat(81)]) {
      expect(() => readNote('p0', id)).toThrow(/Invalid note id/)
      expect(() => saveNote('p0', { id, title: 'x', pinned: false, body: '' })).toThrow(/Invalid note id/)
      expect(() => removeNote('p0', id)).toThrow(/Invalid note id/)
    }
    expect(() => listNotes('nope')).toThrow(/Unknown project/)
    expect(() => saveNote('p0', { title: 'x', pinned: false, body: 'x'.repeat(200_001) })).toThrow(/at most/)
    expect(slugify('../../etc/passwd')).toBe('etc-passwd')
    expect(slugify('***')).toBe('note')
  })

  it('does not follow a link out of the project', () => {
    const outside = tempDir('outside')
    symlinkSync(outside, join(shop, '.devforge'), 'junction')
    expect(() => saveNote('p0', { title: 'x', pinned: false, body: '' })).toThrow(/Not a plain folder/)
    expect(() => listNotes('p0')).toThrow(/Not a plain folder/)
    expect(readdirSync(outside)).toEqual([])
    expect(openCounts()).toEqual({})
  })

  it('opens a note written by hand in Markdown', () => {
    mkdirSync(notesDir(), { recursive: true })
    writeFileSync(join(notesDir(), 'deploiement.md'), '# Déploiement\n\n- [ ] DNS\n- [x] pm2\n\nSur vps-demo.\n')
    writeFileSync(join(notesDir(), 'sans-entete.md'), 'Juste du texte')
    // Not a note: its name is not one DevForge would write
    writeFileSync(join(notesDir(), 'Notes Perso.md'), 'x')
    expect(listNotes('p0').map(n => [n.id, n.title, n.open])).toEqual(expect.arrayContaining([['deploiement', 'Déploiement', 1], ['sans-entete', 'sans entete', 0]]))
    expect(listNotes('p0')).toHaveLength(2)
    expect(readNote('p0', 'deploiement').body).toBe('- [ ] DNS\n- [x] pm2\n\nSur vps-demo.\n')
    expect(parseNote('x', '---\ntitle: \'l\'\'été\'\npinned: yes\n---\n<p>a</p>', '')).toMatchObject({ title: 'l\'été', pinned: true, body: '<p>a</p>' })
    expect(parseNote('x', serializeNote({ title: '#1: "go"', pinned: false, body: '' }), '').title).toBe('#1: "go"')
  })

  it('adds tasks to the tasks note, made when there is none, never twice', () => {
    saveNote('p0', { title: 'Idées', pinned: false, body: '<ul data-checklist><li data-checked="false">Payer</li></ul>' })
    expect(addTasksById('p0', ['Payer', 'Passer une commande', '  ', 'Passer une commande'])).toBe(1)
    const tasks = listNotes('p0').find(n => n.title === 'Tâches')!
    expect(tasks).toMatchObject({ id: 'taches', pinned: true, open: 1 })
    expect(addTasks(project(), ['Livrer']).added).toEqual(['Livrer'])
    expect(readNote('p0', 'taches').body).toBe('<ul data-checklist>\n<li data-checked="false">Passer une commande</li>\n<li data-checked="false">Livrer</li>\n</ul>\n')
    expect(addTasksById('p0', ['Livrer'])).toBe(0)
    expect(openCounts()).toEqual({ p0: 3 })
  })
})

describe('the notes of v3.8 move into the project', () => {
  const entry = {
    tasks: [
      { id: 'a', text: 'Brancher Stripe', done: false, createdAt: '' },
      { id: 'b', text: 'Mettre à jour <Symfony>', done: true, createdAt: '', doneAt: '2026-10-26T08:00:00Z' },
      { id: 'c', text: '  ', done: false, createdAt: '' }
    ],
    notes: '# Mise en ligne\n\n- vider le **cache**',
    updatedAt: ''
  }

  it('makes a pinned « Tâches » checklist and a « Notes » note, then leaves the JSON', () => {
    writeFileSync(legacy(), JSON.stringify({ p0: entry, p1: { tasks: [{ id: 'x', text: 'Écrire', done: false, createdAt: '' }], notes: '', updatedAt: '' } }))
    // Counted from the JSON before they move
    expect(openCounts()).toEqual({ p0: 1, p1: 1 })

    expect(listNotes('p0').map(n => [n.id, n.title, n.pinned, n.open])).toEqual([['taches', 'Tâches', true, 1], ['notes', 'Notes', false, 0]])
    expect(readNote('p0', 'taches').body).toBe('<ul data-checklist>\n<li data-checked="false">Brancher Stripe</li>\n<li data-checked="true">Mettre à jour &lt;Symfony&gt;</li>\n</ul>\n')
    // The Markdown stays Markdown (the editor converts it when it opens)
    expect(readNote('p0', 'notes').body).toBe('# Mise en ligne\n\n- vider le **cache**')
    // The other project's entry stays until its notes are read
    expect(Object.keys(JSON.parse(readFileSync(legacy(), 'utf-8')))).toEqual(['p1'])
    expect(openCounts()).toEqual({ p0: 1, p1: 1 })
    expect(listNotes('p1')).toHaveLength(1)
    expect(existsSync(legacy())).toBe(false)
  })

  it('keeps everything in the JSON when the files cannot be written, and writes nothing twice', () => {
    writeFileSync(legacy(), JSON.stringify({ p0: entry }))
    // .devforge is a file: no folder for the notes
    writeFileSync(join(shop, '.devforge'), 'x')
    expect(() => listNotes('p0')).toThrow(/Not a plain folder/)
    expect(JSON.parse(readFileSync(legacy(), 'utf-8'))).toEqual({ p0: entry })

    rmSync(join(shop, '.devforge'))
    expect(listNotes('p0')).toHaveLength(2)
    // An earlier try wrote the files but could not take the entry out: the next one writes nothing again
    writeFileSync(legacy(), JSON.stringify({ p0: entry }))
    expect(listNotes('p0')).toHaveLength(2)
    expect(existsSync(legacy())).toBe(false)
    // With the .gitignore that keeps them on this PC
    expect(readdirSync(notesDir()).sort()).toEqual(['.gitignore', 'notes.md', 'taches.md'])
  })

  it('a project whose folder is gone keeps its old notes', () => {
    writeFileSync(legacy(), JSON.stringify({ p0: entry }))
    rmSync(shop, { recursive: true, force: true })
    expect(() => listNotes('p0')).toThrow(/Project folder not found/)
    expect(existsSync(shop)).toBe(false)
    expect(JSON.parse(readFileSync(legacy(), 'utf-8'))).toEqual({ p0: entry })
  })
})

describe('Forgy and the notes', () => {
  beforeEach(() => {
    saveNote('p0', { title: 'Tâches', pinned: true, body: '<ul data-checklist><li data-checked="false">Brancher Stripe</li><li data-checked="true">Corriger la TVA</li></ul>' })
    saveNote('p0', { title: 'Serveur', pinned: false, body: '<p>vps-1, <b>pm2</b></p><ul data-checklist><li data-checked="false">Certificat</li></ul>' })
  })

  it('reads the titles, the boxes and the text', () => {
    const text = notesText(project())
    expect(text).toContain('2 note(s), tasks: 2 open, 1 done')
    expect(text).toContain('## Tâches (pinned)\n- [ ] Brancher Stripe\n- [x] Corriger la TVA')
    expect(text).toContain('## Serveur\nvps-1, pm2')
    expect(text).toContain('- [ ] Certificat')
  })

  it('adds a box, checks one, removes one, each undone', async () => {
    const add = taskPlan(project(), 'add', 'Page mot de passe oublié', undefined)
    expect(add.preview).toBe('[ ] Page mot de passe oublié')
    const added = await add.run()
    const texts = () => readNote('p0', 'taches').body
    expect(texts()).toContain('<li data-checked="false">Page mot de passe oublié</li>\n</ul>')
    expect(undoNotes(added.undo)).toBe('Task removed')
    expect(texts()).not.toContain('Page mot de passe')

    // By its text, in any case, in any note
    const done = await taskPlan(project(), 'done', undefined, 'certificat').run()
    expect(readNote('p0', 'serveur').body).toContain('<li data-checked="true">Certificat</li>')
    expect(openCounts()).toEqual({ p0: 1 })
    undoNotes(done.undo)
    expect(readNote('p0', 'serveur').body).toContain('<li data-checked="false">Certificat</li>')

    const reopen = await taskPlan(project(), 'reopen', undefined, 'Corriger la TVA').run()
    expect(texts()).toContain('<li data-checked="false">Corriger la TVA</li>')
    undoNotes(reopen.undo)
    expect(texts()).toContain('<li data-checked="true">Corriger la TVA</li>')

    const removed = await taskPlan(project(), 'remove', undefined, 'Brancher Stripe').run()
    expect(texts()).not.toContain('Brancher Stripe')
    expect(undoNotes(removed.undo)).toBe('Task put back')
    expect(texts()).toBe('<ul data-checklist>\n<li data-checked="false">Brancher Stripe</li>\n<li data-checked="true">Corriger la TVA</li>\n</ul>\n')

    expect(() => taskPlan(project(), 'done', undefined, 'nope')).toThrow(/Unknown task/)
    expect(() => taskPlan(project(), 'add', '  ', undefined)).toThrow(/Missing/)
    expect(() => taskPlan(project(), 'move', 'x', undefined)).toThrow(/must be add/)
  })
})
