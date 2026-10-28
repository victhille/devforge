/**
 * v3.5 lot 3: the IDEs DevForge knows. Each is found by its usual install
 * folders on Windows (a %VAR% stands for that environment variable, a `*`
 * for any version folder), then by its command in PATH.
 */

export interface IdeEntry {
  id: string
  name: string
  /** Command in PATH (code, cursor…) */
  command?: string
  /** Program files, most likely first */
  paths: string[]
  /** How it opens a folder ({dir}); by default the folder alone */
  args?: string[]
}

const jetbrains = (id: string, name: string, folder: string, exe: string, command: string): IdeEntry => ({
  id, name, command,
  paths: [
    `%ProgramFiles%\\JetBrains\\${folder}*\\bin\\${exe}`,
    `%LOCALAPPDATA%\\Programs\\${folder}*\\bin\\${exe}`,
    `%LOCALAPPDATA%\\JetBrains\\Toolbox\\scripts\\${command}.cmd`
  ]
})

export const IDE_CATALOG: IdeEntry[] = [
  { id: 'vscode', name: 'VS Code', command: 'code', paths: ['%LOCALAPPDATA%\\Programs\\Microsoft VS Code\\Code.exe', '%ProgramFiles%\\Microsoft VS Code\\Code.exe'] },
  { id: 'cursor', name: 'Cursor', command: 'cursor', paths: ['%LOCALAPPDATA%\\Programs\\cursor\\Cursor.exe'] },
  { id: 'windsurf', name: 'Windsurf', command: 'windsurf', paths: ['%LOCALAPPDATA%\\Programs\\Windsurf\\Windsurf.exe'] },
  { id: 'antigravity', name: 'Antigravity', command: 'antigravity', paths: ['%LOCALAPPDATA%\\Programs\\Antigravity\\Antigravity.exe'] },
  { id: 'zed', name: 'Zed', command: 'zed', paths: ['%LOCALAPPDATA%\\Programs\\Zed\\Zed.exe'] },
  { id: 'sublime', name: 'Sublime Text', command: 'subl', paths: ['%ProgramFiles%\\Sublime Text\\sublime_text.exe', '%ProgramFiles%\\Sublime Text 3\\sublime_text.exe'] },
  jetbrains('phpstorm', 'PhpStorm', 'PhpStorm', 'phpstorm64.exe', 'phpstorm'),
  jetbrains('webstorm', 'WebStorm', 'WebStorm', 'webstorm64.exe', 'webstorm'),
  jetbrains('intellij', 'IntelliJ IDEA', 'IntelliJ IDEA', 'idea64.exe', 'idea'),
  jetbrains('pycharm', 'PyCharm', 'PyCharm', 'pycharm64.exe', 'pycharm'),
  jetbrains('rider', 'Rider', 'JetBrains Rider', 'rider64.exe', 'rider'),
  jetbrains('goland', 'GoLand', 'GoLand', 'goland64.exe', 'goland'),
  jetbrains('rustrover', 'RustRover', 'RustRover', 'rustrover64.exe', 'rustrover'),
  { id: 'visualstudio', name: 'Visual Studio', paths: ['%ProgramFiles%\\Microsoft Visual Studio\\*\\*\\Common7\\IDE\\devenv.exe'] },
  { id: 'notepadpp', name: 'Notepad++', paths: ['%ProgramFiles%\\Notepad++\\notepad++.exe', '%ProgramFiles(x86)%\\Notepad++\\notepad++.exe'], args: ['-openFoldersAsWorkspace', '{dir}'] }
]

/** What a list of IDEs says about each one */
export interface IdeInfo {
  id: string
  name: string
  /** Found on this PC (always true for an IDE added by hand whose program exists) */
  installed: boolean
  custom?: boolean
}

/** Arguments typed for an IDE added by hand: quoted parts kept whole, {dir} replaced by the folder */
export function ideArgs(template: string, dir: string): string[] {
  const parts = (template.trim() || '{dir}').match(/"[^"]*"|\S+/g) ?? []
  const args = parts.map(p => p.replace(/^"|"$/g, '').split('{dir}').join(dir))
  return template.includes('{dir}') || !template.trim() ? args : [...args, dir]
}
