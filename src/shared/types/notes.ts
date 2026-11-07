// ─── A project's tasks and notes (v3.8 lot 1) ─────────────────────────────────

export interface NoteTask {
  id: string
  text: string
  done: boolean
  createdAt: string
  doneAt?: string
}

export interface ProjectNotes {
  tasks: NoteTask[]
  /** Markdown */
  notes: string
  updatedAt: string
}

export interface NotesAPI {
  get: (projectId: string) => Promise<ProjectNotes>
  save: (projectId: string, notes: ProjectNotes) => Promise<ProjectNotes>
  /** Open tasks per project id (projects without any are left out) */
  counts: () => Promise<Record<string, number>>
}
