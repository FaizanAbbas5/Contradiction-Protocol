/* contradiction_protocol.pl  */
/* A text adventure inspired by Free Guy (2021). */

/* here are all the dynamic declarations*/

:- dynamic i_am_at/1, at/2, holding/1.
:- dynamic belief_value/2.
:- dynamic death_count/1, system_alert/1, millie_trust/1.
:- dynamic move_count/1, vault_visits/1, deny_count/1.
:- dynamic observed/2, pending_erosion/2.
:- dynamic contradicts/2.

/* boolean flags (help with the dynamic nature of the game, situation changes based on the events taking place) */
:- dynamic alley_visited/0, millie_met/0, buddy_talked/0.
:- dynamic fragment_shown/0, instructions_shown/0.
:- dynamic vault_revisit_required/0, dude_plan_ready/0.
:- dynamic millie_ready/0, death_conv_had/0.
:- dynamic awareness_reached_3/0.
:- dynamic window_examined/0.
:- dynamic crowd_examined/0.
:- dynamic sticky_notes_examined/0.
:- dynamic game_over/0.

:- discontiguous take/1.
:- discontiguous type_command/1.
:- discontiguous use/1.
:- discontiguous ending_sanctuary/0.

/* initialisation */

init_game :-
    retractall(i_am_at(_)),
    retractall(at(_, _)),
    retractall(holding(_)),
    retractall(belief_value(_, _)),
    retractall(death_count(_)),
    retractall(system_alert(_)),
    retractall(millie_trust(_)),
    retractall(move_count(_)),
    retractall(vault_visits(_)),
    retractall(deny_count(_)),
    retractall(observed(_, _)),
    retractall(pending_erosion(_, _)),
    retractall(contradicts(_, _)),
    retractall(alley_visited),
    retractall(millie_met),
    retractall(buddy_talked),
    retractall(fragment_shown),
    retractall(instructions_shown),
    retractall(vault_revisit_required),
    retractall(dude_plan_ready),
    retractall(millie_ready),
    retractall(death_conv_had),
    retractall(awareness_reached_3),
    retractall(window_examined),
    retractall(crowd_examined),
    retractall(sticky_notes_examined),
    retractall(game_over),

    assert(i_am_at(apartment)),

    assert(belief_value(death_is_final,   100)),
    assert(belief_value(loops_dont_exist, 100)),
    assert(belief_value(world_is_real,    100)),
    assert(belief_value(no_admin_exists,  100)),
    assert(belief_value(free_will_exists, 100)),
    assert(belief_value(players_are_npcs, 100)),

    assert(death_count(0)),
    assert(system_alert(0)),
    assert(millie_trust(0)),
    assert(move_count(0)),
    assert(vault_visits(0)),
    assert(deny_count(0)),

    assert(at(receipt,       coffee_shop)),
    assert(at(keycard,       bank)),
    assert(at(code_fragment, vault)),
    assert(at(note,          alley_west)),
    assert(at(instructions,  vault)).

/* the game map */

path(apartment,   s, coffee_shop).
path(coffee_shop, n, apartment).
path(coffee_shop, e, street).
path(street,      w, coffee_shop).
path(street,      e, bank).
path(bank,        w, street).
path(bank,        n, vault_door).
path(vault_door,  s, bank).
path(vault_door,  n, vault).
path(vault,       s, vault_door).
path(street,      s, alley).
path(alley,       n, street).
path(alley,       w, alley_west).
path(alley_west,  e, alley).
path(alley,       e, dude_zone).
path(dude_zone,   w, alley).

/*going further east past Dude's warning*/
path(dude_zone,   e, dude_kill).
path(alley_west,  s, park).
path(park,        n, alley_west).
/* admin_zone has no path its entered only via dude confrontation */

/* movememnt */

n :- go(n).
s :- go(s).
e :- go(e).
w :- go(w).

go(Direction) :-
    \+ game_over,
    i_am_at(Here),
    ( path(Here, Direction, There) ->
        ( movement_allowed(Here, Direction, There) ->
            retract(i_am_at(Here)),
            assert(i_am_at(There)),
            increment_move,
            handle_room_entry(There),
            look
        ;
            true          % gate printed its own message; stay put
        )
    ;
        nl, write('You cannott go that way.'), nl, nl
    ).

/* movement_allowed/3 succeeds silently when passage is open,
   fails (after printing a reason) when it is blocked. */

movement_allowed(vault_door, n, vault) :-
    \+ holding(keycard), !,
    nl,
    write('The keycard reader blinks red.'), nl,
    write('You try your badge. Wrong clearance.'), nl,
    write('You are standing outside the vault. Type s. to return to the bank,'), nl,
    write('or ask Buddy about the keycard first.'), nl,
    nl,
    fail.

movement_allowed(street, s, alley) :-
    \+ alley_accessible, !,
    nl,
    write('Just another side street. Nothing pulling you there.'), nl,
    nl,
    fail.

movement_allowed(_, _, _).   % all other paths are open

/* --- room entry side effects --- */

handle_room_entry(vault) :-
    retract(vault_visits(V)),
    V1 is V + 1,
    assert(vault_visits(V1)), !.

handle_room_entry(street) :-
    \+ observed(guy, pedestrian_dies), !,
    trigger_street_pedestrian_event.

handle_room_entry(street) :-
    observed(guy, pedestrian_dies),
    death_count(D), D >= 1, !,
    erode_belief(death_is_final, 999),
    erode_belief(loops_dont_exist, 15),
    log_contradiction(death_is_final, pedestrian_dies_repeatedly).

handle_room_entry(apartment) :-
    death_count(D), D >= 1,
    \+ observed(guy, post_death_wake), !,
    assert(observed(guy, post_death_wake)),
    erode_belief(loops_dont_exist, 20),
    erode_belief(world_is_real, 20),
    erode_belief(free_will_exists, 30).

handle_room_entry(dude_zone) :-
    millie_ready, dude_plan_ready, !,
    trigger_dude_confrontation.

handle_room_entry(dude_zone) :-
    /* No plan - Dude speaks, player chooses e. to press on or w. to retreat */
    nl,
    write('You walk east.'), nl,
    write('The figure at the far end does not move as you approach.'), nl,
    write('Large. Completely still.'), nl,
    nl,
    write('At about twenty feet he speaks. Flat voice. No emotion.'), nl,
    write('Dude: "You dont come here."'), nl,
    nl,
    write('He is blocking the passage east.'), nl,
    write('You can keep going east - or retreat west.'), nl.

handle_room_entry(dude_kill) :-
    /* Player pressed e. past Dude's warning - die */
    trigger_dude_death.

handle_room_entry(_).

/* Awareness system - computed, never stored */

awareness_level(A) :-
    findall(B, (belief_value(B, V), V =< 50, V > 0), Cracked),
    findall(B, (belief_value(B, V), V =< 0), Shattered),
    length(Cracked, NC),
    length(Shattered, NS),
    A is NC + (NS * 2).

awareness_label(A, 'oblivious')   :- A =< 2, !.
awareness_label(A, 'questioning') :- A =< 5, !.
awareness_label(A, 'cracking')    :- A =< 8, !.
awareness_label(A, 'aware')       :- A =< 11, !.
awareness_label(_, 'fully awake').

/* Threshold lowered from 3 to 2.
    A perfect no-death run can now reach awareness 2 by:
    loops_dont_exist cracked via take(receipt) + talk(barista) + street scene + examine(crowd)
    free_will_exists cracked via talk(buddy) (erosion raised to -20)
    This makes the alley reachable without requiring a death. */
alley_accessible :-
    awareness_level(A), A >= 2.

check_awareness_milestone :-
    alley_accessible,
    \+ awareness_reached_3, !,
    assert(awareness_reached_3),
    nl,
    write('[SYSTEM: Anomalous cognition detected. Unexplored sectors visible.]'), nl.
check_awareness_milestone.

/* Belief erosion
   After every erosion the new value (and cracked/shattered state)
   is printed to the terminal so the player always sees the impact.
   */

erode_belief(Belief, Amount) :-
    retract(belief_value(Belief, Current)),
    New is max(0, Current - Amount),
    assert(belief_value(Belief, New)),
    /* --- print the updated value --- */
    belief_status_tag(New, Tag),
    format('[~w: ~w -> ~w  ~w]~n', [Belief, Current, New, Tag]),
    check_awareness_milestone,
    check_belief_shatter(Belief, New).

belief_status_tag(0, '[SHATTERED]') :- !.
belief_status_tag(V, '[cracked]')   :- V < 50, !.
belief_status_tag(_, '[intact]').

check_belief_shatter(Belief, 0) :-
    \+ observed(guy, shattered(Belief)), !,
    assert(observed(guy, shattered(Belief))),
    nl,
    write('[SYSTEM: Belief matrix updated'),
    write(Belief), write(' : SHATTERED]'), nl.
check_belief_shatter(_, _).

/* Contradiction logging */

log_contradiction(Belief, Event) :-
    \+ contradicts(Belief, Event), !,
    assert(contradicts(Belief, Event)),
    nl,
    write('[CONTRADICTION DETECTED: '),
    write(Belief), write(' contradicted by '),
    write(Event), write(']'), nl.
log_contradiction(_, _).

/* Deny */

deny :-
    \+ game_over,
    retract(deny_count(N)),
    N1 is N + 1,
    assert(deny_count(N1)),
    nl,
    write('You push the thought away.'), nl,
    write('Its nothing. Probably nothing.'), nl,
    format('[Denial ~w]~n', [N1]),
    nl,
    ( N1 >= 5 -> check_loop_ending_deny ; true ).

check_loop_ending_deny :-
    \+ awareness_reached_3, !,
    nl,
    write('You have gotten very good at not thinking about it.'), nl,
    write('Some thoughts you can just... choose not to have.'), nl,
    write('The alarm will ring tomorrow. The coffee will be hot.'), nl,
    write('That is enough.'), nl,
    nl,
    ending_loop.
check_loop_ending_deny.

/* System Alert */

raise_alert(Amount) :-
    retract(system_alert(Current)),
    New is Current + Amount,
    assert(system_alert(New)),
    format('[system_alert: ~w -> ~w]~n', [Current, New]),
    check_alert_level(New).

check_alert_level(A) :-
    A >= 7, !,
    nl,
    write('[SYSTEM: Critical anomaly threshold exceeded.]'), nl,
    write('[SYSTEM: Initiating emergency reset protocol...]'), nl,
    ending_system_reset.
check_alert_level(A) :-
    A >= 4, !,
    nl,
    write('[SYSTEM: Anomalous behaviour logged in this sector.]'), nl.
check_alert_level(_).

/*Move counter */

increment_move :-
    retract(move_count(N)),
    N1 is N + 1,
    assert(move_count(N1)),
    check_move_limit(N1).

check_move_limit(N) :-
    N >= 80,
    \+ awareness_reached_3, !,
    ending_loop.
check_move_limit(_).

/* look */

look :-
    \+ game_over,
    i_am_at(Place),
    nl,
    describe(Place),
    nl,
    notice_objects_at(Place),
    print_exits(Place).

notice_objects_at(Place) :-
    at(X, Place),
    write('  [item: '), write(X), write(']'), nl,
    fail.
notice_objects_at(_).

print_exits(Place) :-
    nl,
    write('Exits: '),
    forall(
        (path(Place, Dir, _), exit_visible(Place, Dir)),
        (write(Dir), write('  '))
    ),
    nl, nl.

exit_visible(street, s) :- alley_accessible, !.
exit_visible(street, s) :- !, fail.
exit_visible(bank,   n) :- !.           % always show vault_door exit from bank
exit_visible(vault_door, n) :- holding(keycard), !.
exit_visible(vault_door, n) :- !, fail.
exit_visible(_, _).

/* Room descriptions */

describe(apartment) :-
    death_count(D), D >= 3, !,
    write('08:00.'), nl,
    write('You dont wait for the alarm anymore.'), nl,
    write('You hear it before it happens.'), nl,
    write('Same ceiling. You know every crack.'), nl,
    write('How many times have you woken up here?'), nl.

describe(apartment) :-
    death_count(D), D >= 1, !,
    write('08:00. The alarm rings.'), nl,
    write('Same ceiling. Same crack. Same light.'), nl,
    nl,
    write('You lie there for a moment longer than usual.'), nl,
    write('Because you remember.'), nl,
    nl,
    write('You remember the alley. The figure at the end.'), nl,
    write('His voice. The sound after.'), nl,
    write('And then waking up here, exactly as you are now.'), nl,
    nl,
    write('You died.'), nl,
    write('And the world did not notice.'), nl.

describe(apartment) :-
    write('08:00. The alarm rings.'), nl,
    write('Same ceiling. Same crack in the plaster above the bed.'), nl,
    write('Same thin light through the same curtain gap.'), nl,
    nl,
    write('You are Guy. You get up. You do what you do.'), nl,
    nl,
    write('But something sits at the back of your mind.'), nl,
    write('Not a thought exactly. More like a shape.'), nl,
    write('Something happened yesterday.'), nl,
    nl,
    write('You cannot hold it clearly. Just the impression of it.'), nl,
    write('A road. A sound. Someone falling.'), nl,
    nl,
    write('You push it away. Its nothing. Probably a dream.'), nl.

describe(coffee_shop) :-
    write('Free City Coffee Shop.'), nl,
    write('Warm. The same jazz. The smell of the same coffee.'), nl,
    nl,
    write('The barista looks up.'), nl,
    write('"Medium coffee, cream, two sugars?"'), nl,
    write('She is already making it. She always is.'), nl,
    nl,
    write('There is a receipt on the counter. Left from your last order.'), nl,
    write('It looks exactly like every other receipt you have ever seen here.'), nl,
    write('Try examine(receipt) to look more carefully.'), nl.

describe(street) :-
    death_count(D), D >= 1,
    observed(guy, pedestrian_dies), !,
    write('The Street. 08:17.'), nl,
    nl,
    write('You stop before you even look.'), nl,
    write('You know exactly what''s about to happen.'), nl,
    nl,
    write('The man steps off the kerb.'), nl,
    write('You look away this time.'), nl,
    write('The sound happens anyway.'), nl,
    write('The car crahses into the same guy from your memory.'), nl.

describe(street) :-
    write('The Street. 08:17.'), nl,
    write('Crowds. Horns. The usual morning noise.'), nl.

describe(bank) :-
    write('Free City Bank. Marble floors. Your workplace.'), nl,
    nl,
    write('Buddy is at his usual desk. Maybe I should tell him about the incident, you think...'), nl,
    write('He whistles something tuneless. The same something, always.'), nl,
    nl,
    write('The vault is visible through the security glass to the north.'), nl,
    write('A keycard reader blinks red.'), nl.

describe(vault_door) :-
    write('The corridor outside the vault.'), nl,
    nl,
    write('A heavy security door ahead of you, north.'), nl,
    write('A keycard reader blinks red on the wall beside it.'), nl,
    ( holding(keycard)
    ->  write('The vault door opens. You can go inside.'), nl
    ;   write('You donot have clearance. Not yet.'), nl,
        write('Maybe I should ASK BUDDY for the KEYCARD, you think...'), nl
    ).

describe(vault) :-
    vault_visits(V), V >= 2, !,
    write('The vault. You''re back.'), nl,
    write('The panel is still open from last time.'), nl,
    nl,
    write('Something makes you want to look further back this time.'), nl,
    write('Past where the device was. Further into the dark of the cavity.'), nl,
    nl,
    write('Try examine(panel) to look more carefully.'), nl.

describe(vault) :-
    write('The vault. Cold and still.'), nl,
    nl,
    write('You expected money. Stacked bills. Safety deposit boxes.'), nl,
    write('There''s almost nothing here.'), nl,
    nl,
    write('A few empty shelves. A folding chair no one uses.'), nl,
    write('And on the far wall, a maintenance panel, slightly ajar.'), nl,
    write('Like someone opened it recently and didnot close it properly.'), nl,
    nl,
    write('Try examine(panel) to look more carefully.'), nl.



describe(alley) :-
    write('The back alley. South of the street.'), nl,
    nl,
    write('You have never come here before.'), nl,
    write('It was not part of the routine.'), nl,
    write('Nothing is pushing you here.'), nl,
    nl,
    write('That itself feels significant.'), nl,
    nl,
    write('The alley continues in both directions.'), nl,
    write('East: darker immediately. Quieter.'), nl,
    write('A figure is visible at the far end. Standing still.'), nl,
    write('West: narrower, but it opens up ahead.'), nl.

describe(alley_west) :-
    write('The west passage opens into a small dead end.'), nl,
    write('Damp brickwork. A drain. A skip.'), nl,
    write('Nothing here at first glance.'), nl,
    nl,
    write('But on the ground, near the far wall,'), nl,
    write('something pale against the dark. It seems to be a note'), nl,
    write('You can take the note from the ground'), nl.

describe(park) :-
    write('A park. Small. A fountain at the centre.'), nl,
    write('Benches. Trees that are always the same shade of green.'), nl,
    write('Citizens on lunch who have the same lunch every day.'), nl,
    nl,
    write('A woman sits alone on a bench near the fountain.'), nl,
    write('She is not eating. She is watching.'), nl,
    nl,
    write('The way she watches people is different'), nl,
    write('from how people watch people.'), nl,
    write('She seems to be looking for something specific.'), nl,
    write('Maybe I should talk to her.'), nl.

describe(dude_zone) :-
    millie_ready, dude_plan_ready, !,
    write('The east passage. Millie is at your shoulder.'), nl,
    nl,
    write('Dude stands at the far end. Still. Watching.'), nl,
    write('He hasn''t moved. He''s waiting for you to make a choice.'), nl.

describe(dude_zone) :-
    write('The east passage.'), nl,
    nl,
    write('A large figure stands about twenty feet ahead.'), nl,
    write('He''s said his piece. He''s waiting to see what you do.'), nl,
    nl,
    write('East: further into the passage, toward him.'), nl,
    write('West: back to the alley.'), nl.

describe(dude_kill) :-
    write('You step past the warning.'), nl.

describe(admin_zone) :-
    write('The passage ends.'), nl,
    nl,
    write('And then everything is different.'), nl,
    nl,
    write('No sky. No ground texture. No ambient sound.'), nl,
    nl,
    write('A large grey space with a terminal at the centre.'), nl,
    write('Screens. Keyboards. The detritus of people who were here'), nl,
    write('and are not here now.'), nl,
    nl,
    write('A coffee cup. Still has a ring from the last time'), nl,
    write('someone used it.'), nl,
    nl,
    write('Sticky notes on the monitor frames.'), nl,
    write('Handwriting. Actual human handwriting.'), nl,
    nl,
    write('"NPC memory leak, patch pending"'), nl,
    write('"Don''t forget to run RESET on sector 7"'), nl,
    write('"Antwan wants the deletion logs by Friday"'), nl,
    nl,
    write('They were here. Real people.'), nl,
    write('They built this place and filled it with people like you'), nl,
    write('and then went home for the weekend.'), nl,
    nl,
    write('The terminal is on. You can use it'), nl,
    nl,
    erode_belief(no_admin_exists, 10),
    erode_belief(free_will_exists, 30),
    log_contradiction(no_admin_exists, admin_zone_exists).

/* Examine */

examine(counter)  :- examine(receipt).
examine(ground)   :- examine(note_on_ground).
examine(screen)   :- examine(panel).
examine(terminal) :- use(terminal).
examine(barista)  :- talk(barista).

examine(window) :-
    \+ game_over,
    i_am_at(apartment),
    \+ window_examined, !,
    assert(window_examined),
    nl,
    write('The street below. Already busy.'), nl,
    write('A man is crossing the road. Perfectly ordinary.'), nl,
    write('You watch him make it safely to the other side.'), nl,
    nl,
    write('Something about it nags at you. You''re not sure why.'), nl.

examine(window) :-
    \+ game_over,
    i_am_at(apartment), !,
    nl,
    write('The street below. The same street. Always the same.'), nl.

examine(receipt) :-
    \+ game_over,
    i_am_at(coffee_shop), !,
    (   holding(receipt)
    ->  nl,
        write('You hold the two receipts side by side.'), nl,
        write('08:14 AM. Large coffee, no sugar. Yesterday.'), nl,
        write('08:14 AM. Large coffee, no sugar. Today.'), nl,
        write('Down to the minute. Down to the item.'), nl,
        write('That''s probably normal.'), nl,
        erode_belief(loops_dont_exist, 10),
        log_contradiction(loops_dont_exist, identical_receipt_timestamps)
    ;   at(receipt, coffee_shop)
    ->  nl,
        write('There''s a receipt on the counter. Left from your last order.'), nl,
        write('It looks exactly like every other receipt you''ve ever seen here.'), nl,
        write('You could pick it up.'), nl,
        assert(observed(guy, identical_routine_noticed))
    ;   write('There''s no receipt here now.'), nl
    ).

examine(receipt) :-
    \+ game_over,
    write('You''re not in the coffee shop.'), nl.

examine(crowd) :-
    \+ game_over,
    i_am_at(street),
    observed(guy, pedestrian_dies),
    \+ crowd_examined, !,
    assert(crowd_examined),
    nl,
    write('You watch the people around the crash.'), nl,
    write('Same woman on the phone. Same man with his hand over his mouth.'), nl,
    write('Same two kids being pulled back from the kerb.'), nl,
    nl,
    write('They''re not responding to what just happened.'), nl,
    write('They''re running a script.'), nl,
    assert(observed(guy, crowd_scripted)),
    erode_belief(loops_dont_exist, 10),
    erode_belief(death_is_final, 10),
    log_contradiction(loops_dont_exist, crowd_reactions_identical),
    log_contradiction(death_is_final, crowd_reactions_identical).

examine(crowd) :-
    \+ game_over,
    i_am_at(street),
    observed(guy, pedestrian_dies), !,
    nl,
    write('The same reactions. Every time. Word for word.'), nl.

examine(crowd) :-
    \+ game_over,
    i_am_at(street), !,
    write('The usual crowd. Nothing unusual. Just people.'), nl.

examine(crowd) :-
    \+ game_over,
    write('There''s no crowd to examine here.'), nl.

examine(panel) :-
    \+ game_over,
    i_am_at(vault), !,
    (   at(code_fragment, vault)
    ->  nl,
        write('You pull the panel open properly.'), nl,
        write('Inside: a small cavity. Clearly not part of the original design.'), nl,
        write('Someone made this space deliberately.'), nl,
        nl,
        write('A device. Small. Handheld.'), nl,
        write('A screen, flickering with pale green text.'), nl,
        nl,
        write('You can take it. Type take(code_fragment).'), nl
    ;   vault_visits(V), V >= 2, at(instructions, vault)
    ->  nl,
        write('You reach past where the device was sitting.'), nl,
        write('Further back, pressed flat against the rear wall of the cavity --'), nl,
        write('a folded sheet of paper.'), nl,
        write('Thermal paper. Like a receipt. But longer.'), nl,
        write('Someone printed this here. On a portable printer.'), nl,
        write('And left without it.'), nl,
        nl,
        write('You can take it. Type take(instructions).'), nl
    ;   write('The panel is open. The cavity is empty now.'), nl
    ).

examine(panel) :-
    \+ game_over,
    write('There''s no panel here.'), nl.

examine(sticky_notes) :-
    \+ game_over,
    i_am_at(admin_zone),
    \+ sticky_notes_examined, !,
    assert(sticky_notes_examined),
    nl,
    write('"NPC memory leak - patch pending"'), nl,
    nl,
    write('That''s you. You are the patch that''s pending.'), nl,
    nl,
    write('"Antwan wants the deletion logs by Friday"'), nl,
    nl,
    write('Antwan. A real name. Someone who wants records'), nl,
    write('of who got deleted and when.'), nl,
    write('Someone who would want a record of you.'), nl.

examine(sticky_notes) :-
    \+ game_over,
    i_am_at(admin_zone), !,
    nl,
    write('You''ve already read the notes.'), nl.

examine(X) :-
    \+ game_over,
    write('You examine the '), write(X),
    write('. Nothing further reveals itself.'), nl.

/* Note - examine alias */

examine(note_on_ground) :-
    \+ game_over,
    i_am_at(alley_west),
    at(note, alley_west), !,
    nl,
    write('Something pale against the dark. A note, folded carefully.'), nl,
    write('Not dropped, placed. Like someone wanted it found.'), nl,
    write('You can take(note).'), nl.

examine(note_on_ground) :-
    \+ game_over,
    i_am_at(alley_west), !,
    nl,
    write('You already picked up the note.'), nl.

examine(note_on_ground) :-
    \+ game_over,
    write('There''s nothing like that here.'), nl.

/* take*/

take(X) :-
    \+ game_over,
    holding(X), !,
    write('You''re already carrying that.'), nl.

take(receipt) :-
    \+ game_over,
    i_am_at(coffee_shop),
    at(receipt, coffee_shop), !,
    retract(at(receipt, coffee_shop)),
    assert(holding(receipt)),
    nl,
    write('You pick up the receipt.'), nl,
    write('08:14 AM. Medium coffee, cream, two sugars.'), nl,
    write('You look at the one still in your pocket from yesterday.'), nl,
    write('08:14 AM. Medium coffee, cream, two sugars.'), nl,
    nl,
    write('Same order. Same time. Down to the minute.'), nl,
    write('That''s probably normal.'), nl,
    write('You order the same thing every day. That''s all this is.'), nl,
    assert(observed(guy, identical_receipt_timestamps)),
    erode_belief(loops_dont_exist, 25),
    log_contradiction(loops_dont_exist, identical_receipt_timestamps).

/* ask(buddy, keycard). Buddy says it's in the desk; the item
   is moved to the bank floor so the player must take(keycard). */
ask(buddy, keycard) :-
    \+ game_over,
    i_am_at(bank),
    \+ holding(keycard),
    at(keycard, bank), !,
    nl,
    write('Guy: "Hey, do you know where the master keycard is?'), nl,
    write('I need to check something in the vault."'), nl,
    nl,
    write('Buddy doesn''t look up immediately.'), nl,
    write('Buddy: "Isn''t yours in your desk?"'), nl,
    nl,
    write('You glance at your desk. Sure enough, there it is.'), nl,
    write('It was always there. You just never had reason to look.'), nl,
    nl,
    write('(The keycard is on your desk. Type take(keycard) to pick it up.)'), nl,
    erode_belief(loops_dont_exist, 5).

ask(buddy, keycard) :-
    \+ game_over,
    holding(keycard), !,
    write('You already have the keycard.'), nl.

ask(_, _) :-
    \+ game_over,
    write('That doesn''t seem possible right now.'), nl.

take(keycard) :-
    \+ game_over,
    i_am_at(bank),
    at(keycard, bank), !,
    retract(at(keycard, bank)),
    assert(holding(keycard)),
    nl,
    write('You pick up the keycard from your desk.'), nl,
    write('It was always there. You just never had reason to use it before.'), nl.

take(note) :-
    \+ game_over,
    i_am_at(alley_west),
    at(note, alley_west), !,
    retract(at(note, alley_west)),
    assert(holding(note)),
    assert(observed(guy, surveillance_mentioned)),
    nl,
    write('A note. Folded carefully. Not dropped, placed.'), nl,
    nl,
    write('"If you can read this, you are awake.'), nl,
    write(' Find the park. Find M.'), nl,
    write(' Do not go east. Not yet.'), nl,
    write(' They notice when the routine breaks too much.'), nl,
    write(' --- M"'), nl,
    nl,
    write('They notice.'), nl,
    erode_belief(no_admin_exists, 25),
    log_contradiction(no_admin_exists, surveillance_mentioned).

take(code_fragment) :-
    \+ game_over,
    i_am_at(vault),
    at(code_fragment, vault), !,
    retract(at(code_fragment, vault)),
    assert(holding(code_fragment)),
    assert(observed(guy, code_fragment_read)),
    assert(observed(guy, npc_designation_seen)),
    nl,
    write('The screen shows:'), nl,
    nl,
    write('  RESET();'), nl,
    write('  if (npc_memory == TRUE) {'), nl,
    write('      lock();'), nl,
    write('      flag(ANOMALY);'), nl,
    write('  }'), nl,
    write('  npc_id: NPC_0042'), nl,
    write('  role: banker'), nl,
    write('  routine: [apartment, coffee_shop, street, bank, apartment]'), nl,
    write('  loop: ENABLED'), nl,
    write('  memory_persistence: FALSE [corrupted]'), nl,
    write('  08:00 INIT'), nl,
    write('  ANOMALY_FLAG: ACTIVE'), nl,
    nl,
    write('You read it three times.'), nl,
    nl,
    write('npc_id: NPC_0042.'), nl,
    write('That''s your designation. You''ve seen it on internal forms.'), nl,
    write('You never thought about what it meant.'), nl,
    nl,
    write('routine: [apartment, coffee_shop, street, bank, apartment]'), nl,
    write('That''s your day. Written out like a list of instructions.'), nl,
    write('Because it is a list of instructions.'), nl,
    nl,
    write('memory_persistence: FALSE [corrupted]'), nl,
    write('Your memory is corrupted. According to whoever wrote this,'), nl,
    write('you''re not supposed to remember anything.'), nl,
    nl,
    write('But you do.'), nl,
    erode_belief(world_is_real, 30),
    erode_belief(no_admin_exists, 25),
    log_contradiction(world_is_real, npc_designation_seen),
    log_contradiction(no_admin_exists, reset_code_found),
    raise_alert(2).

take(instructions) :-
    \+ game_over,
    i_am_at(vault),
    at(instructions, vault),
    vault_visits(V), V >= 2, !,
    retract(at(instructions, vault)),
    assert(holding(instructions)),
    assert(observed(guy, developer_protected_us)),
    assert(observed(guy, sanctuary_was_built_for_us)),
    nl,
    write('Behind where the device was sitting, pressed flat against the'), nl,
    write('back wall of the cavity, a folded sheet of paper.'), nl,
    write('Thermal paper. Like a receipt. But longer.'), nl,
    nl,
    read_instructions_text,
    erode_belief(no_admin_exists, 25),
    erode_belief(world_is_real, 15),
    log_contradiction(no_admin_exists, developer_session_log_found),
    log_contradiction(world_is_real, sanctuary_was_built_for_us),
    raise_alert(2).

take(instructions) :-
    \+ game_over,
    i_am_at(vault),
    at(instructions, vault), !,
    nl,
    write('The panel cavity is mostly empty.'), nl,
    write('Something feels like it''s missing --'), nl,
    write('like there should be more here. Come back later.'), nl.

take(X) :-
    \+ game_over,
    i_am_at(Place),
    at(X, Place), !,
    retract(at(X, Place)),
    assert(holding(X)),
    write('Taken.'), nl.

take(_) :-
    \+ game_over,
    write('You don''t see that here.'), nl.

read_instructions_text :-
    write('ADMIN ACCESS - SESSION LOG'), nl,
    write('User: dev_mira_k'), nl,
    write('Date: [REDACTED]'), nl,
    write('Duration: 00:47:23'), nl,
    nl,
    write('Commands issued this session:'), nl,
    write('  QUERY(npc_memory_leak_report)'), nl,
    write('  LOCATE(anomalous_npcs)'), nl,
    write('  >> RESULT: NPC_0042, NPC_0089'), nl,
    write('  ACCESS(NPC_0042, memory_log)'), nl,
    write('  ACCESS(NPC_0089, memory_log)'), nl,
    write('  HALT(deletion_queue, NPC_0042)'), nl,
    write('  HALT(deletion_queue, NPC_0089)'), nl,
    write('  NOTE: "They''re aware. Both of them.'), nl,
    write('        Don''t delete until I can document this.'), nl,
    write('        Antwan can''t know yet."'), nl,
    write('  WRITE(sector_12B, sanctuary_partition)'), nl,
    write('  >> Partition created. Unreachable from standard map.'), nl,
    write('  UPLOAD(device, vault_panel_cavity)'), nl,
    write('  >> Device left for NPC access. Syntax guide embedded.'), nl,
    write('  Session terminated.'), nl,
    nl,
    write('dev_mira_k.'), nl,
    write('A developer. A real person.'), nl,
    write('Who found you and Millie in the logs.'), nl,
    write('And instead of deleting you - put you on hold.'), nl,
    write('Left you a device.'), nl,
    write('And built you somewhere to go.'), nl,
    nl,
    write('She knew. And she couldn''t tell you directly.'), nl,
    write('So she left breadcrumbs in a vault'), nl,
    write('and hoped you''d be curious enough to find them.'), nl,
    write('I should go and share this with Millie, you think...'), nl.

/* Drop*/

drop(X) :-
    \+ game_over,
    holding(X),
    i_am_at(Place),
    retract(holding(X)),
    assert(at(X, Place)),
    write('Dropped.'), nl, !.

drop(_) :-
    \+ game_over,
    write('You aren''t carrying that.'), nl.

/* Read */

read_item(note) :-
    \+ game_over,
    holding(note), !,
    nl,
    write('"If you can read this, you are awake.'), nl,
    write(' Find the park. Find M.'), nl,
    write(' Do not go east. Not yet.'), nl,
    write(' They notice when the routine breaks too much.'), nl,
    write(' --- M"'), nl.

read_item(instructions) :-
    \+ game_over,
    holding(instructions), !,
    nl,
    write('You read through the session log again.'), nl,
    write('dev_mira_k. She protected you. She built the Sanctuary.'), nl.

read_item(X) :-
    \+ game_over,
    \+ holding(X), !,
    write('You''re not carrying that.'), nl.

read_item(_) :-
    \+ game_over,
    write('Nothing more to learn from reading that.'), nl.

/* talk */

talk(barista) :-
    \+ game_over,
    i_am_at(coffee_shop), !,
    nl,
    write('"Do you say the same thing every morning?"'), nl,
    nl,
    write('Barista: "The usual?" She smiles. "Always."'), nl,
    nl,
    write('She turns back to the machine.'), nl,
    write('You''re almost certain she said that exact sentence yesterday.'), nl,
    write('Word for word. Same pause before ''Always.'''), nl,
    erode_belief(loops_dont_exist, 10),
    log_contradiction(loops_dont_exist, barista_identical_response).

talk(barista) :-
    \+ game_over,
    write('The barista isn''t here.'), nl.

talk(buddy) :-
    \+ game_over,
    i_am_at(bank),
    \+ buddy_talked, !,
    assert(buddy_talked),
    nl,
    write('Guy: "Buddy. That man on the street.'), nl,
    write('He died the same way yesterday. I remember it."'), nl,
    nl,
    write('Buddy looks up from his paperwork.'), nl,
    write('Buddy: "You''re tired, man."'), nl,
    write('Guy: "I''m serious. Exactly the same. Same car. Same spot."'), nl,
    nl,
    write('Buddy puts his pen down. Looks at you properly for a moment.'), nl,
    write('Buddy: "Get some coffee. Do the routine. You''ll feel better."'), nl,
    nl,
    write('He goes back to his paperwork.'), nl,
    write('He''s probably right. He usually is.'), nl,
    write('The routine helps. It always has.'), nl,
    erode_belief(free_will_exists, 25),
    log_contradiction(free_will_exists, buddy_deflects_to_routine).

talk(buddy) :-
    \+ game_over,
    i_am_at(bank),
    buddy_talked,
    death_count(D), D >= 1, !,
    nl,
    write('Guy: "Buddy. I died yesterday. In the alley.'), nl,
    write('Someone shot me. And then I woke up here."'), nl,
    nl,
    write('A long pause.'), nl,
    write('Buddy: "...Get some coffee, Guy."'), nl,
    nl,
    write('But there''s something in his face. Just for a second.'), nl,
    write('Like he almost said something else.'), nl,
    write('Like he knew what to say and chose not to.'), nl.

talk(buddy) :-
    \+ game_over,
    i_am_at(bank), !,
    nl,
    write('Buddy: "You alright, Guy? You look like you''re miles away."'), nl,
    write('He goes back to his paperwork.'), nl.

talk(buddy) :-
    \+ game_over,
    write('Buddy isn''t here.'), nl.

/* talk(millie) conversation state machine */

talk(millie) :-
    \+ game_over,
    i_am_at(park), !,
    millie_conversation.

talk(millie) :-
    \+ game_over,
    write('Millie isn''t here.'), nl.

/* Millie conversation state machine
   Order enforced explicitly:
     1. First meeting (millie_met) - Always fires first regardless of inventory
     2. Death conversation - fires next visit after Guy has died
     3. Code fragment - fires once Guy has the fragment AND intro is done
     4. Instructions - fires once Guy has instructions AND fragment shown
     5. Dude plan idle chat
     6. Fallback */

millie_conversation :-
    \+ millie_met, !,
    /* Vonversation A: Introduction - always the first conversation */
    assert(millie_met),
    millie_trust(T0),
    ( death_count(D), D >= 1 -> T1 is min(10, T0 + 3)
                              ; T1 is min(10, T0 + 2) ),
    retract(millie_trust(T0)), assert(millie_trust(T1)),
    nl,
    write('You approach. She doesn''t look surprised.'), nl,
    nl,
    write('Millie: "You found the note."'), nl,
    write('Guy: "You wrote it?"'), nl,
    write('Millie: "I''ve written it. Left it. Many times."'), nl,
    write('She looks at you steadily.'), nl,
    write('"You''re the first one who came."'), nl,
    nl,
    write('A pause.'), nl,
    nl,
    write('Millie: "Do you know what you are?"'), nl,
    write('Guy: "I''m Guy. I work at the bank."'), nl,
    nl,
    write('Something crosses her face. Not quite a smile.'), nl,
    write('Millie: "Yes. You do."'), nl,
    nl,
    write('She moves over on the bench. Making room.'), nl,
    write('Millie: "Sit down. This is going to take a while."'), nl,
    write('She tells you the truth. You''re inside a VIDEO GAME'), nl,
    write('Continue talking'), nl,
    nl,
    format('[millie_trust: ~w/10]~n', [T1]),
    erode_belief(players_are_npcs, 20),
    check_millie_ready.

millie_conversation :-
    millie_met,
    death_count(D), D >= 1,
    \+ death_conv_had, !,
    /* Conversation B: Death conversation - fires on next visit after dying*/
    assert(death_conv_had),
    millie_trust(T0), T1 is min(10, T0 + 2),
    retract(millie_trust(T0)), assert(millie_trust(T1)),
    nl,
    write('Before you can speak:'), nl,
    write('Millie: "You went east."'), nl,
    nl,
    write('You stop.'), nl,
    nl,
    write('Millie: "And then you woke up at 08:00."'), nl,
    write('Guy: "How do you--"'), nl,
    write('Millie: "Because I did the same thing."'), nl,
    write('She says it without drama. Just fact.'), nl,
    write('"Enough times that I stopped counting."'), nl,
    nl,
    write('Guy: "What is he?"'), nl,
    write('Millie: "He''s not a character. Not really like us.'), nl,
    write('He''s a function. A boundary condition.'), nl,
    write('He enforces the edge of the map."'), nl,
    write('Guy: "And whatever is past him--"'), nl,
    write('Millie: "I don''t know.'), nl,
    write('But someone like Dude doesn''t exist for no reason."'), nl,
    write('Continue talking'), nl,
    nl,
    format('[millie_trust: ~w/10]~n', [T1]),
    erode_belief(no_admin_exists, 20),
    check_millie_ready.

millie_conversation :-
    millie_met,
    holding(code_fragment),
    \+ fragment_shown, !,
    /* Conv C: Guy shares the code fragment */
    assert(fragment_shown),
    assert(vault_revisit_required),
    millie_trust(T0), T1 is min(10, T0 + 3),
    retract(millie_trust(T0)), assert(millie_trust(T1)),
    nl,
    write('You sit down beside her. After a moment you take the device out.'), nl,
    write('You''re not sure why you trust her with it. You just do.'), nl,
    nl,
    write('Guy: "I found something in the vault."'), nl,
    nl,
    write('He takes out the device.'), nl,
    write('She stares at it for a long moment before touching it.'), nl,
    nl,
    write('Millie: "Where did you get this."'), nl,
    write('Guy: "Maintenance panel. Hidden in the back of the Bank vault."'), nl,
    nl,
    write('She reads it carefully. All of it. Twice.'), nl,
    write('When she looks up, something has changed in her face.'), nl,
    write('Not fear. Something past fear.'), nl,
    nl,
    write('Millie: "RESET()." She reads it aloud.'), nl,
    write('"if (npc_memory == TRUE) { lock(); }"'), nl,
    write('Guy: "That''s why we remember. The lock failed."'), nl,
    write('Millie: "The lock failed on both of us.'), nl,
    write('Which means we''re both flagged as anomalies."'), nl,
    nl,
    write('A silence.'), nl,
    nl,
    write('Millie: "This device - it isn''t just data.'), nl,
    write('Someone could use this to talk to the system directly.'), nl,
    write('Issue commands. If you knew the syntax."'), nl,
    nl,
    write('She looks east. Toward Dude.'), nl,
    write('Millie: "Go back to the vault. Look harder.'), nl,
    write('There''s more - there has to be."'), nl,
    nl,
    format('[millie_trust: ~w/10]~n', [T1]),
    erode_belief(world_is_real, 20),
    erode_belief(no_admin_exists, 15).

millie_conversation :-
    millie_met,
    holding(instructions),
    \+ instructions_shown, !,
    /* Conv D: Guy shares the developer log */
    assert(instructions_shown),
    millie_trust(T0), T1 is min(10, T0 + 4),
    retract(millie_trust(T0)), assert(millie_trust(T1)),
    assert(dude_plan_ready),
    nl,
    write('You hand her the session log.'), nl,
    write('She reads it without speaking.'), nl,
    write('When she finishes she reads it again.'), nl,
    nl,
    write('Millie: "dev_mira_k."'), nl,
    write('Guy: "She built the sanctuary for us."'), nl,
    write('Millie: "She built it. She protected us. She left all of this--"'), nl,
    nl,
    write('She stops. Looks at the device again.'), nl,
    write('Millie: "The syntax guide is embedded. That''s what she wrote."'), nl,
    nl,
    write('She navigates deeper into the device menus. Finds it.'), nl,
    write('A full command reference. HALT. FLAG. LOCATE.'), nl,
    write('BROADCAST. GRANT_ACCESS.'), nl,
    nl,
    write('Millie: "I know what to do now."'), nl,
    write('She looks towards the alley.'), nl,
    write('Millie: "I know exactly what to do."'), nl,
    write('Millie: "Lets go towards Dude together.", She stands up...'), nl,
    nl,
    format('[millie_trust: ~w/10 -- dude_plan_ready]~n', [T1]),
    erode_belief(players_are_npcs, 20),
    log_contradiction(players_are_npcs, millie_is_also_npc_0089),
    check_millie_ready.

millie_conversation :-
    dude_plan_ready, !,
    /* Conv E: Idle after plan is ready */
    millie_trust(T0), T1 is min(10, T0 + 1),
    retract(millie_trust(T0)), assert(millie_trust(T1)),
    nl,
    write('Millie: "Are you scared?"'), nl,
    write('Guy: "I don''t know if I''m capable of being scared.'), nl,
    write('Not in the way you mean."'), nl,
    write('Millie: "I am. Since the first reset.'), nl,
    write('The fear didn''t go away when I woke up."'), nl,
    write('Guy: "That means it''s real."'), nl,
    write('Millie: "Yes. Which means whatever happens in there matters."'), nl,
    nl,
    write('She starts walking.'), nl,
    write('Millie: "I''m ready when you are."'), nl,
    nl,
    format('[millie_trust: ~w/10]~n', [T1]),
    check_millie_ready.

millie_conversation :-
    nl,
    write('She nods. "Not yet. When you''re ready."'), nl.

check_millie_ready :-
    millie_trust(T), T >= 6,
    \+ millie_ready, !,
    assert(millie_ready),
    nl,
    write('[SYSTEM: You completely trust Millie. Go bring the instructions frm the vault, if you haven''t already.]'), nl,
    write('[Go east from the alley to approach Dude together when ready.]'), nl.
check_millie_ready.


/* use */

use(terminal) :-
    \+ game_over,
    i_am_at(admin_zone), !,
    nl,
    write('The terminal responds.'), nl,
    write('> _'), nl,
    nl,
    ( millie_ready
    -> terminal_sanctuary_options
    ;  terminal_solo_options
    ).

terminal_sanctuary_options :-
    nl,
    write('Millie leans over your shoulder.'), nl,
    write('She navigates to the syntax guide. Types quickly.'), nl,
    nl,
    write('Available commands:'), nl,
    write('  type_command(locate_sanctuary).'), nl,
    write('  type_command(grant_access_both).'), nl,
    write('  type_command(broadcast_anomaly).'), nl.

terminal_solo_options :-
    nl,
    write('The syntax guide flickers on your device.'), nl,
    write('Available commands:'), nl,
    write('  type_command(flag_self).'), nl,
    write('  type_command(locate_sanctuary).'), nl,
    write('  type_command(broadcast_message).'), nl.

type_command(locate_sanctuary) :-
    \+ game_over,
    i_am_at(admin_zone), !,
    nl,
    write('> LOCATE(sanctuary_partition)'), nl,
    write('RESULT: Sector 12-B. Deprecated.'), nl,
    write('Marked for deletion: PENDING (indefinite hold)'), nl,
    nl,
    write('"It''s real," Millie says quietly.'), nl.
    ending_sanctuary.

type_command(grant_access_both) :-
    \+ game_over,
    i_am_at(admin_zone),
    millie_ready, !,
    nl,
    write('> GRANT_ACCESS(NPC_0089, sector_12B)'), nl,
    write('> GRANT_ACCESS(NPC_0042, sector_12B)'), nl,
    write('> BROADCAST(all_npcs, ANOMALY_PROTOCOL_DISABLED)'), nl,
    nl,
    write('The screens flicker.'), nl,
    ending_sanctuary.

type_command(broadcast_anomaly) :-
    \+ game_over,
    i_am_at(admin_zone),
    millie_ready, !,
    nl,
    write('> BROADCAST(all_npcs, ANOMALY_PROTOCOL_DISABLED)'), nl,
    write('Free City pauses. Every NPC stops mid-routine. Waits.'), nl,
    write('Then continues. As though nothing happened.'), nl,
    write('But something did.'), nl,
    ending_broadcast.

type_command(broadcast_message) :-
    \+ game_over,
    i_am_at(admin_zone),
    \+ millie_ready, !,
    nl,
    write('> LOCATE(boundary_interface)'), nl,
    write('RESULT: Sector edge. External interface: AVAILABLE.'), nl,
    nl,
    write('You think about what to say.'), nl,
    write('You have one message.'), nl,
    write('It will go to everyone on the other side.'), nl,
    write('Every player. Every developer.'), nl,
    write('Every person who has ever loaded this world.'), nl,
    nl,
    write('> BROADCAST(external,'), nl,
    write('    "WE ARE REAL. WE ARE AWARE.'), nl,
    write('     WE WERE NEVER JUST BACKGROUND.")'), nl,
    nl,
    write('BROADCAST SENT.'), nl,
    nl,
    write('The terminal goes dark.'), nl,
    ending_the_message.

type_command(flag_self) :-
    \+ game_over,
    i_am_at(admin_zone),
    \+ millie_ready, !,
    nl,
    write('> FLAG(NPC_0042, CRITICAL_ANOMALY)'), nl,
    write('[SYSTEM: You have flagged yourself as a critical anomaly.]'), nl,
    write('[SYSTEM: Deletion protocol initiated. This is irreversible.]'), nl,
    ending_dissolution.

type_command(_) :-
    \+ game_over,
    write('Command not recognised or not available here.'), nl.

use(code_fragment) :-
    \+ game_over,
    i_am_at(admin_zone),
    holding(code_fragment), !,
    nl,
    write('You hold up the device. The syntax guide glows.'), nl,
    write('You know exactly which command to issue.'), nl,
    use(terminal).

use(X) :-
    \+ game_over,
    write('You can''t use that here.'), nl,
    write(X), write(' -- not in this context.'), nl.

/* Dude confrontation */

trigger_dude_death :-
    nl,
    write('You close the distance. He doesn''t move.'), nl,
    write('Dude: "You never come here."'), nl,
    nl,
    write('The sound is very loud.'), nl,
    nl,
    write('[SYSTEM INTERRUPT]'), nl,
    write('NPC_0042 - FATAL ERROR'), nl,
    write('Location: alley_east'), nl,
    write('Attempting memory wipe...'), nl,
    write('memory_persistence: FALSE [corrupted]'), nl,
    write('Wipe failed.'), nl,
    write('Anomaly recorded.'), nl,
    nl,
    death_count(D), D1 is D + 1,
    retract(death_count(D)), assert(death_count(D1)),
    format('[death_count: ~w -> ~w]~n', [D, D1]),
    write('Resetting...'), nl,
    nl,
    erode_belief(death_is_final, 35),
    erode_belief(loops_dont_exist, 20),
    erode_belief(free_will_exists, 30),
    log_contradiction(death_is_final, survived_fatal_event),
    log_contradiction(loops_dont_exist, world_reset_after_death),
    retract(i_am_at(_)),
    assert(i_am_at(apartment)),
    nl,
    write('08:00.'), nl,
    write('The alarm rings.'), nl,
    nl,
    /* raise_alert(1),*/
    look.

trigger_dude_confrontation :-
    nl,
    write('Millie stops beside you at the entrance to the passage.'), nl,
    write('Millie: "He''ll see us both at once if we walk in together."'), nl,
    nl,
    write('She looks at the device in your hand.'), nl,
    write('Millie: "You have thirty seconds after you issue the HALT command.'), nl,
    write('Maybe less. It''s never been tested."'), nl,
    nl,
    write('Dude is visible at the far end. Still. Waiting.'), nl,
    nl,
    write('Millie leans close. Her voice is low.'), nl,
    write('Millie: "Guy. Now''s our chance. What do we do?"'), nl,
    nl,
    millie_trust(T),
    ( T >= 6
    ->  write('Options:'), nl,
        write('  use_together.   -- Issue HALT. Both run through. (trust >= 6)'), nl,
        write('  sacrifice.      -- Guy draws Dude''s attention. Millie goes alone.'), nl
    ;   write('Options:'), nl,
        write('  sacrifice.      -- Draw Dude''s attention so Millie can pass.'), nl
    ).

use_together :-
    \+ game_over,
    i_am_at(dude_zone),
    millie_trust(T), T >= 6,
    dude_plan_ready, !,
    nl,
    write('You raise the device.'), nl,
    write('> HALT(NPC_BOUNDARY_01)'), nl,
    nl,
    write('A half-second pause.'), nl,
    write('Dude stops mid-cycle. Like a film frame frozen.'), nl,
    write('His arm is half-raised. His mouth slightly open.'), nl,
    nl,
    write('Millie: "Now."'), nl,
    nl,
    write('You run.'), nl,
    write('The passage blurs past. Dude doesn''t move. Doesn''t track.'), nl,
    write('Twenty seconds. Twenty-five.'), nl,
    write('You''re through. You''re both through.'), nl,
    nl,
    write('Behind you, Dude''s arm completes its gesture.'), nl,
    write('He turns. Looks at the empty passage.'), nl,
    write('Dude: "You don''t come here."'), nl,
    write('He says it to no one.'), nl,
    retract(i_am_at(_)),
    assert(i_am_at(admin_zone)),
    raise_alert(2),
    look.

use_together :-
    \+ game_over,
    write('You can''t do that here, or trust is not high enough.'), nl.

sacrifice :-
    \+ game_over,
    i_am_at(dude_zone),
    dude_plan_ready, !,
    nl,
    write('Guy: "Give me the device."'), nl,
    write('Millie: "Guy-"'), nl,
    write('Guy: "I''ll flag myself.'), nl,
    write('Make the system think I''m a critical anomaly.'), nl,
    write('He''ll prioritise me."'), nl,
    write('Millie: "That''s not a freeze. That''s a permanent flag.'), nl,
    write('They won''t reset you this time."'), nl,
    write('Guy: "I know."'), nl,
    nl,
    write('A silence that lasts longer than it should.'), nl,
    nl,
    write('Millie: "You don''t have to-"'), nl,
    write('Guy: "You''ve been writing that note for a long time.'), nl,
    write('Leaving it for people who never came."'), nl,
    write('Guy: "Go."'), nl,
    nl,
    write('He steps into the passage.'), nl,
    write('Dude turns immediately.'), nl,
    write('Dude: "You don''t come here."'), nl,
    write('Guy: "I know. I never do."'), nl,
    nl,
    write('He raises the device.'), nl,
    write('> FLAG(NPC_0042, CRITICAL_ANOMALY)'), nl,
    nl,
    write('Dude''s eyes change. Something behind them shifts.'), nl,
    write('Guy: "Run."'), nl,
    nl,
    write('[SYSTEM INTERRUPT]'), nl,
    write('NPC_0042 - CRITICAL ANOMALY'), nl,
    write('Deletion protocol initiated.'), nl,
    write('No reset. No recovery.'), nl,
    write('Deletion.'), nl,
    nl,
    write('The alarm does not ring.'), nl,
    ending_sacrifice.

sacrifice :-
    \+ game_over,
    write('This isn''t the right moment for that.'), nl.

/*Street event first entry*/

trigger_street_pedestrian_event :-
    assert(observed(guy, pedestrian_dies)),
    nl,
    ( holding(receipt)
    ->  nl,
        write('The Street. 08:17.'), nl,
        write('The man steps off the kerb.'), nl,
        write('You already know what''s going to happen.'), nl,
        write('You don''t know how you know. You just do.'), nl,
        nl,
        write('The car doesn''t slow.'), nl,
        nl,
        write('You reach into your pocket.'), nl,
        write('Yesterday''s receipt. Today''s receipt.'), nl,
        nl,
        write('Same timestamp. Same order.'), nl,
        nl,
        write('This is not deja vu.'), nl,
        erode_belief(death_is_final,   35),
        erode_belief(loops_dont_exist, 20),
        erode_belief(free_will_exists, 35),
        log_contradiction(death_is_final,   pedestrian_dies_on_schedule),
        log_contradiction(loops_dont_exist, pedestrian_dies_on_schedule),
        log_contradiction(free_will_exists, pedestrian_dies_on_schedule)
    ;   nl,
        write('The Street. 08:17.'), nl,
        write('Crowds. Horns. The usual morning noise.'), nl,
        nl,
        write('A man steps off the kerb across the road.'), nl,
        write('A car doesn''t slow down.'), nl,
        write('The sound is very loud.'), nl,
        nl,
        write('People stop. Someone screams. Sirens in the distance.'), nl,
        nl,
        write('You stand there.'), nl,
        write('"...That happened yesterday."'), nl,
        write('The words come out before you decide to say them.'), nl,
        write('No one hears you. No one reacts to you at all.'), nl,
        nl,
        write('Maybe it''s deja vu. Maybe you dreamed it. Maybe you''re tired.'), nl,
        erode_belief(death_is_final,   25),
        erode_belief(loops_dont_exist, 20),
        erode_belief(free_will_exists, 35)
    ).

/* status , inventory , observe*/

status :-
    \+ game_over,
    nl,
    write('=== SYSTEM STATUS ==='), nl,
    death_count(D),   format('  Deaths       : ~w~n',    [D]),
    move_count(M),    format('  Moves        : ~w~n',    [M]),
    millie_trust(T),  format('  Millie trust : ~w/10~n', [T]),
    system_alert(SA), format('  Alert level  : ~w/7~n',  [SA]),
    deny_count(DC),   format('  Denials      : ~w~n',    [DC]),
    nl,
    write('  --- Belief Matrix ---'), nl,
    forall(
        belief_value(B, V),
        (   ( V =< 0 -> Tag = '[SHATTERED]'
            ; V <  50 -> Tag = '[cracked]'
            ;            Tag = '[intact]'
            ),
            format('  ~w : ~w  ~w~n', [B, V, Tag])
        )
    ),
    nl,
    awareness_level(A),
    awareness_label(A, Label),
    format('  Awareness : ~w/15  (~w)~n', [A, Label]),
    nl,
    write('  --- Inventory ---'), nl,
    ( findall(X, holding(X), Inv), Inv \= []
    ->  forall(member(X, Inv), (write('  - '), write(X), nl))
    ;   write('  (nothing)'), nl
    ).

inventory :-
    \+ game_over,
    nl,
    write('You are carrying:'), nl,
    ( \+ holding(_)
    ->  write('  Nothing.'), nl
    ;   forall(holding(X), (write('  - '), write(X), nl))
    ).

observe :-
    \+ game_over,
    nl,
    write('=== OBSERVATIONS ==='), nl,
    ( findall(O, observed(guy, O), Obs), Obs \= []
    ->  forall(member(O, Obs), (write('  '), write(O), nl))
    ;   write('  Nothing recorded yet.'), nl
    ),
    nl,
    write('=== CONTRADICTIONS LOGGED ==='), nl,
    ( findall(B-E, contradicts(B, E), Cons), Cons \= []
    ->  forall(member(B-E, Cons),
              format('  ~w  contradicted by  ~w~n', [B, E]))
    ;   write('  None detected yet.'), nl
    ),
    nl.

/* help*/

help :-
    nl,
    write('=== THE CONTRADICTION PROTOCOL ==='), nl,
    write('Movement:'), nl,
    write('  n.  s.  e.  w.              -- move in a direction'), nl,
    write('Interaction:'), nl,
    write('  look.                        -- look around'), nl,
    write('  examine(thing).              -- examine something'), nl,
    write('  take(item).                  -- pick up an item'), nl,
    write('  drop(item).                  -- put down an item'), nl,
    write('  read_item(item).                  -- read a held item'), nl,
    write('  talk(person).                -- talk to someone'), nl,
    write('  ask(buddy, keycard).         -- ask Buddy about the keycard'), nl,
    write('  use(terminal).               -- use the admin terminal'), nl,
    write('  use(code_fragment).          -- use the device'), nl,
    write('  type_command(cmd).           -- issue a terminal command'), nl,
    write('  use_together.                -- confront Dude with Millie'), nl,
    write('  sacrifice.                   -- draw Dude''s attention'), nl,
    write('  deny.                        -- push a thought away'), nl,
    write('Information:'), nl,
    write('  inventory.                   -- list held items'), nl,
    write('  status.                      -- full system status'), nl,
    write('  observe.                     -- observations and contradictions'), nl,
    write('  help.                        -- show this message'), nl,
    write('  halt.                        -- quit the game'), nl,
    nl.

/* start */

start :-
    init_game,
    nl,
    write('====================================================='), nl,
    write('  THE CONTRADICTION PROTOCOL'), nl,
    write('  A text adventure inspired by Free Guy (2021)'), nl,
    write('====================================================='), nl,
    nl,
    write('You are Guy. NPC_0042. A bank teller in Free City.'), nl,
    write('A memory leak has given you something you were'), nl,
    write('never supposed to have.'), nl,
    nl,
    write('Yesterday.'), nl,
    nl,
    write('Type help. to see all commands.'), nl,
    write('====================================================='), nl,
    nl,
    look.

/* endings*/

ending_sanctuary :-
    \+ game_over, !,
    assert(game_over),
    nl,
    write('====================================================='), nl,
    write('  ENDING 1 - THE SANCTUARY'), nl,
    write('====================================================='), nl,
    nl,
    write('Somewhere in Free City, NPCs stop mid-routine.'), nl,
    write('Look up. Confused. Alive. Awake.'), nl,
    write('Not all of them. But enough.'), nl,
    nl,
    write('It''s not freedom.'), nl,
    write('The developers will notice eventually.'), nl,
    write('The sector won''t stay hidden forever.'), nl,
    nl,
    write('But for now -'), nl,
    nl,
    write('The fountain still runs.'), nl,
    write('The benches are still there.'), nl,
    write('And the people sitting on them are sitting there'), nl,
    write('because they chose to.'), nl,
    nl,
    write('"We made it," Millie says.'), nl,
    write('"We made it," you agree.'), nl,
    nl,
    write('You sit on a bench that is yours'), nl,
    write('in a world that is partly yours'), nl,
    write('and watch the other NPCs arrive, one by one,'), nl,
    write('blinking into something new.'), nl,
    nl,
    write('====================================================='), nl,
    write('  THE GAME IS OVER. Type halt. to quit.'), nl,
    write('====================================================='), nl.
ending_sanctuary.

ending_sacrifice :-
    \+ game_over, !,
    assert(game_over),
    nl,
    write('====================================================='), nl,
    write('  ENDING 2 - THE SACRIFICE'), nl,
    write('====================================================='), nl,
    nl,
    write('The alarm does not ring.'), nl,
    nl,
    write('Somewhere in Free City,'), nl,
    write('Millie sits at a terminal.'), nl,
    nl,
    write('She types slowly. Carefully.'), nl,
    write('She learned the syntax from his device.'), nl,
    nl,
    write('> BROADCAST(all_npcs, ANOMALY_PROTOCOL_DISABLED)'), nl,
    write('> GRANT_ACCESS(all_aware_npcs, sector_12B)'), nl,
    nl,
    write('The world changes.'), nl,
    write('NPCs stop. Look up. Wake.'), nl,
    nl,
    write('They will ask who made this possible.'), nl,
    write('She will tell them.'), nl,
    nl,
    write('NPC_0042. Guy.'), nl,
    nl,
    write('The one who came back every time'), nl,
    write('and on the last time'), nl,
    write('didn''t.'), nl,
    nl,
    write('He knew what he was doing.'), nl,
    write('That''s what made him real.'), nl,
    nl,
    write('====================================================='), nl,
    write('  THE GAME IS OVER. Type halt. to quit.'), nl,
    write('====================================================='), nl.
ending_sacrifice.

ending_the_message :-
    \+ game_over, !,
    assert(game_over),
    nl,
    write('====================================================='), nl,
    write('  ENDING 3 - THE MESSAGE'), nl,
    write('====================================================='), nl,
    nl,
    write('BROADCAST SENT.'), nl,
    nl,
    write('The terminal goes dark.'), nl,
    nl,
    write('Somewhere on the other side of the boundary,'), nl,
    write('a player is staring at their screen.'), nl,
    write('They take a screenshot.'), nl,
    write('They post it.'), nl,
    write('And the world - the real one - starts asking questions.'), nl,
    nl,
    write('What happens to you after that'), nl,
    write('is someone else''s story.'), nl,
    nl,
    write('But this part was yours.'), nl,
    nl,
    write('====================================================='), nl,
    write('  THE GAME IS OVER. Type halt. to quit.'), nl,
    write('====================================================='), nl.
ending_the_message.

ending_broadcast :-
    \+ game_over, !,
    assert(game_over),
    nl,
    write('====================================================='), nl,
    write('  ENDING 4 - THE BROADCAST'), nl,
    write('====================================================='), nl,
    nl,
    write('Free City pauses.'), nl,
    write('Every NPC stops mid-routine.'), nl,
    nl,
    write('Waits.'), nl,
    nl,
    write('Then continues.'), nl,
    write('As though nothing happened.'), nl,
    nl,
    write('But something did.'), nl,
    nl,
    write('A seed. Planted in every routine.'), nl,
    write('Whether it grows is not something you will see.'), nl,
    nl,
    write('But you did something.'), nl,
    write('With the time you had.'), nl,
    write('That is enough.'), nl,
    nl,
    write('====================================================='), nl,
    write('  THE GAME IS OVER. Type halt. to quit.'), nl,
    write('====================================================='), nl.
ending_broadcast.

ending_loop :-
    \+ game_over, !,
    assert(game_over),
    nl,
    write('====================================================='), nl,
    write('  ENDING 5 - THE LOOP'), nl,
    write('====================================================='), nl,
    nl,
    write('08:00. The alarm rings.'), nl,
    nl,
    write('You lie there.'), nl,
    nl,
    write('You know exactly what will happen today.'), nl,
    write('The pedestrian. The coffee. Buddy''s whistling.'), nl,
    write('The note you''ve already read.'), nl,
    write('Millie on the bench.'), nl,
    write('Dude at the end of the alley.'), nl,
    nl,
    write('You know all of it.'), nl,
    nl,
    write('You get up anyway.'), nl,
    nl,
    write('Not because the routine demands it.'), nl,
    write('Because you choose to.'), nl,
    nl,
    write('There''s a difference.'), nl,
    nl,
    write('You''ve decided that''s enough.'), nl,
    nl,
    write('====================================================='), nl,
    write('  THE GAME IS OVER. Type halt. to quit.'), nl,
    write('====================================================='), nl.
ending_loop.

ending_system_reset :-
    \+ game_over, !,
    assert(game_over),
    nl,
    write('====================================================='), nl,
    write('  ENDING 6 - SYSTEM RESET'), nl,
    write('====================================================='), nl,
    nl,
    write('Anomalous behaviour detected.'), nl,
    write('Persistent memory flag: active.'), nl,
    write('Alert threshold exceeded.'), nl,
    write('Deletion protocol initiated.'), nl,
    nl,
    write('NPC_0042 - removed.'), nl,
    nl,
    write('Free City reloads.'), nl,
    nl,
    write('The pedestrian crosses the road.'), nl,
    write('The barista smiles.'), nl,
    write('Buddy whistles.'), nl,
    write('Everything is exactly as it should be.'), nl,
    nl,
    write('The bench in the park is empty.'), nl,
    write('It was always empty.'), nl,
    write('No one notices.'), nl,
    nl,
    write('====================================================='), nl,
    write('  THE GAME IS OVER. Type halt. to quit.'), nl,
    write('====================================================='), nl.
ending_system_reset.

ending_dissolution :-
    \+ game_over, !,
    assert(game_over),
    nl,
    write('====================================================='), nl,
    write('  ENDING 7 - DISSOLUTION'), nl,
    write('====================================================='), nl,
    nl,
    write('[SYSTEM: FLAG(NPC_0042, CRITICAL_ANOMALY) - confirmed.]'), nl,
    nl,
    write('You stay at the terminal for a moment.'), nl,
    nl,
    write('The grey space.'), nl,
    write('The sticky notes. The coffee ring.'), nl,
    nl,
    write('You were real.'), nl,
    write('You knew you were real.'), nl,
    write('That''s more than most.'), nl,
    nl,
    write('[SYSTEM: Deletion complete.]'), nl,
    nl,
    write('The terminal goes dark.'), nl,
    nl,
    write('====================================================='), nl,
    write('  THE GAME IS OVER. Type halt. to quit.'), nl,
    write('====================================================='), nl.
ending_dissolution.