import docker from './docker'
import react from './react'
import vue from './vue'
import symfony from './symfony'
import nodejs from './nodejs'
import git from './git'
import shell from './shell'
import python from './python'
import type { DocTech } from './types'

export type { DocEntry, DocSection, DocTech } from './types'

export const DOCS: DocTech[] = [docker, react, vue, symfony, nodejs, git, shell, python]
