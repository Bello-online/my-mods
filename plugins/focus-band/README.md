# focus-band

A focus band above the Claude Code prompt: a pomodoro timer in a bordered card, a progress bar, this session's time, turns and tool calls, and Clawd, the Claude Code mascot, hopping along now and then.

On a terminal it looks like this, inside a rounded border in the mode's colour:

```
        ▐▛███▜▌
       ▝▜█████▛▘
         ▘▘ ▝▝
 ● FOCUS   18:42   [pause] [reset] [skip]
━━━━━━━━━━━━━━──────────  🍅🍅  ·  ⏱ 1h 04m  ·  ↻ 12 turns  ·  ⚒ 87 tool calls
```

## Clawd

- **On the desktop app** Clawd stands on a small stage beside the timer. During a focus block it hops to a new spot every few seconds and blinks. While the timer waits it gives a small hop now and then. During a break it naps with floating z's. Each finished round leaves a tomato on the stage.
- **On a terminal** Clawd is the block-glyph logo, hopping to a new column every 7 to 16 seconds of a focus block. The lane shows when the band has at least seven rows.

## Using it

- **Buttons:** a primary start or pause button (▶ start, ❚❚ pause, ▶ resume), with quieter reset (↺) and skip buttons that light up in the mode colour on hover. With the band focused (click it, or ctrl+x tab), the hotkeys are `s`, `r` and `n`.
- **When a focus block ends** the band rolls into a break and shows a toast. When the break ends, the timer waits for you to start the next focus round.
- **`/pomo`** starts or pauses. `/pomo start`, `/pomo pause`, `/pomo reset`, `/pomo skip` and `/pomo status` do what they say.
- **`/pomo 50 10`** sets a 50-minute focus block and a 10-minute break. The lengths are saved for later sessions. The default is 25 and 5.
- **Collapse the band** with its `[-]` or ctrl+x ctrl+a.

The band draws on the terminal and the desktop app. Counts are per session and start over in a new one.

## Install

```
claude plugin marketplace add Bello-online/my-mods
claude plugin install focus-band@my-mods
```
