/* ── Trainerkarriere: Ereignisse ───────────────────────────────────────
   Zwei Pools, beide über dasselbe Ereignissystem wie die
   Spielerkarriere:

     c_…    allgemeine Trainerereignisse — kommen alle ein bis zwei
            Saisons, dafür mit spürbaren Folgen
     cp_…   Pressekonferenzen — fast jede Saison eine, die Antwort
            wirkt auf Vorstandsvertrauen, Fanstimmung und Kabine

   Die Präfixe sind nicht Kosmetik: über sie zieht die Phasenmaschine
   gezielt aus dem einen oder dem anderen Pool.                       */

window.FKC = window.FKC || {};
FKC.data = FKC.data || {};

(function (FKC) {
  'use strict';

  var K = function (id, part) { return 'ev.' + id + '.' + part; };

  var lastSeason = function (g) {
    return g.career.seasons.length ? g.career.seasons[g.career.seasons.length - 1] : null;
  };
  var clubName = function (g) {
    var c = FKC.state.club();
    if (c) return c.name;
    if (g.national && g.national.teamId) return FKC.data.nationName(g.national.teamId);
    return '';
  };
  var starName = function (g) {
    var s = FKC.coachSquad.star(g);
    return s ? s.name : FKC.t('csquad.aPlayer');
  };
  var hasSquad = function (g) {
    return g.career.phase === 'club' && (g.squad.players || []).length > 4;
  };

  /* ══ Allgemeine Trainerereignisse ═════════════════════════════════ */

  var coach = [

    /* ── Vorstandsdruck nach einer schlechten Serie ──────────────── */
    {
      id: 'c_board_pressure', category: 'board', phases: ['club'],
      weight: 12, cooldown: 2,
      when: function (g) { return g.standing.pressure >= 42 || g.standing.boardTrust <= 45; },
      weightMod: function (g) { return 1 + g.standing.pressure / 45; },
      textParams: function (g) { return { club: clubName(g) }; },
      title: K('c_board_pressure', 'title'), text: K('c_board_pressure', 'text'),
      choices: [
        { id: 'promise', label: K('c_board_pressure', 'promise'),
          desc: K('c_board_pressure', 'promise_d'), risk: 'high',
          outcomes: [
            { p: 0.45, text: K('c_board_pressure', 'promise_ok'),
              pMod: function (g) { return 0.5 + g.attributes.media / 80; },
              effects: [{ type: 'boardTrust', delta: 18 }, { type: 'pressure', delta: -20 },
                        { type: 'attr', key: 'media', delta: 2 }] },
            { p: 0.55, text: K('c_board_pressure', 'promise_bad'),
              effects: [{ type: 'boardTrust', delta: -10 }, { type: 'pressure', delta: 16 }] }
          ] },
        { id: 'plan', label: K('c_board_pressure', 'plan'),
          desc: K('c_board_pressure', 'plan_d'), risk: 'medium',
          outcomes: [
            { p: 0.65, text: K('c_board_pressure', 'plan_ok'),
              pMod: function (g) { return 0.5 + g.attributes.tactics / 90; },
              effects: [{ type: 'boardTrust', delta: 10 }, { type: 'pressure', delta: -10 },
                        { type: 'growthBonus', points: 3 }] },
            { p: 0.35, text: K('c_board_pressure', 'plan_bad'),
              effects: [{ type: 'boardTrust', delta: -4 }, { type: 'pressure', delta: 6 }] }
          ] },
        { id: 'blame', label: K('c_board_pressure', 'blame'),
          desc: K('c_board_pressure', 'blame_d'), risk: 'high',
          outcomes: [
            { p: 0.3, text: K('c_board_pressure', 'blame_ok'),
              effects: [{ type: 'boardTrust', delta: 6 }, { type: 'budget', delta: 3000000 },
                        { type: 'dressingRoom', delta: -8 }] },
            { p: 0.7, text: K('c_board_pressure', 'blame_bad'),
              effects: [{ type: 'boardTrust', delta: -18 }, { type: 'pressure', delta: 20 },
                        { type: 'dressingRoom', delta: -6 }] }
          ] }
      ]
    },

    /* ── Konflikt mit einem prominenten Spieler ──────────────────── */
    {
      id: 'c_star_conflict', category: 'squad', phases: ['club'],
      weight: 11, cooldown: 3,
      when: hasSquad,
      textParams: function (g) { return { star: starName(g), club: clubName(g) }; },
      title: K('c_star_conflict', 'title'), text: K('c_star_conflict', 'text'),
      choices: [
        { id: 'bench', label: K('c_star_conflict', 'bench'),
          desc: K('c_star_conflict', 'bench_d'), risk: 'high',
          outcomes: [
            { p: 0.45, text: K('c_star_conflict', 'bench_ok'),
              pMod: function (g) { return 0.4 + g.attributes.manMgmt / 75; },
              effects: [{ type: 'dressingRoom', delta: 14 }, { type: 'attr', key: 'manMgmt', delta: 2 },
                        { type: 'squadMorale', delta: 4 }] },
            { p: 0.55, text: K('c_star_conflict', 'bench_bad'),
              effects: [{ type: 'dressingRoom', delta: -14 }, { type: 'squadMorale', delta: -8 },
                        { type: 'fanMood', delta: -10 }, { type: 'pressure', delta: 10 }] }
          ] },
        { id: 'talk', label: K('c_star_conflict', 'talk'),
          desc: K('c_star_conflict', 'talk_d'), risk: 'medium',
          outcomes: [
            { p: 0.62, text: K('c_star_conflict', 'talk_ok'),
              pMod: function (g) { return 0.45 + g.attributes.manMgmt / 80; },
              effects: [{ type: 'dressingRoom', delta: 9 }, { type: 'squadMorale', delta: 7 }] },
            { p: 0.38, text: K('c_star_conflict', 'talk_bad'),
              effects: [{ type: 'dressingRoom', delta: -5 }, { type: 'squadMorale', delta: -4 }] }
          ] },
        { id: 'sell', label: K('c_star_conflict', 'sell'),
          desc: K('c_star_conflict', 'sell_d'), risk: 'high',
          outcomes: [
            { p: 0.5, text: K('c_star_conflict', 'sell_ok'),
              effects: [{ type: 'budget', delta: 8000000 }, { type: 'dressingRoom', delta: 6 },
                        { type: 'fanMood', delta: -14 }] },
            { p: 0.5, text: K('c_star_conflict', 'sell_bad'),
              effects: [{ type: 'fanMood', delta: -18 }, { type: 'boardTrust', delta: -10 },
                        { type: 'pressure', delta: 14 }] }
          ] }
      ]
    },

    /* ── Abwerbung während laufendem Vertrag ─────────────────────── */
    {
      id: 'c_poached', category: 'career', phases: ['club'],
      weight: 8, cooldown: 4,
      when: function (g) {
        var l = lastSeason(g);
        return !!g.status.contract && g.status.contract.yearsLeft >= 2 &&
               g.status.reputation >= 45 && l && l.grade >= 1;
      },
      textParams: function (g) { return { club: clubName(g) }; },
      title: K('c_poached', 'title'), text: K('c_poached', 'text'),
      choices: [
        { id: 'listen', label: K('c_poached', 'listen'),
          desc: K('c_poached', 'listen_d'), risk: 'high',
          outcomes: [
            { p: 0.5, text: K('c_poached', 'listen_ok'),
              effects: [{ type: 'reputation', delta: 8 }, { type: 'boardTrust', delta: -12 },
                        { type: 'flag', key: 'wantsOut', value: true }] },
            { p: 0.5, text: K('c_poached', 'listen_bad'),
              effects: [{ type: 'boardTrust', delta: -16 }, { type: 'fanMood', delta: -12 },
                        { type: 'pressure', delta: 12 }] }
          ] },
        { id: 'leverage', label: K('c_poached', 'leverage'),
          desc: K('c_poached', 'leverage_d'), risk: 'medium',
          outcomes: [
            { p: 0.55, text: K('c_poached', 'leverage_ok'),
              pMod: function (g) { return 0.4 + g.attributes.media / 80; },
              effects: [{ type: 'budget', delta: 6000000 }, { type: 'boardTrust', delta: 6 }] },
            { p: 0.45, text: K('c_poached', 'leverage_bad'),
              effects: [{ type: 'boardTrust', delta: -10 }, { type: 'pressure', delta: 8 }] }
          ] },
        { id: 'commit', label: K('c_poached', 'commit'),
          desc: K('c_poached', 'commit_d'), risk: 'low',
          result: K('c_poached', 'commit_r'),
          effects: [{ type: 'boardTrust', delta: 14 }, { type: 'fanMood', delta: 16 },
                    { type: 'dressingRoom', delta: 6 }, { type: 'hidden', key: 'loyalty', delta: 8 }] }
      ]
    },

    /* ── Streit im Trainerstab ───────────────────────────────────── */
    {
      id: 'c_staff_row', category: 'staff', phases: ['club', 'national'],
      weight: 9, cooldown: 4,
      title: K('c_staff_row', 'title'), text: K('c_staff_row', 'text'),
      choices: [
        { id: 'fire', label: K('c_staff_row', 'fire'),
          desc: K('c_staff_row', 'fire_d'), risk: 'high',
          outcomes: [
            { p: 0.45, text: K('c_staff_row', 'fire_ok'),
              effects: [{ type: 'dressingRoom', delta: 8 }, { type: 'attr', key: 'tactics', delta: 2 }] },
            { p: 0.55, text: K('c_staff_row', 'fire_bad'),
              effects: [{ type: 'dressingRoom', delta: -12 }, { type: 'attr', key: 'tactics', delta: -2 },
                        { type: 'pressure', delta: 10 }] }
          ] },
        { id: 'listen', label: K('c_staff_row', 'listen'),
          desc: K('c_staff_row', 'listen_d'), risk: 'medium',
          outcomes: [
            { p: 0.6, text: K('c_staff_row', 'listen_ok'),
              effects: [{ type: 'attr', key: 'tactics', delta: 3 }, { type: 'dressingRoom', delta: 5 },
                        { type: 'growthBonus', points: 3 }] },
            { p: 0.4, text: K('c_staff_row', 'listen_bad'),
              effects: [{ type: 'philosophy', delta: -6 }, { type: 'dressingRoom', delta: -3 }] }
          ] },
        { id: 'ignore', label: K('c_staff_row', 'ignore'),
          desc: K('c_staff_row', 'ignore_d'), risk: 'medium',
          outcomes: [
            { p: 0.5, text: K('c_staff_row', 'ignore_ok'),
              effects: [{ type: 'philosophy', delta: 4 }] },
            { p: 0.5, text: K('c_staff_row', 'ignore_bad'),
              effects: [{ type: 'dressingRoom', delta: -9 }, { type: 'squadMorale', delta: -5 }] }
          ] }
      ]
    },

    /* ── Verletzungswelle ────────────────────────────────────────── */
    {
      id: 'c_injury_wave', category: 'squad', phases: ['club'],
      weight: 9, cooldown: 3,
      when: hasSquad,
      title: K('c_injury_wave', 'title'), text: K('c_injury_wave', 'text'),
      choices: [
        { id: 'youth', label: K('c_injury_wave', 'youth'),
          desc: K('c_injury_wave', 'youth_d'), risk: 'medium',
          outcomes: [
            { p: 0.55, text: K('c_injury_wave', 'youth_ok'),
              pMod: function (g) { return 0.4 + g.attributes.youth / 75; },
              effects: [{ type: 'squadInjury', count: 3, weeks: 10 },
                        { type: 'attr', key: 'youth', delta: 3 },
                        { type: 'fanMood', delta: 8 }, { type: 'squadMorale', delta: 5 }] },
            { p: 0.45, text: K('c_injury_wave', 'youth_bad'),
              effects: [{ type: 'squadInjury', count: 4, weeks: 12 },
                        { type: 'pressure', delta: 12 }, { type: 'squadMorale', delta: -6 }] }
          ] },
        { id: 'buy', label: K('c_injury_wave', 'buy'),
          desc: K('c_injury_wave', 'buy_d'), risk: 'medium',
          outcomes: [
            { p: 0.6, text: K('c_injury_wave', 'buy_ok'),
              effects: [{ type: 'squadInjury', count: 3, weeks: 9 },
                        { type: 'budget', delta: -4000000 }, { type: 'boardTrust', delta: -3 }] },
            { p: 0.4, text: K('c_injury_wave', 'buy_bad'),
              effects: [{ type: 'squadInjury', count: 4, weeks: 11 },
                        { type: 'budget', delta: -6000000 }, { type: 'boardTrust', delta: -9 }] }
          ] },
        { id: 'grind', label: K('c_injury_wave', 'grind'),
          desc: K('c_injury_wave', 'grind_d'), risk: 'high',
          outcomes: [
            { p: 0.4, text: K('c_injury_wave', 'grind_ok'),
              effects: [{ type: 'squadInjury', count: 2, weeks: 8 },
                        { type: 'dressingRoom', delta: 10 }, { type: 'squadMorale', delta: 8 }] },
            { p: 0.6, text: K('c_injury_wave', 'grind_bad'),
              effects: [{ type: 'squadInjury', count: 5, weeks: 14 },
                        { type: 'squadMorale', delta: -10 }, { type: 'pressure', delta: 14 }] }
          ] }
      ]
    },

    /* ── Lob in den Medien ───────────────────────────────────────── */
    {
      id: 'c_media_praise', category: 'media', phases: ['club', 'national'],
      weight: 8, cooldown: 3,
      when: function (g) { var l = lastSeason(g); return l && l.grade >= 1; },
      textParams: function (g) { return { club: clubName(g) }; },
      title: K('c_media_praise', 'title'), text: K('c_media_praise', 'text'),
      choices: [
        { id: 'humble', label: K('c_media_praise', 'humble'),
          desc: K('c_media_praise', 'humble_d'), risk: 'low',
          result: K('c_media_praise', 'humble_r'),
          effects: [{ type: 'dressingRoom', delta: 10 }, { type: 'squadMorale', delta: 6 },
                    { type: 'reputation', delta: 2 }] },
        { id: 'claim', label: K('c_media_praise', 'claim'),
          desc: K('c_media_praise', 'claim_d'), risk: 'medium',
          outcomes: [
            { p: 0.55, text: K('c_media_praise', 'claim_ok'),
              pMod: function (g) { return 0.4 + g.attributes.media / 75; },
              effects: [{ type: 'reputation', delta: 10 }, { type: 'attr', key: 'media', delta: 3 }] },
            { p: 0.45, text: K('c_media_praise', 'claim_bad'),
              effects: [{ type: 'dressingRoom', delta: -10 }, { type: 'reputation', delta: 4 }] }
          ] },
        { id: 'demand', label: K('c_media_praise', 'demand'),
          desc: K('c_media_praise', 'demand_d'), risk: 'high',
          outcomes: [
            { p: 0.45, text: K('c_media_praise', 'demand_ok'),
              effects: [{ type: 'budget', delta: 10000000 }, { type: 'fanMood', delta: 8 }] },
            { p: 0.55, text: K('c_media_praise', 'demand_bad'),
              effects: [{ type: 'boardTrust', delta: -14 }, { type: 'pressure', delta: 10 }] }
          ] }
      ]
    },

    /* ── Kritik in den Medien ────────────────────────────────────── */
    {
      id: 'c_media_criticism', category: 'media', phases: ['club', 'national'],
      weight: 10, cooldown: 3,
      when: function (g) { var l = lastSeason(g); return !l || l.grade <= 0; },
      weightMod: function (g) { return 1 + FKC.data.coachTraitBonus(g, 'mediaRisk'); },
      textParams: function (g) { return { club: clubName(g) }; },
      title: K('c_media_criticism', 'title'), text: K('c_media_criticism', 'text'),
      choices: [
        { id: 'attack', label: K('c_media_criticism', 'attack'),
          desc: K('c_media_criticism', 'attack_d'), risk: 'high',
          outcomes: [
            { p: 0.4, text: K('c_media_criticism', 'attack_ok'),
              pMod: function (g) { return 0.4 + g.attributes.media / 70; },
              effects: [{ type: 'dressingRoom', delta: 14 }, { type: 'fanMood', delta: 10 },
                        { type: 'pressure', delta: -10 }] },
            { p: 0.6, text: K('c_media_criticism', 'attack_bad'),
              effects: [{ type: 'boardTrust', delta: -12 }, { type: 'pressure', delta: 14 },
                        { type: 'money', delta: -40000 }] }
          ] },
        { id: 'own', label: K('c_media_criticism', 'own'),
          desc: K('c_media_criticism', 'own_d'), risk: 'low',
          result: K('c_media_criticism', 'own_r'),
          effects: [{ type: 'boardTrust', delta: 8 }, { type: 'pressure', delta: -6 },
                    { type: 'fanMood', delta: -4 }, { type: 'attr', key: 'media', delta: 2 }] },
        { id: 'silence', label: K('c_media_criticism', 'silence'),
          desc: K('c_media_criticism', 'silence_d'), risk: 'medium',
          outcomes: [
            { p: 0.5, text: K('c_media_criticism', 'silence_ok'),
              effects: [{ type: 'dressingRoom', delta: 6 }, { type: 'pressure', delta: -4 }] },
            { p: 0.5, text: K('c_media_criticism', 'silence_bad'),
              effects: [{ type: 'fanMood', delta: -12 }, { type: 'pressure', delta: 8 }] }
          ] }
      ]
    },

    /* ── Talent aus der eigenen Jugend ───────────────────────────── */
    {
      id: 'c_youth_gem', category: 'youth', phases: ['club'],
      weight: 8, cooldown: 3,
      when: hasSquad,
      title: K('c_youth_gem', 'title'), text: K('c_youth_gem', 'text'),
      choices: [
        { id: 'throw', label: K('c_youth_gem', 'throw'),
          desc: K('c_youth_gem', 'throw_d'), risk: 'medium',
          outcomes: [
            { p: 0.55, text: K('c_youth_gem', 'throw_ok'),
              pMod: function (g) { return 0.4 + g.attributes.youth / 70; },
              effects: [{ type: 'attr', key: 'youth', delta: 4 }, { type: 'fanMood', delta: 12 },
                        { type: 'boardTrust', delta: 6 }] },
            { p: 0.45, text: K('c_youth_gem', 'throw_bad'),
              effects: [{ type: 'pressure', delta: 8 }, { type: 'fanMood', delta: -5 }] }
          ] },
        { id: 'loan', label: K('c_youth_gem', 'loan'),
          desc: K('c_youth_gem', 'loan_d'), risk: 'low',
          result: K('c_youth_gem', 'loan_r'),
          effects: [{ type: 'attr', key: 'youth', delta: 2 }, { type: 'growthBonus', points: 2 }] },
        { id: 'sell', label: K('c_youth_gem', 'sell'),
          desc: K('c_youth_gem', 'sell_d'), risk: 'medium',
          outcomes: [
            { p: 0.6, text: K('c_youth_gem', 'sell_ok'),
              effects: [{ type: 'budget', delta: 7000000 }, { type: 'boardTrust', delta: 8 },
                        { type: 'fanMood', delta: -10 }] },
            { p: 0.4, text: K('c_youth_gem', 'sell_bad'),
              effects: [{ type: 'budget', delta: 4000000 }, { type: 'fanMood', delta: -16 },
                        { type: 'attr', key: 'youth', delta: -2 }] }
          ] }
      ]
    },

    /* ── Zweifel an der eigenen Handschrift ──────────────────────── */
    {
      id: 'c_philosophy_doubt', category: 'tactics', phases: ['club', 'national'],
      weight: 7, cooldown: 5,
      when: function (g) {
        var l = lastSeason(g);
        return l && l.grade <= 0 && g.career.seasons.length >= 2;
      },
      textParams: function (g) {
        return { philosophy: FKC.t('philosophy.' + g.hidden.philosophy) };
      },
      title: K('c_philosophy_doubt', 'title'), text: K('c_philosophy_doubt', 'text'),
      choices: [
        { id: 'double', label: K('c_philosophy_doubt', 'double'),
          desc: K('c_philosophy_doubt', 'double_d'), risk: 'medium',
          result: K('c_philosophy_doubt', 'double_r'),
          effects: [{ type: 'philosophy', delta: 8 }, { type: 'dressingRoom', delta: -4 },
                    { type: 'flag', key: 'philosophyKept', value: true }] },
        { id: 'adapt', label: K('c_philosophy_doubt', 'adapt'),
          desc: K('c_philosophy_doubt', 'adapt_d'), risk: 'medium',
          outcomes: [
            { p: 0.55, text: K('c_philosophy_doubt', 'adapt_ok'),
              effects: [{ type: 'attr', key: 'tactics', delta: 4 },
                        { type: 'philosophy', delta: -8 }, { type: 'dressingRoom', delta: 8 }] },
            { p: 0.45, text: K('c_philosophy_doubt', 'adapt_bad'),
              effects: [{ type: 'philosophy', delta: -14 }, { type: 'pressure', delta: 8 }] }
          ] },
        { id: 'switch', label: K('c_philosophy_doubt', 'switch'),
          desc: K('c_philosophy_doubt', 'switch_d'), risk: 'high',
          outcomes: [
            { p: 0.4, text: K('c_philosophy_doubt', 'switch_ok'),
              effects: [{ type: 'attr', key: 'tactics', delta: 5 }],
              after: function (g) {
                /* Eine neue Handschrift fängt bei null an — sie muss sich
                   über die kommenden Saisons erst wieder ausprägen. */
                var list = FKC.data.coachPhilosophies.filter(function (p) {
                  return p.id !== g.hidden.philosophy;
                });
                g.hidden.philosophy = FKC.rng.pick(list).id;
                g.hidden.philosophyLevel = 45;
              } },
            { p: 0.6, text: K('c_philosophy_doubt', 'switch_bad'),
              effects: [{ type: 'philosophy', delta: -20 }, { type: 'dressingRoom', delta: -10 },
                        { type: 'pressure', delta: 12 }] }
          ] }
      ]
    },

    /* ── Fanprotest ──────────────────────────────────────────────── */
    {
      id: 'c_ultras', category: 'fans', phases: ['club'],
      weight: 8, cooldown: 3,
      when: function (g) { return g.standing.fanMood <= 42; },
      textParams: function (g) { return { club: clubName(g) }; },
      title: K('c_ultras', 'title'), text: K('c_ultras', 'text'),
      choices: [
        { id: 'meet', label: K('c_ultras', 'meet'),
          desc: K('c_ultras', 'meet_d'), risk: 'medium',
          outcomes: [
            { p: 0.6, text: K('c_ultras', 'meet_ok'),
              pMod: function (g) { return 0.4 + g.attributes.media / 80; },
              effects: [{ type: 'fanMood', delta: 18 }, { type: 'pressure', delta: -8 }] },
            { p: 0.4, text: K('c_ultras', 'meet_bad'),
              effects: [{ type: 'fanMood', delta: -6 }, { type: 'pressure', delta: 6 }] }
          ] },
        { id: 'squad', label: K('c_ultras', 'squad'),
          desc: K('c_ultras', 'squad_d'), risk: 'low',
          result: K('c_ultras', 'squad_r'),
          effects: [{ type: 'dressingRoom', delta: 10 }, { type: 'squadMorale', delta: 6 },
                    { type: 'fanMood', delta: -4 }] },
        { id: 'ignore', label: K('c_ultras', 'ignore'),
          desc: K('c_ultras', 'ignore_d'), risk: 'high',
          outcomes: [
            { p: 0.35, text: K('c_ultras', 'ignore_ok'),
              effects: [{ type: 'pressure', delta: -4 }] },
            { p: 0.65, text: K('c_ultras', 'ignore_bad'),
              effects: [{ type: 'fanMood', delta: -14 }, { type: 'boardTrust', delta: -8 },
                        { type: 'pressure', delta: 12 }] }
          ] }
      ]
    },

    /* ── Berater fordert Spielzeit ───────────────────────────────── */
    {
      id: 'c_agent_pressure', category: 'squad', phases: ['club'],
      weight: 7, cooldown: 3,
      when: hasSquad,
      textParams: function (g) { return { star: starName(g) }; },
      title: K('c_agent_pressure', 'title'), text: K('c_agent_pressure', 'text'),
      choices: [
        { id: 'give', label: K('c_agent_pressure', 'give'),
          desc: K('c_agent_pressure', 'give_d'), risk: 'medium',
          outcomes: [
            { p: 0.5, text: K('c_agent_pressure', 'give_ok'),
              effects: [{ type: 'squadMorale', delta: 8 }, { type: 'dressingRoom', delta: 4 }] },
            { p: 0.5, text: K('c_agent_pressure', 'give_bad'),
              effects: [{ type: 'dressingRoom', delta: -8 }, { type: 'pressure', delta: 6 }] }
          ] },
        { id: 'refuse', label: K('c_agent_pressure', 'refuse'),
          desc: K('c_agent_pressure', 'refuse_d'), risk: 'medium',
          outcomes: [
            { p: 0.55, text: K('c_agent_pressure', 'refuse_ok'),
              pMod: function (g) { return 0.4 + g.attributes.manMgmt / 80; },
              effects: [{ type: 'dressingRoom', delta: 10 }, { type: 'attr', key: 'manMgmt', delta: 2 }] },
            { p: 0.45, text: K('c_agent_pressure', 'refuse_bad'),
              effects: [{ type: 'squadMorale', delta: -9 }, { type: 'dressingRoom', delta: -5 }] }
          ] },
        { id: 'trade', label: K('c_agent_pressure', 'trade'),
          desc: K('c_agent_pressure', 'trade_d'), risk: 'low',
          result: K('c_agent_pressure', 'trade_r'),
          effects: [{ type: 'attr', key: 'transfers', delta: 3 }, { type: 'budget', delta: 1500000 }] }
      ]
    },

    /* ── Ein Jahr ohne Posten ────────────────────────────────────── */
    {
      id: 'c_between_jobs', category: 'career', phases: ['unemployed'],
      weight: 10, cooldown: 2,
      title: K('c_between_jobs', 'title'), text: K('c_between_jobs', 'text'),
      choices: [
        { id: 'study', label: K('c_between_jobs', 'study'),
          desc: K('c_between_jobs', 'study_d'), risk: 'low',
          result: K('c_between_jobs', 'study_r'),
          effects: [{ type: 'attr', key: 'tactics', delta: 4 }, { type: 'growthBonus', points: 5 }] },
        { id: 'tv', label: K('c_between_jobs', 'tv'),
          desc: K('c_between_jobs', 'tv_d'), risk: 'medium',
          outcomes: [
            { p: 0.6, text: K('c_between_jobs', 'tv_ok'),
              effects: [{ type: 'reputation', delta: 9 }, { type: 'attr', key: 'media', delta: 4 },
                        { type: 'money', delta: 120000 }] },
            { p: 0.4, text: K('c_between_jobs', 'tv_bad'),
              effects: [{ type: 'reputation', delta: 3 }, { type: 'money', delta: 80000 },
                        { type: 'attr', key: 'tactics', delta: -2 }] }
          ] },
        { id: 'scout', label: K('c_between_jobs', 'scout'),
          desc: K('c_between_jobs', 'scout_d'), risk: 'low',
          result: K('c_between_jobs', 'scout_r'),
          effects: [{ type: 'attr', key: 'transfers', delta: 5 },
                    { type: 'attr', key: 'youth', delta: 2 }] }
      ]
    }
  ];

  /* ══ Pressekonferenzen ════════════════════════════════════════════
     Kommen fast jede Saison. Die Antwort wirkt auf Vorstandsvertrauen,
     Fanstimmung und Kabine — das ist ihr ganzer Zweck.             */

  var press = [

    /* ── Antrittspressekonferenz ─────────────────────────────────── */
    {
      id: 'cp_intro', category: 'press', phases: ['club', 'national'], once: true,
      weight: 30,
      when: function (g) { return g.career.seasons.length === 0; },
      textParams: function (g) {
        return { club: clubName(g), philosophy: FKC.t('philosophy.' + g.hidden.philosophy) };
      },
      title: K('cp_intro', 'title'), text: K('cp_intro', 'text'),
      choices: [
        { id: 'bold', label: K('cp_intro', 'bold'), desc: K('cp_intro', 'bold_d'), risk: 'high',
          result: K('cp_intro', 'bold_r'),
          effects: [{ type: 'fanMood', delta: 16 }, { type: 'reputation', delta: 5 },
                    { type: 'pressure', delta: 14 }] },
        { id: 'modest', label: K('cp_intro', 'modest'), desc: K('cp_intro', 'modest_d'), risk: 'low',
          result: K('cp_intro', 'modest_r'),
          effects: [{ type: 'boardTrust', delta: 8 }, { type: 'pressure', delta: -6 },
                    { type: 'fanMood', delta: -3 }] },
        { id: 'idea', label: K('cp_intro', 'idea'), desc: K('cp_intro', 'idea_d'), risk: 'medium',
          result: K('cp_intro', 'idea_r'),
          effects: [{ type: 'philosophy', delta: 6 }, { type: 'dressingRoom', delta: 6 },
                    { type: 'attr', key: 'media', delta: 2 }] }
      ]
    },

    /* ── Nach einer schlechten Serie ─────────────────────────────── */
    {
      id: 'cp_crisis', category: 'press', phases: ['club', 'national'],
      weight: 12, cooldown: 2,
      when: function (g) { return g.standing.pressure >= 35 || g.standing.boardTrust <= 48; },
      textParams: function (g) { return { club: clubName(g) }; },
      title: K('cp_crisis', 'title'), text: K('cp_crisis', 'text'),
      choices: [
        { id: 'shield', label: K('cp_crisis', 'shield'), desc: K('cp_crisis', 'shield_d'), risk: 'medium',
          result: K('cp_crisis', 'shield_r'),
          effects: [{ type: 'dressingRoom', delta: 14 }, { type: 'squadMorale', delta: 8 },
                    { type: 'pressure', delta: 8 }] },
        { id: 'honest', label: K('cp_crisis', 'honest'), desc: K('cp_crisis', 'honest_d'), risk: 'low',
          result: K('cp_crisis', 'honest_r'),
          effects: [{ type: 'boardTrust', delta: 9 }, { type: 'fanMood', delta: 5 },
                    { type: 'dressingRoom', delta: -6 }] },
        { id: 'defiant', label: K('cp_crisis', 'defiant'), desc: K('cp_crisis', 'defiant_d'), risk: 'high',
          outcomes: [
            { p: 0.45, text: K('cp_crisis', 'defiant_ok'),
              pMod: function (g) { return 0.4 + g.attributes.media / 75; },
              effects: [{ type: 'fanMood', delta: 14 }, { type: 'pressure', delta: -12 },
                        { type: 'dressingRoom', delta: 8 }] },
            { p: 0.55, text: K('cp_crisis', 'defiant_bad'),
              effects: [{ type: 'boardTrust', delta: -14 }, { type: 'pressure', delta: 12 }] }
          ] }
      ]
    },

    /* ── Frage nach dem Titelrennen ──────────────────────────────── */
    {
      id: 'cp_titlerace', category: 'press', phases: ['club', 'national'],
      weight: 10, cooldown: 2,
      when: function (g) {
        return g.status.mandate === 'title' || g.status.mandate === 'europe' ||
               g.status.mandate === 'natTitle' || g.status.mandate === 'natSemi';
      },
      textParams: function (g) { return { club: clubName(g) }; },
      title: K('cp_titlerace', 'title'), text: K('cp_titlerace', 'text'),
      choices: [
        { id: 'claim', label: K('cp_titlerace', 'claim'), desc: K('cp_titlerace', 'claim_d'), risk: 'high',
          result: K('cp_titlerace', 'claim_r'),
          effects: [{ type: 'fanMood', delta: 14 }, { type: 'squadMorale', delta: 6 },
                    { type: 'pressure', delta: 16 }, { type: 'reputation', delta: 4 }] },
        { id: 'deflect', label: K('cp_titlerace', 'deflect'), desc: K('cp_titlerace', 'deflect_d'), risk: 'low',
          result: K('cp_titlerace', 'deflect_r'),
          effects: [{ type: 'pressure', delta: -10 }, { type: 'boardTrust', delta: 4 },
                    { type: 'fanMood', delta: -4 }] },
        { id: 'needle', label: K('cp_titlerace', 'needle'), desc: K('cp_titlerace', 'needle_d'), risk: 'high',
          outcomes: [
            { p: 0.5, text: K('cp_titlerace', 'needle_ok'),
              pMod: function (g) { return 0.4 + g.attributes.media / 70; },
              effects: [{ type: 'fanMood', delta: 18 }, { type: 'squadMorale', delta: 8 },
                        { type: 'reputation', delta: 6 }] },
            { p: 0.5, text: K('cp_titlerace', 'needle_bad'),
              effects: [{ type: 'pressure', delta: 16 }, { type: 'boardTrust', delta: -8 },
                        { type: 'money', delta: -30000 }] }
          ] }
      ]
    },

    /* ── Frage nach einem Transfer ───────────────────────────────── */
    {
      id: 'cp_transfer', category: 'press', phases: ['club'],
      weight: 10, cooldown: 2,
      textParams: function (g) { return { star: starName(g), club: clubName(g) }; },
      title: K('cp_transfer', 'title'), text: K('cp_transfer', 'text'),
      choices: [
        { id: 'deny', label: K('cp_transfer', 'deny'), desc: K('cp_transfer', 'deny_d'), risk: 'medium',
          outcomes: [
            { p: 0.6, text: K('cp_transfer', 'deny_ok'),
              effects: [{ type: 'fanMood', delta: 10 }, { type: 'dressingRoom', delta: 5 }] },
            { p: 0.4, text: K('cp_transfer', 'deny_bad'),
              effects: [{ type: 'boardTrust', delta: -9 }, { type: 'fanMood', delta: -8 }] }
          ] },
        { id: 'open', label: K('cp_transfer', 'open'), desc: K('cp_transfer', 'open_d'), risk: 'medium',
          result: K('cp_transfer', 'open_r'),
          effects: [{ type: 'boardTrust', delta: 7 }, { type: 'fanMood', delta: -8 },
                    { type: 'budget', delta: 2500000 }] },
        { id: 'dodge', label: K('cp_transfer', 'dodge'), desc: K('cp_transfer', 'dodge_d'), risk: 'low',
          result: K('cp_transfer', 'dodge_r'),
          effects: [{ type: 'attr', key: 'media', delta: 2 }, { type: 'pressure', delta: -3 }] }
      ]
    },

    /* ── Frage nach der eigenen Zukunft ──────────────────────────── */
    {
      id: 'cp_future', category: 'press', phases: ['club', 'national'],
      weight: 9, cooldown: 3,
      when: function (g) { return g.status.reputation >= 40; },
      textParams: function (g) { return { club: clubName(g) }; },
      title: K('cp_future', 'title'), text: K('cp_future', 'text'),
      choices: [
        { id: 'commit', label: K('cp_future', 'commit'), desc: K('cp_future', 'commit_d'), risk: 'low',
          result: K('cp_future', 'commit_r'),
          effects: [{ type: 'boardTrust', delta: 12 }, { type: 'fanMood', delta: 12 },
                    { type: 'hidden', key: 'loyalty', delta: 5 }] },
        { id: 'open', label: K('cp_future', 'open'), desc: K('cp_future', 'open_d'), risk: 'high',
          result: K('cp_future', 'open_r'),
          effects: [{ type: 'boardTrust', delta: -14 }, { type: 'fanMood', delta: -12 },
                    { type: 'reputation', delta: 8 }] },
        { id: 'joke', label: K('cp_future', 'joke'), desc: K('cp_future', 'joke_d'), risk: 'medium',
          outcomes: [
            { p: 0.6, text: K('cp_future', 'joke_ok'),
              pMod: function (g) { return 0.4 + g.attributes.media / 70; },
              effects: [{ type: 'attr', key: 'media', delta: 3 }, { type: 'fanMood', delta: 6 }] },
            { p: 0.4, text: K('cp_future', 'joke_bad'),
              effects: [{ type: 'boardTrust', delta: -6 }, { type: 'fanMood', delta: -6 }] }
          ] }
      ]
    },

    /* ── Frage nach den Jungen ───────────────────────────────────── */
    {
      id: 'cp_youth', category: 'press', phases: ['club'],
      weight: 9, cooldown: 3,
      textParams: function (g) { return { club: clubName(g) }; },
      title: K('cp_youth', 'title'), text: K('cp_youth', 'text'),
      choices: [
        { id: 'promise', label: K('cp_youth', 'promise'), desc: K('cp_youth', 'promise_d'), risk: 'medium',
          result: K('cp_youth', 'promise_r'),
          effects: [{ type: 'fanMood', delta: 12 }, { type: 'attr', key: 'youth', delta: 2 },
                    { type: 'pressure', delta: 6 }] },
        { id: 'realistic', label: K('cp_youth', 'realistic'), desc: K('cp_youth', 'realistic_d'), risk: 'low',
          result: K('cp_youth', 'realistic_r'),
          effects: [{ type: 'boardTrust', delta: 6 }, { type: 'fanMood', delta: -5 }] },
        { id: 'demand', label: K('cp_youth', 'demand'), desc: K('cp_youth', 'demand_d'), risk: 'medium',
          outcomes: [
            { p: 0.55, text: K('cp_youth', 'demand_ok'),
              effects: [{ type: 'budget', delta: 3000000 }, { type: 'boardTrust', delta: 4 }] },
            { p: 0.45, text: K('cp_youth', 'demand_bad'),
              effects: [{ type: 'boardTrust', delta: -10 }, { type: 'pressure', delta: 6 }] }
          ] }
      ]
    },

    /* ── Abstiegskampf ───────────────────────────────────────────── */
    {
      id: 'cp_relegation', category: 'press', phases: ['club'],
      weight: 11, cooldown: 2,
      when: function (g) {
        var l = lastSeason(g);
        return g.status.mandate === 'survive' || (l && l.grade < 0);
      },
      textParams: function (g) { return { club: clubName(g) }; },
      title: K('cp_relegation', 'title'), text: K('cp_relegation', 'text'),
      choices: [
        { id: 'rally', label: K('cp_relegation', 'rally'), desc: K('cp_relegation', 'rally_d'), risk: 'medium',
          result: K('cp_relegation', 'rally_r'),
          effects: [{ type: 'fanMood', delta: 14 }, { type: 'squadMorale', delta: 9 },
                    { type: 'dressingRoom', delta: 6 }] },
        { id: 'sober', label: K('cp_relegation', 'sober'), desc: K('cp_relegation', 'sober_d'), risk: 'low',
          result: K('cp_relegation', 'sober_r'),
          effects: [{ type: 'boardTrust', delta: 10 }, { type: 'pressure', delta: -8 },
                    { type: 'squadMorale', delta: -4 }] },
        { id: 'guarantee', label: K('cp_relegation', 'guarantee'), desc: K('cp_relegation', 'guarantee_d'), risk: 'high',
          result: K('cp_relegation', 'guarantee_r'),
          effects: [{ type: 'fanMood', delta: 18 }, { type: 'boardTrust', delta: 6 },
                    { type: 'pressure', delta: 22 }] }
      ]
    }
  ];

  FKC.data.eventsCoach = coach.concat(press);

})(window.FKC);
