import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { DockerOverview, GitRepoDetails, ListeningPort, LocalDomain, ProjectHub, TestRun, TestRunnerInfo } from '@shared/types'
import { NO_CONNECTIONS, useDbConnections, useNoteCounts } from '@renderer/hooks/useLiveData'

/**
 * What a project's page shows, read from the main process: the project and its links, its Git state, its
 * containers, the ports in use, its scripts, its test tools and last run. Opening a project makes it the
 * active one (Forgy, widget, home); an unknown id leads back to the list.
 */
export function useProjectDetail(id: string | undefined, tab: string) {
  const navigate = useNavigate()
  const [hub, setHub] = useState<ProjectHub | null>(null)
  const [git, setGit] = useState<GitRepoDetails | null>(null)
  const [docker, setDocker] = useState<DockerOverview | null>(null)
  const [listening, setListening] = useState<ListeningPort[]>([])
  // The kept list of connections
  const connections = useDbConnections().data ?? NO_CONNECTIONS
  const [domains, setDomains] = useState<LocalDomain[]>([])
  const [scripts, setScripts] = useState<Record<string, string>>({})
  /** The project's test tools (no tool, no Tests tab) */
  const [testRunners, setTestRunners] = useState<TestRunnerInfo[]>([])
  /** The last test run, on the overview */
  const [testRun, setTestRun] = useState<TestRun | null>(null)
  /** The boxes left to check in its notes, on the Notes tab */
  const noteCounts = useNoteCounts().data

  const loadHub = useCallback(() => {
    if (!id) return
    window.devforge.hub
      .get(id)
      .then(setHub)
      .catch(() => navigate('/projects'))
  }, [id, navigate])
  const loadGit = useCallback(
    (fresh = false) => {
      if (hub)
        window.devforge.git
          .details(hub.project.path, fresh)
          .then(setGit)
          .catch(() => setGit(null))
    },
    [hub]
  )
  const loadDocker = useCallback(() => {
    window.devforge.docker
      .overview()
      .then(setDocker)
      .catch(() => {})
  }, [])
  const reloadPorts = useCallback(() => {
    window.devforge
      .getListeningPorts()
      .then(setListening)
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadHub()
    // Opening a project makes it the active one (Forgy, widget, home)
    if (id) window.devforge.hub.setActive(id).catch(() => {})
  }, [id, loadHub])

  useEffect(() => {
    if (!hub) return
    loadGit()
    loadDocker()
    reloadPorts()
    window.devforge.domains
      .list()
      .then(setDomains)
      .catch(() => {})
    window.devforge
      .getProjectScripts(hub.project.path)
      .then(setScripts)
      .catch(() => {})
  }, [hub, loadGit, loadDocker, reloadPorts])

  const projectPath = hub?.project.path
  useEffect(() => {
    if (!projectPath) return
    window.devforge.tests
      .detect(projectPath)
      .then(setTestRunners)
      .catch(() => setTestRunners([]))
  }, [projectPath])
  const firstRunner = testRunners[0]?.runner
  useEffect(() => {
    if (!projectPath || !firstRunner) return
    window.devforge.tests
      .last(projectPath, firstRunner)
      .then(r => setTestRun(r ?? null))
      .catch(() => setTestRun(null))
  }, [projectPath, firstRunner, tab])

  const compose = useMemo(() => docker?.compose.find(c => (hub?.composeDir && c.dir === hub.composeDir) || c.name === hub?.composeName) ?? null, [docker, hub])

  return {
    hub,
    setHub,
    loadHub,
    git,
    loadGit,
    docker,
    loadDocker,
    compose,
    listening,
    reloadPorts,
    connections,
    domains,
    scripts,
    testRunners,
    testRun,
    noteCounts
  }
}
