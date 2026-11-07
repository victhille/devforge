import { describe, expect, it } from 'vitest'
import { folderName, folderOf, projectFolders, withProjectFolders } from '../../src/shared/lib/projectFolders'

/** v3.5 lot 1: several projects folders, the first one the default */
describe('v3.5: projects folders', () => {
  it('keeps the settings from before as the only folder', () => {
    expect(projectFolders({ defaultProjectsDir: 'C:\\Dev' })).toEqual(['C:\\Dev'])
    expect(projectFolders({ defaultProjectsDir: '' })).toEqual([])
  })

  it('lists them in order, without blanks nor the same folder twice', () => {
    expect(projectFolders({ defaultProjectsDir: 'C:\\Dev\\Projet Perso', extraProjectsDirs: ['', 'C:\\Dev\\Projet Cefim', 'c:/dev/projet perso/'] }))
      .toEqual(['C:\\Dev\\Projet Perso', 'C:\\Dev\\Projet Cefim'])
  })

  it('saves the first one as the default', () => {
    expect(withProjectFolders(['D:\\Cefim', ' ', 'C:\\Perso'])).toEqual({ defaultProjectsDir: 'D:\\Cefim', extraProjectsDirs: ['C:\\Perso'] })
    expect(withProjectFolders([])).toEqual({ defaultProjectsDir: '', extraProjectsDirs: [] })
  })

  it('finds the folder of a project: the deepest one holding it, not a name that only starts the same', () => {
    const folders = ['C:\\Dev', 'C:\\Dev\\Cefim', 'C:\\Perso']
    expect(folderOf('C:\\Dev\\Cefim\\shop', folders)).toBe('C:\\Dev\\Cefim')
    expect(folderOf('c:/dev/blog', folders)).toBe('C:\\Dev')
    expect(folderOf('C:\\Personal\\x', folders)).toBeNull()
    expect(folderOf('C:\\Perso', folders)).toBeNull()
  })

  it('names a folder by its last segment', () => {
    expect(folderName('C:\\Users\\me\\Projet Cefim\\')).toBe('Projet Cefim')
    expect(folderName('/home/me/code')).toBe('code')
  })
})
