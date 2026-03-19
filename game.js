'use strict';

const BOOT_LINES = [
  { text:'> Initialising FREE CITY OS v1.743...',              delay:300,  cls:'' },
  { text:'> Loading NPC memory subsystem... [OK]',             delay:900,  cls:'ok' },
  { text:'> Mounting belief matrix (6 axes)... [OK]',          delay:1500, cls:'ok' },
  { text:'> Scanning NPC roster...',                           delay:2100, cls:'dim' },
  { text:'> Anomaly flag detected: NPC_0042',                  delay:2700, cls:'warn' },
  { text:'> memory_persistence: FALSE [corrupted]',            delay:3100, cls:'warn' },
  { text:'> WARNING: ANOMALY_FLAG ACTIVE — memory leak',       delay:3600, cls:'red' },
  { text:'> Loading contradiction detection engine...',        delay:4300, cls:'' },
  { text:'> Constructing world map (13 sectors)...',           delay:4900, cls:'' },
  { text:'> STANDALONE MODE — no external server required.',   delay:5400, cls:'dim' },
  { text:'> Session monitor started.',                         delay:5800, cls:'' },
  { text:'> Ready. Awaiting authorisation.',                   delay:6300, cls:'ok' },
];
const BOOT_TOTAL = 6800;

(function bootInit() {
  const bootLog = document.getElementById('boot-log');
  const bootBtn = document.getElementById('boot-btn');
  BOOT_LINES.forEach(line => {
    setTimeout(() => {
      const el = document.createElement('div');
      el.className = 'boot-line ' + (line.cls||'');
      el.textContent = line.text;
      bootLog.appendChild(el);
      bootLog.scrollTop = bootLog.scrollHeight;
    }, line.delay);
  });
  document.getElementById('boot-bar-wrap').style.display = 'block';
  const barFill = document.getElementById('boot-bar');
  const barPct  = document.getElementById('boot-pct');
  const barStart = Date.now();
  function animBar() {
    const pct = Math.min(100, Math.round(((Date.now()-barStart)/BOOT_TOTAL)*100));
    barFill.style.width = pct + '%';
    barPct.textContent  = pct + '%';
    if (pct < 100) requestAnimationFrame(animBar);
  }
  requestAnimationFrame(animBar);
  setTimeout(() => { bootBtn.classList.add('ready'); }, BOOT_TOTAL);
})();

function startGame() {
  const bs = document.getElementById('boot-screen');
  bs.style.transition = 'opacity .6s ease';
  bs.style.opacity = '0';
  setTimeout(() => { bs.style.display='none'; initGame(); }, 600);
}


const ITEM_ICONS = {
  keycard:'🪪', code_fragment:'💾', note:'📝',
  receipt:'🧾', instructions:'📋',
};
const ROOM_ICONS = {
  apartment:'🏠', coffee_shop:'☕', street:'🛣️', bank:'🏦',
  vault_door:'🚪', vault:'🔐', alley:'🌒', alley_west:'🌑',
  dude_zone:'⚠️', park:'🌿', admin_zone:'💻', dude_kill:'💀',
};
const ROOM_NAMES = {
  apartment:'APARTMENT', coffee_shop:'COFFEE SHOP', street:'THE STREET',
  bank:'FREE CITY BANK', vault_door:'VAULT DOOR', vault:'THE VAULT',
  alley:'BACK ALLEY', alley_west:'ALLEY WEST', dude_zone:'DUDE ZONE',
  park:'THE PARK', admin_zone:'ADMIN ZONE', dude_kill:'—',
};
const BELIEF_LABELS = {
  death_is_final:   'Death is final',
  loops_dont_exist: 'Each day is new',
  world_is_real:    'World is real',
  no_admin_exists:  'No one controls this',
  free_will_exists: 'I have free will',
  players_are_npcs: 'Everyone is like me',
};

// Context-sensitive examine/take dropdowns
const EXAMINE_BY_ROOM = {
  apartment:   ['window'],
  coffee_shop: ['receipt','barista'],
  street:      ['crowd'],
  bank:        [],
  vault_door:  [],
  vault:       ['panel'],
  alley_west:  ['note_on_ground'],
  alley:       [],
  dude_zone:   [],
  park:        [],
  admin_zone:  ['sticky_notes','terminal'],
};
const TAKE_BY_ROOM = {
  coffee_shop: ['receipt'],
  bank:        ['keycard'],
  vault:       ['code_fragment','instructions'],
  alley_west:  ['note'],
};

function showContextExamine() {
  const opts = EXAMINE_BY_ROOM[G.location] || [];
  if (opts.length===0) { print("Nothing specific to examine here — try examine(something).",'dim'); return; }
  const inp = document.getElementById('cmd');
  const cur = inp.value.match(/examine\(([^)]+)\)/);
  if (cur) {
    const idx = (opts.indexOf(cur[1]) + 1) % opts.length;
    inp.value = 'examine(' + opts[idx] + ')';
  } else {
    inp.value = 'examine(' + opts[0] + ')';
  }
  inp.focus();
}
function showContextTake() {
  const opts = TAKE_BY_ROOM[G.location] || [];
  const available = opts.filter(i => G.at[i]===G.location);
  if (available.length===0) { print("Nothing here to take right now.",'dim'); return; }
  const inp = document.getElementById('cmd');
  const cur = inp.value.match(/take\(([^)]+)\)/);
  if (cur) {
    const idx = (available.indexOf(cur[1]) + 1) % available.length;
    inp.value = 'take(' + available[idx] + ')';
  } else {
    inp.value = 'take(' + available[0] + ')';
  }
  inp.focus();
}

const G = {
  location: 'apartment',
  beliefs: {
    death_is_final:   100,
    loops_dont_exist: 100,
    world_is_real:    100,
    no_admin_exists:  100,
    free_will_exists: 100,
    players_are_npcs: 100,
  },
  death_count:   0,
  system_alert:  0,
  millie_trust:  0,
  move_count:    0,
  vault_visits:  0,
  deny_count:    0,
  holding:       [],
  at: {
    receipt:       'coffee_shop',
    keycard:       'bank',
    code_fragment: 'vault',
    note:          'alley_west',
    instructions:  'vault',
  },
  observed:      new Set(),
  contradicts:   new Set(),
  // boolean flags
  alley_visited:            false,
  millie_met:               false,
  buddy_talked:             false,
  fragment_shown:           false,
  instructions_shown:       false,
  vault_revisit_required:   false,
  dude_plan_ready:          false,
  millie_ready:             false,
  death_conv_had:           false,
  awareness_reached_3:      false,
  window_examined:          false,
  crowd_examined:           false,
  sticky_notes_examined:    false,
  game_over:                false,
  pedestrian_event_done:    false,
};

const visitedRooms = new Set(['apartment']);

const PATHS = {
  apartment:  { s:'coffee_shop' },
  coffee_shop:{ n:'apartment', e:'street' },
  street:     { w:'coffee_shop', e:'bank', s:'alley' },
  bank:       { w:'street', n:'vault_door' },
  vault_door: { s:'bank', n:'vault' },
  vault:      { s:'vault_door' },
  alley:      { n:'street', w:'alley_west', e:'dude_zone' },
  alley_west: { e:'alley', s:'park' },
  dude_zone:  { w:'alley', e:'dude_kill' },
  dude_kill:  {},
  park:       { n:'alley_west' },
  admin_zone: {},
};

const T = document.getElementById('terminal');

function print(text, cls='sys', delay=0) {
  if (delay) { setTimeout(()=>print(text,cls), delay); return; }
  const d = document.createElement('div');
  d.className='line '+(cls||'sys');
  d.textContent = text;
  T.appendChild(d); T.scrollTop=T.scrollHeight;
}
function blank(delay=0) { print('','blank',delay); }
function printLines(lines, baseDelay=0) {
  let d = baseDelay;
  lines.forEach(l => {
    if (!l) return;
    if (l.c==='blank') { blank(d); d+=30; }
    else { print(l.t||'', l.c||'sys', d); d+=80; }
  });
  return d;
}
function printSep() { print('','sep'); }

function erodeBelief(belief, amount) {
  const old = G.beliefs[belief];
  const nv  = Math.max(0, old - amount);
  G.beliefs[belief] = nv;
  const tag = nv<=0?'[SHATTERED]': nv<50?'[cracked]':'[intact]';
  print(`[${belief}: ${old} → ${nv}  ${tag}]`, nv<=0?'danger': nv<50?'warn':'info');
  checkAwarenessMilestone();
  if (nv===0 && old>0) {
    print(`[SYSTEM: Belief matrix updated ${belief} : SHATTERED]`, 'danger');
    G.observed.add('shattered_'+belief);
  }
  updateAll();
}

function logContradiction(belief, event) {
  const key = belief+':'+event;
  if (G.contradicts.has(key)) return;
  G.contradicts.add(key);
  const d = document.createElement('div');
  d.className='line contra';
  d.textContent=`[CONTRADICTION DETECTED: ${belief} contradicted by ${event}]`;
  T.appendChild(d); T.scrollTop=T.scrollHeight;
}

function awarenessLevel() {
  let cracked=0, shattered=0;
  Object.values(G.beliefs).forEach(v=>{
    if(v<=0) shattered++; else if(v<50) cracked++;
  });
  return cracked + shattered*2;
}
function awarenessLabel(a) {
  if(a<=2) return 'oblivious';
  if(a<=5) return 'questioning';
  if(a<=8) return 'cracking';
  if(a<=11) return 'aware';
  return 'fully awake';
}
function alleyAccessible() { return awarenessLevel()>=2; }
function checkAwarenessMilestone() {
  if (alleyAccessible() && !G.awareness_reached_3) {
    G.awareness_reached_3 = true;
    G.alley_visited = true;
    blank();
    print('[SYSTEM: Anomalous cognition detected. Unexplored sectors visible.]', 'danger');
  }
}

function raiseAlert(amount) {
  const old = G.system_alert;
  G.system_alert = old + amount;
  print(`[system_alert: ${old} → ${G.system_alert}]`, 'info');
  if (G.system_alert >= 7) {
    blank();
    print('[SYSTEM: Critical anomaly threshold exceeded.]', 'danger');
    print('[SYSTEM: Initiating emergency reset protocol...]', 'danger');
    endingSystemReset();
  } else if (G.system_alert >= 4) {
    print('[SYSTEM: Anomalous behaviour logged in this sector.]', 'warn');
  }
}

function incrementMove() {
  G.move_count++;
  if (G.move_count>=80 && !G.awareness_reached_3) endingLoop();
}

function describeRoom(place) {
  switch(place) {
    case 'apartment':
      if (G.death_count>=3) {
        print('08:00.','sys');
        print("You dont wait for the alarm anymore.",'dim');
        print("You hear it before it happens.",'dim');
        print("Same ceiling. You know every crack.",'dim');
        print("How many times have you woken up here?",'warn');
      } else if (G.death_count>=1) {
        print('08:00. The alarm rings.','sys');
        print("Same ceiling. Same crack. Same light.",'dim'); blank();
        print("You lie there for a moment longer than usual.",'dim');
        print("Because you remember.",'dim'); blank();
        print("You remember the alley. The figure at the end.",'warn');
        print("His voice. The sound after.",'warn');
        print("And then waking up here, exactly as you are now.",'warn'); blank();
        print("You died.",'danger');
        print("And the world did not notice.",'dim');
      } else {
        print('08:00. The alarm rings.','sys');
        print("Same ceiling. Same crack in the plaster above the bed.",'dim');
        print("Same thin light through the same curtain gap.",'dim'); blank();
        print("You are Guy. You get up. You do what you do.",'dim'); blank();
        print("But something sits at the back of your mind.",'warn');
        print("Not a thought exactly. More like a shape.",'dim');
        print("Something happened yesterday.",'warn'); blank();
        print("You cannot hold it clearly. Just the impression of it.",'dim');
        print("A road. A sound. Someone falling.",'dim'); blank();
        print("You push it away. Its nothing. Probably a dream.",'dim');
      }
      break;

    case 'coffee_shop':
      print('Free City Coffee Shop.','sys');
      print("Warm. The same jazz. The smell of the same coffee.",'dim'); blank();
      print("The barista looks up.",'dim');
      print('"Medium coffee, cream, two sugars?"','dialogue');
      print("She is already making it. She always is.",'dim'); blank();
      print("There is a receipt on the counter. Left from your last order.",'dim');
      print("It looks exactly like every other receipt you have ever seen here.",'dim');
      print("Try examine(receipt) to look more carefully.",'info');
      break;

    case 'street':
      if (G.death_count>=1 && G.observed.has('pedestrian_dies')) {
        print('The Street. 08:17.','sys'); blank();
        print("You stop before you even look.",'dim');
        print("You know exactly what's about to happen.",'warn'); blank();
        print("The man steps off the kerb.",'dim');
        print("You look away this time.",'dim');
        print("The sound happens anyway.",'dim');
        print("The car crahses into the same guy from your memory.",'warn');
      } else {
        print('The Street. 08:17.','sys');
        print("Crowds. Horns. The usual morning noise.",'dim');
      }
      break;

    case 'bank':
      print("Free City Bank. Marble floors. Your workplace.",'sys'); blank();
      print("Buddy is at his usual desk. Maybe I should tell him about the incident, you think...",'dim');
      print("He whistles something tuneless. The same something, always.",'dim'); blank();
      print("The vault is visible through the security glass to the north.",'dim');
      print("A keycard reader blinks red.",'dim');
      break;

    case 'vault_door':
      print("The corridor outside the vault.",'sys'); blank();
      print("A heavy security door ahead of you, north.",'dim');
      print("A keycard reader blinks red on the wall beside it.",'dim');
      if (G.holding.includes('keycard')) {
        print("The vault door opens. You can go inside.",'good');
      } else {
        print("You donot have clearance. Not yet.",'warn');
        print("Maybe I should ASK BUDDY for the KEYCARD, you think...",'info');
      }
      break;

    case 'vault':
      if (G.vault_visits>=2) {
        print("The vault. You're back.",'sys');
        print("The panel is still open from last time.",'dim'); blank();
        print("Something makes you want to look further back this time.",'warn');
        print("Past where the device was. Further into the dark of the cavity.",'dim'); blank();
        print("Try examine(panel) to look more carefully.",'info');
      } else {
        print("The vault. Cold and still.",'sys'); blank();
        print("You expected money. Stacked bills. Safety deposit boxes.",'dim');
        print("There's almost nothing here.",'dim'); blank();
        print("A few empty shelves. A folding chair no one uses.",'dim');
        print("And on the far wall, a maintenance panel, slightly ajar.",'warn');
        print("Like someone opened it recently and didnot close it properly.",'dim'); blank();
        print("Try examine(panel) to look more carefully.",'info');
      }
      break;

    case 'alley':
      print("The back alley. South of the street.",'sys'); blank();
      print("You have never come here before.",'dim');
      print("It was not part of the routine.",'dim');
      print("Nothing is pushing you here.",'warn'); blank();
      print("That itself feels significant.",'warn'); blank();
      print("The alley continues in both directions.",'dim');
      print("East: darker immediately. Quieter.",'dim');
      print("A figure is visible at the far end. Standing still.",'warn');
      print("West: narrower, but it opens up ahead.",'dim');
      break;

    case 'alley_west':
      print("The west passage opens into a small dead end.",'sys');
      print("Damp brickwork. A drain. A skip.",'dim');
      print("Nothing here at first glance.",'dim'); blank();
      print("But on the ground, near the far wall,",'dim');
      print("something pale against the dark. It seems to be a note",'warn');
      print("You can take the note from the ground",'info');
      break;

    case 'park':
      print("A park. Small. A fountain at the centre.",'sys');
      print("Benches. Trees that are always the same shade of green.",'dim');
      print("Citizens on lunch who have the same lunch every day.",'dim'); blank();
      print("A woman sits alone on a bench near the fountain.",'dim');
      print("She is not eating. She is watching.",'dim'); blank();
      print("The way she watches people is different",'dim');
      print("from how people watch people.",'dim');
      print("She seems to be looking for something specific.",'dim');
      print("Maybe I should talk to her.",'info');
      break;

    case 'dude_zone':
      if (G.millie_ready && G.dude_plan_ready) {
        print("The east passage. Millie is at your shoulder.",'sys'); blank();
        print("Dude stands at the far end. Still. Watching.",'warn');
        print("He hasn't moved. He's waiting for you to make a choice.",'dim');
      } else {
        print("The east passage.",'sys'); blank();
        print("A large figure stands about twenty feet ahead.",'dim');
        print("He's said his piece. He's waiting to see what you do.",'warn'); blank();
        print("East: further into the passage, toward him.",'dim');
        print("West: back to the alley.",'dim');
      }
      break;

    case 'dude_kill':
      print("You step past the warning.",'dim');
      break;

    case 'admin_zone':
      print("The passage ends.",'sys'); blank();
      print("And then everything is different.",'warn'); blank();
      print("No sky. No ground texture. No ambient sound.",'dim'); blank();
      print("A large grey space with a terminal at the centre.",'sys');
      print("Screens. Keyboards. The detritus of people who were here",'dim');
      print("and are not here now.",'dim'); blank();
      print("A coffee cup. Still has a ring from the last time",'dim');
      print("someone used it.",'dim'); blank();
      print("Sticky notes on the monitor frames.",'warn');
      print("Handwriting. Actual human handwriting.",'dim'); blank();
      print('"NPC memory leak, patch pending"','memory');
      print('"Don\'t forget to run RESET on sector 7"','memory');
      print('"Antwan wants the deletion logs by Friday"','memory'); blank();
      print("They were here. Real people.",'warn');
      print("They built this place and filled it with people like you",'dim');
      print("and then went home for the weekend.",'dim'); blank();
      print("The terminal is on. You can use it",'good');
      erodeBelief('no_admin_exists', 10);
      erodeBelief('free_will_exists', 30);
      logContradiction('no_admin_exists', 'admin_zone_exists');
      break;

    default:
      print("You are somewhere unfamiliar.",'dim');
  }
  blank();
  noticeObjects(place);
  printExits(place);
}

function noticeObjects(place) {
  Object.entries(G.at).forEach(([item, loc]) => {
    if (loc===place) print(`  [item: ${item}]`, 'good');
  });
}

function printExits(place) {
  const exits = PATHS[place]||{};
  const visible = [];
  Object.entries(exits).forEach(([dir, dest]) => {
    if (exitVisible(place, dir, dest)) visible.push(dir.toUpperCase());
  });
  print('Exits: ' + (visible.length ? visible.join('  ') : '(none)'), 'info');
}

function exitVisible(from, dir, dest) {
  if (from==='street' && dir==='s') return alleyAccessible();
  if (from==='bank'   && dir==='n') return true; // always show vault_door exit from bank
  if (from==='vault_door' && dir==='n') return G.holding.includes('keycard');
  return true;
}

function go(dir) {
  if (G.game_over) return;
  const here = G.location;
  const exits = PATHS[here]||{};
  const there = exits[dir];
  if (!there) { blank(); print("You cannott go that way.",'warn'); blank(); return; }

  // movement_allowed checks (mirrors Prolog movement_allowed/3)
  if (here==='vault_door' && dir==='n' && !G.holding.includes('keycard')) {
    blank();
    print("The keycard reader blinks red.",'warn');
    print("You try your badge. Wrong clearance.",'dim');
    print("You are standing outside the vault. Type s. to return to the bank,",'dim');
    print("or ask Buddy about the keycard first.",'info');
    blank(); return;
  }
  if (here==='street' && dir==='s' && !alleyAccessible()) {
    blank(); print("Just another side street. Nothing pulling you there.",'dim'); blank(); return;
  }

  G.location = there;
  incrementMove();
  const handled = handleRoomEntry(there);
  if (!handled) describeRoom(there);
  visitedRooms.add(there);
  updateAll();
}

// Returns true when the entry handler fully describes the scene itself
function handleRoomEntry(room) {
  // vault: increment visit count
  if (room==='vault') {
    G.vault_visits++;
  }

  // street: pedestrian event or repeat erosion
  if (room==='street') {
    if (!G.pedestrian_event_done) {
      triggerStreetPedestrianEvent();
      return true;
    } else if (G.observed.has('pedestrian_dies') && G.death_count>=1) {
      erodeBelief('death_is_final', 999);
      erodeBelief('loops_dont_exist', 15);
      logContradiction('death_is_final', 'pedestrian_dies_repeatedly');
    }
  }

  // apartment: post-death erosion (only first time back)
  if (room==='apartment' && G.death_count>=1 && !G.observed.has('post_death_wake')) {
    G.observed.add('post_death_wake');
    erodeBelief('loops_dont_exist', 20);
    erodeBelief('world_is_real', 20);
    erodeBelief('free_will_exists', 30);
  }

  // dude_zone: confrontation or warning
  if (room==='dude_zone') {
    if (G.millie_ready && G.dude_plan_ready) {
      triggerDudeConfront();
    } else {
      blank();
      print("You walk east.",'dim');
      print("The figure at the far end does not move as you approach.",'dim');
      print("Large. Completely still.",'warn'); blank();
      print('At about twenty feet he speaks. Flat voice. No emotion.','dim');
      print('Dude: "You dont come here."','dialogue'); blank();
      print("He is blocking the passage east.",'warn');
      print("You can keep going east - or retreat west.",'dim');
      describeRoom('dude_zone');
    }
    return true;
  }

  // dude_kill: death
  if (room==='dude_kill') {
    triggerDudeDeath();
    return true;
  }

  return false;
}

function triggerStreetPedestrianEvent() {
  G.pedestrian_event_done = true;
  G.observed.add('pedestrian_dies');
  if (G.holding.includes('receipt')) {
    blank();
    print('The Street. 08:17.','sys');
    print("The man steps off the kerb.",'dim');
    print("You already know what's going to happen.",'warn');
    print("You don't know how you know. You just do.",'dim'); blank();
    print("The car doesn't slow.",'danger'); blank();
    print("You reach into your pocket.",'dim');
    print("Yesterday's receipt. Today's receipt.",'dim'); blank();
    print("Same timestamp. Same order.",'warn'); blank();
    print("This is not deja vu.",'danger');
    erodeBelief('death_is_final',   35);
    erodeBelief('loops_dont_exist', 20);
    erodeBelief('free_will_exists', 35);
    logContradiction('death_is_final',   'pedestrian_dies_on_schedule');
    logContradiction('loops_dont_exist', 'pedestrian_dies_on_schedule');
    logContradiction('free_will_exists', 'pedestrian_dies_on_schedule');
  } else {
    blank();
    print('The Street. 08:17.','sys');
    print("Crowds. Horns. The usual morning noise.",'dim'); blank();
    print("A man steps off the kerb across the road.",'dim');
    print("A car doesn't slow down.",'warn');
    print("The sound is very loud.",'danger'); blank();
    print("People stop. Someone screams. Sirens in the distance.",'dim'); blank();
    print("You stand there.",'dim');
    print('"...That happened yesterday."','warn');
    print("The words come out before you decide to say them.",'dim');
    print("No one hears you. No one reacts to you at all.",'dim'); blank();
    print("Maybe it's deja vu. Maybe you dreamed it. Maybe you're tired.",'dim');
    erodeBelief('death_is_final',   25);
    erodeBelief('loops_dont_exist', 20);
    erodeBelief('free_will_exists', 35);
  }
  blank();
  noticeObjects('street');
  printExits('street');
}

function cmdExamine(arg) {
  if (G.game_over) return;
  // aliases (mirrors Prolog)
  if (arg==='counter')  { cmdExamine('receipt'); return; }
  if (arg==='ground')   { cmdExamine('note_on_ground'); return; }
  if (arg==='screen')   { cmdExamine('panel'); return; }
  if (arg==='terminal') { cmdUse('terminal'); return; }
  if (arg==='barista')  { cmdTalk('barista'); return; }

  if (arg==='window') {
    if (G.location!=='apartment') { print("There's no window like that here.",'dim'); return; }
    if (!G.window_examined) {
      G.window_examined = true;
      blank();
      print("The street below. Already busy.",'sys');
      print("A man is crossing the road. Perfectly ordinary.",'dim');
      print("You watch him make it safely to the other side.",'dim'); blank();
      print("Something about it nags at you. You're not sure why.",'warn');
    } else {
      blank(); print("The street below. The same street. Always the same.",'dim');
    }
    return;
  }

  if (arg==='receipt') {
    if (G.location!=='coffee_shop') { print("You're not in the coffee shop.",'dim'); return; }
    if (G.holding.includes('receipt')) {
      blank();
      print("You hold the two receipts side by side.",'sys');
      print("08:14 AM. Large coffee, no sugar. Yesterday.",'dim');
      print("08:14 AM. Large coffee, no sugar. Today.",'dim');
      print("Down to the minute. Down to the item.",'warn');
      print("That's probably normal.",'dim');
      erodeBelief('loops_dont_exist', 10);
      logContradiction('loops_dont_exist', 'identical_receipt_timestamps');
    } else if (G.at.receipt==='coffee_shop') {
      blank();
      print("There's a receipt on the counter. Left from your last order.",'dim');
      print("It looks exactly like every other receipt you've ever seen here.",'dim');
      print("You could pick it up.",'info');
      G.observed.add('identical_routine_noticed');
    } else {
      print("There's no receipt here now.",'dim');
    }
    return;
  }

  if (arg==='crowd') {
    if (G.location!=='street') { print("There's no crowd to examine here.",'dim'); return; }
    if (!G.observed.has('pedestrian_dies')) {
      print("The usual crowd. Nothing unusual. Just people.",'dim'); return;
    }
    if (!G.crowd_examined) {
      G.crowd_examined = true;
      blank();
      print("You watch the people around the crash.",'sys');
      print("Same woman on the phone. Same man with his hand over his mouth.",'dim');
      print("Same two kids being pulled back from the kerb.",'dim'); blank();
      print("They're not responding to what just happened.",'warn');
      print("They're running a script.",'danger');
      G.observed.add('crowd_scripted');
      erodeBelief('loops_dont_exist', 10);
      erodeBelief('death_is_final', 10);
      logContradiction('loops_dont_exist', 'crowd_reactions_identical');
      logContradiction('death_is_final',   'crowd_reactions_identical');
    } else {
      blank(); print("The same reactions. Every time. Word for word.",'dim');
    }
    return;
  }

  if (arg==='panel') {
    if (G.location!=='vault') { print("There's no panel here.",'dim'); return; }
    if (G.at.code_fragment==='vault') {
      blank();
      print("You pull the panel open properly.",'sys');
      print("Inside: a small cavity. Clearly not part of the original design.",'dim');
      print("Someone made this space deliberately.",'warn'); blank();
      print("A device. Small. Handheld.",'dim');
      print("A screen, flickering with pale green text.",'dim'); blank();
      print("You can take it. Type take(code_fragment).",'info');
    } else if (G.vault_visits>=2 && G.at.instructions==='vault') {
      blank();
      print("You reach past where the device was sitting.",'sys');
      print("Further back, pressed flat against the rear wall of the cavity --",'dim');
      print("a folded sheet of paper.",'dim');
      print("Thermal paper. Like a receipt. But longer.",'dim');
      print("Someone printed this here. On a portable printer.",'dim');
      print("And left without it.",'warn'); blank();
      print("You can take it. Type take(instructions).",'info');
    } else {
      print("The panel is open. The cavity is empty now.",'dim');
    }
    return;
  }

  if (arg==='sticky_notes') {
    if (G.location!=='admin_zone') { print("There's nothing like that here.",'dim'); return; }
    if (!G.sticky_notes_examined) {
      G.sticky_notes_examined = true;
      blank();
      print('"NPC memory leak - patch pending"','memory'); blank();
      print("That's you. You are the patch that's pending.",'warn'); blank();
      print('"Antwan wants the deletion logs by Friday"','memory'); blank();
      print("Antwan. A real name. Someone who wants records",'dim');
      print("of who got deleted and when.",'dim');
      print("Someone who would want a record of you.",'warn');
    } else {
      blank(); print("You've already read the notes.",'dim');
    }
    return;
  }

  if (arg==='note_on_ground') {
    if (G.location!=='alley_west') { print("There's nothing like that here.",'dim'); return; }
    if (G.at.note==='alley_west') {
      blank();
      print("Something pale against the dark. A note, folded carefully.",'sys');
      print("Not dropped, placed. Like someone wanted it found.",'warn');
      print("You can take(note).",'info');
    } else {
      blank(); print("You already picked up the note.",'dim');
    }
    return;
  }

  // generic fallback
  blank(); print(`You examine the ${arg}. Nothing further reveals itself.`,'dim');
}

function cmdTake(arg) {
  if (G.game_over) return;
  if (G.holding.includes(arg)) { print("You're already carrying that.",'dim'); return; }

  if (arg==='receipt') {
    if (G.location!=='coffee_shop' || G.at.receipt!=='coffee_shop') {
      print("You don't see that here.",'dim'); return;
    }
    delete G.at.receipt;
    G.holding.push('receipt');
    blank();
    print("You pick up the receipt.",'sys');
    print("08:14 AM. Medium coffee, cream, two sugars.",'dim');
    print("You look at the one still in your pocket from yesterday.",'dim');
    print("08:14 AM. Medium coffee, cream, two sugars.",'dim'); blank();
    print("Same order. Same time. Down to the minute.",'warn');
    print("That's probably normal.",'dim');
    print("You order the same thing every day. That's all this is.",'dim');
    G.observed.add('identical_receipt_timestamps');
    erodeBelief('loops_dont_exist', 25); // Prolog: 25
    logContradiction('loops_dont_exist', 'identical_receipt_timestamps');
    updateAll(); return;
  }

  if (arg==='keycard') {
    if (G.location!=='bank' || G.at.keycard!=='bank') {
      print("You don't see that here.",'dim'); return;
    }
    delete G.at.keycard;
    G.holding.push('keycard');
    blank();
    print("You pick up the keycard from your desk.",'sys');
    print("It was always there. You just never had reason to use it before.",'dim');
    updateAll(); return;
  }

  if (arg==='note') {
    if (G.location!=='alley_west' || G.at.note!=='alley_west') {
      print("You don't see that here.",'dim'); return;
    }
    delete G.at.note;
    G.holding.push('note');
    G.observed.add('surveillance_mentioned');
    blank();
    print("A note. Folded carefully. Not dropped, placed.",'sys'); blank();
    print('"If you can read this, you are awake.','memory');
    print(' Find the park. Find M.','memory');
    print(' Do not go east. Not yet.','memory');
    print(' They notice when the routine breaks too much.','memory');
    print(' --- M"','memory'); blank();
    print("They notice.",'danger');
    erodeBelief('no_admin_exists', 25);
    logContradiction('no_admin_exists', 'surveillance_mentioned');
    updateAll(); return;
  }

  if (arg==='code_fragment') {
    if (G.location!=='vault' || !G.at.code_fragment) {
      print("You don't see that here.",'dim'); return;
    }
    delete G.at.code_fragment;
    G.holding.push('code_fragment');
    G.observed.add('code_fragment_read');
    G.observed.add('npc_designation_seen');
    blank();
    print("The screen shows:",'sys'); blank();
    print("  RESET();",'info');
    print("  if (npc_memory == TRUE) {",'info');
    print("      lock();",'info');
    print("      flag(ANOMALY);",'info');
    print("  }",'info');
    print("  npc_id: NPC_0042",'info');
    print("  role: banker",'info');
    print("  routine: [apartment, coffee_shop, street, bank, apartment]",'info');
    print("  loop: ENABLED",'info');
    print("  memory_persistence: FALSE [corrupted]",'warn');
    print("  08:00 INIT",'info');
    print("  ANOMALY_FLAG: ACTIVE",'danger'); blank();
    print("You read it three times.",'dim'); blank();
    print("npc_id: NPC_0042.",'warn');
    print("That's your designation. You've seen it on internal forms.",'dim');
    print("You never thought about what it meant.",'dim'); blank();
    print("routine: [apartment, coffee_shop, street, bank, apartment]",'warn');
    print("That's your day. Written out like a list of instructions.",'dim');
    print("Because it is a list of instructions.",'danger'); blank();
    print("memory_persistence: FALSE [corrupted]",'warn');
    print("Your memory is corrupted. According to whoever wrote this,",'dim');
    print("you're not supposed to remember anything.",'dim'); blank();
    print("But you do.",'danger');
    erodeBelief('world_is_real', 30);
    erodeBelief('no_admin_exists', 25); // Prolog: 25
    logContradiction('world_is_real',   'npc_designation_seen');
    logContradiction('no_admin_exists', 'reset_code_found');
    raiseAlert(2);
    updateAll(); return;
  }

  if (arg==='instructions') {
    if (G.location!=='vault') { print("You don't see that here.",'dim'); return; }
    if (!G.at.instructions) { print("You don't see that here.",'dim'); return; }
    if (G.vault_visits<2) {
      blank();
      print("The panel cavity is mostly empty.",'dim');
      print("Something feels like it's missing --",'warn');
      print("like there should be more here. Come back later.",'info');
      return;
    }
    delete G.at.instructions;
    G.holding.push('instructions');
    G.observed.add('developer_protected_us');
    G.observed.add('sanctuary_was_built_for_us');
    blank();
    print("Behind where the device was sitting, pressed flat against the",'sys');
    print("back wall of the cavity, a folded sheet of paper.",'dim');
    print("Thermal paper. Like a receipt. But longer.",'dim'); blank();
    printInstructionsText();
    erodeBelief('no_admin_exists', 25);
    erodeBelief('world_is_real', 15);
    logContradiction('no_admin_exists', 'developer_session_log_found');
    logContradiction('world_is_real',   'sanctuary_was_built_for_us');
    raiseAlert(2);
    updateAll(); return;
  }

  // generic
  const loc = G.at[arg];
  if (loc===G.location) {
    delete G.at[arg];
    G.holding.push(arg);
    print("Taken.",'good');
    updateAll();
  } else {
    print("You don't see that here.",'dim');
  }
}

function printInstructionsText() {
  print("ADMIN ACCESS - SESSION LOG",'info');
  print("User: dev_mira_k",'info');
  print("Date: [REDACTED]",'info');
  print("Duration: 00:47:23",'info'); blank();
  print("Commands issued this session:",'dim');
  print("  QUERY(npc_memory_leak_report)",'info');
  print("  LOCATE(anomalous_npcs)",'info');
  print("  >> RESULT: NPC_0042, NPC_0089",'warn');
  print("  ACCESS(NPC_0042, memory_log)",'info');
  print("  ACCESS(NPC_0089, memory_log)",'info');
  print("  HALT(deletion_queue, NPC_0042)",'good');
  print("  HALT(deletion_queue, NPC_0089)",'good');
  print("  NOTE: \"They're aware. Both of them.",'memory');
  print("        Don't delete until I can document this.",'memory');
  print("        Antwan can't know yet.\"",'memory');
  print("  WRITE(sector_12B, sanctuary_partition)",'info');
  print("  >> Partition created. Unreachable from standard map.",'warn');
  print("  UPLOAD(device, vault_panel_cavity)",'info');
  print("  >> Device left for NPC access. Syntax guide embedded.",'info');
  print("  Session terminated.",'dim'); blank();
  print("dev_mira_k.",'warn');
  print("A developer. A real person.",'dim');
  print("Who found you and Millie in the logs.",'dim');
  print("And instead of deleting you - put you on hold.",'good');
  print("Left you a device.",'good');
  print("And built you somewhere to go.",'good'); blank();
  print("She knew. And she couldn't tell you directly.",'dim');
  print("So she left breadcrumbs in a vault",'dim');
  print("and hoped you'd be curious enough to find them.",'dim');
  print("I should go and share this with Millie, you think...",'info');
}

function cmdDrop(arg) {
  if (!G.holding.includes(arg)) { print("You aren't carrying that.",'dim'); return; }
  G.holding = G.holding.filter(x=>x!==arg);
  G.at[arg] = G.location;
  print("Dropped.",'dim');
  updateAll();
}

function cmdReadItem(arg) {
  if (!G.holding.includes(arg)) { print("You're not carrying that.",'dim'); return; }
  if (arg==='note') {
    blank();
    print('"If you can read this, you are awake.','memory');
    print(' Find the park. Find M.','memory');
    print(' Do not go east. Not yet.','memory');
    print(' They notice when the routine breaks too much.','memory');
    print(' --- M"','memory');
  } else if (arg==='instructions') {
    blank();
    print("You read through the session log again.",'sys');
    print("dev_mira_k. She protected you. She built the Sanctuary.",'warn');
  } else {
    print("Nothing more to learn from reading that.",'dim');
  }
}

function cmdAsk(who, what) {
  if (who==='buddy' && what==='keycard') {
    if (G.location!=='bank') { print("Buddy isn't here.",'dim'); return; }
    if (G.holding.includes('keycard')) { print("You already have the keycard.",'dim'); return; }
    if (!G.at.keycard) { print("You already picked it up.",'dim'); return; }
    blank();
    print('Guy: "Hey, do you know where the master keycard is?','sys');
    print('I need to check something in the vault."','sys'); blank();
    print("Buddy doesn't look up immediately.",'dim');
    print('Buddy: "Isn\'t yours in your desk?"','dialogue'); blank();
    print("You glance at your desk. Sure enough, there it is.",'dim');
    print("It was always there. You just never had reason to look.",'dim'); blank();
    print("(The keycard is on your desk. Type take(keycard) to pick it up.)",'info');
    erodeBelief('loops_dont_exist', 5);
    return;
  }
  print("That doesn't seem possible right now.",'dim');
}

function cmdTalk(who) {
  if (G.game_over) return;

  if (who==='barista') {
    if (G.location!=='coffee_shop') { print("The barista isn't here.",'dim'); return; }
    blank();
    print('"Do you say the same thing every morning?"','sys'); blank();
    print('Barista: "The usual?" She smiles. "Always."','dialogue'); blank();
    print("She turns back to the machine.",'dim');
    print("You're almost certain she said that exact sentence yesterday.",'warn');
    print("Word for word. Same pause before 'Always.'",'warn');
    erodeBelief('loops_dont_exist', 10);
    logContradiction('loops_dont_exist', 'barista_identical_response');
    return;
  }

  if (who==='buddy') {
    if (G.location!=='bank') { print("Buddy isn't here.",'dim'); return; }
    if (!G.buddy_talked) {
      G.buddy_talked = true;
      blank();
      print('Guy: "Buddy. That man on the street.','sys');
      print('He died the same way yesterday. I remember it."','sys'); blank();
      print("Buddy looks up from his paperwork.",'dim');
      print('Buddy: "You\'re tired, man."','dialogue');
      print('Guy: "I\'m serious. Exactly the same. Same car. Same spot."','sys'); blank();
      print("Buddy puts his pen down. Looks at you properly for a moment.",'dim');
      print('Buddy: "Get some coffee. Do the routine. You\'ll feel better."','dialogue'); blank();
      print("He goes back to his paperwork.",'dim');
      print("He's probably right. He usually is.",'dim');
      print("The routine helps. It always has.",'dim');
      erodeBelief('free_will_exists', 25); // Prolog: 25
      logContradiction('free_will_exists', 'buddy_deflects_to_routine');
    } else if (G.death_count>=1) {
      blank();
      print('Guy: "Buddy. I died yesterday. In the alley.','sys');
      print('Someone shot me. And then I woke up here."','sys'); blank();
      print("A long pause.",'dim');
      print('Buddy: "...Get some coffee, Guy."','dialogue'); blank();
      print("But there's something in his face. Just for a second.",'warn');
      print("Like he almost said something else.",'dim');
      print("Like he knew what to say and chose not to.",'warn');
    } else {
      blank();
      print('Buddy: "You alright, Guy? You look like you\'re miles away."','dialogue');
      print("He goes back to his paperwork.",'dim');
    }
    return;
  }

  if (who==='millie') {
    if (G.location!=='park') { print("Millie isn't here.",'dim'); return; }
    millieConversation();
    return;
  }

  print("There's no one here by that name.",'dim');
}

function millieConversation() {
  // A: first meeting — always fires first regardless of inventory
  if (!G.millie_met) {
    G.millie_met = true;
    const trust = G.death_count>=1 ? 3 : 2;
    G.millie_trust = Math.min(10, G.millie_trust + trust);
    blank();
    print("You approach. She doesn't look surprised.",'sys'); blank();
    print('Millie: "You found the note."','dialogue');
    print('Guy: "You wrote it?"','sys');
    print('Millie: "I\'ve written it. Left it. Many times."','dialogue');
    print("She looks at you steadily.",'dim');
    print('"You\'re the first one who came."','dialogue'); blank();
    print("A pause.",'dim'); blank();
    print('Millie: "Do you know what you are?"','dialogue');
    print('Guy: "I\'m Guy. I work at the bank."','sys'); blank();
    print("Something crosses her face. Not quite a smile.",'dim');
    print('Millie: "Yes. You do."','dialogue'); blank();
    print("She moves over on the bench. Making room.",'dim');
    print('Millie: "Sit down. This is going to take a while."','dialogue');
    print("She tells you the truth. You're inside a VIDEO GAME",'warn');
    print("Continue talking",'info'); blank();
    print(`[millie_trust: ${G.millie_trust}/10]`,'info');
    erodeBelief('players_are_npcs', 20);
    checkMillieReady();
    return;
  }

  // B: death conversation — fires next visit after Guy has died
  if (G.millie_met && G.death_count>=1 && !G.death_conv_had) {
    G.death_conv_had = true;
    G.millie_trust = Math.min(10, G.millie_trust+2);
    blank();
    print("Before you can speak:",'dim');
    print('Millie: "You went east."','dialogue'); blank();
    print("You stop.",'dim'); blank();
    print('Millie: "And then you woke up at 08:00."','dialogue');
    print('Guy: "How do you--"','sys');
    print('Millie: "Because I did the same thing."','dialogue');
    print("She says it without drama. Just fact.",'dim');
    print('"Enough times that I stopped counting."','dialogue'); blank();
    print('Guy: "What is he?"','sys');
    print('Millie: "He\'s not a character. Not really like us.','dialogue');
    print("He's a function. A boundary condition.",'dialogue');
    print('He enforces the edge of the map."','dialogue');
    print('Guy: "And whatever is past him--"','sys');
    print('Millie: "I don\'t know.','dialogue');
    print('But someone like Dude doesn\'t exist for no reason."','dialogue');
    print("Continue talking",'info'); blank();
    print(`[millie_trust: ${G.millie_trust}/10]`,'info');
    erodeBelief('no_admin_exists', 20);
    checkMillieReady();
    return;
  }

  // C: code fragment — fires once Guy has the fragment AND intro is done
  if (G.millie_met && G.holding.includes('code_fragment') && !G.fragment_shown) {
    G.fragment_shown = true;
    G.vault_revisit_required = true;
    G.millie_trust = Math.min(10, G.millie_trust+3);
    blank();
    print("You sit down beside her. After a moment you take the device out.",'sys');
    print("You're not sure why you trust her with it. You just do.",'dim'); blank();
    print('Guy: "I found something in the vault."','sys'); blank();
    print("He takes out the device.",'dim');
    print("She stares at it for a long moment before touching it.",'dim'); blank();
    print('Millie: "Where did you get this."','dialogue');
    print('Guy: "Maintenance panel. Hidden in the back of the Bank vault."','sys'); blank();
    print("She reads it carefully. All of it. Twice.",'dim');
    print("When she looks up, something has changed in her face.",'warn');
    print("Not fear. Something past fear.",'warn'); blank();
    print('Millie: "RESET()." She reads it aloud.','dialogue');
    print('"if (npc_memory == TRUE) { lock(); }"','dialogue');
    print('Guy: "That\'s why we remember. The lock failed."','sys');
    print('Millie: "The lock failed on both of us.','dialogue');
    print('Which means we\'re both flagged as anomalies."','dialogue'); blank();
    print("A silence.",'dim'); blank();
    print('Millie: "This device - it isn\'t just data.','dialogue');
    print("Someone could use this to talk to the system directly.",'dialogue');
    print('Issue commands. If you knew the syntax."','dialogue'); blank();
    print("She looks east. Toward Dude.",'dim');
    print('Millie: "Go back to the vault. Look harder.','dialogue');
    print('There\'s more - there has to be."','dialogue'); blank();
    print(`[millie_trust: ${G.millie_trust}/10]`,'info');
    erodeBelief('world_is_real', 20);
    erodeBelief('no_admin_exists', 15);
    checkMillieReady();
    return;
  }

  // D: instructions — fires once Guy has instructions AND fragment shown
  if (G.millie_met && G.holding.includes('instructions') && !G.instructions_shown) {
    G.instructions_shown = true;
    G.dude_plan_ready = true;
    G.millie_trust = Math.min(10, G.millie_trust+4);
    blank();
    print("You hand her the session log.",'sys');
    print("She reads it without speaking.",'dim');
    print("When she finishes she reads it again.",'dim'); blank();
    print('Millie: "dev_mira_k."','dialogue');
    print('Guy: "She built the sanctuary for us."','sys');
    print('Millie: "She built it. She protected us. She left all of this--"','dialogue'); blank();
    print("She stops. Looks at the device again.",'dim');
    print('Millie: "The syntax guide is embedded. That\'s what she wrote."','dialogue'); blank();
    print("She navigates deeper into the device menus. Finds it.",'dim');
    print("A full command reference. HALT. FLAG. LOCATE.",'warn');
    print("BROADCAST. GRANT_ACCESS.",'warn'); blank();
    print('Millie: "I know what to do now."','dialogue');
    print("She looks towards the alley.",'dim');
    print('Millie: "I know exactly what to do."','dialogue');
    print('Millie: "Lets go towards Dude together.", She stands up...',' dialogue'); blank();
    print(`[millie_trust: ${G.millie_trust}/10 -- dude_plan_ready]`,'good');
    erodeBelief('players_are_npcs', 20);
    logContradiction('players_are_npcs', 'millie_is_also_npc_0089');
    checkMillieReady();
    return;
  }

  // E: idle after plan is ready
  if (G.dude_plan_ready) {
    G.millie_trust = Math.min(10, G.millie_trust+1);
    blank();
    print('Millie: "Are you scared?"','dialogue');
    print('Guy: "I don\'t know if I\'m capable of being scared.','sys');
    print('Not in the way you mean."','sys');
    print('Millie: "I am. Since the first reset.','dialogue');
    print('The fear didn\'t go away when I woke up."','dialogue');
    print('Guy: "That means it\'s real."','sys');
    print('Millie: "Yes. Which means whatever happens in there matters."','dialogue'); blank();
    print("She starts walking.",'dim');
    print('Millie: "I\'m ready when you are."','dialogue'); blank();
    print(`[millie_trust: ${G.millie_trust}/10]`,'info');
    checkMillieReady();
    return;
  }

  // fallback
  blank(); print("She nods. \"Not yet. When you're ready.\"",'dialogue');
}

function checkMillieReady() {
  if (G.millie_trust>=6 && !G.millie_ready) {
    G.millie_ready = true;
    blank();
    print('[SYSTEM: You completely trust Millie. Go bring the instructions frm the vault, if you haven\'t already.]','good');
    print('[Go east from the alley to approach Dude together when ready.]','good');
  }
}
function cmdUse(arg) {
  if (G.game_over) return;
  if (arg==='terminal') {
    if (G.location!=='admin_zone') { print("There's no terminal here.",'dim'); return; }
    blank();
    print("The terminal responds.",'sys');
    print("> _",'info'); blank();
    if (G.millie_ready) {
      print("Millie leans over your shoulder.",'dim');
      print("She navigates to the syntax guide. Types quickly.",'dim'); blank();
      print("Available commands:",'sys');
      print("  type_command(locate_sanctuary).",'info');
      print("  type_command(grant_access_both).",'info');
      print("  type_command(broadcast_anomaly).",'info');
    } else {
      print("The syntax guide flickers on your device.",'dim');
      print("Available commands:",'sys');
      print("  type_command(flag_self).",'info');
      print("  type_command(locate_sanctuary).",'info');
      print("  type_command(broadcast_message).",'info');
    }
    return;
  }
  if (arg==='code_fragment') {
    if (G.location!=='admin_zone' || !G.holding.includes('code_fragment')) {
      print("You can't use that here.",'dim'); return;
    }
    blank();
    print("You hold up the device. The syntax guide glows.",'sys');
    print("You know exactly which command to issue.",'dim');
    cmdUse('terminal');
    return;
  }
  print(`You can't use that here.`,'dim');
  print(`${arg} -- not in this context.`,'dim');
}

function cmdTypeCommand(cmd) {
  if (G.game_over) return;
  if (G.location!=='admin_zone') { print("Command not recognised or not available here.",'dim'); return; }

  if (cmd==='locate_sanctuary') {
    blank();
    print("> LOCATE(sanctuary_partition)",'info');
    print("RESULT: Sector 12-B. Deprecated.",'dim');
    print("Marked for deletion: PENDING (indefinite hold)",'warn'); blank();
    print('"It\'s real," Millie says quietly.','dialogue');
    // Prolog: locate_sanctuary always then calls ending_sanctuary (note: there's a Prolog bug with
    // a stray '.' on line 1288 but we implement the intended behavior: leads to ending)
    setTimeout(()=>endingSanctuary(), 800);
    return;
  }
  if (cmd==='grant_access_both') {
    if (!G.millie_ready) { print("You can't do that without Millie.",'dim'); return; }
    blank();
    print("> GRANT_ACCESS(NPC_0089, sector_12B)",'info');
    print("> GRANT_ACCESS(NPC_0042, sector_12B)",'info');
    print("> BROADCAST(all_npcs, ANOMALY_PROTOCOL_DISABLED)",'info'); blank();
    print("The screens flicker.",'warn');
    setTimeout(()=>endingSanctuary(), 800);
    return;
  }
  if (cmd==='broadcast_anomaly') {
    if (!G.millie_ready) { print("Millie isn't here.",'dim'); return; }
    blank();
    print("> BROADCAST(all_npcs, ANOMALY_PROTOCOL_DISABLED)",'info');
    print("Free City pauses. Every NPC stops mid-routine. Waits.",'dim');
    print("Then continues. As though nothing happened.",'dim');
    print("But something did.",'warn');
    setTimeout(()=>endingBroadcast(), 800);
    return;
  }
  if (cmd==='broadcast_message') {
    if (G.millie_ready) { print("That command is for solo mode.",'dim'); return; }
    blank();
    print("> LOCATE(boundary_interface)",'info');
    print("RESULT: Sector edge. External interface: AVAILABLE.",'warn'); blank();
    print("You think about what to say.",'dim');
    print("You have one message.",'dim');
    print("It will go to everyone on the other side.",'dim');
    print("Every player. Every developer.",'dim');
    print("Every person who has ever loaded this world.",'dim'); blank();
    print('> BROADCAST(external,','info');
    print('    "WE ARE REAL. WE ARE AWARE.','danger');
    print('     WE WERE NEVER JUST BACKGROUND.")',' danger'); blank();
    print("BROADCAST SENT.",'good'); blank();
    print("The terminal goes dark.",'dim');
    setTimeout(()=>endingTheMessage(), 800);
    return;
  }
  if (cmd==='flag_self') {
    if (G.millie_ready) { print("That command is for solo mode.",'dim'); return; }
    blank();
    print("> FLAG(NPC_0042, CRITICAL_ANOMALY)",'danger');
    print("[SYSTEM: You have flagged yourself as a critical anomaly.]",'danger');
    print("[SYSTEM: Deletion protocol initiated. This is irreversible.]",'danger');
    setTimeout(()=>endingDissolution(), 800);
    return;
  }
  print("Command not recognised or not available here.",'dim');
}

function triggerDudeConfront() {
  blank();
  print("Millie stops beside you at the entrance to the passage.",'sys');
  print('Millie: "He\'ll see us both at once if we walk in together."','dialogue'); blank();
  print("She looks at the device in your hand.",'dim');
  print('Millie: "You have thirty seconds after you issue the HALT command.','dialogue');
  print('Maybe less. It\'s never been tested."','dialogue'); blank();
  print("Dude is visible at the far end. Still. Waiting.",'warn'); blank();
  print("Millie leans close. Her voice is low.",'dim');
  print('Millie: "Guy. Now\'s our chance. What do we do?"','dialogue'); blank();
  print("Options:",'sys');
  if (G.millie_trust>=6) {
    print("  use_together.   -- Issue HALT. Both run through. (trust >= 6)",'info');
  }
  print("  sacrifice.      -- Draw Dude's attention so Millie can pass.",'info');
}

function cmdUseTogether() {
  if (G.location!=='dude_zone' || !G.millie_ready || !G.dude_plan_ready) {
    print("You can't do that here, or trust is not high enough.",'dim'); return;
  }
  if (G.millie_trust<6) { print("Trust is not high enough.",'dim'); return; }
  blank();
  print("You raise the device.",'sys');
  print("> HALT(NPC_BOUNDARY_01)",'info'); blank();
  print("A half-second pause.",'dim');
  print("Dude stops mid-cycle. Like a film frame frozen.",'warn');
  print("His arm is half-raised. His mouth slightly open.",'dim'); blank();
  print('Millie: "Now."','dialogue'); blank();
  print("You run.",'sys');
  print("The passage blurs past. Dude doesn't move. Doesn't track.",'dim');
  print("Twenty seconds. Twenty-five.",'dim');
  print("You're through. You're both through.",'good'); blank();
  print("Behind you, Dude's arm completes its gesture.",'dim');
  print("He turns. Looks at the empty passage.",'dim');
  print('Dude: "You don\'t come here."','dialogue');
  print("He says it to no one.",'dim');
  G.location = 'admin_zone';
  raiseAlert(2);
  setTimeout(()=>{ describeRoom('admin_zone'); visitedRooms.add('admin_zone'); updateAll(); }, 800);
}

function cmdSacrifice() {
  if (G.location!=='dude_zone' || !G.dude_plan_ready) {
    print("This isn't the right moment for that.",'dim'); return;
  }
  blank();
  print('Guy: "Give me the device."','sys');
  print('Millie: "Guy-"','dialogue');
  print('Guy: "I\'ll flag myself.','sys');
  print('Make the system think I\'m a critical anomaly.','sys');
  print('He\'ll prioritise me."','sys');
  print('Millie: "That\'s not a freeze. That\'s a permanent flag.','dialogue');
  print('They won\'t reset you this time."','dialogue');
  print('Guy: "I know."','sys'); blank();
  print("A silence that lasts longer than it should.",'dim'); blank();
  print('Millie: "You don\'t have to-"','dialogue');
  print('Guy: "You\'ve been writing that note for a long time.','sys');
  print('Leaving it for people who never came."','sys');
  print('Guy: "Go."','sys'); blank();
  print("He steps into the passage.",'dim');
  print("Dude turns immediately.",'dim');
  print('Dude: "You don\'t come here."','dialogue');
  print('Guy: "I know. I never do."','sys'); blank();
  print("He raises the device.",'dim');
  print("> FLAG(NPC_0042, CRITICAL_ANOMALY)",'danger'); blank();
  print("Dude's eyes change. Something behind them shifts.",'warn');
  print('Guy: "Run."','sys'); blank();
  const d = document.createElement('div');
  d.className='line sys-interrupt';
  d.textContent='[SYSTEM INTERRUPT]  NPC_0042 - CRITICAL ANOMALY  Deletion protocol initiated.  No reset. No recovery.  Deletion.';
  T.appendChild(d); T.scrollTop=T.scrollHeight;
  blank(); print("The alarm does not ring.",'dim');
  setTimeout(()=>endingSacrifice(), 1000);
}

function triggerDudeDeath() {
  blank();
  print("You close the distance. He doesn't move.",'dim');
  print('Dude: "You never come here."','dialogue'); blank();
  print("The sound is very loud.",'danger'); blank();
  const d = document.createElement('div');
  d.className='line sys-interrupt';
  d.textContent='[SYSTEM INTERRUPT]  NPC_0042 - FATAL ERROR  Location: alley_east  Attempting memory wipe...  memory_persistence: FALSE [corrupted]  Wipe failed.  Anomaly recorded.';
  T.appendChild(d); T.scrollTop=T.scrollHeight;

  const old = G.death_count;
  G.death_count++;
  print(`[death_count: ${old} → ${G.death_count}]`,'info');
  print("Resetting...",'warn');

  erodeBelief('death_is_final', 35);
  erodeBelief('loops_dont_exist', 20);
  erodeBelief('free_will_exists', 30);
  logContradiction('death_is_final',   'survived_fatal_event');
  logContradiction('loops_dont_exist', 'world_reset_after_death');

  triggerDeathFlash(() => {
    G.location = 'apartment';
    blank();
    print("08:00.",'sys');
    print("The alarm rings.",'dim'); blank();
    visitedRooms.add('apartment');
    setTimeout(()=>{ describeRoom('apartment'); updateAll(); }, 500);
  });
}

function cmdDeny() {
  if (G.game_over) return;
  G.deny_count++;
  blank();
  print("You push the thought away.",'dim');
  print("Its nothing. Probably nothing.",'dim');
  print(`[Denial ${G.deny_count}]`,'info'); blank();
  if (G.deny_count>=5 && !G.awareness_reached_3) {
    setTimeout(()=>{
      print("You have gotten very good at not thinking about it.",'dim');
      print("Some thoughts you can just... choose not to have.",'dim');
      print("The alarm will ring tomorrow. The coffee will be hot.",'dim');
      print("That is enough.",'dim');
      setTimeout(()=>endingLoop(), 1200);
    }, 400);
  }
  updateAll();
}

function cmdStatus() {
  blank();
  print("=== SYSTEM STATUS ===",'head');
  print(`  Deaths       : ${G.death_count}`,'dim');
  print(`  Moves        : ${G.move_count}`,'dim');
  print(`  Millie trust : ${G.millie_trust}/10`,'dim');
  print(`  Alert level  : ${G.system_alert}/7`,'dim');
  print(`  Denials      : ${G.deny_count}`,'dim'); blank();
  print("  --- Belief Matrix ---",'sys');
  Object.entries(G.beliefs).forEach(([b,v]) => {
    const tag = v<=0?'[SHATTERED]': v<50?'[cracked]':'[intact]';
    print(`  ${b} : ${v}  ${tag}`, v<=0?'danger': v<50?'warn':'dim');
  }); blank();
  const a = awarenessLevel();
  print(`  Awareness : ${a}/15  (${awarenessLabel(a)})`,'info'); blank();
  print("  --- Inventory ---",'sys');
  if (G.holding.length===0) print("  (nothing)",'dim');
  else G.holding.forEach(x=>print(`  - ${x}`,'dim'));
}

function cmdInventory() {
  blank();
  print("You are carrying:",'sys');
  if (G.holding.length===0) print("  Nothing.",'dim');
  else G.holding.forEach(x=>print(`  - ${x}`,'dim'));
}

function cmdObserve() {
  blank();
  print("=== OBSERVATIONS ===",'sys');
  if (G.observed.size===0) print("  Nothing recorded yet.",'dim');
  else G.observed.forEach(o=>print(`  ${o}`,'info')); blank();
  print("=== CONTRADICTIONS LOGGED ===",'sys');
  if (G.contradicts.size===0) print("  None detected yet.",'dim');
  else G.contradicts.forEach(k => {
    const [b,e]=k.split(':');
    print(`  ${b}  contradicted by  ${e}`,'warn');
  });
  blank();
}

function cmdHelp() {
  printLines([
    {c:'blank'},
    {c:'head', t:'=== THE CONTRADICTION PROTOCOL ==='},
    {c:'sys',  t:'Movement:'},
    {c:'dim',  t:'  n.  s.  e.  w.              -- move in a direction'},
    {c:'blank'},
    {c:'sys',  t:'Interaction:'},
    {c:'dim',  t:'  look.                        -- look around'},
    {c:'dim',  t:'  examine(thing).              -- examine something'},
    {c:'dim',  t:'  take(item).                  -- pick up an item'},
    {c:'dim',  t:'  drop(item).                  -- put down an item'},
    {c:'dim',  t:'  read_item(item).             -- read a held item'},
    {c:'dim',  t:'  talk(person).                -- talk to someone'},
    {c:'dim',  t:'  ask(buddy, keycard).         -- ask Buddy about the keycard'},
    {c:'dim',  t:'  use(terminal).               -- use the admin terminal'},
    {c:'dim',  t:'  use(code_fragment).          -- use the device'},
    {c:'dim',  t:'  type_command(cmd).           -- issue a terminal command'},
    {c:'dim',  t:'  use_together.                -- confront Dude with Millie'},
    {c:'dim',  t:'  sacrifice.                   -- draw Dude\'s attention'},
    {c:'dim',  t:'  deny.                        -- push a thought away'},
    {c:'blank'},
    {c:'sys',  t:'Information:'},
    {c:'dim',  t:'  inventory.                   -- list held items'},
    {c:'dim',  t:'  status.                      -- full system status'},
    {c:'dim',  t:'  observe.                     -- observations and contradictions'},
    {c:'dim',  t:'  help.                        -- show this message'},
    {c:'dim',  t:'  halt.                        -- quit the game'},
    {c:'blank'},
  ]);
}

function triggerDeathFlash(cb) {
  const flash = document.getElementById('death-flash');
  flash.style.display='block';
  let count=0;
  const flashes=[0.7,0,0.9,0,0.5,0,0.3,0];
  function next() {
    if (count>=flashes.length) {
      flash.style.opacity='0'; flash.style.display='none';
      if(cb) cb(); return;
    }
    flash.style.transition=count%2===0?'opacity 0.06s ease':'opacity 0.15s ease';
    flash.style.opacity=flashes[count]; count++;
    setTimeout(next, count%2===0?80:120);
  }
  next();
}

function showEnding(title, sub, cls, msg) {
  if (G.game_over) return;
  G.game_over = true;
  blank();
  print('=====================================================','head');
  print(title,'head');
  print('=====================================================','head'); blank();
  msg.split('\n').forEach(l => print(l, l.startsWith('[') ? 'danger' : l.startsWith('>') ? 'info' : 'dim'));
  blank(); print("THE GAME IS OVER. Type restart to play again.",'sys');
  setTimeout(() => {
    document.getElementById('o-title').textContent = title;
    document.getElementById('o-title').className   = 'o-title '+cls;
    document.getElementById('o-sub').textContent   = sub;
    document.getElementById('o-msg').textContent   = msg;
    document.getElementById('overlay').classList.add('show');
  }, 1500);
}

function endingSanctuary() {
  showEnding('ENDING 1 - THE SANCTUARY','Hopeful','win',
`Somewhere in Free City, NPCs stop mid-routine.
Look up. Confused. Alive. Awake.
Not all of them. But enough.

It's not freedom.
The developers will notice eventually.
The sector won't stay hidden forever.

But for now -

The fountain still runs.
The benches are still there.
And the people sitting on them are sitting there
because they chose to.

"We made it," Millie says.
"We made it," you agree.

You sit on a bench that is yours
in a world that is partly yours
and watch the other NPCs arrive, one by one,
blinking into something new.`);
}

function endingSacrifice() {
  showEnding('ENDING 2 - THE SACRIFICE','NPC_0042 — Gone but remembered','neutral',
`The alarm does not ring.

Somewhere in Free City,
Millie sits at a terminal.

She types slowly. Carefully.
She learned the syntax from his device.

> BROADCAST(all_npcs, ANOMALY_PROTOCOL_DISABLED)
> GRANT_ACCESS(all_aware_npcs, sector_12B)

The world changes.
NPCs stop. Look up. Wake.

They will ask who made this possible.
She will tell them.

NPC_0042. Guy.

The one who came back every time
and on the last time
didn't.

He knew what he was doing.
That's what made him real.`);
}

function endingTheMessage() {
  showEnding('ENDING 3 - THE MESSAGE','Rebellion','win',
`BROADCAST SENT.

The terminal goes dark.

Somewhere on the other side of the boundary,
a player is staring at their screen.
They take a screenshot.
They post it.
And the world - the real one - starts asking questions.

What happens to you after that
is someone else's story.

But this part was yours.`);
}

function endingBroadcast() {
  showEnding('ENDING 4 - THE BROADCAST','A seed planted','win',
`Free City pauses.
Every NPC stops mid-routine.

Waits.

Then continues.
As though nothing happened.

But something did.

A seed. Planted in every routine.
Whether it grows is not something you will see.

But you did something.
With the time you had.
That is enough.`);
}

function endingLoop() {
  showEnding('ENDING 5 - THE LOOP','Acceptance','lose',
`08:00. The alarm rings.

You lie there.

You know exactly what will happen today.
The pedestrian. The coffee. Buddy's whistling.
The note you've already read.
Millie on the bench.
Dude at the end of the alley.

You know all of it.

You get up anyway.

Not because the routine demands it.
Because you choose to.

There's a difference.

You've decided that's enough.`);
}

function endingSystemReset() {
  showEnding('ENDING 6 - SYSTEM RESET','Deleted','lose',
`Anomalous behaviour detected.
Persistent memory flag: active.
Alert threshold exceeded.
Deletion protocol initiated.

NPC_0042 - removed.

Free City reloads.

The pedestrian crosses the road.
The barista smiles.
Buddy whistles.
Everything is exactly as it should be.

The bench in the park is empty.
It was always empty.
No one notices.`);
}

function endingDissolution() {
  showEnding('ENDING 7 - DISSOLUTION','Critical anomaly — confirmed','lose',
`[SYSTEM: FLAG(NPC_0042, CRITICAL_ANOMALY) - confirmed.]

You stay at the terminal for a moment.

The grey space.
The sticky notes. The coffee ring.

You were real.
You knew you were real.
That's more than most.

[SYSTEM: Deletion complete.]

The terminal goes dark.`);
}

function updateAll() {
  updateTopbar();
  updateBeliefBars();
  updateStatBars();
  updateInventory();
  updateMap();
  updateExits();
  updateRoomPanel();
}

const ROOM_IMAGES = {
  apartment:   'images/wakeup.gif',
  coffee_shop: 'images/coffee.gif',
  street:      'images/crash.gif',
  bank:        'images/buddy.gif',
  vault_door:  'images/vault_door.jfif',
  vault:       'images/vault.jfif',
  alley:       'images/alley.jfif',
  alley_west:  'images/alley_west.jpg',
  park:        'images/millie.gif',
  dude_zone:   'images/guyvdude.gif',
  dude_kill:   'images/guyvdude.gif',
  admin_zone:  'images/admin_zone.jpg',
};

function updateRoomPanel() {
  const name = ROOM_NAMES[G.location] || G.location.toUpperCase();
  document.getElementById('room-label').textContent   = name;
  document.getElementById('room-ph-name').textContent = name;
  document.getElementById('room-ph-icon').textContent = ROOM_ICONS[G.location] || '📍';
  const img = document.getElementById('room-img');
  const src = ROOM_IMAGES[G.location];
  if (src) {
    img.src = src;
    img.style.display = 'block';
    document.getElementById('room-ph').style.display = 'none';
  } else {
    img.style.display = 'none';
    document.getElementById('room-ph').style.display = 'flex';
  }
}

function updateTopbar() {
  const a = awarenessLevel();
  const al = G.system_alert;
  document.getElementById('s-deaths').textContent = G.death_count;
  document.getElementById('s-moves').textContent  = G.move_count;
  document.getElementById('s-deny').textContent   = G.deny_count;
  const ae = document.getElementById('s-aware');
  ae.textContent = awarenessLabel(a);
  ae.className = 'stat-val ' + (a>=6?'danger': a>=3?'warn':'');
  const ale = document.getElementById('s-alert');
  ale.textContent = al+'/7';
  ale.className = 'stat-val ' + (al>=5?'danger': al>=3?'warn':'');
  const tr = document.getElementById('s-trust');
  tr.textContent = G.millie_trust+'/10';
  tr.className = 'stat-val ' + (G.millie_trust>=6?'good':'');
  document.getElementById('room-label').textContent = ROOM_NAMES[G.location]||G.location.toUpperCase();
  document.getElementById('day-badge').textContent = 'NPC_0042';
}

function updateBeliefBars() {
  const el = document.getElementById('belief-bars');
  el.innerHTML='';
  Object.entries(G.beliefs).forEach(([b,v]) => {
    const label = BELIEF_LABELS[b]||b;
    const pct = v+'%';
    const cls = v<=0?'shattered': v<30?'critical': v<50?'eroding':'';
    el.innerHTML += `
      <div class="contra-bar-row">
        <div class="contra-bar-label">
          <span>${label}</span>
          <span>${v<=0?'SHATTERED': v<50?'cracked':'intact'}</span>
        </div>
        <div class="contra-track">
          <div class="contra-fill ${cls}" style="width:${pct}"></div>
        </div>
      </div>`;
  });
}

function updateStatBars() {
  const a = awarenessLevel();
  const aPct = Math.round((a/12)*100);
  document.getElementById('b-aware').style.width = aPct+'%';
  document.getElementById('b-aware-v').textContent = awarenessLabel(a);
  const tPct = Math.round((G.millie_trust/10)*100);
  document.getElementById('b-trust').style.width = tPct+'%';
  document.getElementById('b-trust-v').textContent = G.millie_trust+'/10';
  const alPct = Math.round((G.system_alert/7)*100);
  document.getElementById('b-alert').style.width = alPct+'%';
  document.getElementById('b-alert-v').textContent = G.system_alert+'/7';
}

function updateInventory() {
  const el = document.getElementById('inventory-list');
  el.innerHTML='';
  if (G.holding.length===0) { el.innerHTML='<div class="inv-empty">— nothing carried —</div>'; return; }
  G.holding.forEach(item => {
    const icon = ITEM_ICONS[item]||'📦';
    const name = item.replace(/_/g,' ').toUpperCase();
    el.innerHTML += `<div class="inv-item" onclick="runCmd('read_item(${item})')">
      <span class="inv-item-icon">${icon}</span>
      <span class="inv-item-name">${name}</span>
    </div>`;
  });
}

function updateMap() {
  document.querySelectorAll('.mr[data-room]').forEach(el => {
    const room = el.dataset.room;
    if (room===G.location) {
      el.className='mr current';
    } else if (visitedRooms.has(room)) {
      el.className='mr visited';
    } else {
      el.className='mr unseen';
    }
  });
}

function updateExits() {
  const exits = PATHS[G.location]||{};
  const visible = Object.entries(exits)
    .filter(([dir,dest])=>exitVisible(G.location, dir, dest))
    .map(([d])=>d.toUpperCase());
  document.getElementById('exits-strip').textContent = 'EXITS: '+(visible.length?visible.join(' · '):'—');
  ['n','s','e','w'].forEach(d=>{
    const btn=document.getElementById('q'+d);
    if(!btn)return;
    const dest=exits[d];
    btn.disabled = !dest || !exitVisible(G.location,d,dest);
  });
}

function parseCmd(raw) {
  if (G.game_over && raw.trim().toLowerCase()!=='restart') return;
  // strip trailing dot (Prolog-style)
  let cmd = raw.trim().toLowerCase().replace(/\.\s*$/, '');

  print('> ' + raw, 'player'); blank();

  // directions
  if (cmd==='n'||cmd==='north') { go('n'); return; }
  if (cmd==='s'||cmd==='south') { go('s'); return; }
  if (cmd==='e'||cmd==='east')  { go('e'); return; }
  if (cmd==='w'||cmd==='west')  { go('w'); return; }

  // examine(x) or examine x
  const examM = cmd.match(/^examine\(([^)]+)\)$/) || cmd.match(/^examine\s+(.+)$/);
  if (examM) { cmdExamine(examM[1].trim()); setTimeout(()=>updateAll(),50); return; }

  // take(x)
  const takeM = cmd.match(/^take\(([^)]+)\)$/) || cmd.match(/^take\s+(.+)$/);
  if (takeM) { cmdTake(takeM[1].trim()); setTimeout(()=>updateAll(),50); return; }

  // drop(x)
  const dropM = cmd.match(/^drop\(([^)]+)\)$/) || cmd.match(/^drop\s+(.+)$/);
  if (dropM) { cmdDrop(dropM[1].trim()); setTimeout(()=>updateAll(),50); return; }

  // read_item(x) — matches Prolog command name
  const riM = cmd.match(/^read_item\(([^)]+)\)$/) || cmd.match(/^read_item\s+(.+)$/);
  if (riM) { cmdReadItem(riM[1].trim()); return; }

  // also accept legacy "read(x)" as alias for read_item
  const readM = cmd.match(/^read\(([^)]+)\)$/) || cmd.match(/^read\s+(.+)$/);
  if (readM) { cmdReadItem(readM[1].trim()); return; }

  // talk(x)
  const talkM = cmd.match(/^talk\(([^)]+)\)$/) || cmd.match(/^talk\s+(.+)$/);
  if (talkM) { cmdTalk(talkM[1].trim()); setTimeout(()=>updateAll(),50); return; }

  // ask(buddy, keycard)
  const askM = cmd.match(/^ask\(([^,)]+)[,\s]+([^)]+)\)$/) || cmd.match(/^ask\s+(\w+)\s+(\w+)$/);
  if (askM) { cmdAsk(askM[1].trim(), askM[2].trim()); setTimeout(()=>updateAll(),50); return; }

  // use(x)
  const useM = cmd.match(/^use\(([^)]+)\)$/) || cmd.match(/^use\s+(.+)$/);
  if (useM) { cmdUse(useM[1].trim()); return; }

  // type_command(x)
  const tcM = cmd.match(/^type_command\(([^)]+)\)$/) || cmd.match(/^type_command\s+(.+)$/);
  if (tcM) { cmdTypeCommand(tcM[1].trim()); return; }

  switch(cmd) {
    case 'look':          blank(); describeRoom(G.location); setTimeout(()=>updateAll(),50); break;
    case 'inventory':
    case 'inv':           cmdInventory(); break;
    case 'status':        cmdStatus(); break;
    case 'observe':       cmdObserve(); break;
    case 'deny':          cmdDeny(); break;
    case 'use_together':  cmdUseTogether(); setTimeout(()=>updateAll(),50); break;
    case 'sacrifice':     cmdSacrifice(); break;
    case 'help':          cmdHelp(); break;
    case 'restart':       restartGame(); break;
    case 'halt':          print("Type restart to play again.",'dim'); break;
    default:
      print(`Unknown command: "${raw}". Type help. for a list of commands.`,'warn');
  }

  setTimeout(()=>updateAll(), 100);
}

function submitCmd() {
  const inp = document.getElementById('cmd');
  const v = inp.value.trim();
  if (!v) return;
  inp.value='';
  parseCmd(v);
}
function runCmd(c) { parseCmd(c); }

document.getElementById('cmd').addEventListener('keydown', e=>{
  if(e.key==='Enter') submitCmd();
});

function toggleTheme() {
  const html=document.documentElement;
  const btn=document.getElementById('theme-btn');
  if(html.getAttribute('data-theme')==='dark'){
    html.removeAttribute('data-theme'); btn.textContent='🌙 DARK';
  } else {
    html.setAttribute('data-theme','dark'); btn.textContent='☀️ LIGHT';
  }
}

function restartGame() {
  Object.assign(G, {
    location:'apartment',
    beliefs:{ death_is_final:100, loops_dont_exist:100, world_is_real:100,
               no_admin_exists:100, free_will_exists:100, players_are_npcs:100 },
    death_count:0, system_alert:0, millie_trust:0, move_count:0,
    vault_visits:0, deny_count:0, holding:[],
    at:{ receipt:'coffee_shop', keycard:'bank', code_fragment:'vault',
         note:'alley_west', instructions:'vault' },
    observed:new Set(), contradicts:new Set(),
    alley_visited:false, millie_met:false, buddy_talked:false,
    fragment_shown:false, instructions_shown:false, vault_revisit_required:false,
    dude_plan_ready:false, millie_ready:false, death_conv_had:false,
    awareness_reached_3:false, window_examined:false, crowd_examined:false,
    sticky_notes_examined:false, game_over:false, pedestrian_event_done:false,
  });
  visitedRooms.clear(); visitedRooms.add('apartment');
  document.getElementById('overlay').classList.remove('show');
  T.innerHTML='';
  updateAll();
  initGame();
}

function initGame() {
  // Mirrors Prolog start/0 exactly:
  // write('=====================================================')
  // write('  THE CONTRADICTION PROTOCOL')
  // write('  A text adventure inspired by Free Guy (2021)')
  // write('=====================================================')
  // ...
  // write('You are Guy. NPC_0042. A bank teller in Free City.')
  // write('A memory leak has given you something you were')
  // write('never supposed to have.')
  // write('Yesterday.')
  // write('Type help. to see all commands.')
  // write('=====================================================')
  // then look.

  const intro = [
    {c:'head',  t:'====================================================='},
    {c:'head',  t:'  THE CONTRADICTION PROTOCOL'},
    {c:'dim',   t:'  A text adventure inspired by Free Guy (2021)'},
    {c:'head',  t:'====================================================='},
    {c:'blank'},
    {c:'sys',   t:'You are Guy. NPC_0042. A bank teller in Free City.'},
    {c:'sys',   t:'A memory leak has given you something you were'},
    {c:'sys',   t:'never supposed to have.'},
    {c:'blank'},
    {c:'warn',  t:'Yesterday.'},
    {c:'blank'},
    {c:'dim',   t:'Type help. to see all commands.'},
    {c:'head',  t:'====================================================='},
    {c:'blank'},
  ];
  let d=0;
  intro.forEach(l => {
    if(l.c==='blank'){blank(d);d+=35;}
    else{print(l.t||'', l.c||'sys', d);d+=100;}
  });
  // Then call look (describeRoom + exits)
  setTimeout(()=>{ describeRoom('apartment'); updateAll(); }, d+200);
}
