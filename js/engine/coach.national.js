/* ── Nationaltrainer ───────────────────────────────────────────────────
   Der Weg nach ganz oben. Ab einem gewissen Renommee meldet sich ein
   Verband — zuerst meist das eigene Land, mit genug Ruf auch fremde.

   Das Turniersystem kommt unverändert aus der Spielerkarriere:
   FKC.data.tournamentIn bestimmt, welches Turnier in welchem Jahr
   stattfindet, FKC.national.qualChance die Qualifikationschance des
   Landes, FKC.season.runKnockout den Turnierverlauf und
   FKC.national.buildDetail die Gruppentabelle samt K.-o.-Weg.       */

window.FKC = window.FKC || {};

(function (FKC) {
  'use strict';

  var N = {};
  var clamp = function (v, a, b) { return FKC.util.clamp(v, a, b); };

  /* ── Erwartung eines Verbands ─────────────────────────────────────
     Wie beim Verein hängt sie an der eigenen Stärke: Frankreich will
     den Titel, Schottland will überhaupt dabei sein.               */
  N.mandateFor = function (nation) {
    if (!nation) return 'natQualify';
    if (nation.strength >= 86) return 'natTitle';
    if (nation.strength >= 78) return 'natSemi';
    if (nation.strength >= 70) return 'natQuarter';
    return 'natQualify';
  };

  /* Ab welcher Turnierrunde die Erwartung erfüllt ist */
  var STAGES = ['noQual', 'group', 'r16', 'quarter', 'semi', 'final', 'won'];
  var TARGET = {
    natTitle:   { good: 'final',   great: 'won',   ok: 'semi' },
    natSemi:    { good: 'semi',    great: 'final', ok: 'quarter' },
    natQuarter: { good: 'quarter', great: 'semi',  ok: 'r16' },
    natQualify: { good: 'r16',     great: 'quarter', ok: 'group' }
  };
  N.STAGES = STAGES;
  N.TARGET = TARGET;

  /* ══ Kommt ein Angebot? ═══════════════════════════════════════════ */

  N.eligible = function (game) {
    if (game.career.phase === 'national') return false;
    if (game.identity.age >= 66) return false;
    if (game.status.reputation < 62) return false;
    return game.career.trophies.length >= 1 || game.ovr >= 74;
  };

  N.offerDue = function (game) {
    if (!N.eligible(game)) return false;
    if (game.flags.natOfferYear === game.identity.year) return false;

    /* Wer gerade erst irgendwo unterschrieben hat, verlässt den Verein
       nicht vor dem ersten Spieltag wieder. Ein Verband greift erst zu,
       wenn man dort mindestens eine Saison gearbeitet hat — sonst
       standen reihenweise Stationen mit null Spielen in der Vita. */
    if (game.status.clubId) {
      var last = game.career.seasons[game.career.seasons.length - 1];
      if (!last || last.clubId !== game.status.clubId) return false;
    }

    var p = clamp((game.status.reputation - 60) / 130 +
                  game.career.trophies.length * 0.02, 0.05, 0.42);
    return FKC.rng.chance(p);
  };

  /**
   * Welcher Verband anruft. Das eigene Land zuerst — es ist die
   * naheliegende Geschichte und der Spieler hat seine Flagge von
   * Anfang an gesehen. Mit sehr grossem Ruf auch ein fremdes Land.
   */
  N.buildOffer = function (game) {
    var r = FKC.rng;
    var own = FKC.data.nationById(game.identity.nationality);
    var rep = game.status.reputation;

    var nation = own;
    /* Nur wer wirklich Weltklasse ist, wird im Ausland Nationaltrainer */
    if (rep >= 80 && r.chance(0.45)) {
      var pool = FKC.data.nations.filter(function (n) {
        if (n.id === game.identity.nationality) return false;
        /* Der Verband muss zum Renommee passen */
        return Math.abs(n.strength - (40 + rep * 0.55)) <= 12;
      });
      if (pool.length) nation = r.pick(pool);
    }
    if (!nation) return null;

    var mandate = N.mandateFor(nation);
    var salary = Math.round(
      Math.pow(1.11, Math.max(0, game.ovr - 45)) * 420000 *
      (0.6 + nation.strength / 130) / 10000) * 10000;

    return {
      key: 'nat', kind: 'national', national: true,
      nationId: nation.id, name: FKC.data.nationName(nation.id),
      short: nation.id, color: null,
      leagueName: FKC.t('cnational.federation'),
      country: nation.id, abroad: nation.id !== game.identity.nationality,
      level: nation.strength,
      salary: salary, mandate: mandate,
      rating: {
        sport: clamp(Math.round(60 + (nation.strength - 70) * 0.9), 20, 99),
        money: clamp(Math.round(52 + (salary /
          Math.max(1, game.status.contract ? game.status.contract.salary : salary) - 1) * 45), 5, 99),
        risk: clamp(Math.round(34 + (nation.strength - 60) * 0.5 +
          (nation.id !== game.identity.nationality ? 16 : 0)), 8, 95)
      },
      chance: 100,
      tagKeys: ['ctag.national', 'mandate.' + mandate]
        .concat(nation.id === game.identity.nationality ? ['ctag.homeNation'] : [])
        .slice(0, 3)
    };
  };

  /* ══ Antreten ═════════════════════════════════════════════════════ */

  N.accept = function (game, offer) {
    var nation = FKC.data.nationById(offer.nationId);

    /* Der bisherige Verein wird abgeschlossen */
    var prev = game.status.clubId;
    if (prev) {
      for (var i = game.career.clubsManaged.length - 1; i >= 0; i--) {
        if (game.career.clubsManaged[i].clubId === prev &&
            game.career.clubsManaged[i].to == null) {
          game.career.clubsManaged[i].to = game.identity.year;
          break;
        }
      }
    }

    game.career.phase = 'national';
    game.status.clubId = null;
    game.status.clubType = 'national';
    game.status.contComp = null;
    game.status.mandate = offer.mandate;
    game.status.seasonsAtClub = 0;
    game.status.seasonsMissed = 0;
    game.squad.players = [];
    game.squad.budget = { transfer: 0, wage: 0, wageUsed: 0 };

    game.national.teamId = nation.id;
    game.national.since = game.identity.year;

    game.status.contract = {
      salary: offer.salary,
      yearsLeft: FKC.rng.int(2, 4),
      signedYear: game.identity.year,
      mandate: offer.mandate
    };

    game.standing.boardTrust = 66;
    game.standing.fanMood = 60;
    game.standing.dressingRoom = 62;
    game.standing.pressure = 0;

    game.career.clubsManaged.push({
      clubId: null, nationId: nation.id, from: game.identity.year, to: null,
      matches: 0, w: 0, d: 0, l: 0, trophies: 0, mandate: offer.mandate, national: true
    });

    FKC.state.logTimeline({
      text: { key: 'ctl.nationalJob', params: { nation: FKC.data.nationName(nation.id) } },
      mark: 'good'
    });

    return FKC.coachEffects.apply(game, [
      { type: 'reputation', delta: 10 }
    ]);
  };

  /* ══ Eine Saison als Nationaltrainer ══════════════════════════════
     Ohne Liga, ohne Transfermarkt: ein Jahr besteht aus
     Qualifikationsspielen und — alle zwei Jahre — einem Turnier.   */

  N.season = function (game) {
    var r = FKC.rng;
    var nation = FKC.data.nationById(game.national.teamId);
    var season = FKC.i18n.season(game.identity.year);
    var ovrBefore = game.ovr;

    /* Die Vereinswelt läuft weiter, damit die Tabellen aktuell bleiben */
    FKC.coachSeason.idleYear(game);

    /* Stärke der Mannschaft: Landesstärke plus Trainerarbeit */
    var edge = (game.ovr - 60) * 0.10
             + ((game.hidden.philosophyLevel - 50) / 26)
             + (game.standing.dressingRoom - 55) / 40
             + FKC.data.coachTraitBonus(game, 'tacticEdge') * 4;

    var comp = FKC.data.tournamentIn(game.identity.year, nation.conf);
    var tournament = null, matches, w, d, l, gf, ga;

    if (comp.length) {
      /* WM hat Vorrang vor dem Kontinentalturnier */
      var pick = null;
      comp.forEach(function (c) { if (c.id === 'nat.wc') pick = c; });
      if (!pick) pick = comp[0];
      tournament = N.playTournament(game, pick, edge);
    }

    /* Qualifikations- und Freundschaftsspiele. Bewusst Spiel für Spiel
       gewürfelt statt über eine Formel: eine feste Siegquote liess auch
       Brasilien Jahr für Jahr ungeschlagen durch die Qualifikation
       marschieren. */
    var qGames = tournament && tournament.qualified ? 6 : 10;
    var pct = clamp((nation.strength - 55) / 45 + edge * 0.05, 0.05, 0.95);
    var pWin = clamp(0.30 + pct * 0.50 + edge * 0.02, 0.16, 0.86);
    w = 0; d = 0; l = 0;
    for (var gi = 0; gi < qGames; gi++) {
      var roll = r.next();
      if (roll < pWin) w++;
      else if (roll < pWin + 0.22) d++;
      else l++;
    }
    matches = qGames + (tournament && tournament.qualified ? tournament.apps : 0);
    if (tournament && tournament.qualified) {
      w += tournament.wins; d += tournament.draws; l += tournament.losses;
    }
    gf = Math.max(2, Math.round(matches * r.float(1.1, 2.2) * (0.7 + pct * 0.8)));
    ga = Math.max(1, Math.round(matches * r.float(0.5, 1.4) * (1.4 - pct * 0.8)));

    /* ── Urteil des Verbands ──────────────────────────────────────── */
    var verdict = N.judge(game, tournament);

    /* ── Titel ────────────────────────────────────────────────────── */
    var titles = [];
    if (tournament && tournament.result === 'won') {
      titles.push(FKC.coachSeason.recordTrophy(game, {
        compId: tournament.compId, name: FKC.data.compName(tournament.compId),
        nationId: nation.id, season: season, national: true
      }));
      FKC.state.logTimeline({
        text: { key: 'ctl.trophy', params: { name: FKC.data.compName(tournament.compId) } },
        mark: 'good'
      });
    }

    /* ── Trainer des Turniers ─────────────────────────────────────── */
    var awards = [];
    if (tournament && tournament.qualified) {
      var deep = ['semi', 'final', 'won'].indexOf(tournament.result) >= 0;
      if (deep && FKC.rng.chance(tournament.result === 'won' ? 0.5 : 0.2)) {
        var a = { id: 'coachOfTournament', season: season,
                  compId: tournament.compId, coach: true };
        awards.push(a);
        game.career.awards.push(a);
        FKC.state.logTimeline({ text: { key: 'ctl.coachOfTournament' }, mark: 'good' });
      }
      tournament.awards = awards.map(function (x) { return x.id; });
    }

    /* ── Wirkung ──────────────────────────────────────────────────── */
    FKC.coachSeason.applyStanding(game, verdict, titles.length, null);

    if (game.status.contract) {
      game.career.finances.balance += Math.round(game.status.contract.salary * 0.55);
    }

    /* ── Statistik ────────────────────────────────────────────────── */
    var tot = game.career.totals;
    tot.matches += matches; tot.w += w; tot.d += d; tot.l += l;
    tot.gf += gf; tot.ga += ga; tot.points += w * 3 + d; tot.seasons += 1;

    var stint = null;
    for (var i = game.career.clubsManaged.length - 1; i >= 0; i--) {
      if (game.career.clubsManaged[i].national) { stint = game.career.clubsManaged[i]; break; }
    }
    if (stint) {
      stint.matches += matches; stint.w += w; stint.d += d; stint.l += l;
      stint.trophies += titles.length;
    }

    var record = {
      season: season, year: game.identity.year, age: game.identity.age,
      clubId: null, nationId: nation.id, leagueId: null, national: true,
      matches: matches, w: w, d: d, l: l, gf: gf, ga: ga, points: w * 3 + d,
      leaguePos: 0, leagueSize: 0,
      cup: null, cont: null, move: null,
      tournament: tournament,
      trophies: titles, titles: titles, awards: awards,
      mandate: game.status.mandate,
      grade: verdict.grade, verdictKey: verdict.key,
      approach: (game.tactics && game.tactics.approach) || 'balanced',
      boardTrust: Math.round(game.standing.boardTrust),
      pressure: Math.round(game.standing.pressure),
      ovrStart: ovrBefore, ovrEnd: game.ovr,
      salary: game.status.contract ? game.status.contract.salary : 0
    };

    game.career.seasons.push(record);
    return record;
  };

  /* ── Turnier ──────────────────────────────────────────────────────── */

  N.playTournament = function (game, comp, edge) {
    var nation = FKC.data.nationById(game.national.teamId);
    var season = FKC.i18n.season(game.identity.year);

    /* Qualifikation: an der echten historischen Häufigkeit des Landes,
       durch gute Trainerarbeit spürbar verbessert. */
    var q = clamp(FKC.national.qualChance(nation, comp) + edge * 0.035, 0.05, 0.99);
    if (!FKC.rng.chance(q)) {
      return { compId: comp.id, season: season, year: game.identity.year,
               qualified: false, result: 'noQual', apps: 0,
               wins: 0, draws: 0, losses: 0, awards: [] };
    }

    var pool = FKC.data.nations.filter(function (n) {
      return comp.conf === '*' || n.conf === comp.conf;
    });
    var weaker = pool.filter(function (n) { return n.strength < nation.strength; }).length;
    var pct = clamp(weaker / Math.max(1, pool.length) + edge * 0.03, 0.02, 0.96);

    var result = FKC.season.runKnockout(pct, 5);
    if (result === 'early') result = 'group';

    var games = { group: 3, r16: 4, quarter: 5, semi: 6, final: 7, won: 7 }[result] || 3;
    var reached = STAGES.indexOf(result);
    var wins = Math.max(0, reached - 1 + (result === 'won' ? 1 : 0));
    var draws = FKC.rng.int(0, Math.max(0, games - wins));
    var losses = Math.max(0, games - wins - draws);

    var entry = {
      compId: comp.id, season: season, year: game.identity.year,
      qualified: true, result: result, apps: games,
      wins: wins, draws: draws, losses: losses, awards: []
    };
    entry.detail = FKC.national.buildDetail(nation, pool, result);
    game.national.tournaments.push(entry);

    if (game.tables) {
      game.tables.tournament = {
        compId: comp.id, season: season, nationId: nation.id,
        result: result, detail: entry.detail
      };
    }

    if (result === 'won') {
      game.status.reputation = clamp(game.status.reputation + 16, 0, 100);
    } else if (result === 'final' || result === 'semi') {
      game.status.reputation = clamp(game.status.reputation + 7, 0, 100);
    }

    return entry;
  };

  /* ── Urteil des Verbands ──────────────────────────────────────────── */

  N.judge = function (game, tournament) {
    var target = TARGET[game.status.mandate] || TARGET.natQualify;

    /* Jahr ohne Turnier: gemessen wird nur, ob die Qualifikation läuft.
       Ein solches Jahr kann niemanden retten und niemanden stürzen —
       und es darf den Zähler der verpassten Turniere **nicht**
       zurücksetzen. Sonst wechselten sich Turnier- und Zwischenjahre so
       ab, dass ein Nationaltrainer nie entlassen werden konnte. */
    if (!tournament) {
      return { grade: 0, key: 'ok', overshoot: 0, neutral: true };
    }

    if (!tournament.qualified) {
      return { grade: -2, key: 'disaster', overshoot: -3 };
    }

    var got = STAGES.indexOf(tournament.result);
    var grade;
    if (got >= STAGES.indexOf(target.great)) grade = 2;
    else if (got >= STAGES.indexOf(target.good)) grade = 1;
    else if (got >= STAGES.indexOf(target.ok)) grade = 0;
    else grade = -1;

    return {
      grade: grade,
      key: grade >= 2 ? 'great' : grade === 1 ? 'good' : grade === 0 ? 'ok' : 'poor',
      overshoot: got - STAGES.indexOf(target.good)
    };
  };

  /* ── Weitermachen beim Verband ────────────────────────────────────
     Das Gegenstück zum „bleiben"-Angebot beim Verein. Ohne dieses
     Angebot müsste ein Nationaltrainer am Ende jedes Vertrags
     zwangsweise zu einem Verein zurück.                            */

  N.stayOffer = function (game) {
    var nation = FKC.data.nationById(game.national.teamId);
    if (!nation) return null;
    var ct = game.status.contract || { salary: 400000, yearsLeft: 0 };
    var last = game.career.seasons[game.career.seasons.length - 1];
    var bump = last ? 1 + last.grade * 0.08 : 1;

    return {
      key: 'stay', kind: 'stay', stay: true, national: true,
      nationId: nation.id, clubId: null,
      name: FKC.data.nationName(nation.id), short: nation.id, color: null,
      leagueName: FKC.t('cnational.federation'),
      country: nation.id, abroad: false,
      level: nation.strength,
      salary: Math.max(100000, Math.round(ct.salary * bump / 10000) * 10000),
      mandate: game.status.mandate || N.mandateFor(nation),
      renew: ct.yearsLeft <= 1,
      rating: {
        sport: clamp(Math.round(58 + (nation.strength - 70) * 0.9), 20, 99),
        money: 50,
        risk: clamp(Math.round(28 + Math.max(0, game.standing.pressure - 30) * 0.6), 8, 92)
      },
      tagKeys: ['ctag.national', 'mandate.' + (game.status.mandate || 'natQualify')]
    };
  };

  /** Vertrag beim Verband verlängern */
  N.renew = function (game, offer) {
    game.status.contract = {
      salary: offer.salary,
      yearsLeft: FKC.rng.int(2, 4),
      signedYear: game.identity.year,
      mandate: offer.mandate
    };
    game.status.mandate = offer.mandate;
    return FKC.coachEffects.apply(game, [
      { type: 'boardTrust', delta: 8 }, { type: 'fanMood', delta: 6 }
    ]);
  };

  /* ── Entlassung beim Verband ──────────────────────────────────────
     Verbände sind geduldiger als Vereine, aber nicht endlos: nach zwei
     verpassten Turnieren ist auch dort Schluss.                    */

  N.sackRisk = function (game) {
    var st = game.standing;
    var p = Math.max(0, st.pressure - 50) / 100 * 0.9
          + Math.max(0, 42 - st.boardTrust) / 100 * 0.8;
    if (game.status.seasonsMissed >= 3) p += 0.30;
    p -= FKC.data.coachTraitBonus(game, 'survival');
    return clamp(p, 0, 0.8);
  };

  N.leave = function (game) {
    var nation = FKC.data.nationById(game.national.teamId);
    for (var i = game.career.clubsManaged.length - 1; i >= 0; i--) {
      if (game.career.clubsManaged[i].national &&
          game.career.clubsManaged[i].to == null) {
        game.career.clubsManaged[i].to = game.identity.year;
        break;
      }
    }
    game.career.sackings = (game.career.sackings || 0) + 1;
    game.flags.justSacked = true;
    game.career.phase = 'unemployed';
    game.status.clubType = 'none';
    game.status.contract = null;
    game.status.mandate = null;
    game.national.teamId = null;
    game.standing.pressure = clamp(game.standing.pressure - 30, 0, 100);
    game.status.reputation = clamp(game.status.reputation - 6, 0, 100);

    FKC.state.logTimeline({
      text: { key: 'ctl.nationalEnd', params: { nation: nation ? FKC.data.nationName(nation.id) : '' } },
      mark: 'bad'
    });
    return nation;
  };

  FKC.coachNational = N;

})(window.FKC);
