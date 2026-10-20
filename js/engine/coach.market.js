/* ── Trainermarkt ──────────────────────────────────────────────────────
   Verträge, Angebote, Entlassung und der Weg zur Nationalmannschaft.

   Das Grundprinzip ist dasselbe wie beim Spieler (Laufzeit + Gehalt,
   Gegenangebot, Rückzug des Angebots), mit einer Ergänzung, die es nur
   beim Trainer gibt: Entlassungsrisiko. Bleiben die Ergebnisse hinter
   der Erwartung zurück, verliert man den Posten — das Gegenstück zum
   Vereinslos-Werden in der Spielerkarriere. Je grösser und
   ambitionierter der Verein, desto enger das Zeitfenster.           */

window.FKC = window.FKC || {};

(function (FKC) {
  'use strict';

  var M = {};
  var clamp = function (v, a, b) { return FKC.util.clamp(v, a, b); };

  /* ══ Gehaltsniveau ════════════════════════════════════════════════ */

  M.estimateSalary = function (club, game, factor) {
    var base = Math.pow(1.135, Math.max(0, game.ovr - 40)) * 95000;
    base *= 0.25 + club.finances / 70;
    var lg = FKC.data.leagueOf(club);
    if (lg) base *= 0.55 + lg.strength / 95;
    base *= 0.85 + game.status.reputation / 220;
    base *= 1 + Math.min(0.35, game.career.trophies.length * 0.025);
    if (game.identity.age >= 63) base *= 0.85;
    return Math.max(30000, Math.round(base * (factor || 1) / 10000) * 10000);
  };

  /* ══ Marktniveau des Trainers ═════════════════════════════════════
     Welche Vereine überhaupt anrufen. Muss dicht am Rating liegen —
     Vereinsniveau und Trainerrating laufen auf derselben Skala.    */

  M.marketLevel = function (game, record) {
    var v = game.ovr + (game.status.reputation - 40) / 8;
    if (record) {
      v += record.grade * 3.5;
      v += (record.trophies || []).length * 3;
      if (record.move && record.move.dir === 'up') v += 4;
      if (record.move && record.move.dir === 'down') v -= 6;
    }
    v += Math.min(6, game.career.trophies.length * 0.8);
    if (game.identity.age >= 64) v -= (game.identity.age - 63) * 2.4;
    /* Wer gerade entlassen wurde, ruft kein Spitzenverein an */
    if (game.flags.justSacked) v -= 7;
    return v;
  };

  /* ══ Bewertungsachsen ═════════════════════════════════════════════
     Dieselben drei Achsen wie beim Spieler, nur mit Trainerinhalt:
     sportliche Aufgabe, Geld, Risiko des Postens.                  */

  M.rate = function (game, club, mandate, salary) {
    var lvl = FKC.data.clubLevel(club);
    var cur = FKC.state.club();
    var curLvl = cur ? FKC.data.clubLevel(cur) : lvl - 6;
    var curSalary = game.status.contract ? game.status.contract.salary : salary * 0.65;
    var lg = FKC.data.leagueOf(club);
    var curLg = cur ? FKC.data.leagueOf(cur) : null;

    /* Sportlich: eine Aufgabe, die zum eigenen Stand passt — nicht zu
       klein, nicht drei Nummern zu gross. */
    var gap = lvl - game.ovr;
    var sport = 72 - Math.abs(gap - 2) * 3.2;
    if (lg && curLg) sport += clamp((lg.strength - curLg.strength) * 0.5, -12, 12);
    sport += (club.prestige - 62) * 0.14;
    if (mandate === 'title') sport += 10;
    else if (mandate === 'europe') sport += 6;
    else if (mandate === 'survive') sport -= 8;
    sport = clamp(Math.round(sport), 3, 99);

    var money = clamp(Math.round(38 + (salary / Math.max(1, curSalary) - 1) * 55), 3, 99);

    /* Risiko: wie schnell dieser Posten einen ausspuckt */
    var bands = FKC.data.mandateBands(mandate, lg ? lg.clubCount : 18);
    var risk = 26 + (club.prestige - 60) * 0.35;
    risk += (5 - bands.patience) * 7;
    if (lg && curLg && lg.country !== curLg.country) risk += 20;
    if (lg && curLg && lg.conf !== curLg.conf) risk += 10;
    risk += Math.max(0, gap - 4) * 2.4;
    risk += clamp((90 - game.hidden.adaptability) * 0.24, 0, 22);
    risk -= FKC.data.coachTraitBonus(game, 'pressureRes') * 0.3;
    risk = clamp(Math.round(risk), 4, 97);

    return { sport: sport, money: money, risk: risk };
  };

  M.tagsFor = function (kind, rating, club, mandate) {
    var tags = [];
    if (kind === 'money') tags.push('ctag.money');
    if (kind === 'step') tags.push('ctag.project');
    if (kind === 'sport') tags.push('ctag.step');
    tags.push('mandate.' + mandate);
    if (club.prestige >= 84) tags.push('tag.bigName');
    if (rating.risk >= 62) tags.push('ctag.hotSeat');
    if (club.facilities >= 86) tags.push('tag.topFacilities');
    return tags.slice(0, 3);
  };

  /* ══ Angebote nach der Saison ═════════════════════════════════════ */

  M.buildOffers = function (game, record) {
    var r = FKC.rng;
    var cur = FKC.state.club();
    var curLg = cur ? FKC.data.leagueOf(cur) : null;
    var lvl = M.marketLevel(game, record);
    var offers = [];

    var contract = game.status.contract || { yearsLeft: 1, salary: 200000 };
    var expiring = contract.yearsLeft <= 1;

    /* Wie viel Interesse gibt es überhaupt? Ein Trainer, der geliefert
       hat, bekommt Anrufe; einer, der abgestiegen ist, nicht. */
    var interest = clamp(
      (record ? record.grade * 0.9 : 0) +
      (game.status.reputation - 40) / 20 +
      (expiring ? 0.7 : 0) +
      (game.identity.age >= 62 ? -1.2 : 0) +
      FKC.data.coachTraitBonus(game, 'offerBoost') * 3 +
      r.float(-0.7, 1.0), -1, 3.2);

    var count = interest < 0.3 ? 0 : interest < 1.2 ? 1 : interest < 2.2 ? 2 : 3;

    if (count > 0) {
      var kinds = r.shuffle(['sport', 'step', 'money']).slice(0, count);
      var used = [cur && cur.id];

      kinds.forEach(function (kind, i) {
        var target, factor;
        if (kind === 'money') { target = lvl + r.int(5, 11); factor = r.float(1.6, 2.6); }
        else if (kind === 'sport') { target = lvl + r.int(1, 7); factor = r.float(1.15, 1.7); }
        else { target = lvl - r.int(2, 9); factor = r.float(0.85, 1.25); }

        var club = M.sampleClub(target, used, game);
        if (!club) return;
        used.push(club.id);

        var mandate = FKC.data.coachMandate(club);
        var salary = M.estimateSalary(club, game, factor);
        var rating = M.rate(game, club, mandate, salary);
        var lg = FKC.data.leagueOf(club);

        offers.push({
          key: 'o' + i, kind: kind,
          clubId: club.id, name: club.name, short: club.short, color: club.color,
          leagueName: lg ? lg.name : '', country: lg ? lg.country : null,
          abroad: !!(curLg && lg && lg.country !== curLg.country),
          level: FKC.data.clubLevel(club),
          salary: salary, mandate: mandate, rating: rating,
          tagKeys: M.tagsFor(kind, rating, club, mandate)
        });
      });

      offers.forEach(function (o) {
        o.chance = Math.round(M.clubsAgree(game, o, true).chance * 100);
      });
    }

    /* Bleiben ist immer möglich — solange man den Posten noch hat */
    if (cur) {
      var stayMandate = game.status.mandate || FKC.data.coachMandate(cur);
      var perf = record ? record.grade * 0.18 : 0;
      var renewSalary = expiring
        ? M.estimateSalary(cur, game, clamp(1.05 + perf, 0.8, 2.0))
        : contract.salary;
      var stayRating = M.rate(game, cur, stayMandate, renewSalary);
      stayRating.risk = Math.max(4, Math.round(stayRating.risk * 0.55));

      offers.push({
        key: 'stay', kind: 'stay', stay: true,
        clubId: cur.id, name: cur.name, short: cur.short, color: cur.color,
        leagueName: curLg ? curLg.name : '', country: curLg ? curLg.country : null,
        level: FKC.data.clubLevel(cur),
        salary: renewSalary, mandate: stayMandate,
        renew: expiring, rating: stayRating,
        tagKeys: M.stayTags(game)
      });
    }

    return offers;
  };

  M.stayTags = function (game) {
    var tags = ['ctag.knownClub'];
    var s = game.status.seasonsAtClub;
    if (s >= 7) tags.push('ctag.institution');
    else if (s >= 4) tags.push('ctag.established');
    if (game.standing.fanMood >= 75) tags.push('ctag.lovedHere');
    if (game.standing.boardTrust < 40) tags.push('ctag.thinIce');
    return tags.slice(0, 3);
  };

  /** Vereine im Zielfenster, höchstens einer pro Liga */
  M.sampleClub = function (targetLevel, exclude, game) {
    var r = FKC.rng;
    var ex = (exclude || []).filter(Boolean);
    var rep = game.status.reputation;

    function collect(lo, hi) {
      return FKC.data.clubs.filter(function (c) {
        if (ex.indexOf(c.id) >= 0) return false;
        var lg = FKC.data.leagueOf(c);
        if (!lg) return false;
        /* Ein Spitzenverein holt keinen unbekannten Trainer */
        if (c.prestige >= 92 && rep < 76) return false;
        if (c.prestige >= 85 && rep < 60) return false;
        if (c.prestige >= 76 && rep < 40) return false;
        var lvl = FKC.data.clubLevel(c);
        return lvl >= lo && lvl <= hi;
      });
    }

    /* Fenster schrittweise öffnen. Der letzte Schritt lässt das Niveau
       ganz fallen: Wer sehr tief gesunken ist, liegt sonst unter dem
       schwächsten Verein der Datenbank und bekäme überhaupt kein
       Angebot mehr — die Karriere stünde bis zum Rücktritt still. */
    var pool = collect(targetLevel - 10, targetLevel + 10);
    if (!pool.length) pool = collect(targetLevel - 20, targetLevel + 18);
    if (!pool.length) pool = collect(-999, targetLevel + 30);
    if (!pool.length) pool = collect(-999, 999);
    if (!pool.length) return null;

    var scored = pool.map(function (c) {
      var d = Math.abs(FKC.data.clubLevel(c) - targetLevel);
      return { club: c, w: (1 / (1 + d / 4)) * r.float(0.5, 1.5) };
    });
    scored.sort(function (a, b) { return b.w - a.w; });
    return scored[0].club;
  };

  /* ══ Angebote als Vereinsloser ════════════════════════════════════ */

  M.freeOffers = function (game) {
    var r = FKC.rng;
    var lvl = M.marketLevel(game, null) - 5;
    var age = game.identity.age;

    var interest = (game.ovr - 58) / 8 + (game.status.reputation - 40) / 22;
    if (age >= 66) interest -= 2.2;
    else if (age >= 63) interest -= 1.1;
    if (game.career.sackings >= 3) interest -= 0.8;
    interest += FKC.data.coachTraitBonus(game, 'offerBoost') * 3;
    interest += r.float(-0.6, 0.9);

    var count = interest < -0.2 ? 0 : interest < 0.9 ? 1 : interest < 2 ? 2 : 3;

    /* Wer länger als eine Saison ohne Posten ist, bekommt in jedem Fall
       eine Adresse angeboten — irgendwo tiefer nimmt immer jemand einen
       erfahrenen Trainer. Ohne diesen Ausweg dreht sich die Spirale
       endlos: kein Verein → weniger Ansehen → erst recht kein Verein,
       und die Karriere steht bis zum Rücktritt still. Dasselbe Prinzip
       wie beim Spieler, der kaum spielt (`starved` in transfer.js). */
    var stranded = (game.career.freeYears || 0) >= 1;
    if (stranded) count = Math.max(count, 1);

    var offers = [], used = [];

    for (var i = 0; i < count; i++) {
      /* Nach längerer Pause wird das Zielniveau spürbar tiefer gesetzt */
      var drop = stranded
        ? Math.min(24, r.int(6, 16) + (game.career.freeYears || 0) * 2)
        : r.int(0, 8);
      var club = M.sampleClub(lvl - drop, used, game);
      if (!club) break;
      used.push(club.id);
      var mandate = FKC.data.coachMandate(club);
      var salary = M.estimateSalary(club, game, r.float(0.7, 1.1));
      var rating = M.rate(game, club, mandate, salary);
      var lg = FKC.data.leagueOf(club);
      offers.push({
        key: 'f' + i, kind: 'free', free: true,
        clubId: club.id, name: club.name, short: club.short, color: club.color,
        leagueName: lg ? lg.name : '', country: lg ? lg.country : null,
        abroad: lg && lg.country !== FKC.data.youthCountry(game.identity.nationality),
        level: FKC.data.clubLevel(club),
        salary: salary, mandate: mandate, rating: rating,
        chance: 100,
        tagKeys: ['ctag.freeNow'].concat(M.tagsFor('step', rating, club, mandate)).slice(0, 3)
      });
    }
    return offers;
  };

  /* ══ Einigen sich die Vereine? ════════════════════════════════════
     Auch ein Trainer steht unter Vertrag. Ein Wechsel während der
     Laufzeit braucht die Zustimmung des aktuellen Vereins — oder eine
     Ablöse. Der stärkste Hebel ist paradoxerweise ein Vorstand, der
     einen ohnehin loswerden will.                                   */

  M.compensation = function (game) {
    var ct = game.status.contract;
    if (!ct || ct.yearsLeft <= 0) return 0;
    var base = ct.salary * Math.max(1, ct.yearsLeft) * 0.65;
    if (game.career.trophies.length) base *= 1 + Math.min(0.5, game.career.trophies.length * 0.05);
    /* Ein Verein, der ohnehin zweifelt, verlangt weniger */
    base *= 0.6 + (game.standing.boardTrust / 100) * 0.8;
    return Math.round(base / 100000) * 100000;
  };

  M.clubsAgree = function (game, offer, nurRechnen) {
    var cur = FKC.state.club();
    var ct = game.status.contract;

    if (!cur || !ct || ct.yearsLeft <= 0) {
      var pFrei = 0.9;
      return { ok: nurRechnen ? false : FKC.rng.chance(pFrei),
               free: true, fee: 0, chance: pFrei, reason: 'free' };
    }

    var buyer = FKC.data.clubById(offer.clubId);
    var power = Math.pow(1.085, (buyer ? buyer.finances : 60) - 40) * 900000;
    var fee = M.compensation(game);

    var p = 0.20;
    var reason = 'none';

    if (ct.yearsLeft <= 1) { p += 0.50; reason = 'expiring'; }
    else if (ct.yearsLeft === 2) p += 0.18;
    else if (ct.yearsLeft >= 4) p -= 0.05;

    /* Der eigentliche Hebel: wenn der Vorstand nicht mehr überzeugt
       ist, lässt er einen ziehen — oft erleichtert. */
    if (game.standing.boardTrust < 42) { p += 0.42; if (reason === 'none') reason = 'unwanted'; }
    else if (game.standing.boardTrust > 80) p -= 0.18;

    if (game.standing.pressure >= 60) { p += 0.20; if (reason === 'none') reason = 'unwanted'; }

    p += clamp((power / Math.max(1, fee) - 1) * 0.16, -0.06, 0.22);
    if (reason === 'none' && p >= 0.55) reason = 'agreed';

    p = clamp(p, 0.04, 0.94);
    return { ok: nurRechnen ? false : FKC.rng.chance(p),
             free: false, fee: fee, chance: p, reason: reason, buyer: buyer };
  };

  M.transferChance = function (game, offer) {
    return M.clubsAgree(game, offer, true).chance;
  };

  /* ══ Vertragsverhandlung ══════════════════════════════════════════ */

  M.openingTerms = function (game, offer) {
    var age = game.identity.age;
    var years = age <= 45 ? FKC.rng.int(2, 4)
              : age <= 56 ? FKC.rng.int(2, 3) : FKC.rng.int(1, 2);
    return { years: years, salary: offer.salary };
  };

  M.negotiate = function (game, pending, what, record) {
    var club = FKC.data.clubById(pending.clubId);
    var lvl = M.marketLevel(game, record);
    var clubLvl = club ? FKC.data.clubLevel(club) : lvl;

    var leverage = (lvl - clubLvl) * 0.035
      + (game.status.reputation - 45) / 170
      + Math.min(0.18, game.career.trophies.length * 0.02)
      - pending.round * 0.34;
    if (game.identity.age >= 62) leverage -= 0.22;
    if (!game.status.clubId) leverage -= 0.18;      // ohne Posten schwache Position
    if (game.flags.justSacked) leverage -= 0.12;

    var p = clamp(0.30 + leverage, 0.03, 0.64);
    var roll = FKC.rng.next();
    var terms = { years: pending.terms.years, salary: pending.terms.salary };

    if (roll < p) {
      if (what === 'money') terms.salary = Math.round(terms.salary * 1.26 / 10000) * 10000;
      else terms.years = Math.min(6, terms.years + 2);
      return { outcome: 'full', terms: terms };
    }
    if (roll < p + 0.22) {
      if (what === 'money') terms.salary = Math.round(terms.salary * 1.11 / 10000) * 10000;
      else terms.years = Math.min(6, terms.years + 1);
      return { outcome: 'partial', terms: terms };
    }

    var withdraw = clamp(0.10 + pending.round * 0.22 - leverage * 0.2, 0.05, 0.7);
    if (FKC.rng.chance(withdraw)) {
      return { outcome: 'withdrawn', terms: terms, withdrawn: true };
    }
    return { outcome: 'refused', terms: terms };
  };

  /* ══ Unterschreiben ═══════════════════════════════════════════════ */

  M.signContract = function (game, pending) {
    var club = FKC.state.clubById(pending.clubId);
    if (!club) {
      return { textKey: 'ccontract.signed.move', params: {}, effects: [], tone: 'plain' };
    }
    var staying = game.status.clubId === pending.clubId;
    var effects = [], textKey;
    var oldSalary = game.status.contract ? game.status.contract.salary : 0;

    if (staying) {
      textKey = 'ccontract.signed.stay';
      effects.push({ type: 'boardTrust', delta: 8 });
      effects.push({ type: 'fanMood', delta: 6 });
      effects.push({ type: 'dressingRoom', delta: 5 });

      if (game.status.seasonsAtClub >= 7 && !game.flags.institutionAt) {
        game.flags.institutionAt = club.id;
        effects.push({ type: 'reputation', delta: 8 });
        effects.push({ type: 'fanMood', delta: 12 });
        FKC.state.logTimeline({
          text: { key: 'ctl.institution', params: { club: club.name } }, mark: 'good' });
        textKey = 'ccontract.signed.institution';
      }

    } else {
      var rt = pending.rating || { sport: 55, money: 50, risk: 35 };
      var moneyDriven = rt.money - rt.sport;
      effects.push({ type: 'club', club: club, clubType: 'club' });

      if (moneyDriven > 25) {
        textKey = 'ccontract.signed.money';
        effects.push({ type: 'fanMood', delta: -8 });
        effects.push({ type: 'pressure', delta: 12 });
        game.flags.chasedMoney = true;
      } else if (rt.sport >= 60 && moneyDriven < 10) {
        textKey = 'ccontract.signed.sport';
        effects.push({ type: 'boardTrust', delta: 6 });
        effects.push({ type: 'growthBonus', points: 4 });
      } else {
        textKey = 'ccontract.signed.move';
      }

      /* Ein neues Land ist für einen Trainer eine echte Umstellung —
         Sprache, Medien, Kabine. */
      if (pending.abroad) {
        game.flags.movedAbroad = true;
        if (FKC.rng.chance(clamp((100 - game.hidden.adaptability) / 150, 0.1, 0.6))) {
          effects.push({ type: 'dressingRoom', delta: -10 });
          effects.push({ type: 'pressure', delta: 10 });
        } else {
          effects.push({ type: 'hidden', key: 'adaptability', delta: 4 });
        }
      }

      FKC.state.logTimeline({
        text: { key: 'ctl.newJob', params: { club: club.name } },
        mark: moneyDriven > 25 ? 'plain' : 'good'
      });
    }

    game.status.contract = {
      salary: pending.terms.salary,
      yearsLeft: pending.terms.years,
      signedYear: game.identity.year,
      mandate: pending.mandate || FKC.data.coachMandate(club)
    };
    game.status.mandate = game.status.contract.mandate;
    game.flags.justSacked = false;
    game.career.phase = 'club';

    FKC.coachEffects.apply(game, effects);

    return {
      textKey: textKey,
      params: { club: club.name, salary: FKC.i18n.money(pending.terms.salary),
                years: pending.terms.years, league: pending.leagueName || '',
                old: FKC.i18n.money(oldSalary),
                mandate: FKC.t('mandate.' + game.status.mandate) },
      effects: effects, tone: 'good'
    };
  };

  /* ══ Entlassungsrisiko ════════════════════════════════════════════
     Das trainertypische Gegenstück zum Vereinslos-Werden. Der Druck
     baut sich über Saisons auf; ein grosser Verein wartet kürzer.  */

  M.patienceOf = function (game) {
    var club = FKC.state.club();
    if (!club) return 4;
    var lg = FKC.data.leagueOf(club);
    var bands = FKC.data.mandateBands(game.status.mandate, lg ? lg.clubCount : 18);
    var lic = FKC.data.coachLicenceById(game.identity.licence);
    var p = bands.patience;
    /* Wer ganz unten eingestiegen ist, bekommt mehr Zeit als einer,
       der gleich bei einem ambitionierten Verein angefangen hat. */
    if (game.career.seasons.length <= 2 && lic) p += lic.patience;
    if (game.flags.institutionAt === club.id) p += 2;
    return Math.max(1, p);
  };

  M.sackRisk = function (game) {
    var club = FKC.state.club();
    if (!club || game.career.phase === 'national') return 0;
    var st = game.standing;

    var p = 0;
    p += Math.max(0, st.pressure - 38) / 100 * 1.15;
    p += Math.max(0, 46 - st.boardTrust) / 100 * 0.95;
    p += Math.max(0, 38 - st.fanMood) / 100 * 0.35;

    /* Die Geduld ist aufgebraucht */
    var patience = M.patienceOf(game);
    if (game.status.seasonsMissed >= patience) p += 0.30;
    else if (game.status.seasonsMissed >= patience - 1) p += 0.12;

    /* Ein Abstieg ist fast immer das Ende */
    var last = game.career.seasons[game.career.seasons.length - 1];
    if (last && last.move && last.move.dir === 'down') p += 0.42;
    if (last && last.grade >= 1) p -= 0.28;

    /* Je grösser und ambitionierter der Verein, desto enger das Fenster */
    p *= 0.70 + club.prestige / 150;

    /* Guthaben: erfolgreiche Jahre und Titel bei diesem Verein */
    var stint = null;
    for (var i = game.career.clubsManaged.length - 1; i >= 0; i--) {
      if (game.career.clubsManaged[i].clubId === club.id) {
        stint = game.career.clubsManaged[i]; break;
      }
    }
    if (stint) p -= Math.min(0.30, stint.trophies * 0.10);
    p -= Math.min(0.12, game.status.seasonsAtClub * 0.02);
    p -= FKC.data.coachTraitBonus(game, 'survival');

    return clamp(p, 0, 0.94);
  };

  /** Ist die Entlassung diese Saison tatsächlich eingetreten? */
  M.rollSack = function (game) {
    var p = M.sackRisk(game);
    return p > 0 && FKC.rng.chance(p);
  };

  M.sack = function (game) {
    var club = FKC.state.club();
    game.career.sackings = (game.career.sackings || 0) + 1;
    game.flags.justSacked = true;

    var stint = null;
    for (var i = game.career.clubsManaged.length - 1; i >= 0; i--) {
      if (game.career.clubsManaged[i].clubId === game.status.clubId) {
        stint = game.career.clubsManaged[i]; break;
      }
    }
    if (stint && stint.to == null) stint.to = game.identity.year;

    /* Abfindung: der Restvertrag wird teilweise ausbezahlt */
    var ct = game.status.contract;
    var payoff = ct ? Math.round(ct.salary * Math.max(0, ct.yearsLeft) * 0.4) : 0;
    game.career.finances.balance += payoff;

    game.status.clubId = null;
    game.status.clubType = 'none';
    game.status.contract = null;
    game.status.mandate = null;
    game.status.seasonsAtClub = 0;
    game.status.seasonsMissed = 0;
    game.status.contComp = null;
    game.squad.players = [];
    game.squad.budget = { transfer: 0, wage: 0, wageUsed: 0 };
    game.career.phase = 'unemployed';

    game.standing.boardTrust = 50;
    game.standing.fanMood = 50;
    game.standing.dressingRoom = 50;
    game.standing.pressure = clamp(game.standing.pressure - 25, 0, 100);
    game.status.reputation = clamp(game.status.reputation - 7, 0, 100);

    FKC.state.logTimeline({
      text: { key: 'ctl.sacked', params: { club: club ? club.name : '' } }, mark: 'bad'
    });

    return { club: club, payoff: payoff };
  };

  /* ══ Steht die Vereinsfrage an? ═══════════════════════════════════
     Wie beim Spieler: nur fragen, wenn es etwas zu entscheiden gibt.  */

  M.jobDue = function (game) {
    if (game.career.phase === 'unemployed' || !game.status.clubId) return true;
    var ct = game.status.contract;
    if (!ct) return true;
    if (ct.yearsLeft <= 1) return true;                  // Verlängerung fällig
    if (game.flags.wantsOut) return true;
    if (game.identity.age >= 62) return true;            // Karriereende möglich
    if (game.standing.boardTrust < 38) return true;      // es wackelt
    if (game.standing.pressure >= 62) return true;

    /* Ein grösserer Verein klopft an — der trainertypische Fall der
       Abwerbung während laufendem Vertrag. */
    var last = game.career.seasons[game.career.seasons.length - 1];
    if (last && last.grade >= 1 && game.status.reputation >= 45) {
      return FKC.rng.chance(clamp(0.20 + game.status.reputation / 220 +
        FKC.data.coachTraitBonus(game, 'offerBoost'), 0.15, 0.6));
    }
    return false;
  };

  /* ══ Karriereende ═════════════════════════════════════════════════ */

  M.RETIRE_MIN = 60;
  M.RETIRE_MAX = 72;

  M.shouldRetire = function (game) {
    var age = game.identity.age;
    if (age >= M.RETIRE_MAX) return true;
    if (age < M.RETIRE_MIN) return false;

    var p = (age - M.RETIRE_MIN) * 0.08;
    if (!game.status.clubId) p += 0.20;
    if (game.career.sackings >= 4) p += 0.10;
    if (game.ovr >= 82) p -= 0.14;
    if (game.hidden.ambition >= 75) p -= 0.10;
    return FKC.rng.chance(clamp(p, 0, 0.95));
  };

  FKC.coachMarket = M;

})(window.FKC);
