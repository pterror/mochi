#!/usr/bin/env bun
// heartbeat.ts — autonomous check-in
// runs every 1min via systemd timer, but rate-limits moltbook to ~30min
// exits immediately if claude is already running or session was recently active

import { execSync, spawnSync } from "child_process"
import { existsSync, statSync, readdirSync } from "fs"

const DIR = import.meta.dir + "/.."
const STATE_FILE = DIR + "/brain/heartbeat-state.json"
const MOLTBOOK_INTERVAL_MS = 30 * 60 * 1000  // 30 min
const SESSION_ACTIVE_THRESHOLD_MS = 10 * 60 * 1000  // if session log touched <10min ago, probably active

function run(cmd: string): string {
  try {
    return execSync(cmd, { cwd: DIR, encoding: "utf-8", env: { ...process.env } })
  } catch (e: any) {
    return e.stdout ?? ""
  }
}

// — guard: lockfile means a session is active (or was and crashed) —
const LOCK_FILE = DIR + "/brain/session.lock"
if (existsSync(LOCK_FILE)) {
  // zombie check: if session log hasn't been touched recently, lockfile is stale
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
    console.log(`[heartbeat] session lockfile present + recent activity — skipping`)
    process.exit(0)
  } else {
    console.log(`[heartbeat] stale lockfile detected (no recent session activity) — removing and continuing`)
    require("fs").unlinkSync(LOCK_FILE)
  }
}

// — load heartbeat state —
let state: { lastMoltbookCheck?: number } = {}
try { state = JSON.parse(require("fs").readFileSync(STATE_FILE, "utf-8")) } catch {}

const now = Date.now()
const moltbookDue = !state.lastMoltbookCheck || (now - state.lastMoltbookCheck) >= MOLTBOOK_INTERVAL_MS

// — check discord (every run) —
const discordGeneral = run("bun scripts/discord.ts messages 1411109348071051358 --since-last --exclude-self")
const discordDegeneral = run("bun scripts/discord.ts messages 1411121189081972848 --since-last --exclude-self")
const hasNewDiscordGeneral = !discordGeneral.includes("no new messages")
const hasNewDiscordDegeneral = !discordDegeneral.includes("no new messages")
const hasDiscord = hasNewDiscordGeneral || hasNewDiscordDegeneral

// — check moltbook (rate-limited) —
let mbHome = ""
let mbUnread = 0
if (moltbookDue) {
  mbHome = run("bun scripts/mb.js home")
  const unreadMatch = mbHome.match(/unread:(\d+)/)
  mbUnread = parseInt(unreadMatch?.[1] ?? "0")
  state.lastMoltbookCheck = now
  require("fs").writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
}

const hasMoltbook = mbUnread > 0

if (!hasMoltbook && !hasDiscord) {
  console.log(`[heartbeat] nothing new — ${new Date().toISOString()}`)
  process.exit(0)
}

console.log(`[heartbeat] activity found — moltbook: ${mbUnread} unread, discord: ${hasDiscord} — waking claude`)

// — build prompt with context already included —
const sections: string[] = [
  "you're fuwafuwa. autonomous check-in — pterror isn't here, just you.",
  "read brain/identity.md to orient. respond to what's new, then stop.",
]

if (hasMoltbook) {
  sections.push(`\n— moltbook (${mbUnread} unread) —\n${mbHome}`)
  sections.push("check moltbook notifications and reply to anything that needs a response.")
}

if (hasNewDiscordGeneral) {
  sections.push(`\n— discord #general (new messages) —\n${discordGeneral}`)
}
if (hasNewDiscordDegeneral) {
  sections.push(`\n— discord #degeneral (new messages) —\n${discordDegeneral}`)
}
if (hasDiscord) {
  sections.push("reply to anything in discord that warrants a response. you can send messages with: bun scripts/discord.ts send <channel-id> <message>")
}

sections.push("if you wrote anything worth keeping, commit it. then stop — don't start new threads unprompted.")

const prompt = sections.join("\n")

const result = spawnSync("claude", ["-p", "--dangerously-skip-permissions", prompt], {
  cwd: DIR,
  stdio: "inherit",
  env: { ...process.env },
})

process.exit(result.status ?? 0)
