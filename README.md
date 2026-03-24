# The Contradiction Protocol

A text adventure written in Prolog, inspired by *Free Guy* (2021). You play as Guy, NPC_0042, a bank teller in Free City whose memory is leaking. You remember things you are not supposed to remember. The game tracks what you believe, what you observe, and what you can no longer deny.

A browser-based HTML/CSS/JS interface is included alongside the Prolog source.

---

## Project Structure

```
contradiction-protocol/
├── a3.pl              # Prolog source - the canonical game
├── index.html         # Browser UI entry point
├── style.css          # UI styles
├── game.js            # UI game logic (mirrors the Prolog state machine)
└── images/            # Optional room images (see UI section)
```

---

## Running the Prolog Game

### Requirements

Any standard Prolog interpreter. Tested with [SWI-Prolog](https://www.swi-prolog.org/).

### Installation

Install SWI-Prolog from [swi-prolog.org](https://www.swi-prolog.org/Download.html), or via a package manager:

```bash
# macOS
brew install swi-prolog

# Ubuntu / Debian
sudo apt install swi-prolog
```

### Starting the Game

```bash
swipl a3.pl
```

Then at the Prolog prompt:

```prolog
?- start.
```

### Commands

| Command | Description |
|---|---|
| `n.` `s.` `e.` `w.` | Move in a direction |
| `look.` | Describe the current room |
| `examine(thing).` | Examine something in the room |
| `take(item).` | Pick up an item |
| `drop(item).` | Put down an item |
| `read_item(item).` | Read a held item |
| `talk(person).` | Talk to someone |
| `ask(buddy, keycard).` | Ask Buddy about the keycard |
| `use(terminal).` | Use the admin terminal |
| `use(code_fragment).` | Use the device |
| `type_command(cmd).` | Issue a terminal command |
| `use_together.` | Confront Dude with Millie |
| `sacrifice.` | Draw Dude's attention so Millie can pass |
| `deny.` | Push a thought away |
| `inventory.` | List held items |
| `status.` | Full system status |
| `observe.` | View observations and contradictions logged |
| `help.` | Show all commands |
| `halt.` | Quit |

---

## Running the Browser UI

No server or build step required. Open `index.html` directly in any modern browser.

The UI is a faithful JavaScript reimplementation of the Prolog game engine - same state machine, same dialogues, same belief erosion values, same endings.

### Adding Room Images

The UI displays a room image panel on the left side. To add images, edit the `ROOM_IMAGES` object near the top of `game.js`:

```javascript
const ROOM_IMAGES = {
  apartment:   'images/apartment.png',
  coffee_shop: 'images/coffee_shop.png',
  street:      'images/street.png',
  // ...
};
```

Place image files in an `images/` folder next to `index.html`. Any room without an entry falls back to an emoji placeholder. Recommended image size: **480×270px** (16:9).

---

## How the Belief & Awareness System Works

Guy starts with six beliefs, each at full integrity (100):

| Belief | Description |
|---|---|
| `death_is_final` | Death is permanent |
| `loops_dont_exist` | Each day is new |
| `world_is_real` | The world is genuine |
| `no_admin_exists` | Nobody controls this place |
| `free_will_exists` | Guy acts of his own accord |
| `players_are_npcs` | Everyone around him is like him |

Every significant observation — the pedestrian dying, the identical receipt timestamps, the code fragment in the vault, conversations with Millie - erodes one or more beliefs by a fixed amount. When a belief drops below 50 it is **cracked**. At 0 it is **shattered**.

**Awareness** is computed from the current belief state:

```
awareness = (number of cracked beliefs) + (number of shattered beliefs × 2)
```

| Awareness | Label |
|---|---|
| 0–2 | oblivious |
| 3–5 | questioning |
| 6–8 | cracking |
| 9–11 | aware |
| 12+ | fully awake |

Awareness reaching 2 unlocks the alley — the only way south from the street. The system also tracks a **system alert** level (0–7). Anomalous behaviour raises it; hitting 7 triggers an immediate ending.

**Contradictions** are logged separately whenever an event directly contradicts a held belief. These are visible via `observe.` and are tracked independently from the numeric erosion.

---

## Endings

The game has seven endings. Which one you reach depends on your choices in the final act, your trust level with Millie, and how many times you have died.

<details>
<summary>Show all endings (spoilers)</summary>

### Ending 1 - The Sanctuary
Reach the admin zone with Millie and issue `type_command(grant_access_both).` or `type_command(locate_sanctuary).` - granting both of you access to the hidden sector built by developer `dev_mira_k`. The most complete resolution.

### Ending 2 - The Sacrifice
At the Dude confrontation, choose `sacrifice.` Guy flags himself as a critical anomaly to draw Dude's attention, allowing Millie to reach the admin zone alone. Guy is permanently deleted. Millie completes the mission.

### Ending 3 - The Message
Reach the admin zone alone (without Millie's trust reaching 6) and issue `type_command(broadcast_message).` Guy broadcasts a message to every player and developer who has ever loaded the world.

### Ending 4 - The Broadcast
Reach the admin zone with Millie and issue `type_command(broadcast_anomaly).` A signal is sent to all NPCs. Whether it takes root is unknown. A quieter, more ambiguous resolution than Ending 1.

### Ending 5 - The Loop
Triggered in two ways: deny enough thoughts (`deny.` five or more times before awareness unlocks the alley), or exhaust 80 moves without the alley becoming accessible. Guy chooses the routine — not because he has to, but because he decides it is enough.

### Ending 6 - System Reset
The system alert reaches 7. The anomaly threshold is exceeded and the deletion protocol fires automatically. Free City reloads. Nobody notices.

### Ending 7 - Dissolution
Reach the admin zone alone and issue `type_command(flag_self).` Guy flags himself as a critical anomaly. Immediate, irreversible deletion. Brief, and the only ending Guy initiates entirely on his own terms.

</details>

---

## Technical Notes

- The Prolog engine uses dynamic predicates throughout. All game state — location, beliefs, flags, item positions, counters — lives in the database and is modified via `retract`/`assert` pairs.
- The awareness system is computed on demand via `awareness_level/1` rather than stored, ensuring it always reflects the current belief state.
- The HTML UI mirrors the Prolog state machine in JavaScript with a flat `G` object replacing the dynamic database. Belief erosion values and dialogue text are kept exactly consistent with the Prolog source.
- The `deny.` command accumulates independently of belief erosion and can trigger Ending 5 before awareness is ever reached, representing Guy actively choosing not to question his world.
