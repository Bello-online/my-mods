# clawd-buddy

Clawd, the Claude Code mascot, in a pane beside the chat. He acts out what Claude is doing, and the turn's actions are listed underneath him.

## What Clawd does

| Claude is | Clawd |
| --- | --- |
| thinking | looks up at a thought bubble |
| writing the answer | types on a keyboard under a speech bubble |
| reading a file | reads an open book, turning the page |
| editing or writing a file | watches a pencil write a line of code |
| running a command | hops beside a terminal as the output arrives |
| searching | sweeps a magnifying glass over a set of files |
| on the web or in a browser | watches a spinning globe |
| using a subagent | hands tasks to two small helpers |
| calling a connector | is plugged into a server by a live cable |
| using another tool | works beside turning gears |
| done | jumps under falling confetti |
| stopped by an error | shakes under a warning sign |
| waiting | stands by with a steaming mug |

## The action list

Under Clawd is a headline (for example "Reading…") and what it is about, then every tool call of the turn, newest first: a mark (◌ running, ✓ done, ✗ failed), what was done, and how long it took. Calls a subagent made are marked ↳. The list stays after the turn ends and starts over with the next one. `clear` (or `c` with the pane focused) empties it.

## Using it

- **On the desktop app and in the editor** the pane opens by itself, docked beside the chat.
- **On a terminal** run `/clawd` to open it. There Clawd is the block-glyph logo with a small prop beside him.

## Install

```
claude plugin marketplace add Bello-online/my-mods
claude plugin install clawd-buddy@my-mods
```
