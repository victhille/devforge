export interface DocEntry {
  cmd:      string
  desc:     string
  example?: string
}

export interface DocSection {
  title:   string
  entries: DocEntry[]
}

export interface DocTech {
  id:       string
  name:     string
  color:    string
  sections: DocSection[]
}
