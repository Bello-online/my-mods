# focus-band

A slim focus band above the Claude Code prompt. It runs a pomodoro timer and keeps a running count of this session's time, turns and tool calls.

```
● focus 18:42  [pause] [reset] [skip]   🍅🍅 · session 1h 04m · 12 turns · 87 tool calls
```

## Using it

- **Buttons:** start or pause, reset, and skip to the next block. With the band focused (click it, or ctrl+x tab), the hotkeys are `s`, `r` and `n`.
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
