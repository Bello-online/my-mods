# my-mods

Olaseni Bello's Claude Code mods: changes to Claude's own interface, written as function-hooks plugins.

## brain-hud

A Jarvis-style **Claude Brain** pane that animates while Claude works and changes colour, motion and overlay with the task: thinking, responding, reading, editing, running a command, searching, fetching the web, delegating to subagents, done, error.

- **3D view**: a sphere of points turning in depth, with gyroscope rings, a pulsing core and sparks. Each recent tool call rides the sphere as a node; hover one for the tool, file and duration. On a terminal the sphere is a live text render you can drag to spin, with arrow keys, `+`/`-` zoom, space to pause and `r` to reset.
- **HUD view**: vector rings with a radar sweep, scan lines, ripples and a waveform per phase.
- Buttons for 3D/HUD, pause, speed and clear; hotkeys `3`, `h`, `p`, `s`, `c` while the pane has focus.
- The status line shows the phase and what Claude is touching.

The pane docks beside the transcript on the desktop app; on a terminal, `/brain` opens it.

### Install

In Claude Code:

```
/plugin marketplace add Bello-online/my-mods
/plugin install brain-hud@my-mods
```

Or from a shell:

```bash
claude plugin install brain-hud --marketplace Bello-online/my-mods
```

It loads in every session from the next start.

### Develop

```bash
claude plugin validate plugins/brain-hud
claude plugin test plugins/brain-hud
```

Source: `plugins/brain-hud/hooks` (the hooks module `register.tsx`, the vector views in `brain-svg.ts`, the terminal 3D client `brain3d.tsx`, the tool-to-phase map `phases.ts`). After a change, bump the version in `plugins/brain-hud/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`, then update the marketplace and reinstall.

## focus-band

A focus band above the prompt: a pomodoro timer in a bordered card with a progress bar and this session's time, turns and tool calls. Clawd, the Claude Code mascot, hops along it now and then during a focus block and naps through breaks.

- Buttons to start or pause, reset and skip; hotkeys `s`, `r`, `n` while the band has focus.
- A focus block rolls into a break with a toast; after the break the timer waits for you.
- `/pomo` starts or pauses. `/pomo reset`, `/pomo skip` and `/pomo status` do what they say. `/pomo 50 10` sets the lengths and saves them for later sessions.

```
/plugin install focus-band@my-mods
```

## clawd-buddy

Clawd, the Claude Code mascot, in a pane beside the chat. He acts out what Claude is doing, with the turn's actions listed underneath him.

- Thirteen animated scenes: a thought bubble while thinking, a keyboard while writing the answer, a book while reading, a pencil while editing, a terminal while a command runs, a magnifying glass while searching, and more.
- Under Clawd: a headline of what is happening, then each tool call of the turn with a mark for running, done or failed and how long it took.
- Opens by itself on the desktop app and in the editor. On a terminal, `/clawd` opens it.

```
/plugin install clawd-buddy@my-mods
```

## License

MIT
