# my-mods

Seni's Claude Code mods: changes to Claude's own interface, written as function-hooks plugins.

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

## License

MIT
