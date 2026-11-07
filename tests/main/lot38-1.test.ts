import { describe, expect, it } from 'vitest'
import { addTask, getNotes, openCounts, saveNotes, setTaskDone } from '../../src/main/services/notes/projectNotes'
import { notesText, taskPlan, undoNotes } from '../../src/main/services/assistant/notesTools'

/** v3.8 lot 1: a project's tasks and notes, and Forgy */
const project = { id: 'p1', name: 'shop', path: 'C:/p/shop' } as never

describe('v3.8 lot 1: tasks and notes', () => {
  it('keeps them per project, cleaned, and counts the open tasks', () => {
    expect(getNotes('p1')).toEqual({ tasks: [], notes: '', updatedAt: '' })
    const saved = saveNotes('p1', {
      tasks: [
        { id: 'a', text: '  Brancher Stripe  ', done: false, createdAt: '2026-10-29T08:00:00Z' },
        { id: 'b', text: 'Mettre à jour Symfony', done: true, createdAt: '2026-10-20T08:00:00Z', doneAt: '2026-10-26T08:00:00Z' },
        { id: 'c', text: '   ', done: false, createdAt: '' }
      ],
      notes: '# Mise en ligne\n\n- vider le cache', updatedAt: ''
    })
    expect(saved.tasks.map(t => t.text)).toEqual(['Brancher Stripe', 'Mettre à jour Symfony'])
    expect(saved.updatedAt).not.toBe('')
    expect(getNotes('p1').notes).toBe('# Mise en ligne\n\n- vider le cache')
    expect(openCounts()).toEqual({ p1: 1 })

    // Emptied: the project leaves the file
    saveNotes('p2', { tasks: [{ id: 'x', text: 'x', done: false, createdAt: '' }], notes: '', updatedAt: '' })
    saveNotes('p2', { tasks: [], notes: '  ', updatedAt: '' })
    expect(openCounts()).toEqual({ p1: 1 })
  })

  it('lets Forgy read them, add one and check one, each undone', async () => {
    saveNotes('p1', { tasks: [{ id: 'a', text: 'Brancher Stripe', done: false, createdAt: '' }], notes: 'Serveur : vps-1', updatedAt: '' })
    const text = notesText(project)
    expect(text).toContain('Tasks of shop: 1 open, 0 done')
    expect(text).toContain('- [ ] Brancher Stripe (id a)')
    expect(text).toContain('Serveur : vps-1')

    const add = taskPlan(project, 'add', 'Page mot de passe oublié', undefined)
    expect(add.preview).toBe('[ ] Page mot de passe oublié')
    const added = await add.run()
    expect(getNotes('p1').tasks.map(t => t.text)).toEqual(['Brancher Stripe', 'Page mot de passe oublié'])
    undoNotes(added.undo)
    expect(getNotes('p1').tasks.map(t => t.text)).toEqual(['Brancher Stripe'])

    const done = await taskPlan(project, 'done', undefined, 'a').run()
    expect(getNotes('p1').tasks[0]).toMatchObject({ done: true })
    expect(getNotes('p1').tasks[0].doneAt).toBeTruthy()
    undoNotes(done.undo)
    expect(getNotes('p1').tasks[0].done).toBe(false)

    expect(() => taskPlan(project, 'done', undefined, 'nope')).toThrow(/Unknown task/)
    expect(() => taskPlan(project, 'add', '  ', undefined)).toThrow(/Missing/)
    expect(setTaskDone('p1', 'nope', true)).toBeNull()
    expect(addTask('p1', 'x'.repeat(600)).text).toHaveLength(500)
  })
})
