import { describe, expect, it } from 'vitest'
import { folderName, folderOf, projectFolders, withProjectFolders } from '../../src/shared/lib/projectFolders'

/** v3.5 lot 1: several projects folders, the first one the default */
describe('v3.5: projects folders', () => {
  it('keeps the settings from before as the only folder', () => {
    expect(projectFolders({ defaultProjectsDir: 'C:\\Dev' })).toEqual(['C:\\Dev'])
    expect(projectFolders({ defaultProjectsDir: '' })).toEqual([])
  })

  it('lists them in order, without blanks nor the same folder twice', () => {
    expect(projectFolders({ defaultProjectsDir: 'C:\\Dev\\Projet Perso', extraProjectsDirs: ['', 'C:\\Dev\\Projet Client', 'c:/dev/projet perso/'] }))
      .toEqual(['C:\\Dev\\Projet Perso', 'C:\\Dev\\Projet Client'])
  })

  it('saves the first one as the default', () => {
    expect(withProjectFolders(['D:\\Client', ' ', 'C:\\Perso'])).toEqual({ defaultProjectsDir: 'D:\\Client', extraProjectsDirs: ['C:\\Perso'] })
    expect(withProjectFolders([])).toEqual({ defaultProjectsDir: '', extraProjectsDirs: [] })
  })

  it('finds the folder of a project: the deepest one holding it, not a name that only starts the same', () => {
    const folders = ['C:\\Dev', 'C:\\Dev\\Client', 'C:\\Perso']
    expect(folderOf('C:\\Dev\\Client\\shop', folders)).toBe('C:\\Dev\\Client')
    expect(folderOf('c:/dev/blog', folders)).toBe('C:\\Dev')
    expect(folderOf('C:\\Personal\\x', folders)).toBeNull()
    expect(folderOf('C:\\Perso', folders)).toBeNull()
  })

  it('names a folder by its last segment', () => {
    expect(folderName('C:\\Users\\me\\Projet Client\\')).toBe('Projet Client')
    expect(folderName('/home/me/code')).toBe('code')
  })
})
