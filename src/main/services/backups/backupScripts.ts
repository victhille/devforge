/**
 * Shell scripts of the server-side backups, kept here so they are tested.
 * Everything lives in ~/devforge/backups; nothing else on the server changes,
 * except one line in the user's crontab.
 *
 * - Databases are dumped inside their container with the credentials of the
 *   container's own environment: no password leaves the server or DevForge.
 * - Volumes are archived by a throw-away alpine container that streams the
 *   tar to stdout: the files belong to the user, no bind mount needed.
 */

export const BACKUP_DIR = '~/devforge/backups'
export const CRON_TAG = '# devforge-backup'

/** Dump commands, run with `sh -c` inside the database container */
export const DUMP: Record<'postgres' | 'mariadb', string> = {
  postgres: 'pg_dumpall --clean --if-exists -U "${POSTGRES_USER:-postgres}"',
  mariadb: 'd=mariadb-dump; command -v $d >/dev/null 2>&1 || d=mysqldump; MYSQL_PWD="${MARIADB_ROOT_PASSWORD:-${MYSQL_ROOT_PASSWORD:-}}" $d --all-databases --single-transaction --routines --events -uroot'
}

/** Restore commands, fed the dump on stdin */
export const LOAD: Record<'postgres' | 'mariadb', string> = {
  postgres: 'psql -q -o /dev/null -U "${POSTGRES_USER:-postgres}" -d postgres',
  mariadb: 'c=mariadb; command -v $c >/dev/null 2>&1 || c=mysql; MYSQL_PWD="${MARIADB_ROOT_PASSWORD:-${MYSQL_ROOT_PASSWORD:-}}" $c -uroot'
}

/** backup.sh: reads ./config ("DB postgres <container>", "VOL <volume>", "KEEP_DAILY 7", "KEEP_WEEKLY 4") */
export const BACKUP_SH = `#!/usr/bin/env bash
# Written by DevForge: backups of the databases and volumes listed in ./config.
# Output in daily/<date>/, a copy in weekly/ on Sundays, state in status.json.
set -u
DIR="$(cd "$(dirname "$0")" && pwd)"
DAY="$(date +%F)"
OUT="$DIR/daily/$DAY"
STATUS="$DIR/status.json"

exec 9>"$DIR/.lock"
if command -v flock >/dev/null 2>&1; then flock -n 9 || { echo "A backup is already running"; exit 0; }; fi
# The log stays small
[ -f "$DIR/backup.log" ] && [ "$(wc -c < "$DIR/backup.log")" -gt 1000000 ] && : > "$DIR/backup.log"

mkdir -p "$OUT"
STARTED="$(date -u +%FT%TZ)"
ITEMS=""
FAIL=0
KEEP_DAILY=7
KEEP_WEEKLY=4

esc() { printf '%s' "$1" | tr -d '\\r' | tr '\\n' ' ' | sed 's/\\\\/\\\\\\\\/g; s/"/\\\\"/g'; }
item() { # kind name file ok error
  size=0; [ -f "$3" ] && size=$(wc -c < "$3" | tr -d ' ')
  ITEMS="$ITEMS\${ITEMS:+,}{\\"kind\\":\\"$1\\",\\"name\\":\\"$(esc "$2")\\",\\"file\\":\\"$(esc "\${3#"$DIR"/}")\\",\\"size\\":$size,\\"ok\\":$4,\\"error\\":\\"$(esc "$5")\\"}"
}
dump_cmd() {
  case "$1" in
    postgres) echo '${DUMP.postgres}' ;;
    mariadb) echo '${DUMP.mariadb.replace(/'/g, "'\\''")}' ;;
  esac
}

while read -r KIND A B; do
  case "$KIND" in
    KEEP_DAILY) KEEP_DAILY="$A" ;;
    KEEP_WEEKLY) KEEP_WEEKLY="$A" ;;
    DB)
      F="$OUT/db-$B.sql.gz"
      CMD="$(dump_cmd "$A")"
      if [ -z "$CMD" ]; then item db "$B" "" false "Unknown engine $A"; FAIL=1; continue; fi
      docker exec "$B" sh -c "$CMD" 2>"$OUT/.err" | gzip > "$F.tmp"
      ST=("\${PIPESTATUS[@]}")
      if [ "\${ST[0]}" = 0 ] && [ "\${ST[1]}" = 0 ]; then mv "$F.tmp" "$F"; item db "$B" "$F" true ""
      else rm -f "$F.tmp"; item db "$B" "" false "$(tail -c 300 "$OUT/.err")"; FAIL=1; fi
      ;;
    VOL)
      # A volume name, or a folder of the server ("/opt/app/data" → vol-opt_app_data)
      F="$OUT/vol-$(printf '%s' "$A" | sed 's#^/##; s#/#_#g').tar.gz"
      if docker run --rm -v "$A":/data:ro alpine:3 tar czf - -C /data . > "$F.tmp" 2>"$OUT/.err"; then mv "$F.tmp" "$F"; item vol "$A" "$F" true ""
      else rm -f "$F.tmp"; item vol "$A" "" false "$(tail -c 300 "$OUT/.err")"; FAIL=1; fi
      ;;
  esac
done < "$DIR/config"
rm -f "$OUT/.err"

# Sundays: a weekly copy (hard links, no extra space)
if [ "$(date +%u)" = 7 ]; then
  rm -rf "$DIR/weekly/$DAY"; mkdir -p "$DIR/weekly/$DAY"
  for f in "$OUT"/*; do [ -f "$f" ] && ln "$f" "$DIR/weekly/$DAY/"; done
fi
# Rotation: the newest KEEP_DAILY days and KEEP_WEEKLY weeks stay
for kind in daily weekly; do
  keep=$KEEP_DAILY; [ $kind = weekly ] && keep=$KEEP_WEEKLY
  [ -d "$DIR/$kind" ] && ls -1 "$DIR/$kind" | sort -r | tail -n +$((keep + 1)) | while read -r old; do rm -rf "\${DIR:?}/$kind/$old"; done
done

SIZE=0
for f in "$OUT"/*; do [ -f "$f" ] && SIZE=$((SIZE + $(wc -c < "$f"))); done
OK=true; [ $FAIL = 0 ] || OK=false
printf '{"version":1,"day":"%s","startedAt":"%s","finishedAt":"%s","ok":%s,"size":%s,"items":[%s]}\\n' \\
  "$DAY" "$STARTED" "$(date -u +%FT%TZ)" "$OK" "$SIZE" "$ITEMS" > "$STATUS.tmp" && mv "$STATUS.tmp" "$STATUS"
echo "$DAY $OK $SIZE" >> "$DIR/history.log"
[ $FAIL = 0 ]
`

/** File name part of a volume or folder: "/opt/app/data" → "opt_app_data" */
export const safeName = (v: string) => v.replace(/^\//, '').replace(/\//g, '_')

/** A volume name, or an absolute folder path without ".." */
export const TARGET_RE = /^(?:[\w.-]+|(?:\/[\w.-]+)+)$/
export const isTarget = (v: string) => TARGET_RE.test(v) && !v.split('/').includes('..')

/** Containers that mount a volume or folder: ids, one per line */
const usersOf = (v: string) => `docker ps -q | xargs -r docker inspect --format '{{.Id}} {{range .Mounts}}{{.Name}} {{.Source}} {{end}}' | grep -F " ${v} " | cut -c1-12 || true`

export interface BackupTargets { databases: { engine: 'postgres' | 'mariadb'; container: string }[]; volumes: string[]; keepDaily: number; keepWeekly: number }

export const configFile = (t: BackupTargets) => [
  `KEEP_DAILY ${t.keepDaily}`,
  `KEEP_WEEKLY ${t.keepWeekly}`,
  ...t.databases.map(d => `DB ${d.engine} ${d.container}`),
  ...t.volumes.map(v => `VOL ${v}`)
].join('\n') + '\n'

const b64 = (s: string) => Buffer.from(s, 'utf-8').toString('base64')

/** Installs (or updates) the script, its config and the nightly cron line at `hh:mm` */
export function installScript(t: BackupTargets, time: string): string {
  const [h = '3', m = '30'] = time.split(':')
  const line = `${Number(m)} ${Number(h)} * * * $HOME/devforge/backups/backup.sh >> $HOME/devforge/backups/backup.log 2>&1 ${CRON_TAG}`
  return [
    'set -e',
    `mkdir -p ${BACKUP_DIR} && cd ${BACKUP_DIR}`,
    `echo ${b64(BACKUP_SH)} | base64 -d > backup.sh && chmod 700 backup.sh`,
    `echo ${b64(configFile(t))} | base64 -d > config`,
    'command -v crontab >/dev/null || { echo "crontab is missing on this server"; exit 3; }',
    `(crontab -l 2>/dev/null | grep -v '${CRON_TAG}' || true; echo "${line}") | crontab -`,
    `echo "Nightly backup at ${String(Number(h)).padStart(2, '0')}:${String(Number(m)).padStart(2, '0')}"`
  ].join('\n')
}

export const uninstallScript = () => `(crontab -l 2>/dev/null | grep -v '${CRON_TAG}' || true) | crontab - && echo "Nightly backup off (the files stay in ${BACKUP_DIR})"`

/** Path of a backup file, checked: inside daily/ or weekly/, no "..", a known extension */
export const SAFE_FILE = /^(daily|weekly)\/\d{4}-\d{2}-\d{2}\/(db|vol)-[\w.-]+\.(sql|tar)\.gz$/

/** Containers of the same Compose project (stopped during a restore so nothing writes meanwhile) */
const projectPeers = (container: string) =>
  `P="$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' ${container} 2>/dev/null)"; ` +
  `PEERS=""; [ -n "$P" ] && PEERS="$(docker ps -q --filter "label=com.docker.compose.project=$P" | grep -v "$(docker inspect -f '{{.Id}}' ${container} | cut -c1-12)" || true)"`

/**
 * Restore of a database dump or a volume archive, after a safety copy of the
 * current state in pre-restore/. The containers that use the data are stopped
 * meanwhile, then started again.
 */
export function restoreScript(file: string, target: { kind: 'db'; engine: 'postgres' | 'mariadb'; container: string } | { kind: 'vol'; volume: string }): string {
  if (!SAFE_FILE.test(file)) throw new Error('Invalid backup file')
  const stamp = '$(date +%F-%H%M%S)'
  if (target.kind === 'db') {
    const c = target.container
    if (!/^[\w.-]+$/.test(c)) throw new Error('Invalid container')
    return [
      'set -e -o pipefail',
      `cd ${BACKUP_DIR} && mkdir -p pre-restore`,
      `S="pre-restore/${stamp}-db-${c}.sql.gz"`,
      `docker exec ${c} sh -c '${DUMP[target.engine].replace(/'/g, "'\\''")}' | gzip > "$S"`,
      'echo "Safety copy: $S"',
      projectPeers(c),
      '[ -n "$PEERS" ] && docker stop $PEERS >/dev/null && echo "Stopped while restoring: $(docker inspect -f "{{.Name}}" $PEERS | tr -d / | tr "\\n" " ")"',
      // pg_dumpall --clean also drops and creates the roles: the one connected cannot be, and that is fine
      `gunzip -c '${file}' | docker exec -i ${c} sh -c '${LOAD[target.engine].replace(/'/g, "'\\''")}' 2> >(grep -vE 'current user cannot be dropped|role ".*" already exists' >&2)`,
      '[ -n "$PEERS" ] && docker start $PEERS >/dev/null || true',
      'echo "Restored"'
    ].join('\n')
  }
  const v = target.volume
  if (!isTarget(v)) throw new Error('Invalid volume')
  return [
    'set -e -o pipefail',
    `cd ${BACKUP_DIR} && mkdir -p pre-restore`,
    `S="pre-restore/${stamp}-vol-${safeName(v)}.tar.gz"`,
    `docker run --rm -v ${v}:/data:ro alpine:3 tar czf - -C /data . > "$S"`,
    'echo "Safety copy: $S"',
    `USERS="$(${usersOf(v)})"`,
    '[ -n "$USERS" ] && docker stop $USERS >/dev/null',
    `docker run --rm -i -v ${v}:/data alpine:3 sh -c 'find /data -mindepth 1 -delete && tar xzf - -C /data' < '${file}'`,
    '[ -n "$USERS" ] && docker start $USERS >/dev/null || true',
    'echo "Restored"'
  ].join('\n')
}
