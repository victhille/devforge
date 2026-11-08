// ─── A project's notes ───────────────────────────────────────────────────────
// Each note is a file of the project, <project>/.devforge/notes/<id>.md, so it
// follows Git. Its tasks are the checkboxes of its text.

export interface ProjectNote {
  /** The file's name without `.md`: lower-case letters, digits and dashes */
  id: string
  title: string
  pinned: boolean
  /** HTML from the editor (a file written by hand may hold Markdown) */
  body: string
  /** The file's last change (ISO) */
  updatedAt: string
}

/** A note in the list: no text, its boxes left to check counted */
export interface NoteSummary {
  id: string
  title: string
  pinned: boolean
  updatedAt: string
  open: number
}

/** What the window saves: no id for a new note */
export interface NoteInput {
  id?: string
  title: string
  pinned: boolean
  body: string
}

export interface NotesAPI {
  /** Pinned ones first, then the last changed */
  list: (projectId: string) => Promise<NoteSummary[]>
  read: (projectId: string, id: string) => Promise<ProjectNote>
  /** The note as saved; its id follows its title (a renamed note changes file) */
  save: (projectId: string, note: NoteInput) => Promise<ProjectNote>
  remove: (projectId: string, id: string) => Promise<void>
  /** Boxes left to check at the end of the project's tasks note; returns how many were added (those already there are left alone) */
  addTasks: (projectId: string, texts: string[]) => Promise<number>
  /** Boxes left to check per project id (projects without any are left out) */
  counts: () => Promise<Record<string, number>>
}
