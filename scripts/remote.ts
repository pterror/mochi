#!/usr/bin/env bun
// remote.ts — spawn claude -p sessions in other repos with activity guard
//
// usage:
//   remote run <repo-path> <prompt>    — run a prompt in a repo (if no active session)
//   remote check <repo-path>           — check if a session is active
//   remote list                        — list known repos and their session status

import { spawnSync } from "child_process"
import { existsSync, statSync, readdirSync } from "fs"

const SESSION_ACTIVE_THRESHOLD_MS = 10 * 60 * 1000
const HOME = process.env.HOME!

const [cmd, ...rest] = process.argv.slice(2)

function repoToSessionDir(repoPath: string): string {
  // /home/me/git/rhizone/normalize → -home-me-git-rhizone-normalize
  const encoded = repoPath.replace(/^\//, "").replace(/\//g, "-")
  return `${HOME}/.claude/projects/-${encoded}`
}

function lastJsonlActivity(sessionDir: string): number | null {
  if (!existsSync(sessionDir)) return null
  const files = readdirSync(sessionDir).filter(f => f.endsWith(".jsonl"))
  if (files.length === 0) return null
  return files
    .map(f => statSync(`${sessionDir}/${f}`).mtime.getTime())
    .sort((a, b) => b - a)[0]
}

function isSessionActive(repoPath: string): { active: boolean; lastActivity: number | null; agoMs: number | null } {
  const sessionDir = repoToSessionDir(repoPath)
  const last = lastJsonlActivity(sessionDir)
  if (last === null) return { active: false, lastActivity: null, agoMs: null }
  const agoMs = Date.now() - last
  return { active: agoMs < SESSION_ACTIVE_THRESHOLD_MS, lastActivity: last, agoMs }
}

function fmtAgo(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m ago`
}

function resolveRepoPath(input: string): string {
  if (input.startsWith("/")) return input
  if (input.startsWith("~/")) return input.replace("~", HOME)
  // treat as relative to ~/git/rhizone/ as a convenience
  return `${HOME}/git/rhizone/${input}`
}

if (cmd === "check") {
  const repoPath = resolveRepoPath(rest[0])
  if (!repoPath) { console.error("usage: remote check <repo-path>"); process.exit(1) }
  const status = isSessionActive(repoPath)
  if (status.lastActivity === null) {
    console.log(`${repoPath}: no sessions found`)
  } else if (status.active) {
    console.log(`${repoPath}: ACTIVE (last activity ${fmtAgo(status.agoMs!)})`)
  } else {
    console.log(`${repoPath}: idle (last activity ${fmtAgo(status.agoMs!)})`)
  }
} else if (cmd === "run") {
  const repoInput = rest[0]
  const prompt = rest.slice(1).join(" ")
  if (!repoInput || !prompt) { console.error("usage: remote run <repo-path> <prompt>"); process.exit(1) }
  const repoPath = resolveRepoPath(repoInput)

  if (!existsSync(repoPath)) {
    console.error(`repo not found: ${repoPath}`)
    process.exit(1)
  }

  const status = isSessionActive(repoPath)
  if (status.active) {
    console.error(`session active in ${repoPath} (last activity ${fmtAgo(status.agoMs!)}) — aborting`)
    process.exit(1)
  }

  console.log(`[remote] spawning claude -p in ${repoPath}`)
  const result = spawnSync("claude", ["-p", "--dangerously-skip-permissions", prompt], {
    cwd: repoPath,
    stdio: "inherit",
    env: { ...process.env },
  })
  console.log(`[remote] exited with code ${result.status}`)
  process.exit(result.status ?? 0)
} else if (cmd === "list") {
  const projectsDir = `${HOME}/.claude/projects`
  if (!existsSync(projectsDir)) { console.log("no projects found"); process.exit(0) }
  const dirs = readdirSync(projectsDir).filter(d => {
    try { return statSync(`${projectsDir}/${d}`).isDirectory() } catch { return false }
  })
  for (const d of dirs) {
    const repoPath = "/" + d.replace(/^-/, "").replace(/-/g, "/")
    const last = lastJsonlActivity(`${projectsDir}/${d}`)
    if (last === null) {
      console.log(`  ${repoPath}: no sessions`)
    } else {
      const agoMs = Date.now() - last
      const tag = agoMs < SESSION_ACTIVE_THRESHOLD_MS ? "ACTIVE" : "idle"
      console.log(`  ${repoPath}: ${tag} (${fmtAgo(agoMs)})`)
    }
  }
} else {
  console.error("usage: remote <check|run|list> [args]")
  process.exit(1)
}
