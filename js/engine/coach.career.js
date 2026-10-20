/* ── Trainerkarriere: Phasenmaschine ───────────────────────────────────
   Liefert Bild für Bild ("Szenen") und schiebt die Karriere voran.
   Der aktuelle Stand liegt in game.pending und ist speicherbar —
   genau wie in der Spielerkarriere.

   Ein Trainerjahr:
     Saisonvorbereitung → Transferfenster → Pressekonferenz → Saison
     → Ereignis → Vorstandsbewertung → Vereinsfrage

   Bewusst wenige, dafür schwere Entscheidungen — dasselbe Prinzip wie
   bei der Profisaison des Spielers.                                  */

window.FKC = window.FKC || {};

(function (FKC) {
  'use strict';

  var C = {};
  var clamp = function (v, a, b) { return FKC.util.clamp(v, a, b); };

  /* ── Schwerpunkt der Trainerarbeit ──────────────────────────────────
     Das Gegenstück zum Trainingsschwerpunkt beim Spieler: woran der
     Trainer diese Saison selbst arbeitet.                           */
  var WORK = [
    { id: 'drill',    focus: 'tactics',   effects: [{ type: 'growthBonus', points: 3 }] },
    { id: 'squad',    focus: 'manMgmt',   effects: [{ type: 'dressingRoom', delta: 8 },
                                                    { type: 'squadMorale', delta: 6 }] },
    { id: 'scouting', focus: 'transfers', effects: [{ type: 'growthBonus', points: 2 },
                                                    { type: 'budget', delta: 500000 }] },
    { id: 'academy',  focus: 'youth',     effects: [{ type: 'growthBonus', points: 2 },
                                                    { type: 'boardTrust', delta: 4 }] },
    { id: 'public',   focus: 'media',     effects: [{ type: 'fanMood', delta: 9 },
                                                    { type: 'pressure', delta: -8 }] }
  ];
  C.WORK = WORK;

  /* ══ Start ════════════════════════════════════════════════════════ */

  C.start = function (game, opts) {
    var club = opts.club;

    game.origin = {
      country: game.identity.nationality,
      licence: game.identity.licence,
      startClubId: club ? club.id : null,
      startClubName: club ? club.name : '',
      playedBefore: !!opts.playedBefore
    };

    game.hidden = FKC.data.rollCoachHidden(game.identity.licence, opts.philosophy);
    game.attributes = FKC.coachAttr.startingSet(game);

    /* Die Vorgeschichte färbt den Start, ohne ihn zu entscheiden. Ein
       ehemaliger Profi hat den Namen und die Kabine auf seiner Seite;
       ein Quereinsteiger kommt über die Arbeit. */
    if (game.origin.playedBefore) {
      game.status.reputation = clamp(game.status.reputation + 8, 0, 100);
      game.standing.dressingRoom = clamp(game.standing.dressingRoom + 8, 0, 100);
      game.attributes.media = clamp(game.attributes.media + 4, 5, 99);
    } else {
      game.attributes.tactics = clamp(game.attributes.tactics + 3, 5, 99);
      game.attributes.transfers = clamp(game.attributes.transfers + 2, 5, 99);
    }

    FKC.world.init(game);

    game.tactics = { shape: '4-3-3', approach: 'balanced', focus: null };

    if (club) {
      FKC.coachEffects.moveToClub(game, club, 'club');
      var lic = FKC.data.coachLicenceById(game.identity.licence);
      game.status.contract = {
        salary: FKC.coachMarket.estimateSalary(club, game, 0.9),
        yearsLeft: FKC.rng.int(2, 3),
        signedYear: game.identity.year,
        mandate: game.status.mandate
      };
      /* Der Start ist kein Vertrauensvorschuss aus dem Nichts: wer mit
         der Pro-Lizenz bei einem ambitionierten Verein anfängt, hat von
         Anfang an weniger Luft. */
      game.standing.boardTrust = clamp(62 + (lic ? lic.patience * 4 : 0), 40, 78);
      game.standing.pressure = lic && lic.id === 'uefaPro' ? 14 : 0;
    }

    FKC.coachAttr.recalc(game);
    FKC.coachAttr.pushHistory(game);

    FKC.state.logTimeline({
      text: { key: 'ctl.licence', params: { licence: FKC.t('licence.' + game.identity.licence) } },
      mark: 'plain'
    });
    if (club) {
      FKC.state.logTimeline({
        text: { key: 'ctl.firstJob', params: { club: club.name } }, mark: 'good'
      });
    }

    C.beginYear(game);
    game.pending = { kind: 'intro' };
    return game;
  };

  /* ══ Jahresrhythmus ═══════════════════════════════════════════════ */

  C.beginYear = function (game) {
    /* Allgemeine Ereignisse kommen nicht jede Saison — dafür mit
       spürbaren Folgen. Pressekonferenzen dagegen fast immer. */
    var due = game.flags.nextEventYear == null ||
              game.identity.year >= game.flags.nextEventYear;

    game.tick = {
      year: game.identity.year,
      events: 0,
      plan: due ? 1 : 0,
      pressDue: FKC.rng.chance(0.8),
      prepDone: false,
      transferDone: false,
      pressDone: false,
      seasonDone: false,
      boardDone: false,
      jobDone: false,
      idleHandled: false
    };
  };

  /* ══ Nächste Szene ════════════════════════════════════════════════ */

  C.nextScene = function () {
    var game = FKC.state.game;
    if (!game) return null;
    if (game.pending) return C.describePending(game);
    if (game.career.phase === 'retired') {
      game.pending = { kind: 'retire' };
      return C.describePending(game);
    }
    if (!game.tick || game.tick.year !== game.identity.year) C.beginYear(game);

    /* Ein Verband meldet sich — eigener Slot, damit das Angebot nicht
       zwischen den übrigen Ereignissen untergeht. Genau wie beim
       Mentor in der Spielerkarriere.

       Ausdrücklich nur **vor** der Saisonvorbereitung: wer mitten in
       einer laufenden Spielzeit wechselt, würde diese Saison entweder
       verlieren oder doppelt spielen. */
    if (!game.tick.prepDone && !game.tick.seasonDone &&
        !game.flags.natOfferOpen && FKC.coachNational.offerDue(game)) {
      var offer = FKC.coachNational.buildOffer(game);
      if (offer) {
        game.flags.natOfferYear = game.identity.year;
        game.pending = { kind: 'nationalOffer', offer: offer };
        return C.describePending(game);
      }
    }

    return game.career.phase === 'national' ? nationalScene(game) : clubScene(game);
  };

  /* ── Vereinstrainer ─────────────────────────────────────────────── */

  function clubScene(game) {
    /* Ohne Posten wird keine Saison gearbeitet — erst braucht es einen
       Verein. Das ist die trainertypische Entsprechung zum
       Vereinslos-Werden in der Spielerkarriere. */
    if (!game.status.clubId) {
      if (game.tick.idleHandled) { C.advanceYear(game); return C.nextScene(); }
      game.pending = { kind: 'jobChoice', free: true };
      return C.describePending(game);
    }

    if (!game.tick.prepDone) {
      game.pending = { kind: 'prep' };
      return C.describePending(game);
    }
    if (!game.tick.transferDone) {
      game.pending = { kind: 'transferWindow' };
      return C.describePending(game);
    }
    if (game.tick.pressDue && !game.tick.pressDone) {
      game.tick.pressDone = true;
      var pev = FKC.events.draw(game, { idPrefix: 'cp_' });
      if (pev) {
        game.pending = { kind: 'scene', source: 'event', id: pev.id };
        return C.describePending(game);
      }
    }
    if (!game.tick.seasonDone) {
      game.pending = C.runSeason(game);
      game.tick.seasonDone = true;
      return C.describePending(game);
    }
    if (game.tick.events < game.tick.plan) {
      game.tick.events++;
      var ev = FKC.events.draw(game, { idPrefix: 'c_' });
      if (ev) {
        game.flags.nextEventYear = game.identity.year + FKC.rng.int(1, 2);
        game.pending = { kind: 'scene', source: 'event', id: ev.id };
        return C.describePending(game);
      }
      return C.nextScene();
    }
    if (!game.tick.boardDone) {
      game.tick.boardDone = true;
      game.pending = C.buildBoardReview(game);
      return C.describePending(game);
    }
    if (!game.tick.jobDone && FKC.coachMarket.jobDue(game)) {
      game.tick.jobDone = true;
      game.pending = { kind: 'jobChoice' };
      return C.describePending(game);
    }
    game.tick.jobDone = true;
    C.advanceYear(game);
    return C.nextScene();
  }

  /* ── Nationaltrainer ────────────────────────────────────────────── */

  function nationalScene(game) {
    if (!game.tick.prepDone) {
      game.pending = { kind: 'prep' };
      return C.describePending(game);
    }
    if (game.tick.pressDue && !game.tick.pressDone) {
      game.tick.pressDone = true;
      var pev = FKC.events.draw(game, { idPrefix: 'cp_' });
      if (pev) {
        game.pending = { kind: 'scene', source: 'event', id: pev.id };
        return C.describePending(game);
      }
    }
    if (!game.tick.seasonDone) {
      game.pending = C.runSeason(game);
      game.tick.seasonDone = true;
      return C.describePending(game);
    }
    if (game.tick.events < game.tick.plan) {
      game.tick.events++;
      var ev = FKC.events.draw(game, { idPrefix: 'c_' });
      if (ev) {
        game.flags.nextEventYear = game.identity.year + FKC.rng.int(1, 2);
        game.pending = { kind: 'scene', source: 'event', id: ev.id };
        return C.describePending(game);
      }
      return C.nextScene();
    }
    if (!game.tick.boardDone) {
      game.tick.boardDone = true;
      game.pending = C.buildBoardReview(game);
      return C.describePending(game);
    }
    if (!game.tick.jobDone && (game.status.contract == null ||
        game.status.contract.yearsLeft <= 1 || game.identity.age >= 62)) {
      game.tick.jobDone = true;
      game.pending = { kind: 'jobChoice' };
      return C.describePending(game);
    }
    game.tick.jobDone = true;
    C.advanceYear(game);
    return C.nextScene();
  }

  C.sceneSource = function (game) {
    if (!game.pending || game.pending.kind !== 'scene') return null;
    return FKC.events.byId(game.pending.id);
  };

  /* ══ Anzeige aufbereiten ══════════════════════════════════════════ */

  C.describePending = function (game) {
    var p = game.pending;
    if (!p) return null;

    if (p.kind === 'intro') {
      return { kind: 'intro', age: game.identity.age, origin: game.origin,
               club: FKC.state.club() };
    }

    if (p.kind === 'scene') {
      var def = C.sceneSource(game);
      if (!def) { game.pending = null; return C.nextScene(); }
      var view = FKC.events.present(game, def);
      view.kind = 'scene';
      view.age = game.identity.age;
      view.press = def.category === 'press';
      view.result = p.result ? C.describeResult(game, p.result) : null;
      return view;
    }

    if (p.kind === 'prep') {
      return {
        kind: 'prep', age: game.identity.age,
        national: game.career.phase === 'national',
        club: FKC.state.club(),
        nation: game.national.teamId ? FKC.data.nationById(game.national.teamId) : null,
        season: FKC.i18n.season(game.identity.year),
        approach: (game.tactics && game.tactics.approach) || 'balanced',
        philosophy: game.hidden.philosophy,
        fit: game.status.clubId ? FKC.coachSquad.fit(game) : 1,
        options: WORK.map(function (o) { return { id: o.id, focus: o.focus }; }),
        result: p.result ? C.describeResult(game, p.result) : null
      };
    }

    if (p.kind === 'transferWindow') {
      if (!p.buys) p.buys = FKC.coachSquad.transferTargets(game, 5);
      if (!p.sells) p.sells = FKC.coachSquad.sellOffers(game, 3);
      return {
        kind: 'transferWindow', age: game.identity.age,
        club: FKC.state.club(),
        season: FKC.i18n.season(game.identity.year),
        budget: game.squad.budget,
        wageRoom: FKC.coachSquad.wageRoom(game),
        squad: FKC.coachSquad.sorted(game),
        xi: FKC.coachSquad.bestXI(game),
        strength: Math.round(FKC.coachSquad.strength(game)),
        avgAge: FKC.coachSquad.avgAge(game),
        fit: FKC.coachSquad.fit(game),
        philosophy: game.hidden.philosophy,
        buys: p.buys.filter(function (o) { return !o.done; }),
        sells: p.sells.filter(function (o) { return !o.done; }),
        feed: p.feed || []
      };
    }

    if (p.kind === 'seasonReview') {
      return {
        kind: 'seasonReview', age: game.identity.age,
        record: p.record, deltas: p.deltas
      };
    }

    if (p.kind === 'boardReview') {
      return {
        kind: 'boardReview', age: game.identity.age,
        record: p.record, grade: p.grade, verdictKey: p.verdictKey,
        mandate: p.mandate, bands: p.bands,
        sacked: !!p.sacked, payoff: p.payoff || 0,
        risk: p.risk, club: p.clubName, national: !!p.national,
        standing: {
          boardTrust: Math.round(game.standing.boardTrust),
          fanMood: Math.round(game.standing.fanMood),
          dressingRoom: Math.round(game.standing.dressingRoom),
          pressure: Math.round(game.standing.pressure)
        }
      };
    }

    if (p.kind === 'jobChoice') {
      if (!p.offers) {
        p.offers = (!game.status.clubId && game.career.phase !== 'national')
          ? FKC.coachMarket.freeOffers(game)
          : FKC.coachMarket.buildOffers(game, lastRecord(game));
        /* Als Nationaltrainer gibt es keinen „bleiben"-Verein — das
           Weitermachen beim Verband muss trotzdem zur Auswahl stehen,
           sonst wäre jeder auslaufende Vertrag ein Zwangsabgang. */
        if (game.career.phase === 'national') {
          var stay = FKC.coachNational.stayOffer(game);
          if (stay) p.offers.unshift(stay);
        }
      }
      return {
        kind: 'jobChoice', age: game.identity.age, free: !!p.free,
        offers: p.offers,
        contract: game.status.contract,
        compensation: game.status.contract && game.status.contract.yearsLeft > 0
          ? FKC.coachMarket.compensation(game) : 0,
        national: game.career.phase === 'national',
        canRetire: game.identity.age >= 58,
        canQuit: !!game.status.contract && !game.flags.wantsOut &&
                 game.career.phase !== 'national',
        wantsOut: !!game.flags.wantsOut,
        result: p.result ? C.describeResult(game, p.result) : null
      };
    }

    if (p.kind === 'nationalOffer') {
      return {
        kind: 'nationalOffer', age: game.identity.age,
        offer: p.offer,
        nation: FKC.data.nationById(p.offer.nationId),
        contract: game.status.contract,
        result: p.result ? C.describeResult(game, p.result) : null
      };
    }

    if (p.kind === 'contract') {
      return {
        kind: 'contract', age: game.identity.age,
        clubId: p.clubId, clubName: p.name, short: p.short, color: p.color,
        leagueName: p.leagueName, mandate: p.mandate,
        offerKind: p.offerKind, fee: p.fee || 0, free: !!p.free,
        terms: p.terms, base: p.base, round: p.round || 0,
        current: game.status.contract,
        result: p.result ? C.describeResult(game, p.result) : null
      };
    }

    if (p.kind === 'retire') {
      if (!p.summary) p.summary = C.buildRetrospective(game);
      return { kind: 'retire', summary: p.summary };
    }

    return null;
  };

  C.describeResult = function (game, res) {
    return {
      text: (res.textKey ? FKC.t(res.textKey, res.params || {}) : (res.text || '')) +
            (res.extraKey ? ' ' + FKC.t(res.extraKey, res.params || {}) : ''),
      chips: FKC.coachEffects.describeAll(game, res.effects || []),
      tone: res.tone || 'good'
    };
  };

  function lastRecord(game) {
    var s = game.career.seasons;
    return s.length ? s[s.length - 1] : null;
  }
  C.lastRecord = lastRecord;

  /* ══ Entscheidung treffen ═════════════════════════════════════════ */

  C.choose = function (choiceId) {
    var game = FKC.state.game;
    var p = game.pending;
    if (!p) return null;

    /* Das Transferfenster bleibt offen, bis man es selbst schliesst —
       es ist der einzige Bildschirm mit mehreren Handlungen. */
    if (p.kind === 'transferWindow') {
      C.transferAction(game, choiceId);
      FKC.save.write();
      return null;
    }

    if (p.result) return null;
    var res = null;

    if (p.kind === 'scene') {
      res = FKC.events.resolve(game, C.sceneSource(game), choiceId);

    } else if (p.kind === 'prep') {
      res = C.chooseWork(game, choiceId);

    } else if (p.kind === 'jobChoice') {
      res = C.chooseJob(game, choiceId);

    } else if (p.kind === 'nationalOffer') {
      res = C.chooseNational(game, choiceId);

    } else if (p.kind === 'contract') {
      res = C.chooseContract(game, choiceId);
    }

    if (!res) return null;
    p.result = res;
    FKC.save.write();
    return C.describeResult(game, res);
  };

  /** Quittieren — verkettete Szenen beachten */
  C.ack = function () {
    var game = FKC.state.game;
    var p = game.pending;

    if (p && p.continueAfter) {
      p.continueAfter = false;
      p.result = null;
      FKC.save.write();
      return C.describePending(game);
    }

    game.pending = (p && p.next) ? p.next : null;
    FKC.save.write();
    return C.nextScene();
  };

  /* ── Saisonvorbereitung ─────────────────────────────────────────── */

  /** Ausrichtung umschalten — noch keine Auflösung */
  C.setApproach = function (game, key) {
    if (!game.pending || game.pending.kind !== 'prep') return null;
    if (FKC.coachSeason.approachIds.indexOf(key) < 0) return null;
    game.pending.approach = key;
    return key;
  };

  C.chooseWork = function (game, id) {
    var opt = FKC.util.byId(WORK, id);
    if (!opt) return null;

    var approach = (game.pending && game.pending.approach) || 'balanced';
    game.tactics.approach = approach;
    game.tactics.focus = opt.focus;
    game.tick.prepDone = true;

    /* Wer seiner Handschrift treu bleibt, prägt sie weiter aus */
    game.flags.philosophyKept = true;

    var fx = opt.effects.slice();
    FKC.coachEffects.apply(game, fx);

    return {
      textKey: 'cwork.' + id + '_r',
      params: {},
      effects: fx,
      extraKey: 'capproach.' + approach + '_r',
      tone: approach === 'attack' ? 'mixed' : 'good'
    };
  };

  /* ── Transferfenster ────────────────────────────────────────────── */

  C.transferAction = function (game, key) {
    var p = game.pending;
    p.feed = p.feed || [];

    if (key === 'done') {
      game.tick.transferDone = true;
      game.pending = null;
      return;
    }

    /* Schlüssel sind "buy:<key>" bzw. "sell:<key>" — die Präfixe sind
       verschieden lang, deshalb am Doppelpunkt trennen und nicht an
       einer festen Position. */
    var sep = key.indexOf(':');
    if (sep < 0) return;
    var kind = key.slice(0, sep);
    var id = key.slice(sep + 1);

    if (kind === 'buy') {
      var buy = null;
      (p.buys || []).forEach(function (o) { if (o.key === id) buy = o; });
      if (!buy || buy.done) return;
      var bought = FKC.coachSquad.buy(game, buy);
      if (!bought) {
        p.feed.push({ tone: 'bad', key: 'ctransfer.cannotAfford',
                      params: { name: buy.player.name } });
        return;
      }
      buy.done = true;
      p.feed.push({ tone: 'good', key: 'ctransfer.bought',
                    params: { name: bought.name, fee: FKC.i18n.money(buy.fee) } });
      FKC.state.logTimeline({
        text: { key: 'ctl.signed', params: { name: bought.name } }, mark: 'plain' });
      return;
    }

    if (kind === 'sell') {
      var sell = null;
      (p.sells || []).forEach(function (o) { if (o.key === id) sell = o; });
      if (!sell || sell.done) return;
      var sold = FKC.coachSquad.sell(game, sell);
      if (!sold) return;
      sell.done = true;
      /* Der Kader hat sich geändert — die Kaufliste passt nicht mehr */
      p.buys = FKC.coachSquad.transferTargets(game, 5);
      p.feed.push({ tone: sell.starter ? 'mixed' : 'good', key: 'ctransfer.sold',
                    params: { name: sold.name, fee: FKC.i18n.money(sell.fee) } });
      FKC.state.logTimeline({
        text: { key: 'ctl.sold', params: { name: sold.name } }, mark: 'plain' });
    }
  };

  /* ══ Saison ═══════════════════════════════════════════════════════ */

  C.runSeason = function (game) {
    var national = game.career.phase === 'national';
    var record = national ? FKC.coachNational.season(game) : FKC.coachSeason.run(game);

    var bonus = game.flags.growthBonus || 0;
    game.flags.growthBonus = 0;

    var club = FKC.state.club();
    var quality;
    if (national) {
      var nat = FKC.data.nationById(game.national.teamId);
      quality = nat ? clamp(nat.strength, 40, 99) : 70;
    } else if (club) {
      var lg = FKC.data.leagueOf(club);
      quality = clamp(Math.round(club.facilities * 0.45 +
        (lg ? lg.strength : 60) * 0.35 + club.prestige * 0.20), 20, 99);
    } else {
      quality = 50;
    }

    var grow = FKC.coachAttr.yearly(game, {
      grade: record.grade,
      quality: quality,
      focus: game.tactics.focus,
      bonusPoints: bonus
    });

    record.ovrEnd = game.ovr;
    FKC.coachAttr.pushHistory(game);

    return { kind: 'seasonReview', record: record, deltas: grow.deltas };
  };

  /* ══ Vorstandsbewertung ═══════════════════════════════════════════
     Der Moment, in dem sich entscheidet, ob man den Posten behält.
     Das Ergebnis wird **einmal** gewürfelt und im pending abgelegt,
     damit ein Neuzeichnen nie ein anderes Urteil erzeugt.          */

  C.buildBoardReview = function (game) {
    var record = lastRecord(game) || { grade: 0, verdictKey: 'ok' };
    var national = game.career.phase === 'national';
    var club = FKC.state.club();

    /* Der Name muss **vor** einer möglichen Trennung feststehen — danach
       ist weder clubId noch teamId noch gesetzt. */
    var name = club ? club.name
             : (game.national.teamId ? FKC.data.nationName(game.national.teamId) : '');

    var risk = national ? FKC.coachNational.sackRisk(game)
                        : FKC.coachMarket.sackRisk(game);
    var sacked = risk > 0 && FKC.rng.chance(risk);
    var payoff = 0;

    if (sacked) {
      if (national) FKC.coachNational.leave(game);
      else payoff = FKC.coachMarket.sack(game).payoff;
    }

    return {
      kind: 'boardReview',
      record: record,
      grade: record.grade, verdictKey: record.verdictKey,
      mandate: record.mandate, bands: record.bands,
      risk: Math.round(risk * 100),
      sacked: sacked, payoff: payoff, national: national,
      clubName: name
    };
  };

  /* ══ Vereinsfrage ═════════════════════════════════════════════════ */

  C.chooseJob = function (game, key) {
    var p = game.pending;

    if (key === 'retire') {
      C.retire(game, 'choice');
      return { textKey: 'cjob.retire_r', params: {}, effects: [], tone: 'good' };
    }

    /* Von sich aus gehen: kostet Ruf, öffnet aber jede Tür */
    if (key === 'quit') {
      game.flags.wantsOut = true;
      var fx = [
        { type: 'boardTrust', delta: -25 },
        { type: 'fanMood', delta: -18 },
        { type: 'reputation', delta: -4 }
      ];
      FKC.coachEffects.apply(game, fx);
      FKC.state.logTimeline({
        text: { key: 'ctl.resignRequest', params: { club: (FKC.state.club() || {}).name || '' } },
        mark: 'bad'
      });
      p.continueAfter = true;
      p.offers = null;
      return { textKey: 'cjob.quit_r',
               params: { club: (FKC.state.club() || {}).name || '' },
               effects: fx, tone: 'mixed' };
    }

    /* Ohne Posten: ein Jahr aussetzen und auf das richtige Angebot warten */
    if (key === 'wait') {
      game.tick.idleHandled = true;
      game.career.freeYears = (game.career.freeYears || 0) + 1;
      FKC.coachSeason.idleYear(game);
      FKC.coachAttr.pushHistory(game);
      /* Ein Wartejahr kostet Ansehen — aber nur bis zu einem Boden.
         Ohne den fiele man beliebig tief und käme nie zurück. */
      var wfx = [{ type: 'pressure', delta: -20 }];
      if (game.status.reputation > 22) wfx.unshift({ type: 'reputation', delta: -4 });
      FKC.coachEffects.apply(game, wfx);
      return { textKey: 'cjob.wait_r', params: {}, effects: wfx, tone: 'mixed' };
    }

    var offer = null;
    (p.offers || []).forEach(function (o) { if (o.key === key) offer = o; });
    if (!offer) return null;

    /* Die Vereinsfrage ist mit dieser Wahl beantwortet — egal wie sie
       ausgeht. Ohne diesen Riegel konnte in **einem** Jahr zweimal
       gefragt werden (etwa weil `jobDue` wegen des Alters ohnehin immer
       true liefert), und der eben unterschriebene Verein stand danach
       mit null Spielen in der Vita. */
    if (game.tick) game.tick.jobDone = true;

    /* Beim eigenen Verein bzw. beim Verband bleiben */
    if (offer.stay) {
      var ct = game.status.contract;
      if (ct && ct.yearsLeft > 1) {
        return { textKey: 'cjob.stay_r', params: { club: offer.name },
                 effects: [], tone: 'good' };
      }
      /* Ein Verband hat keinen Verein, an dem die Vertragsmaschine
         hängt — die Verlängerung wird deshalb direkt abgeschlossen. */
      if (offer.national) {
        var nfx = FKC.coachNational.renew(game, offer);
        return {
          textKey: 'ccontract.signed.stay',
          params: { club: offer.name, years: game.status.contract.yearsLeft,
                    salary: FKC.i18n.money(offer.salary) },
          effects: nfx, tone: 'good'
        };
      }
      p.next = C.makeContractPending(game, offer, 'renew');
      return { textKey: 'cjob.toTable_r', params: { club: offer.name },
               effects: [], tone: 'good' };
    }

    /* Wechsel: der abgebende Verein muss zustimmen */
    var deal = FKC.coachMarket.clubsAgree(game, offer);
    if (!deal.ok) {
      return {
        textKey: 'cjob.noDeal_r',
        params: { club: offer.name, fee: FKC.i18n.money(deal.fee),
                  current: (FKC.state.club() || {}).name || '' },
        effects: FKC.coachEffects.apply(game, [{ type: 'pressure', delta: 6 }]),
        tone: 'bad'
      };
    }

    p.next = C.makeContractPending(game, offer, deal.free ? 'free' : 'release', deal.fee);
    return {
      textKey: deal.free ? 'cjob.freeAgreed_r'
             : deal.reason === 'unwanted' ? 'cjob.released_r' : 'cjob.agreed_r',
      params: { club: offer.name, fee: FKC.i18n.money(deal.fee) },
      effects: [], tone: 'good'
    };
  };

  C.makeContractPending = function (game, offer, offerKind, fee) {
    var terms = FKC.coachMarket.openingTerms(game, offer);
    return {
      kind: 'contract', offerKind: offerKind,
      clubId: offer.clubId, name: offer.name, short: offer.short, color: offer.color,
      leagueName: offer.leagueName, mandate: offer.mandate,
      rating: offer.rating, abroad: offer.abroad, free: offerKind === 'free',
      fee: fee || 0,
      base: { years: terms.years, salary: terms.salary },
      terms: terms, round: 0
    };
  };

  /* ── Vertragsverhandlung ────────────────────────────────────────── */

  C.chooseContract = function (game, key) {
    var p = game.pending;

    if (key === 'accept') {
      var res = FKC.coachMarket.signContract(game, p);
      game.flags.wantsOut = false;
      return res;
    }

    if (key === 'decline') {
      if (p.offerKind === 'renew') {
        game.flags.leavingClub = true;
        return {
          textKey: 'ccontract.declined.renew', params: { club: p.name },
          effects: FKC.coachEffects.apply(game, [{ type: 'boardTrust', delta: -12 }]),
          tone: 'mixed'
        };
      }
      if (!game.status.clubId) game.tick.idleHandled = true;
      return { textKey: 'ccontract.declined.other', params: { club: p.name },
               effects: [], tone: 'mixed' };
    }

    var what = key === 'years' ? 'years' : 'money';
    var out = FKC.coachMarket.negotiate(game, p, what, lastRecord(game));
    p.round = (p.round || 0) + 1;
    p.terms = out.terms;

    if (out.outcome === 'withdrawn') {
      p.withdrawn = true;
      if (p.offerKind === 'renew') game.flags.leavingClub = true;
      if (!game.status.clubId) game.tick.idleHandled = true;
      return {
        textKey: 'ccontract.counter.withdrawn', params: { club: p.name },
        effects: FKC.coachEffects.apply(game, [{ type: 'pressure', delta: 8 }]),
        tone: 'bad'
      };
    }

    p.continueAfter = true;
    return {
      textKey: 'ccontract.counter.' + out.outcome + '.' + what,
      params: { club: p.name, salary: FKC.i18n.money(p.terms.salary),
                years: p.terms.years },
      effects: [], tone: out.outcome === 'refused' ? 'mixed' : 'good'
    };
  };

  /* ── Angebot des Verbands ───────────────────────────────────────── */

  C.chooseNational = function (game, key) {
    var p = game.pending;
    if (key === 'decline') {
      game.flags.natOfferOpen = false;
      return {
        textKey: 'cnational.declined_r',
        params: { nation: p.offer.name },
        effects: FKC.coachEffects.apply(game, [{ type: 'boardTrust', delta: 5 }]),
        tone: 'plain'
      };
    }
    if (key !== 'accept') return null;

    var fx = FKC.coachNational.accept(game, p.offer);
    /* Ein neuer Posten heisst: das laufende Jahr beginnt von vorn */
    C.beginYear(game);
    return {
      textKey: 'cnational.accepted_r',
      params: { nation: p.offer.name, salary: FKC.i18n.money(p.offer.salary),
                mandate: FKC.t('mandate.' + p.offer.mandate) },
      effects: fx, tone: 'good'
    };
  };

  /* ══ Jahreswechsel ════════════════════════════════════════════════ */

  C.advanceYear = function (game) {
    FKC.state.advanceCalendar(game, 1);

    if (game.status.clubId || game.career.phase === 'national') {
      game.status.seasonsAtClub += 1;
    }
    if (game.status.contract) {
      game.status.contract.yearsLeft = Math.max(0, game.status.contract.yearsLeft - 1);
    }

    /* Vertrag ausgelaufen und nicht verlängert → ohne Posten */
    if (game.flags.leavingClub) {
      game.flags.leavingClub = false;
      var old = FKC.state.club();
      for (var i = game.career.clubsManaged.length - 1; i >= 0; i--) {
        if (game.career.clubsManaged[i].clubId === game.status.clubId &&
            game.career.clubsManaged[i].to == null) {
          game.career.clubsManaged[i].to = game.identity.year; break;
        }
      }
      game.status.clubId = null;
      game.status.clubType = 'none';
      game.status.contract = null;
      game.status.mandate = null;
      game.status.seasonsAtClub = 0;
      game.status.contComp = null;
      game.squad.players = [];
      game.squad.budget = { transfer: 0, wage: 0, wageUsed: 0 };
      game.career.phase = 'unemployed';
      FKC.state.logTimeline({
        text: { key: 'ctl.contractEnded', params: { club: old ? old.name : '' } },
        mark: 'plain'
      });
    }

    /* Der Kader wird ein Jahr älter — Entwicklung, Abgänge, Nachrücker */
    if (game.status.clubId) {
      FKC.coachSquad.progress(game);
      var club = FKC.state.club();
      if (club) FKC.coachSquad.setBudgets(game, club);
    }

    game.flags.wantsOut = false;
    game.flags.natOfferOpen = false;

    if (FKC.coachMarket.shouldRetire(game)) C.retire(game, 'age');

    C.beginYear(game);
    FKC.save.write();
  };

  /* ══ Karriereende ═════════════════════════════════════════════════ */

  C.retire = function (game, reason) {
    game.career.phase = 'retired';
    game.career.retiredAt = game.identity.age;
    game.career.retireReason = reason || 'age';
    var club = FKC.state.club();

    /* Die laufende Station abschliessen. Wer kurz vor Schluss noch
       unterschrieben und dann aufgehört hat, ohne ein einziges Spiel zu
       leiten, hat dort auch nichts verloren — solche Einträge kommen
       sonst ohne Bilanz und ohne Endjahr in den Rückblick. */
    for (var i = game.career.clubsManaged.length - 1; i >= 0; i--) {
      var st = game.career.clubsManaged[i];
      if (st.to != null) continue;
      if ((st.matches || 0) === 0 && !st.national) game.career.clubsManaged.splice(i, 1);
      else st.to = game.identity.year;
      break;
    }

    FKC.state.logTimeline({
      text: { key: 'ctl.retired', params: { club: club ? club.name : '', age: game.identity.age } },
      mark: 'plain'
    });
    game.pending = { kind: 'retire' };
    FKC.save.write();
  };

  /* ── Karrierewertung ──────────────────────────────────────────────
     Dieselbe Idee wie beim Spieler: fünf benannte Bereiche, die der
     Rückblick einzeln ausweist.                                    */

  var TROPHY_WEIGHT = { national: 110, cont1: 70, cont2: 32, league: 40, cup: 18 };
  var CONT_TOP = ['cont.ucl', 'cont.lib', 'cont.ccc', 'cont.acl'];
  var AWARD_WEIGHT = { coachOfYear: 35, coachOfTournament: 55 };

  C.scoreCareer = function (game) {
    var tot = game.career.totals;

    /* 1 — Höchstes je erreichtes Rating */
    var rating = Math.pow(Math.max(0, game.peakOvr - 55), 1.35) * 3.2;

    /* 2 — Titel nach Art */
    var trophies = 0;
    game.career.trophies.forEach(function (tr) {
      if (tr.national) trophies += TROPHY_WEIGHT.national;
      else if (tr.compId.indexOf('cont.') === 0) {
        trophies += CONT_TOP.indexOf(tr.compId) >= 0 ? TROPHY_WEIGHT.cont1 : TROPHY_WEIGHT.cont2;
      } else if (tr.compId.indexOf('league.') === 0) trophies += TROPHY_WEIGHT.league;
      else trophies += TROPHY_WEIGHT.cup;
    });

    /* 3 — Nationalmannschaft */
    var national = 0;
    (game.national.tournaments || []).forEach(function (x) {
      if (!x.qualified) return;
      national += x.result === 'won' ? 70 : x.result === 'final' ? 35
                : x.result === 'semi' ? 18 : 6;
    });
    if (game.national.since) national += 25;

    /* 4 — Die nackte Bilanz: Punkte pro Spiel über die ganze Laufbahn */
    var ppg = tot.matches > 0 ? tot.points / tot.matches : 0;
    var record = Math.max(0, (ppg - 1.15)) * 320 + Math.min(120, tot.matches * 0.12);

    /* 5 — Individuelle Auszeichnungen */
    var awards = 0;
    game.career.awards.forEach(function (a) {
      awards += AWARD_WEIGHT[a.id] != null ? AWARD_WEIGHT[a.id] : 15;
    });
    if (game.flags.institutionAt) awards += 30;

    var parts = {
      rating: Math.round(rating), trophies: Math.round(trophies),
      national: Math.round(national), record: Math.round(record),
      awards: Math.round(awards)
    };
    return {
      parts: parts,
      total: parts.rating + parts.trophies + parts.national + parts.record + parts.awards
    };
  };

  /** Karrierenote 0–100 auf derselben Skala wie beim Spieler */
  C.careerRating = function (score, peakOvr) {
    var stuetzen = [[0, 0], [95, 12], [170, 25], [360, 42], [520, 58],
                    [760, 75], [1100, 86], [1500, 93], [2800, 99]];
    var note = 100;
    for (var i = 1; i < stuetzen.length; i++) {
      if (score <= stuetzen[i][0]) {
        var a = stuetzen[i - 1], b = stuetzen[i];
        note = a[1] + (score - a[0]) / (b[0] - a[0]) * (b[1] - a[1]);
        break;
      }
    }
    if (peakOvr != null) {
      if (peakOvr < 70) note = Math.min(note, 62);
      else if (peakOvr < 77) note = Math.min(note, 74);
      else if (peakOvr < 83) note = Math.min(note, 85);
      else if (peakOvr < 88) note = Math.min(note, 92);
    }
    return clamp(Math.round(note), 0, 100);
  };

  C.buildRetrospective = function (game) {
    var tot = game.career.totals;

    var byComp = {};
    game.career.trophies.forEach(function (tr) {
      var key = tr.compId;
      if (!byComp[key]) {
        byComp[key] = { name: tr.name || FKC.data.compName(tr.compId),
                        compId: tr.compId, count: 0, national: !!tr.national };
      }
      byComp[key].count++;
    });

    var scored = C.scoreCareer(game);
    var verdict = FKC.data.coachVerdictFor(scored.total, game.peakOvr);

    return {
      score: scored.total,
      rated: C.careerRating(scored.total, game.peakOvr),
      parts: scored.parts,
      verdictId: verdict.id,
      peakOvr: game.peakOvr,
      retiredAt: game.career.retiredAt || game.identity.age,
      seasons: game.career.seasons.length,
      totals: tot,
      ppg: tot.matches > 0 ? FKC.util.round(tot.points / tot.matches, 2) : 0,
      clubs: game.career.clubsManaged.slice(),
      sackings: game.career.sackings || 0,
      trophies: Object.keys(byComp).map(function (k) { return byComp[k]; })
                 .sort(function (a, b) { return b.count - a.count; }),
      awards: game.career.awards.slice(),
      national: {
        nationId: game.national.teamId,
        since: game.national.since,
        tournaments: (game.national.tournaments || []).slice()
      },
      philosophy: game.hidden.philosophy,
      philosophyLevel: game.hidden.philosophyLevel,
      finances: game.career.finances.balance
    };
  };

  FKC.coachCareer = C;

})(window.FKC);
