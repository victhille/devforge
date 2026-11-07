import { useEffect, useState } from 'react'

export interface Snippet {
  id:        string
  title:     string
  language:  string
  code:      string
  tags:      string[]
  createdAt: string
}

const STORAGE_KEY = 'devforge:snippets'

function load(): Snippet[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}

/** Snippet list persisted in localStorage. */
export function useSnippets() {
  const [snippets, setSnippets] = useState<Snippet[]>(load)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snippets))
  }, [snippets])

  function create(): Snippet {
    const s: Snippet = {
      id: crypto.randomUUID(),
      title: 'New Snippet',
      language: 'TypeScript',
      code: '',
      tags: [],
      createdAt: new Date().toISOString()
    }
    setSnippets(prev => [s, ...prev])
    return s
  }

  function update(id: string, patch: Partial<Snippet>) {
    setSnippets(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)))
  }

  function remove(id: string) {
    setSnippets(prev => prev.filter(s => s.id !== id))
  }

  return { snippets, create, update, remove }
}
