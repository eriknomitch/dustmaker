# SPEC — DUSTMAKER

**A turn-based, AI-augmented strategy game. The design comes from Introversion's DEFCON.**

Version 0.3
Author: Erik / Claude
Status: Adopted

---

## 1. Overview

DUSTMAKER is a simple turn-based version of DEFCON (2006). DEFCON is a multiplayer
strategy game about global nuclear war. Each player commands one of six world
territories. Each player puts silos, fleets, and airbases on the map. Each player then
increases the DEFCON alert level. At DEFCON 1, the game permits nuclear launches. The
player with the highest score at the end of the game wins.

The original game is a real-time game. Players complete one game in one session.
DUSTMAKER is different in these ways:

1. **Single-player or multiplayer.** The game uses private rooms. Players join a room
   with a link. AI players fill the empty seats.
2. **Synchronous turns (WEGO).** Each player submits secret orders for the current round.
   When all orders are in, the server resolves all orders at the same time. The next
   round then starts.
3. **Browser-based.** The game runs in the browser as a full web application. It keeps
   the vector wireframe map of the original game.
4. **Asynchronous.** A player can submit orders and then stop play. The round resolves
   when the other players submit their orders.
5. **AI-native.** An LLM is part of play. Each player has an AI "Chief of Staff". The
   player can send messages to the Chief of Staff and can give it tasks. An AI
   Adjudicator checks the orders and describes each round. AI players with different
   characters can command a full territory.

### 1.1 Design principles

- **Asynchronous first.** One round must need 2 to 5 minutes of player attention. A full
  game must be completable in 15 to 25 rounds. Players can complete a game in one evening
  or in three weeks at one round each day.
- **Simultaneous orders are the primary tension.** No player has a turn-order advantage.
  All players commit their orders without knowledge of the other orders. All players then
  see the same resolution. Deception and timing stay important in a turn-based game.
- **Make the geometry more simple, but keep the decisions.** Movement uses zones and not
  continuous coordinates. Unit counts are small. The game keeps all of the important
  decisions of DEFCON: silo mode changes, submarine stealth, fighter scouting, alliance
  betrayal, and launch time.
- **The AI is a character and not a function.** Delegation, diplomacy, and adjudication
  must feel like command of a staff of officers.

### 1.2 Items that are not in v1

- Real-time play with synchronization in less than one second. Live mode also resolves
  one round at a time.
- Mobile applications. The web interface is responsive.
- Ranked matchmaking, ELO scores, or a public list of games. Players join a room with a
  link only.
- An accurate copy of the continuous-space combat calculations of DEFCON.
- Voice or video order submission.

---

## 2. Game rules

### 2.1 The map

The world map is a fixed **zone graph**. The system shows the graph on a vector world
outline in the style of DEFCON.

- There are **6 territories**, as in DEFCON: North America, South America, Europe,
  Russia, South Asia, and Africa.
- Each territory has **4 land zones**. There are 24 land zones in total.
- The oceans have **14 sea zones**. The sea zones connect the territories.
- Each zone is a node in an adjacency graph. The system measures all movement and all
  range in **zone hops** along this graph.
- Each territory contains **8 cities** in its land zones. Each city has a start
  population. The total population of each territory is 100 million. The system shows
  each city as a diamond. The diamond becomes smaller when the population decreases.

The map data contains the zones, the adjacency, the cities, and the spawn constraints.
The map data is a static JSON document with a version number. The client and the server
use the same document.

### 2.2 Units

Each player starts with a fixed set of units. The game does not produce or replace units.
There is one exception: airbases and carriers make new fighters.

| Unit | Count | Placement | Moves? | Notes |
|---|---|---|---|---|
| Missile Silo | 3 | Land zone | No | 10 LRBMs each. There are two modes. In **Defend** mode, the silo intercepts missiles and aircraft in its own zone and in the adjacent zones. In **Launch** mode, the silo can fire but cannot defend. The silo becomes visible when it fires. A mode change needs one full round. During the change, the silo cannot defend and cannot fire. 3 HP. |
| Radar | 2 | Land zone | No | Shows all surface units in a range of 3 zone hops. 1 HP. |
| Airbase | 2 | Land zone | No | Holds 4 fighters and 2 bombers. Holds 6 SRBMs. Rearms the bombers that land. 2 HP. |
| Carrier | 2 | Sea zone | 1 hop each round | Holds 3 fighters and 1 bomber. Holds 3 SRBMs. There are two modes: **Air Ops** and **ASW**. In ASW mode, the carrier finds and attacks submarines in its own zone. 2 HP. |
| Battleship | 3 | Sea zone | 1 hop each round | Has a strong conventional attack against naval and air units in its own zone and in the adjacent zones. Has no nuclear weapons. Cannot find submarines. 3 HP. |
| Submarine | 2 | Sea zone | 1 hop each round | 4 MRBMs each. In **Submerged** mode, only ASW carriers and submarines in the same zone can see the submarine. A submerged submarine cannot attack. In **Surfaced** mode, the submarine can launch, but all players can see it. A surfaced submarine is easy to destroy. 2 HP. |
| Fighter | (held) | From an airbase or a carrier | 3-hop combat radius | Scouts and shows the zones on its route. Intercepts bombers and fighters. Each host makes 1 new fighter each round, up to the capacity of the host. |
| Bomber | (held) | From an airbase or a carrier | 5-hop fuel range | Carries 1 SRBM. The range of the SRBM is 2 hops from the bomber. The bomber is effective against naval units. The bomber moves 1 zone each round. Fighters can destroy the bomber easily. |

**Missile ranges:** the LRBM of a silo has unlimited range. The MRBM of a submarine has a
range of 6 zone hops. The SRBM of a bomber has a range of 2 zone hops from the launch
zone. All warheads are the same. A warhead on a city zone kills population (refer to
§2.6). A warhead on a unit removes 1 HP.

**Air sorties:** fighters and bombers move in different ways. A fighter completes its
full sortie in one round: it flies out to a maximum of 3 hops, it scouts or intercepts,
and it returns to its host in the same round. A bomber is a persistent unit on the map.
It moves 1 zone each round. It has a fuel budget of 5 hops in total. A bomber must land
at an airbase or a carrier to refuel and rearm. A bomber with no fuel crashes in the
cleanup phase.

**Combat numbers:** these values are the v1 defaults. The playtests in M0 tune them.

| Roll | Chance |
|---|---|
| Fighter destroys a bomber | 2/3 |
| Fighter destroys a fighter | 1/2 |
| Fighter intercepts a missile | 1/6 |
| Silo in Defend mode intercepts one inbound missile (each silo in range rolls) | 1/4 |
| Battleship removes 1 HP from one naval or air unit in range | 1/2 |
| Carrier in ASW mode finds and hits a submarine in its zone | 1/3 |
| Bomber conventional attack removes 1 HP from a naval unit | 1/2 |

A fighter has 1 HP. A bomber has 1 HP.

**Fleets:** naval units in the same sea zone operate together. Each unit moves
independently. Version 1 has no fleet object. This is an intentional simplification.

### 2.3 Rounds and DEFCON levels

The game is a sequence of numbered **rounds**. The DEFCON level is a function of the
round number. The values that follow are the defaults. The host can change them in the
lobby.

| Rounds | DEFCON | Permitted actions |
|---|---|---|
| 1–2 | 5 | **Placement.** Put ground units in your territory. Put fleets in the adjacent seas. Naval movement is permitted. Combat is not permitted. |
| 3–4 | 4 | Placement is still permitted. Radar operates. Fog of war applies. Scouting flights are permitted. Combat is not permitted. |
| 5–7 | 3 | Placement is not permitted. Conventional naval and air combat is permitted. |
| 8–9 | 2 | All conventional combat is permitted. Silos can start a change to Launch mode. |
| 10+ | 1 | **Nuclear launches are permitted.** |

**End of the game:** the **Victory Countdown** starts when players launch or destroy 80%
or more of all nuclear warheads in the game. The Victory Countdown continues for 3 more
rounds. The game then ends and the scores become final. The maximum number of rounds is
25. The host can set this limit from 15 to 40 in the lobby. In most games, the round
limit is the real clock: the countdown is an early exit for games of mutual
annihilation. The M0 tournament confirms this (refer to
`docs/repos/m0-tournament-results.md`).

### 2.4 The WEGO turn cycle

Each round has these steps:

1. **Briefing.** Each player sees the resolved state of the last round. The system shows
   an animation of the resolution on the map. The system also shows a situation report
   (SITREP) that the AI writes (refer to §5.3).
2. **Orders.** Each player gives a maximum of **one order to each unit**. An order can be
   a move, a mode change, a scout, an attack, or a launch at a target. Each player can
   also do free actions. Free actions include diplomatic messages and alliance votes. The
   system checks each order immediately (refer to §5.2). The orders stay secret.
3. **Commit.** The player submits the order set. The player can recall and change the
   order set until the round resolves. AI players and the AI Chief of Staff submit orders
   in the same way.
4. **Resolution.** The server resolves all orders at the same time when all players
   commit their orders. The server also resolves the round when the round deadline passes
   (refer to §2.7). The server uses this phase sequence:

   1. Mode changes start or complete. This includes silo modes, submarine dive and
      surface, and carrier modes.
   2. Naval units and bombers move. All units move. Other units can detect a unit that
      passes through a zone.
   3. Air operations occur. This includes fighter scouting, interception, and carrier ASW
      detection.
   4. The system announces the missile launches. All players see the launch zones, as in
      DEFCON.
   5. Interception occurs. Silos in Defend mode and fighters make a roll against the
      missiles and bombers in range.
   6. Impacts occur. The warheads that remain do damage to cities and units.
   7. Conventional combat occurs. This includes battleship, carrier, bomber, and fighter
      attacks, and depth charges.
   8. Cleanup occurs. The hosts make new fighters. The system does fuel checks. Bombers
      that are beyond their range crash. The system updates the ghost markers, the
      scores, and the DEFCON level.

   All random values come from a **seeded RNG that the server holds**. There is one seed
   for each round. Thus each resolution is reproducible and the client can replay it.
5. The system makes the briefing for the next round. The system then sends the
   notifications (refer to §4).

### 2.5 Fog of war

- All players can always see the enemy **cities**. A player can see an enemy **unit** only
  in the detection area of the player. A radar detects units in a range of 3 hops. A ship,
  an airbase, and a carrier detect units in a range of 2 hops. A fighter shows the zones
  on its route. A submarine detects a submarine in its own zone.
- **Launch detection:** all players see the zone of a unit that launches a missile. For a
  building, the system keeps a permanent "ghost" marker. For a mobile unit, the ghost
  marker becomes invisible when the unit moves or submerges.
- Allies share their radar coverage by default. The host can change this option (refer to
  §2.8). An allied submarine that is submerged stays invisible to its allies.
- Spectators can see all information if the host permits spectators. Spectators cannot
  interact with the players. Spectators can use the spectator chat channel only.

### 2.6 Damage and scoring

- A warhead on a **city zone** hits the largest city in that zone that is not destroyed.
  The first hit kills 50% of the remaining population of that city. Each subsequent hit
  kills 50% of the population that remains. Overkill moves to other cities: more warheads
  in the same round hit the next largest city.
- A warhead on a **unit** removes 1 HP. A unit at 0 HP is destroyed. A silo needs 3 hits.
- The host selects one of these **score modes** in the lobby. All three modes come from
  DEFCON:
  - **Default:** +2 points for each enemy megadeath. −1 point for each megadeath in your
    own territory.
  - **Genocide:** +1 point for each enemy megadeath.
  - **Survivor:** each player starts with 100 points. The score is the population that
    survives. The score can only decrease.
- Within an alliance, points go to the player whose warhead caused the megadeaths.
  Competition for kills inside an alliance is intentional.
- The player with the highest score at the end of the game wins. If the scores are equal,
  the players share the victory. Alliances do not win together. There is only one winner
  or one group of tied winners.

### 2.7 Deadlines and inactive players

- The host sets a **round deadline** in the lobby. The deadline can be from 60 seconds to
  7 days. The default deadline is 24 hours.
- When the deadline passes, the server resolves the players that did not commit. Each
  player selects one of these policies for each game. The default policy is Delegate.
  - **Delegate:** the AI Chief of Staff of that player makes and submits a careful order
    set. The order set agrees with the guidance that the player gave to it (refer to
    §5.1).
  - **Hold:** all units keep their position and their mode. Silos stay in Defend mode.
- The system marks a player as absent after that player misses **3 deadlines in
  sequence**. The host can then change the seat to an AI player. The host can also keep
  the player on permanent delegation.
- **Delegation quality tier:** within one game, all delegated turns and all AI player
  turns use the same LLM model tier. The Chief of Staff chat can use a larger model for
  advice and drafts. When the Chief of Staff plays a turn (the Delegate policy or
  vacation mode), it uses the same model as the AI opponents. Skill in writing standing
  guidance for the Chief of Staff has no cap. That skill is part of the game.
- A player can select **"Vacation mode"** before a deadline. In this mode, the AI plays
  all of the turns of that player for a number of rounds.

### 2.8 Alliances and diplomacy

- An alliance can have a maximum of 5 players. To join an alliance, a player sends a
  request. A majority of the members must vote for the request. A player can leave an
  alliance at any time. A majority of the members can remove a player. All votes resolve
  at the next round resolution.
- An alliance gives these effects by default: a ceasefire, radar sharing, and free
  passage. Free passage means that units do not automatically attack over allied
  territory. The host can permit different options for each player.
- If you make an alliance with a player that you attack, the system cancels your targeting
  against that player at the next resolution. Missiles that are already in flight still
  hit their targets. Thus you must commit carefully.
- **Diplomatic messages:** a player can send free text to one player, to the alliance
  channel, or to the channel for all players. The system delivers the message with the
  next round briefing. In live mode, the system delivers the message immediately. The AI
  Chief of Staff can also write and send a message. For example: "Tell Russia that we will
  stop our attack if they leave the North Atlantic."

### 2.9 Resolution edge cases

These rulings are normative. Each row is also a golden test in the engine test suite.
The two artifacts must stay identical.

| Case | Ruling |
|---|---|
| Two silos launch at each other in the same round | Both missiles fly. Both silos can be hit. Launch (phase 4) occurs before impact (phase 6). |
| A silo is destroyed during a mode change | The mode change dies with the silo. There are no partial states. |
| A host carrier or airbase is destroyed while its aircraft are in the air | The fighters are lost at the end of the round, because they have no place to land. The bombers keep flying until their fuel ends. They then crash. |
| Two fleets exchange zones in the same round | They engage in the destination zone of the defender. This ruling is provisional until a playtest confirms it (refer to §10.2). |
| A player forms an alliance in the same round as an attack on the new ally | The system cancels the targeting at the resolution. Missiles that are already in flight still hit (refer to §2.8). |
| A radar or detector is destroyed in the same round that it would detect a unit | Detection resolves in phase 3. Destruction occurs in phases 6 and 7. Thus the unit detects first and then dies. |

---

## 3. Product surfaces and UX

### 3.1 Screens

1. **Home.** The player can make a room, join a room with a link, or continue a game. The
   list of games shows the status of each round: `WAITING ON YOU`, `WAITING ON OTHERS
   (2/4 in)`, or `RESOLVED — VIEW`.
2. **Lobby.** The lobby shows the room link and a QR code. The lobby also shows the seat
   list. Each seat is a human player, an AI character, or an open seat. Each player
   selects a territory on the world map. The host sets the game options: the mode, the
   score mode, the deadline, the spectator permission, and the AI settings. Each player
   then sets the ready flag. The host can start the game with any mix of human players and
   AI players.
3. **Game screen.** This is the primary screen. The layout is the same as the layout of
   DEFCON.
   - The vector world map fills the screen. The player can pan and zoom. Zone overlays
     appear when the pointer moves over a zone. The map shows unit icons and range rings.
     A red ring is the attack range. A blue ring is the fuel range. The map uses the neon
     colors of DEFCON on a black background.
   - The top bar shows the round number, the DEFCON level, the time to the deadline, and
     the scores.
   - The bottom left area shows **Comms**. It has tabs for All, Alliance, direct messages,
     and the **Chief of Staff (AI chat)**.
   - The bottom right area shows the toolbar. The toolbar has these buttons: Units, Orders
     (the list of orders for this round), Allies, Scores, Radar, Territory, Nukes
     Remaining, and Info.
   - The **Commit button** is large. It shows `COMMIT ORDERS (7 queued)`. After the
     commit, it shows the players that the room waits for.
4. **Replay and briefing view.** This screen shows an animation of the last resolution. The
   animation includes missile paths, interceptions, and detonations. The SITREP text is
   adjacent to the animation. Each round has a read-only link that the player can share
   with spectators.
5. **Round link landing page.** This page opens the briefing for the new round. It then
   opens the orders view.

### 3.2 Order UX

- Click a unit to see the applicable actions. For a move, the map shows the permitted
  zones. For a launch, the map shows the targets in range. A mode change is a toggle. Each
  order goes to the Orders panel. The player can cancel each order before the commit.
- The client prevents an invalid selection. For an unclear selection, the Adjudicator
  gives an explanation in the interface (refer to §5.2). For example: *"Silo B cannot
  launch this round. It is still in a change to Launch mode. It is ready in round 12."*
- The keyboard shortcuts agree with DEFCON when this is possible. Use WASD or the arrow
  keys to pan. Use Q and E to zoom. Use the space bar to deselect. Use the return key for
  the chat. Use the escape key for the menu.

### 3.3 Appearance

The appearance is a homage to DEFCON. It does not use the assets of DEFCON. The background
is black. The coastlines are thin vector lines that glow. Each territory has a color fill.
Cities are diamonds. Range circles are dotted. The interface uses a monospaced or stencil
typeface. The audio has quiet alarm and beep sounds. The player can mute the audio. All of
the art and all of the audio are new.

---

## 4. Multiplayer and rooms

- The host makes a **room**. Each room has an identifier that a person cannot guess. The
  room address has the form `https://game.example.com/r/{roomId}`. Any person with the
  link can take an open seat. If the host permits spectators, a person with the link can
  also watch the game. The host can also set a room passcode.
- **Capacity:** a game can have 2 to 6 players. The players can be human players and AI
  players in any mix. There must be a minimum of 1 human player. A single-player game has
  1 human player and 1 to 5 AI players.
- **Live synchronization:** the system pushes updates when more than one player is online
  at the same time. The updates include the lobby state, the commit status ("3/4 orders
  in"), the chat, and the resolution replays. The system uses WebSockets for this function. The game operates
  correctly without a live connection. WebSockets are an improvement and not a
  requirement.
- **Notifications:** the system shows notifications in the application. A notification
  tells the player that a round resolved, that the room waits for the player, or that a
  message arrived. The player can set the notification options for each game.
- **Reconnection:** the server holds all of the game state. A player can continue the game
  from any device in the middle of a round.

---

## 5. AI and LLM integration

There are three different AI roles. All three roles use the same LLM provider (refer to
§6.1). Each role has a different system prompt, different permissions, and a different
audit trail.

### 5.1 The Chief of Staff (assistant and delegate for one player)

The Chief of Staff is a chat agent in the Comms panel. Its tools operate only for its own
player. The Chief of Staff cannot see through the fog of war. It sees only the information
that its player sees.

The Chief of Staff has these tools:

- **Get situation.** Gives the visible state: the units of the player, the enemies that
  the player detected, the scores, the DEFCON level, and the condition of the cities. This
  tool answers the question "What is the status of my cities?"
- **Get rules.** Finds a rule. This tool answers the question "Can I do X?"
- **Propose orders.** Changes natural language into a draft order set. For example: "Scout
  the Russian coast with two fighters and move a submarine to the north." The system
  checks the draft order set. The player then examines the draft and accepts it or changes
  it. A draft never commits automatically. There is one exception, which is delegation.
- **Delegate.** Gives control to the Chief of Staff. For example: "Control my navy this
  round" or "Play my full turn. Protect the cities. Do not launch first." The player can
  also use permanent delegation for vacation mode (refer to §2.7). The interface and the
  audit log identify all delegated orders.
- **Send message.** Writes or sends a diplomatic message for the player. The player must
  confirm the message before the system sends it. If the message is in the scope of an
  active delegation, the system sends it without confirmation.
- **Commit orders.** Operates only in the scope of an active delegation.

Guardrails: the Chief of Staff refuses a request that is not in its scope. It refuses to
show hidden enemy information. It refuses to change the rules. The audit log identifies
each action of the Chief of Staff with the label `via AI`. Only its own player can see
this audit log.

### 5.2 The Adjudicator (rules mediator)

The Adjudicator is a neutral role for the full game.

- **Order validation.** The validator in the engine is deterministic code. The Adjudicator
  gives a plain-language explanation of each rejection from the engine. It also answers
  the question "What can I do now?" for any player. The Adjudicator cannot override the
  engine. The code makes the decision. The LLM only gives the explanation.
- **Explanation of disputes and unusual results.** After a resolution, a player can ask
  "Why did my bomber die?" The Adjudicator gives an explanation with references to the
  resolution log.
- **Abuse prevention.** The Adjudicator monitors the public chat and the alliance chat for
  harassment. It marks the messages. It does not remove deception about game intentions.
  Deception is part of the game.

### 5.3 The Narrator (SITREPs and flavor text)

- The Narrator makes the **round SITREP** for each player. It uses the resolution log and
  the fog of war of that player. The system removes all hidden information before it sends
  the log to the Narrator. Thus the Narrator cannot show hidden information. The tone is
  the dry military tone of the Cold War period.
- The Narrator also makes the text for the end of the game. This text includes the
  statistics of the destruction.

### 5.4 AI players

An AI player can command a full territory. AI players fill the seats in single-player
games and in multiplayer games.

- **Characters.** The host selects a character for each AI player in the lobby. Examples
  are *GENERAL WINTER* (defensive, uses a second-strike doctrine), *DR. FALLGOOD*
  (aggressive, uses a first-strike doctrine), *THE DIPLOMAT* (makes many alliances, then
  betrays them at a late stage), and *RANDOM*. Each character is a set of prompts and
  parameters for one agent.
- **Architecture.** At the start of each round, a queue job starts each AI player. The AI
  player receives its situation after the fog-of-war filter. It also receives its character
  and a record of its own earlier intentions. The system keeps this record for each game.
  The AI player then makes an order set. It uses the same propose, validate, and commit
  tools that human players use. The AI player has the same rules and the same information
  as a human player. **The AI player cannot cheat.** The AI player also participates in
  the diplomacy chat, but with a limit on its message frequency.
- **Fallback.** If the LLM call fails after the retries, the seat uses a deterministic
  policy. The policy is to hold position and to defend. Thus a game never stops.
- **Cost control.** AI turns use a small and inexpensive model by default. Each character
  has a token limit for each round. Each game has an LLM budget. When the game reaches the
  budget, the AI players change to the deterministic policy.

### 5.5 Fairness and audit

- The system records all LLM prompts and all LLM outputs for each game. The host can
  examine these records after the game if the host enables this option.
- Only the engine changes the game state. An LLM acts only through the same validated
  order interface that human players use.
- The server applies the fog-of-war filter before it makes the context for an LLM.

---

## 6. Technical architecture (Cloudflare-first)

### 6.1 Stack summary

| Layer | Choice | Reason |
|---|---|---|
| Frontend | **TypeScript, Vite, and Svelte** for the interface, and **PixiJS** for the map and replay layer | PixiJS gives good performance for the glowing vector appearance, the missile paths, and the replay animation. Svelte keeps the panels small. React is an acceptable alternative. |
| Hosting | **Cloudflare Workers and Static Assets** | One deployment gives the application and the API. |
| Game state | **Durable Objects**, with one Durable Object for each game room | Each game has one authority and one thread. Thus there are no race conditions when players commit at the same time. Durable Objects also support WebSockets and hibernation. Hibernation makes inactive games inexpensive. |
| Persistence | Durable Object storage for the active state, and **D1** for the accounts, the game index, the archive of completed games, and the audit logs | Durable Object storage holds the document for the active game. D1 holds the data that a query must read across more than one game. |
| Jobs | **Cloudflare Queues** and **Durable Object alarms** | Alarms control the round deadlines. Queues control the AI player turns and the notification jobs. |
| LLM | **Anthropic API through the Cloudflare AI Gateway** | Claude operates the Chief of Staff, the Narrator, and the AI players. The AI Gateway gives caching, rate limits, spend limits, and logging. A small model does the AI player turns and the SITREPs. A large model does the Chief of Staff chat. |
| Analytics | Workers Analytics Engine and structured logs | These record the resolution time of each round and the LLM cost of each game. |

The frontend row is a recommendation and not a constraint. The one platform requirement
is that DUSTMAKER is a web game that runs in the browser. Any framework or renderer is
acceptable. The deterministic engine principle (§6.2) and the server architecture (§6.3
to §6.5) are normative.

### 6.2 Core principle: a deterministic engine on the server

The game engine is a pure TypeScript module. The engine takes the current state, the
orders of each player, and a seed. It gives a new state and a resolution log. The engine
does no input or output. The engine uses no random values other than the seed.

- The Durable Object runs the engine to make the true state. The client runs the same
  module. The client uses the module to check orders before the commit and to show the
  replay. The resolution log is the script for the replay.
- The tests run the engine without an interface. The tests include property tests, golden
  tests, and fuzz tests with random order sets.

### 6.3 The GameRoom Durable Object

The GameRoom Durable Object has these functions:

- It holds the lobby state and the seat assignments.
- It receives the orders. It accepts a new order set until the resolution.
- It records which players committed.
- It sets the deadline alarm.
- It runs the resolution.
- It saves a snapshot of each round.
- It sends the notification jobs to the queue.
- It broadcasts the state to the connected clients through WebSockets.
- It makes the fog-of-war view for each player.
- It adds the AI player turn jobs to the queue.

The state document contains the game identifier, the map version, the round number, the
DEFCON level, and the phase. The phase is lobby, orders, resolving, or finished. The
document also contains the game configuration, the seats, the units, and the cities. In
addition, it contains the alliances, the orders that are not resolved, the RNG seed, and
the references to the history snapshots.

### 6.4 API surface

The Worker gives these operations:

- Make a room.
- Get the lobby view or the game view. The server applies the fog-of-war filter for the
  session.
- Take a seat or become a spectator.
- Change the game options. Only the host can do this.
- Start the game.
- Submit or replace the order set for this round.
- Recall the order set.
- Get the briefing for a round. The briefing has the snapshot, the resolution log, and the
  SITREP.
- Send a diplomatic message.
- Request an alliance, vote, leave an alliance, or remove a member.
- Send a message to the Chief of Staff. The server streams the answer.
- Open a WebSocket for live updates.

### 6.5 Round lifecycle

1. A player commits. The GameRoom Durable Object stores the orders. It sets the commit
   flag for that player.
2. If all players committed, the Durable Object runs the resolution. If not, it broadcasts
   the commit count.
3. If the deadline alarm occurs first, the Durable Object processes the players that did
   not commit. It uses the Delegate policy or the Hold policy for each of these players.
4. The engine resolves the round. It gives a new state and a resolution log.
5. The Durable Object saves the snapshot. If the game is complete, it moves the snapshot
   to D1.
6. The Durable Object adds a Narrator job to the queue. This job makes the SITREP for each
   player.
7. The Durable Object adds one AI turn job to the queue for each AI seat.
8. The Durable Object broadcasts the resolution. The clients then show the animation from
   the log.

### 6.6 Security and abuse prevention

- Each room identifier has a minimum of 96 bits of entropy. The host can add a passcode.
- The engine on the server checks every order submission. The engine does this check even
  if the client checked the order.
- The server applies the fog-of-war filter. The client never receives hidden state. Thus a
  player cannot see hidden information in the client data.
- The system applies rate limits to the chat operations and the LLM operations for each
  session. It uses the Workers rate limiter and the AI Gateway.
- The system treats all diplomatic messages and all player chat as untrusted data before
  it sends them to an AI role. Each AI role has a list of permitted tools (refer to §5).
  The engine ignores all data that does not come through the typed order interface. This
  prevents prompt injection.

---

## 7. Data model

D1 holds these records:

| Record | Contents |
|---|---|
| Games | The game identifier, the room identifier, the status, the configuration, the map version, and the creation and completion times. |
| Seats | The game, the player identifier, the seat type, the AI character, the territory, and the deadline policy. |
| Rounds | The game, the round number, references to the snapshot and the resolution log, the seed, and the resolution time. |
| Messages | The game, the round, the sender, the channel, the message text, and the time. |
| LLM audit | The game, the AI role, the player, the model, references to the prompt and the output, the token count, the cost, and the time. |

The Durable Object holds the state of the active round. The D1 records refer to large
objects in R2 storage. R2 holds the snapshots, the logs, and the replay assets.

---

## 8. Requirement traceability

| Requirement | Location |
|---|---|
| Single-player or multiplayer with lobbies and room links | §3.1, §4, §5.4 |
| Synchronous turns: all players submit, then the server resolves | §2.4, §6.5 |
| HTML game with an interface in the style of DEFCON | §3, §6.1 |
| AI in the game: delegation, messages, status checks, and mediation | §5.1 to §5.3 |
| Full AI opponents | §5.4 |

---

## 9. Milestones

**M0 — Engine (1 to 2 weeks).**
Make the map data, the engine module, the full rules with tests but no interface, and
deterministic replays. *Exit condition: two scripted bots complete a 25-round game with no
interface.*

**M1 — Local web game.**
Make the PixiJS map and the order interface. Two players use the same browser in sequence.
The game uses the real engine. There are no accounts. *Exit condition: two players complete
a full game in one browser.*

**M2 — Rooms and live multiplayer.**
Make the Workers application, the GameRoom Durable Object, the lobby, the WebSocket
synchronization, the commit and resolution loop, and the replay animation. *Exit condition:
three human players complete a live game from three devices.*

**M3 — Asynchronous play.**
Make the deadlines and alarms, the deadline policies, the notification options, and the
round links. *Exit condition: two human players complete a game across several days.*

**M4 — AI layer.**
Make the Chief of Staff chat and its tools, the Adjudicator explanations, the Narrator
SITREPs, and the delegation. *Exit condition: a player completes a full turn with the Chief
of Staff chat only.*

**M5 — AI opponents and polish.**
Make the AI characters, the AI turn queue jobs, the cost limits, the single-player flow,
the spectator function, the audio, and a tutorial against an AI player. *Exit condition: a
game with 1 human player and 3 AI players is enjoyable.*

**Candidates for v2:** game mode presets in the style of Bigworld, Speed, and Diplomacy;
tournaments; a public list of games; and mobile web notifications.

---

## 10. Open questions

1. Must conventional combat be fully deterministic? A deterministic result makes
   asynchronous planning more accurate. Random values would then apply to missile
   interception only. The current opinion is yes. A playtest must confirm this.
2. What occurs when two fleets exchange zones in the same round? Do they pass each other
   or do they engage? The proposal is that they engage in the destination zone of the
   defender. A playtest must confirm this.
3. How frequently must an AI character send diplomacy messages? Too many messages become
   noise.
4. Are 8 cities for each territory correct for a game of 15 to 25 rounds? An alternative
   is to change the city count with the player count.
5. What is the position on monetization and hosting cost if the game becomes public? The
   LLM cost of each game is the primary variable. §5.4 gives the controls for this cost.
