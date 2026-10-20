/* ── Trainersaison ─────────────────────────────────────────────────────
   Eine Saison aus Trainersicht. Der halbe Motor kommt unverändert aus
   der Spielerkarriere:

     FKC.world.runSeason      alle 32 Ligen, Auf- und Abstieg
     FKC.season.runKnockout   Pokal und Europapokal
     FKC.season.buildRun      Gegner und Ergebnisse des K.-o.-Wegs
     FKC.season.qualification Europapokalplatz für die Folgesaison

   Neu ist nur, was den Trainer betrifft: Wie stark seine Mannschaft
   durch ihn wird, und wie der Vorstand das Ergebnis am Ende gegen die
   Erwartung hält.                                                    */

window.FKC = window.FKC || {};

(function (FKC) {
  'use strict';

  var CS = {};
  var clamp = function (v, a, b) { return FKC.util.clamp(v, a, b); };

  /* ── Saisonausrichtung ──────────────────────────────────────────────
     Das Gegenstück zu Trainingsschwerpunkt und Saisonplan beim
     Spieler: eine Entscheidung vor der Saison, die die ganze Spielzeit
     färbt.                                                          */
  var APPROACH = {
    balanced: { attack: 0, defence: 0, boost: 0.0, cup: 0.00, risk: 0,   youth: 0 },
    attack:   { attack: 0.22, defence: -0.14, boost: 0.7, cup: 0.08, risk: 8, youth: 0 },
    defend:   { attack: -0.16, defence: 0.24, boost: 0.4, cup: 0.02, risk: -4, youth: 0 },
    develop:  { attack: -0.05, defence: -0.05, boost: -0.9, cup: -0.04, risk: -6, youth: 1 }
  };
  CS.APPROACH = APPROACH;
  CS.approachIds = ['balanced', 'attack', 'defend', 'develop'];

  /* ══ Wie viel der Trainer ausmacht ════════════════════════════════
     Der Zuschlag, mit dem die eigene Mannschaft in die
     Tabellensimulation geht. Er setzt sich aus fünf sichtbaren Teilen
     zusammen — dieselben, die im Saisonbericht ausgewiesen werden. */

  CS.boostParts = function (game) {
    var club = FKC.state.club();
    if (!club) return null;
    var level = FKC.data.clubLevel(club);
    var squad = FKC.coachSquad.strength(game);
    var fit = FKC.coachSquad.fit(game);
    var app = APPROACH[(game.tactics && game.tactics.approach) || 'balanced'] || APPROACH.balanced;

    /* 1 — Die Qualität des Trainers selbst */
    var coach = (game.ovr - 58) * 0.075;

    /* 2 — Kaderarbeit: was Transfers und Entwicklung gebracht haben,
           gemessen am Niveau, das der Verein von Haus aus hat. */
    var squadEdge = (squad - level) * 0.55;

    /* 3 — Die Handschrift. Sie wirkt nur, wenn der Kader dazu passt —
           Ballbesitz mit einem Kader voller Sprinter bringt nichts. */
    var hand = ((game.hidden.philosophyLevel - 50) / 30) * fit;
    hand += FKC.data.coachTraitBonus(game, 'tacticEdge') * 4;

    /* 4 — Die Kabine */
    var room = (game.standing.dressingRoom - 55) / 45;

    /* 5 — Die gewählte Ausrichtung */
    var approach = app.boost;

    /* Die Obergrenze liegt bewusst nahe an der der Spielerkarriere
       (dort 4.5 plus 1.6 für „alles geben"). Ein Trainer soll deutlich
       etwas ausmachen — aber nicht so viel, dass die Tabellensimulation
       an ihre Punktobergrenze läuft und Saisons ohne Niederlage zur
       Regel werden. */
    return {
      coach: coach, squad: squadEdge, hand: hand, room: room, approach: approach,
      fit: fit, squadStrength: squad, clubLevel: level,
      total: clamp(coach + squadEdge + hand + room + approach, -4, 5.5)
    };
  };

  /* ══ Eine komplette Saison ════════════════════════════════════════ */

  CS.run = function (game) {
    var r = FKC.rng;
    var club = FKC.state.club();
    var league = FKC.data.leagueOf(club);
    var season = FKC.i18n.season(game.identity.year);
    var ovrBefore = game.ovr;

    var app = APPROACH[(game.tactics && game.tactics.approach) || 'balanced'] || APPROACH.balanced;
    var parts = CS.boostParts(game);
    var boost = parts.total;

    /* ── 1. Liga: die ganze Fussballwelt spielt mit ───────────────── */
    var world = FKC.world.runSeason(game, club, boost);
    var table = world.tables[league.id] || [];
    var own = null;
    table.forEach(function (row) { if (row.club.id === club.id) own = row; });

    var size = Math.max(6, table.length || league.clubCount);
    var position = own ? own.position : Math.ceil(size / 2);
    var ownMove = FKC.world.moveFor(world.moves, club.id);

    /* ── 2. Nationaler Pokal ──────────────────────────────────────── */
    var cupField = FKC.data.clubsOfCountry(league.country);
    var cupPct = clamp(FKC.season.strengthPercentile(club, cupField) +
                       boost * 0.02 + app.cup + r.float(-0.12, 0.06), 0, 1);
    var cupResult = FKC.season.runKnockout(cupPct, 6, FKC.season.CUP_STAGES);

    /* ── 3. Internationaler Wettbewerb ────────────────────────────── */
    var contComp = game.status.contComp ? FKC.data.compById(game.status.contComp) : null;
    var contResult = null, contDetail = null;
    if (contComp) {
      var contPool = FKC.data.clubs.filter(function (c) {
        var lg = FKC.data.leagueOf(c);
        return lg && lg.conf === contComp.conf && lg.tier === 1;
      });
      var contPct = clamp(FKC.season.strengthPercentile(club, contPool) +
                          boost * 0.02 + app.cup, 0, 1);
      if (contComp.tier === 2) contPct = clamp(contPct + 0.18, 0, 1);
      else if (contComp.tier === 3) contPct = clamp(contPct + 0.32, 0, 1);
      contResult = FKC.season.runKnockout(contPct, 5);

      var teams = 36;
      var lpPos = clamp(Math.round((1 - contPct) * teams + r.gauss(0, 4)), 1, teams);
      contDetail = {
        compId: contComp.id, teams: teams,
        leaguePhase: { pos: lpPos, played: 8,
                       pts: clamp(Math.round(24 - lpPos * 0.5 + r.gauss(0, 2)), 1, 24) },
        rounds: FKC.season.buildRun(club, contPool, contResult),
        result: contResult
      };
    }

    /* ── 4. Tabellen sichern — identisches Format wie beim Spieler ── */
    var allTables = {};
    Object.keys(world.tables).forEach(function (lid) {
      allTables[lid] = FKC.season.packTight(world.tables[lid]);
    });

    game.tables = {
      season: season, leagueId: league.id, clubId: club.id,
      league: FKC.season.packTable(table),
      all: allTables,
      cont: contDetail,
      cup: { compId: league.domesticCup, result: cupResult,
             rounds: FKC.season.buildRun(club, cupField, cupResult, FKC.season.CUP_ORDER) },
      tournament: null,
      moves: world.moves.filter(function (m) {
        var lg = FKC.data.leagueById(m.to);
        return lg && lg.country === league.country;
      }),
      ownMove: ownMove
    };

    /* ── 5. Bilanz. Die Zahlen kommen direkt aus der Tabelle — die
           Mannschaft des Trainers **ist** diese Tabellenzeile. ───── */
    var matches = own ? own.played : (size - 1) * 2;
    var w = own ? own.w : Math.round(matches * 0.4);
    var d = own ? own.d : Math.round(matches * 0.25);
    var l = own ? own.l : matches - w - d;
    var gf = own ? own.gf : Math.round(matches * 1.3);
    var ga = own ? own.ga : Math.round(matches * 1.3);
    var points = own ? own.points : w * 3 + d;

    /* Die Ausrichtung färbt Tore und Gegentore, ohne die Tabelle zu
       verbiegen — die Punkte bleiben, wie sie simuliert wurden. */
    gf = Math.max(4, Math.round(gf * (1 + app.attack)));
    ga = Math.max(4, Math.round(ga * (1 - app.defence)));

    /* ── 6. Titel ─────────────────────────────────────────────────── */
    var titles = [];
    if (position === 1) {
      titles.push(CS.recordTrophy(game, {
        compId: 'league.' + league.id, name: league.name,
        clubId: club.id, season: season
      }));
    }
    if (cupResult === 'won') {
      titles.push(CS.recordTrophy(game, {
        compId: league.domesticCup, name: FKC.data.compName(league.domesticCup),
        clubId: club.id, season: season
      }));
    }
    if (contResult === 'won' && contComp) {
      titles.push(CS.recordTrophy(game, {
        compId: contComp.id, name: contComp.name,
        clubId: club.id, season: season
      }));
    }

    /* ── 7. Urteil des Vorstands ──────────────────────────────────── */
    var bands = FKC.data.mandateBands(game.status.mandate, size);
    var verdict = CS.judge(game, {
      position: position, size: size, bands: bands,
      titles: titles, move: ownMove, cup: cupResult,
      cont: contResult, points: points
    });

    /* ── 8. Auszeichnungen ────────────────────────────────────────── */
    var awards = CS.rollAwards(game, league, {
      season: season, position: position, size: size,
      points: points, titles: titles, grade: verdict.grade,
      overshoot: verdict.overshoot
    });

    /* ── 9. Auswirkungen auf den Trainer ──────────────────────────── */
    CS.applyStanding(game, verdict, titles.length, ownMove);

    /* ── 10. Gehalt gutschreiben ──────────────────────────────────── */
    if (game.status.contract) {
      game.career.finances.balance += Math.round(game.status.contract.salary * 0.55);
    }

    /* ── 11. Qualifikation für die Folgesaison ────────────────────── */
    game.status.contComp = (ownMove && ownMove.dir === 'down')
      ? null : FKC.season.qualification(league, position, cupResult, contResult);

    if (ownMove) {
      FKC.state.logTimeline({
        text: { key: ownMove.dir === 'up' ? 'ctl.promoted' : 'ctl.relegated',
                params: { club: club.name,
                          league: (FKC.data.leagueById(ownMove.to) || {}).name || '' } },
        mark: ownMove.dir === 'up' ? 'good' : 'bad'
      });
    }
    titles.forEach(function (tr) {
      FKC.state.logTimeline({ text: { key: 'ctl.trophy', params: { name: tr.name } }, mark: 'good' });
    });

    /* ── 12. Gesamtstatistik ──────────────────────────────────────── */
    var tot = game.career.totals;
    tot.matches += matches; tot.w += w; tot.d += d; tot.l += l;
    tot.gf += gf; tot.ga += ga; tot.points += points; tot.seasons += 1;

    var stint = null;
    for (var i = game.career.clubsManaged.length - 1; i >= 0; i--) {
      if (game.career.clubsManaged[i].clubId === club.id) {
        stint = game.career.clubsManaged[i]; break;
      }
    }
    if (stint) {
      stint.matches += matches; stint.w += w; stint.d += d; stint.l += l;
      stint.trophies += titles.length;
    }

    var record = {
      season: season, year: game.identity.year, age: game.identity.age,
      clubId: club.id, leagueId: league.id, national: false,
      matches: matches, w: w, d: d, l: l, gf: gf, ga: ga, points: points,
      leaguePos: position, leagueSize: size,
      cup: cupResult, cont: contComp ? { id: contComp.id, result: contResult } : null,
      move: ownMove ? { dir: ownMove.dir, to: ownMove.to } : null,
      trophies: titles, titles: titles, awards: awards,
      mandate: game.status.mandate, bands: bands,
      grade: verdict.grade, verdictKey: verdict.key,
      approach: (game.tactics && game.tactics.approach) || 'balanced',
      parts: parts,
      squadStrength: Math.round(parts.squadStrength),
      boardTrust: Math.round(game.standing.boardTrust),
      pressure: Math.round(game.standing.pressure),
      ovrStart: ovrBefore, ovrEnd: game.ovr,
      salary: game.status.contract ? game.status.contract.salary : 0
    };

    game.career.seasons.push(record);
    return record;
  };

  /* ══ Titel eintragen ══════════════════════════════════════════════
     Einzige Stelle, an der ein Trainertitel in den Trophäenschrank
     wandert. `coach: true` unterscheidet ihn dort von den Titeln einer
     Spielerkarriere — mehr braucht es nicht, das Format bleibt
     identisch.                                                      */

  CS.recordTrophy = function (game, def) {
    var entry = {
      compId: def.compId, name: def.name,
      clubId: def.clubId, nationId: def.nationId || null,
      season: def.season, coach: true, counted: true,
      national: !!def.national
    };
    game.career.trophies.push({
      compId: entry.compId, name: entry.name,
      clubId: entry.clubId, nationId: entry.nationId,
      season: entry.season, coach: true, national: entry.national
    });
    return entry;
  };

  /* ══ Urteil des Vorstands ═════════════════════════════════════════
     Gemessen wird ausschliesslich an der Erwartung, die dieser Verein
     an diesen Trainer stellt. Platz 8 ist für einen Aufsteiger eine
     grosse Saison und für einen Titelanwärter eine Katastrophe.    */

  CS.judge = function (game, ctx) {
    var b = ctx.bands;
    var grade;
    if (ctx.position <= b.great) grade = 2;
    else if (ctx.position <= b.good) grade = 1;
    else if (ctx.position <= b.ok) grade = 0;
    else grade = -1;

    /* Ein Titel hebt jede Saison — auch eine sonst mässige */
    if (ctx.titles.length) grade = Math.min(2, grade + 1);
    /* Ein weiter Weg im Europapokal zählt ebenfalls */
    if (ctx.cont === 'final' || ctx.cont === 'semi') grade = Math.min(2, grade + 1);

    /* Auf- und Abstieg überschreiben alles */
    if (ctx.move && ctx.move.dir === 'up') grade = 2;
    if (ctx.move && ctx.move.dir === 'down') grade = -2;
    else if (ctx.position > b.ok && ctx.position >= ctx.size - 2) grade = -2;

    var key = grade >= 2 ? 'great' : grade === 1 ? 'good'
            : grade === 0 ? 'ok' : grade === -1 ? 'poor' : 'disaster';

    return {
      grade: grade, key: key,
      /* Wie weit über oder unter der Erwartung — für Auszeichnungen */
      overshoot: b.good - ctx.position
    };
  };

  /* ══ Wirkung auf Vertrauen, Fans, Kabine und Druck ════════════════ */

  CS.applyStanding = function (game, verdict, titleCount, move) {
    var st = game.standing;
    var g = verdict.grade;

    st.boardTrust = clamp(Math.round(st.boardTrust + g * 11 + titleCount * 7), 0, 100);
    st.fanMood = clamp(Math.round(st.fanMood + g * 9 + titleCount * 11 +
      (move && move.dir === 'up' ? 14 : 0) + (move && move.dir === 'down' ? -20 : 0)), 0, 100);
    st.dressingRoom = clamp(Math.round(st.dressingRoom + g * 5 +
      (game.attributes.manMgmt - 55) / 9 +
      FKC.data.coachTraitBonus(game, 'moraleBoost') * 0.4), 0, 100);

    /* Druck ist der Zähler, an dem das Entlassungsrisiko hängt. Er
       steigt schnell und fällt langsam — genau deshalb ist eine
       schlechte Serie für einen Trainer gefährlich. */
    var delta = g >= 2 ? -30 : g === 1 ? -16 : g === 0 ? -4 : g === -1 ? 22 : 40;
    delta -= FKC.data.coachTraitBonus(game, 'pressureRes') * 0.25;
    st.pressure = clamp(Math.round(st.pressure + delta), 0, 100);

    /* Ein Zwischenjahr ohne Turnier ist weder Erfolg noch Misserfolg —
       es darf den Zähler weder erhöhen noch zurücksetzen. */
    if (!verdict.neutral) {
      game.status.seasonsMissed = g < 0 ? game.status.seasonsMissed + 1 : 0;
    }

    /* Renommee folgt dem Erfolg, aber träger als das Vertrauen */
    var club = FKC.state.club();
    var lg = club ? FKC.data.leagueOf(club) : null;
    var rep = g * 4 + titleCount * 7 + (lg ? (lg.prestige - 60) / 26 : 0);
    game.status.reputation = clamp(Math.round(game.status.reputation + rep), 0, 100);

    /* Die Stimmung im Kader hängt am Abschneiden und an der
       Kaderführung des Trainers. */
    var mood = g * 4 + (game.attributes.manMgmt - 55) / 8;
    (game.squad.players || []).forEach(function (p) {
      p.morale = clamp(Math.round(p.morale + mood + FKC.rng.int(-4, 4)), 5, 99);
    });
  };

  /* ══ Auszeichnungen ═══════════════════════════════════════════════
     Trainer des Jahres auf Ligaebene. Nach demselben Muster wie die
     Spielerauszeichnungen: ein Wert für die eigene Saison gegen eine
     Bestmarke, die deterministisch aus Liga und Saison entsteht — sie
     darf sich beim Neuzeichnen nicht ändern.                       */

  CS.coachMark = function (leagueId, season) {
    var h = 0, str = 'coty|' + leagueId + '|' + season;
    for (var i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    h ^= h >>> 16; h = Math.imul(h, 0x45d9f3b); h ^= h >>> 16;
    return 62 + ((h >>> 0) % 14);              // 62 … 75
  };

  /**
   * Wert der Trainersaison, 0–100. Bewertet wird nicht der Tabellenplatz
   * an sich, sondern das Verhältnis zwischen dem, was möglich war, und
   * dem, was herauskam. Deshalb kann auch der Trainer eines kleinen
   * Vereins die Auszeichnung gewinnen.
   */
  CS.coachScore = function (game, league, line) {
    var club = FKC.state.club();
    if (!club) return 0;

    /* 1 — Überperformance: Platz gegen die eigene Kaderstärke */
    var peers = FKC.data.clubsOf(league.id);
    var stronger = 0;
    peers.forEach(function (c) { if (c.strength > club.strength) stronger++; });
    var expected = stronger + 1;                       // Platz nach Kadergüte
    var over = clamp((expected - line.position) / Math.max(3, line.size * 0.35), -1, 1.6);
    var perf = (over + 1) / 2.6 * 52;                  // 0 … 52

    /* 2 — Was am Ende in der Vitrine steht */
    var titles = 0;
    (line.titles || []).forEach(function (tr) {
      if (tr.compId.indexOf('cont.') === 0) titles += 20;
      else if (tr.compId.indexOf('league.') === 0) titles += 16;
      else titles += 7;
    });
    titles = Math.min(30, titles);

    /* 3 — Die reine Punktausbeute */
    var pts = clamp((line.points / Math.max(1, line.size * 3.1) - 0.42) * 90, 0, 18);

    return clamp(Math.round(perf + titles + pts), 0, 100);
  };

  CS.rollAwards = function (game, league, line) {
    var out = [];
    var score = CS.coachScore(game, league, line);

    if (score > CS.coachMark(league.id, line.season)) {
      out.push({ id: 'coachOfYear', season: line.season, leagueId: league.id,
                 score: score, coach: true });
      FKC.state.logTimeline({ text: { key: 'ctl.coachOfYear' }, mark: 'good' });
    }

    out.forEach(function (a) { game.career.awards.push(a); });
    return out;
  };

  /* ══ Saison ohne Verein ═══════════════════════════════════════════
     Wer entlassen wurde und kein Angebot annimmt, verliert ein Jahr.
     Die Liga-Welt läuft trotzdem weiter — sonst stünde beim
     Wiedereinstieg eine eingefrorene Tabelle da.                   */

  CS.idleYear = function (game) {
    var world = FKC.world.runSeason(game, null, 0);

    var home = FKC.data.leaguesOf(FKC.data.youthCountry(game.identity.nationality));
    var lid = home.length ? home[0].id : FKC.data.leagues[0].id;
    var country = (FKC.data.leagueById(lid) || {}).country;

    var all = {};
    Object.keys(world.tables).forEach(function (k) {
      all[k] = FKC.season.packTight(world.tables[k]);
    });

    game.tables = {
      season: FKC.i18n.season(game.identity.year),
      leagueId: lid, clubId: null,
      league: FKC.season.packTable(world.tables[lid] || []),
      all: all, cont: null, cup: null, tournament: null,
      moves: world.moves.filter(function (m) {
        var lg = FKC.data.leagueById(m.to);
        return lg && lg.country === country;
      }),
      ownMove: null
    };
  };

  FKC.coachSeason = CS;

})(window.FKC);
