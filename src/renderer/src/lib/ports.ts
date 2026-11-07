import type { ListeningPort } from '@shared/types'

/** Processes that serve apps or data while developing (the rest is system noise) */
const DEV_PROCESS = /^(node|bun|deno|python\d*|php|php-cgi|java|ruby|go|dotnet|uvicorn|gunicorn|postgres|mysqld|mariadbd|mongod|redis-server|nginx|httpd|caddy|com\.docker\.backend|docker.*|wslrelay)(\.exe)?$/i

export const isDevPort = (p: ListeningPort) => p.port >= 1024 && DEV_PROCESS.test(p.processName)

/** Short name shown for a process (Docker's helpers all become "docker") */
export const processLabel = (name: string) => (/docker|wslrelay/i.test(name) ? 'docker' : name.replace(/\.exe$/i, ''))

/** Ports opened by dev servers, one entry per port */
export const devPorts = (ports: ListeningPort[]) =>
  [...new Map(ports.filter(isDevPort).map(p => [p.port, { ...p, processName: processLabel(p.processName) }])).values()]
    .sort((a, b) => a.port - b.port)
