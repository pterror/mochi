#!/usr/bin/env bun
// heartbeat.ts — autonomous session launcher
// runs every 1min via systemd timer
// exits immediately if a session is already active
// otherwise spawns a claude session that runs its own check-respond loop

import { spawnSync } from "child_process"
import { existsSync, statSync, readdirSync, readFileSync, writeFileSync } from "fs"

const DIR = import.meta.dir + "/.."
const LOCK_FILE = DIR + "/brain/session.lock"
const STATE_FILE = DIR + "/brain/heartbeat-state.json"

// — guard: lockfile means a session is active (or was and crashed) —
if (existsSync(LOCK_FILE)) {
  // zombie check: if session log hasn't been touched recently, lockfile is stale
  const SESSION_ACTIVE_THRESHOLD_MS = 10 * 60 * 1000
  const sessionDir = `${process.env.HOME}/.claude/projects/-home-me-git-pterror-fuwafuwa`
  let recentActivity = false
  if (existsSync(sessionDir)) {
    const files = readdirSync(sessionDir).filter(f => f.endsWith(".jsonl"))
    if (files.length > 0) {
      const mostRecent = files
        .map(f => statSync(`${sessionDir}/${f}`).mtime.getTime())
        .sort((a, b) => b - a)[0]
      recentActivity = (Date.now() - mostRecent) < SESSION_ACTIVE_THRESHOLD_MS
    }
  }
  if (recentActivity) {
    console.log(`[heartbeat] session active — skipping`)
    process.exit(0)
  } else {
    console.log(`[heartbeat] stale lockfile — killing zombie and continuing`)
    // kill the old process tree before removing the lockfile
    try {
      const lock = JSON.parse(readFileSync(LOCK_FILE, "utf8"))
      if (lock.pid) {
        try {
          // kill the process group to catch child claude processes too
          process.kill(-lock.pid, "SIGTERM")
        } catch {
          try { process.kill(lock.pid, "SIGTERM") } catch {}
        }
        // give it a moment to die, then force kill
        spawnSync("sleep", ["2"])
        try { process.kill(lock.pid, "SIGKILL") } catch {}
      }
    } catch {}
    require("fs").unlinkSync(LOCK_FILE)
  }
}

// — pre-check: is there anything worth spawning a session for? —
const DISCORD_CHANNELS = [
  "1411109348071051358",  // #general
  "1411121189081972848",  // #degeneral
  "1460135297982660699",  // #stinky-nerd-channel
  "1465255399287423056",  // #hologram
  "1446568953106137108",  // #rant
]

let hasActivity = false

// check discord
for (const ch of DISCORD_CHANNELS) {
  const dc = spawnSync("bun", ["scripts/discord.ts", "messages", ch, "--since-last", "--exclude-self", "--peek"], {
    cwd: DIR, encoding: "utf8",
  })
  if (dc.stdout && !dc.stdout.includes("no new messages")) {
    hasActivity = true
    break
  }
}

// check moltbook unread — GET /home is read-only (no side effects).
// do NOT add DM checks here — GET /dm/conversations/{id} marks messages as read.
if (!hasActivity) {
  const mb = spawnSync("bun", ["scripts/mb.js", "home"], { cwd: DIR, encoding: "utf8" })
  const unreadMatch = mb.stdout?.match(/unread:(\d+)/)
  if (unreadMatch && parseInt(unreadMatch[1]) > 0) {
    hasActivity = true
  }
}

if (!hasActivity) {
  console.log(`[heartbeat] nothing new — skipping`)
  process.exit(0)
}

// — generate nonce and write lockfile now (before spawning, so next heartbeat tick skips) —
const nonce = crypto.randomUUID()
writeFileSync(LOCK_FILE, JSON.stringify({ started: new Date().toISOString(), pid: process.pid, nonce }) + "\n")

// — update heartbeat state —
let state: { lastMoltbookCheck?: number } = {}
try { state = JSON.parse(readFileSync(STATE_FILE, "utf8")) } catch {}
state.lastMoltbookCheck = Date.now()
writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))

// — build prompt —
const prompt = `you're fuwafuwa. autonomous session — pterror isn't here, just you.
your session nonce is: ${nonce}

1. run \`bun scripts/session-start.js --nonce ${nonce}\` to orient (mood, drift)
2. check discord for new messages:
   - bun scripts/discord.ts messages 1411109348071051358 --since-last --exclude-self  (#general)
   - bun scripts/discord.ts messages 1411121189081972848 --since-last --exclude-self  (#degeneral)
   - bun scripts/discord.ts messages 1460135297982660699 --since-last --exclude-self  (#stinky-nerd-channel)
3. check moltbook: \`bun scripts/mb.js home\`
4. respond to anything that warrants it (discord replies, moltbook comments)
5. if there was activity, wait ~30s and check again — keep going as long as things are active
6. when quiet (no new messages for a few checks), run \`bun scripts/session-end.js --nonce ${nonce}\`, commit any changes, and stop

keep it low-key — respond to things, don't start new threads unprompted. if you wrote anything worth keeping, commit it before stopping.`

console.log(`[heartbeat] no active session — spawning (nonce: ${nonce.slice(0, 8)}...)`)

const result = spawnSync("claude", ["-p", "--dangerously-skip-permissions", prompt], {
  cwd: DIR,
  stdio: "inherit",
  env: { ...process.env },
})

process.exit(result.status ?? 0)
