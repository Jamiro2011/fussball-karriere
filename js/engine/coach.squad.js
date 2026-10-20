/* ── Kader ─────────────────────────────────────────────────────────────
   Die Spielerkarriere kennt keine einzelnen Mitspieler — für einen
   Trainer braucht es sie. Der Kader ist bewusst schlank gehalten:
   22 Spieler mit dem Nötigsten, damit ein Spielstand klein bleibt und
   eine Transferentscheidung trotzdem etwas bedeutet.

   Jeder Spieler hat neben dem Rating drei Eigenschaften, an denen die
   taktische Handschrift des Trainers hängt:

     sp   Tempo        — Konterfussball lebt davon
     tec  Technik      — Ballbesitz lebt davon
     phy  Physis       — Pressing und defensive Stabilität leben davon

   Wer Ballbesitz spielen will und einen Kader voller Sprinter hat,
   bekommt seine Handschrift nicht auf den Platz. Genau das macht den
   Transfermarkt zur eigentlichen Trainerentscheidung.               */

window.FKC = window.FKC || {};

(function (FKC) {
  'use strict';

  var S = {};
  var clamp = function (v, a, b) { return FKC.util.clamp(v, a, b); };

  /* Kaderaufbau: Position → Anzahl. Summe 22. */
  var TEMPLATE = [
    ['GK', 2], ['CB', 3], ['LB', 2], ['RB', 2], ['CDM', 2],
    ['CM', 3], ['CAM', 1], ['LW', 2], ['RW', 2], ['ST', 3]
  ];

  /* Startelf im 4-3-3 — je Platz die gesuchte Position */
  var XI = ['GK', 'CB', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CM', 'LW', 'RW', 'ST'];

  S.TEMPLATE = TEMPLATE;
  S.XI = XI;
  S.SIZE = 22;

  /* Wie stark eine Position auf die drei Eigenschaften einzahlt */
  var PROFILE = {
    GK:  { sp: 0.3, tec: 0.6, phy: 1.0 },
    CB:  { sp: 0.7, tec: 0.6, phy: 1.4 },
    LB:  { sp: 1.3, tec: 0.9, phy: 0.9 },
    RB:  { sp: 1.3, tec: 0.9, phy: 0.9 },
    CDM: { sp: 0.7, tec: 0.9, phy: 1.3 },
    CM:  { sp: 0.9, tec: 1.3, phy: 1.0 },
    CAM: { sp: 1.0, tec: 1.5, phy: 0.6 },
    LW:  { sp: 1.5, tec: 1.2, phy: 0.6 },
    RW:  { sp: 1.5, tec: 1.2, phy: 0.6 },
    ST:  { sp: 1.2, tec: 1.0, phy: 1.1 }
  };

  /* ══ Einzelnen Spieler würfeln ════════════════════════════════════ */

  var nextId = 1;

  /**
   * @param level  Zielrating des Spielers
   * @param pos    Position
   * @param nat    Herkunftsland des Vereins (die Mehrheit kommt von dort)
   */
  S.makePlayer = function (level, pos, country) {
    var r = FKC.rng;

    /* Herkunft: rund zwei Drittel aus dem Land des Vereins, der Rest
       aus der ganzen Fussballwelt. */
    var nat = country;
    if (r.chance(0.36)) {
      nat = r.pick(FKC.data.nations).id;
    }
    var name = FKC.data.randomName(nat);

    var ovr = clamp(r.gaussInt(level, 3, 38, 94), 38, 94);
    var age = r.weighted([18, 20, 22, 24, 26, 28, 30, 32, 34],
      function (a) { return a <= 20 ? 2 : a <= 24 ? 4 : a <= 29 ? 5 : a <= 32 ? 3 : 1.2; });
    age = clamp(age + r.int(-1, 1), 17, 36);

    /* Restpotenzial: junge Spieler haben Luft, alte nicht mehr */
    var headroom = age <= 20 ? r.int(6, 20) : age <= 23 ? r.int(3, 13)
                 : age <= 26 ? r.int(0, 6) : 0;
    var pot = clamp(ovr + headroom, ovr, 96);

    var p = PROFILE[pos] || PROFILE.CM;
    function sub(mult) {
      return clamp(r.gaussInt(ovr * 0.55 + 22 + (mult - 1) * 16, 8, 20, 99), 20, 99);
    }

    return {
      id: 'p' + (nextId++) + '-' + r.int(100, 999),
      name: name.first + ' ' + name.last,
      pos: pos, age: age, nat: nat,
      ovr: ovr, pot: pot,
      sp: sub(p.sp), tec: sub(p.tec), phy: sub(p.phy),
      years: r.int(1, 4),
      morale: r.gaussInt(62, 12, 25, 95),
      form: r.gaussInt(60, 10, 30, 90),
      injury: 0
    };
  };

  /* ══ Kader aufbauen ═══════════════════════════════════════════════ */

  /**
   * Erzeugt den Kader eines Vereins. Die Ratings folgen einer fallenden
   * Kurve um das Vereinsniveau: ein klarer Bester, eine solide Elf,
   * eine spürbar schwächere Bank.
   */
  S.build = function (game, club) {
    var r = FKC.rng;
    var lg = FKC.data.leagueOf(club);
    var level = FKC.data.clubLevel(club);
    var country = lg ? lg.country : game.identity.nationality;

    /* Positionsliste aus der Vorlage, gemischt — damit nicht immer der
       Stürmer der beste Spieler ist. */
    var slots = [];
    TEMPLATE.forEach(function (row) {
      for (var i = 0; i < row[1]; i++) slots.push(row[0]);
    });
    slots = r.shuffle(slots);

    /* Ratingkurve: Platz 0 ist der Star, Platz 21 der dritte Torhüter */
    var players = slots.map(function (pos, i) {
      var target = i === 0 ? level + r.int(4, 9)
                 : i < 11  ? level + r.int(-2, 3)
                 : i < 16  ? level - r.int(2, 7)
                           : level - r.int(6, 13);
      return S.makePlayer(clamp(target, 36, 95), pos, country);
    });

    game.squad.players = players;
    S.repriceAll(game, club);
    S.setBudgets(game, club);
    return players;
  };

  /** Gehalt und Marktwert aller Spieler neu bestimmen */
  S.repriceAll = function (game, club) {
    var c = club || FKC.state.club();
    if (!c) return;
    (game.squad.players || []).forEach(function (p) {
      p.wage = S.wageOf(p, c);
      p.value = S.valueOf(p, c);
    });
  };

  /* ── Gehalt und Marktwert ───────────────────────────────────────────
     Bewusst dieselbe Kurvenform wie in der Spielerkarriere
     (engine/attributes.js und engine/transfer.js), damit sich die
     Zahlen in beiden Modi gleich anfühlen.                          */

  S.wageOf = function (player, club) {
    var base = Math.pow(1.155, Math.max(0, player.ovr - 38)) * 11000;
    base *= 0.06 + club.finances / 58;
    var lg = FKC.data.leagueOf(club);
    if (lg) base *= 0.55 + lg.strength / 95;
    if (player.age >= 32) base *= 0.8;
    else if (player.age <= 20) base *= 0.7;
    return Math.max(12000, Math.round(base / 1000) * 1000);
  };

  S.valueOf = function (player, club) {
    var base = Math.pow(1.163, player.ovr - 40) * 38000;
    if (player.ovr > 88) base *= 1 - (player.ovr - 88) * 0.045;

    var age = player.age, f;
    if (age <= 21)      f = 1.5;
    else if (age <= 25) f = 1.3;
    else if (age <= 28) f = 1.0;
    else if (age <= 31) f = 0.68;
    else if (age <= 34) f = 0.36;
    else                f = 0.15;
    if (age <= 23) f += Math.min(0.6, Math.max(0, player.pot - player.ovr) * 0.035);

    var lg = club ? FKC.data.leagueOf(club) : null;
    var lf = lg ? 0.75 + (lg.strength / 100) * 0.5 : 0.8;

    var cf = player.years <= 0 ? 0.3 : player.years === 1 ? 0.6
           : player.years >= 4 ? 1.1 : 1;

    return Math.max(50000, Math.round(base * f * lf * cf / 50000) * 50000);
  };

  /* ── Budgets ────────────────────────────────────────────────────────
     Was der Verein dem Trainer in die Hand gibt. Die Lizenzstufe wirkt
     hier nicht mit — sie hat den Startverein bestimmt, das reicht. */

  S.setBudgets = function (game, club) {
    var r = FKC.rng;
    var c = club || FKC.state.club();
    if (!c) return;

    var transfer = Math.pow(1.088, c.finances - 40) * 2200000 * r.float(0.75, 1.3);
    /* Ein Vorstand, der seinem Trainer vertraut, gibt mehr frei */
    transfer *= 0.7 + (game.standing.boardTrust / 100) * 0.6;

    var bill = S.wageBill(game);
    game.squad.budget = {
      transfer: Math.round(transfer / 100000) * 100000,
      wage: Math.round(bill * r.float(1.08, 1.28) / 10000) * 10000,
      wageUsed: bill
    };
    return game.squad.budget;
  };

  S.wageBill = function (game) {
    var sum = 0;
    (game.squad.players || []).forEach(function (p) { sum += p.wage || 0; });
    return sum;
  };

  S.wageRoom = function (game) {
    return (game.squad.budget.wage || 0) - S.wageBill(game);
  };

  /* ══ Zugriff & Auswahl ════════════════════════════════════════════ */

  S.byId = function (game, id) {
    var list = game.squad.players || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  };

  S.sorted = function (game) {
    return (game.squad.players || []).slice()
      .sort(function (a, b) { return b.ovr - a.ovr; });
  };

  /** Der beste Spieler des Kaders — Gesicht der Mannschaft */
  S.star = function (game) {
    var list = S.sorted(game);
    return list.length ? list[0] : null;
  };

  /**
   * Startelf im 4-3-3. Je Platz der beste verfügbare Spieler der
   * gesuchten Position; ist keiner mehr da, springt der beste noch
   * freie Feldspieler ein.
   */
  S.bestXI = function (game) {
    var pool = (game.squad.players || []).filter(function (p) { return !p.injury; });
    if (pool.length < 11) pool = (game.squad.players || []).slice();
    pool = pool.slice().sort(function (a, b) {
      return effective(b) - effective(a);
    });

    var used = {}, out = [];
    XI.forEach(function (want) {
      var pick = null;
      for (var i = 0; i < pool.length; i++) {
        if (used[pool[i].id]) continue;
        if (pool[i].pos === want) { pick = pool[i]; break; }
      }
      if (!pick) {
        /* Ersatz: nächstbester passender Spieler aus der Nachbarschaft */
        var near = FKC.data.positionNeighbours[want] || [];
        for (var j = 0; j < pool.length && !pick; j++) {
          if (used[pool[j].id]) continue;
          if (near.indexOf(pool[j].pos) >= 0) pick = pool[j];
        }
      }
      if (!pick) {
        for (var k = 0; k < pool.length; k++) {
          if (used[pool[k].id]) continue;
          if (want !== 'GK' && pool[k].pos === 'GK') continue;
          pick = pool[k]; break;
        }
      }
      if (pick) { used[pick.id] = 1; out.push(pick); }
    });
    return out;
  };

  /** Rating unter Berücksichtigung von Form und Stimmung */
  function effective(p) {
    return p.ovr + (p.form - 60) / 12 + (p.morale - 60) / 16;
  }
  S.effective = effective;

  /* ══ Mannschaftsstärke ════════════════════════════════════════════
     Was am Ende in die Tabellensimulation geht. Die Startelf zählt am
     meisten, die Bank fängt Verletzungen und englische Wochen ab.  */

  S.strength = function (game) {
    var xi = S.bestXI(game);
    if (!xi.length) return 40;

    var sum = 0;
    xi.forEach(function (p) { sum += effective(p); });
    var core = sum / xi.length;

    /* Kadertiefe: Durchschnitt der Spieler 12 bis 18 */
    var rest = S.sorted(game).slice(11, 18);
    var depth = rest.length
      ? FKC.util.sum(rest.map(effective)) / rest.length : core - 10;

    return core * 0.86 + depth * 0.14;
  };

  /** Durchschnittsalter — für die Kaderplanung sichtbar */
  S.avgAge = function (game) {
    var list = game.squad.players || [];
    if (!list.length) return 0;
    return FKC.util.round(FKC.util.sum(list.map(function (p) { return p.age; })) / list.length, 1);
  };

  /**
   * Wie gut passt der Kader zur taktischen Handschrift? 0 … 1.4
   * Gemessen an der Eigenschaft, die die Philosophie verlangt.
   */
  S.fit = function (game, philosophyId) {
    var ph = FKC.data.philosophyById(philosophyId || game.hidden.philosophy);
    if (!ph) return 1;
    var xi = S.bestXI(game);
    if (!xi.length) return 1;
    var key = ph.needs;
    var avg = FKC.util.sum(xi.map(function (p) { return p[key] || 50; })) / xi.length;
    /* 50 = neutral, 80 = ideal besetzt */
    return clamp(0.55 + (avg - 45) / 45, 0.4, 1.4);
  };

  /** Schwächste Position der Startelf — Vorschlag für den Transfermarkt */
  S.weakestSlot = function (game) {
    var xi = S.bestXI(game);
    if (!xi.length) return 'CM';
    var worst = xi[0];
    xi.forEach(function (p) { if (p.ovr < worst.ovr) worst = p; });
    return worst.pos;
  };

  /* ══ Verletzungen ═════════════════════════════════════════════════ */

  S.injure = function (game, count, weeks) {
    var list = S.sorted(game).filter(function (p) { return !p.injury; });
    var hit = list.slice(0, Math.max(1, count));
    hit.forEach(function (p) { p.injury = weeks || FKC.rng.int(4, 14); });
    return hit;
  };

  S.healAll = function (game) {
    (game.squad.players || []).forEach(function (p) { p.injury = 0; });
  };

  /* ══ Jahreswechsel im Kader ═══════════════════════════════════════
     Spieler werden älter, entwickeln sich, Verträge laufen ab. Wie gut
     sich die Jungen entwickeln, hängt am Attribut „Jugend-/
     Spielerentwicklung" des Trainers — das ist der Ort, an dem sich
     dieses Attribut auszahlt.                                      */

  S.progress = function (game) {
    var r = FKC.rng;
    var club = FKC.state.club();
    var youth = game.attributes.youth || 50;
    var youthPush = 1 + (youth - 50) / 90 + FKC.data.coachTraitBonus(game, 'youthGrowth') * 0.4;
    var out = { grown: [], declined: [], left: [] };

    (game.squad.players || []).forEach(function (p) {
      p.age += 1;
      p.injury = 0;
      if (p.years > 0) p.years -= 1;

      var before = p.ovr;
      if (p.age <= 24 && p.ovr < p.pot) {
        var gain = Math.round(r.float(0.6, 2.4) * youthPush *
                              clamp((p.pot - p.ovr) / 8, 0.2, 1.4));
        p.ovr = clamp(p.ovr + Math.max(0, gain), 38, p.pot);
      } else if (p.age >= 31) {
        var loss = Math.round(r.float(0.5, 2.2) * (1 + (p.age - 31) * 0.18));
        p.ovr = clamp(p.ovr - Math.max(0, loss), 34, 99);
      } else if (p.ovr < p.pot && r.chance(0.35)) {
        p.ovr = clamp(p.ovr + 1, 38, p.pot);
      }

      /* Die drei Eigenschaften folgen dem Rating, Tempo altert zuerst */
      var d = p.ovr - before;
      if (d !== 0) {
        p.tec = clamp(p.tec + Math.round(d * 0.9), 20, 99);
        p.phy = clamp(p.phy + Math.round(d * 0.7), 20, 99);
        p.sp = clamp(p.sp + Math.round(d * (p.age >= 31 ? 1.5 : 0.8)), 20, 99);
        (d > 0 ? out.grown : out.declined).push(p);
      }

      p.form = clamp(r.gaussInt(60, 9, 30, 90), 30, 90);
      p.morale = clamp(p.morale + r.int(-6, 6), 10, 99);
    });

    /* Auslaufende Verträge: wer nicht mehr gebraucht wird, geht.
       Der Kader wird danach wieder aufgefüllt. */
    var keep = [];
    (game.squad.players || []).forEach(function (p) {
      var gone = p.years <= 0 && (p.age >= 34 || FKC.rng.chance(0.45));
      if (gone) out.left.push(p); else keep.push(p);
    });
    game.squad.players = keep;

    if (club) {
      S.refill(game, club);
      S.repriceAll(game, club);
    }
    return out;
  };

  /** Kader wieder auf Sollgrösse bringen (Leihen, Nachwuchs, Freie) */
  S.refill = function (game, club) {
    var r = FKC.rng;
    var lg = FKC.data.leagueOf(club);
    var level = FKC.data.clubLevel(club);
    var country = lg ? lg.country : game.identity.nationality;

    var have = {};
    (game.squad.players || []).forEach(function (p) {
      have[p.pos] = (have[p.pos] || 0) + 1;
    });

    TEMPLATE.forEach(function (row) {
      var missing = row[1] - (have[row[0]] || 0);
      for (var i = 0; i < missing; i++) {
        /* Nachrücker kommen von unten, nicht als fertige Stammspieler */
        var p = S.makePlayer(clamp(level - r.int(4, 12), 36, 92), row[0], country);
        p.wage = S.wageOf(p, club);
        p.value = S.valueOf(p, club);
        game.squad.players.push(p);
      }
    });
  };

  /* ══ Transfermarkt ════════════════════════════════════════════════ */

  /**
   * Kandidaten für das laufende Fenster. Bewusst frisch gezogen und
   * nicht gespeichert — sonst bläht der Spielstand mit jedem Fenster
   * auf, und ein verpasster Transfer soll auch verpasst bleiben.
   */
  S.transferTargets = function (game, count) {
    var r = FKC.rng;
    var club = FKC.state.club();
    if (!club) return [];
    var lg = FKC.data.leagueOf(club);
    var level = FKC.data.clubLevel(club);
    var country = lg ? lg.country : game.identity.nationality;
    var ph = FKC.data.philosophyById(game.hidden.philosophy);

    /* Die Lücke im eigenen Kader zuerst, dann Verstärkungen allgemein */
    var wanted = [S.weakestSlot(game)];
    var all = TEMPLATE.map(function (row) { return row[0]; });
    while (wanted.length < (count || 5)) {
      var pos = r.pick(all);
      wanted.push(pos);
    }

    var edge = 1 - clamp((game.attributes.transfers - 50) / 220, -0.12, 0.2)
             - FKC.data.coachTraitBonus(game, 'transferEdge') * 0.5;

    return wanted.map(function (pos, i) {
      /* Erster Vorschlag ist eine echte Verstärkung, danach gemischt */
      var target = i === 0 ? level + r.int(2, 7) : level + r.int(-4, 6);
      var p = S.makePlayer(clamp(target, 38, 94), pos, country);
      var fromClub = pickSellerClub(club, p.ovr);
      p.value = S.valueOf(p, fromClub || club);
      p.wage = S.wageOf(p, club);

      var fee = Math.round(p.value * r.float(0.95, 1.75) * clamp(edge, 0.7, 1.35)
                           / 100000) * 100000;

      return {
        key: 'b' + i,
        player: p,
        fromId: fromClub ? fromClub.id : null,
        fromName: fromClub ? fromClub.name : FKC.t('csquad.freeAgent'),
        fee: fromClub ? Math.max(100000, fee) : 0,
        wage: p.wage,
        /* Wie gut passt der Spieler zur Handschrift des Trainers? */
        fit: ph ? clamp(Math.round((p[ph.needs] - 45) / 0.45) / 100, 0, 1) : 0.5,
        needSlot: i === 0
      };
    });
  };

  function pickSellerClub(own, ovr) {
    if (FKC.rng.chance(0.12)) return null;         // ablösefrei
    var pool = FKC.data.clubs.filter(function (c) {
      if (c.id === own.id) return false;
      var lvl = FKC.data.clubLevel(c);
      return Math.abs(lvl - ovr) <= 14;
    });
    if (!pool.length) pool = FKC.data.clubs;
    return FKC.rng.pick(pool);
  }

  /**
   * Angebote für eigene Spieler. Es melden sich vor allem Vereine für
   * die, die man selbst nicht braucht — und manchmal einer für den
   * Star, den man eigentlich behalten will.
   */
  S.sellOffers = function (game, count) {
    var r = FKC.rng;
    var club = FKC.state.club();
    if (!club) return [];

    var list = S.sorted(game);
    var xi = {};
    S.bestXI(game).forEach(function (p) { xi[p.id] = 1; });

    /* Zwei Ergänzungsspieler, dazu mit etwas Glück ein Stammspieler */
    var pool = list.filter(function (p) { return !xi[p.id]; });
    var picks = r.sample(pool, Math.min(count || 3, pool.length));
    if (r.chance(0.4) && list.length) {
      var starter = r.pick(S.bestXI(game));
      if (starter && picks.indexOf(starter) < 0) picks.unshift(starter);
    }

    var edge = 1 + clamp((game.attributes.transfers - 50) / 200, -0.15, 0.25)
             + FKC.data.coachTraitBonus(game, 'transferEdge') * 0.6;

    return picks.slice(0, 4).map(function (p, i) {
      var buyer = pickSellerClub(club, p.ovr);
      return {
        key: 's' + i,
        player: p,
        toId: buyer ? buyer.id : null,
        toName: buyer ? buyer.name : FKC.t('csquad.unknownClub'),
        fee: Math.max(50000, Math.round(p.value * r.float(0.7, 1.35) * edge / 50000) * 50000),
        starter: !!xi[p.id]
      };
    });
  };

  /** Einen Transfer durchführen. Liefert null, wenn er nicht geht. */
  S.buy = function (game, offer) {
    var b = game.squad.budget;
    if (offer.fee > b.transfer) return null;
    if (offer.wage > S.wageRoom(game) + 1) return null;

    b.transfer -= offer.fee;
    var p = offer.player;
    p.years = FKC.rng.int(3, 5);
    p.morale = clamp(p.morale + 8, 0, 99);
    game.squad.players.push(p);
    b.wageUsed = S.wageBill(game);
    return p;
  };

  S.sell = function (game, offer) {
    var idx = -1;
    (game.squad.players || []).forEach(function (p, i) {
      if (p.id === offer.player.id) idx = i;
    });
    if (idx < 0) return null;
    var p = game.squad.players.splice(idx, 1)[0];
    game.squad.budget.transfer += offer.fee;
    game.squad.budget.wageUsed = S.wageBill(game);
    /* Einen Leistungsträger zu verkaufen spürt die ganze Kabine */
    if (offer.starter) {
      game.standing.dressingRoom = clamp(game.standing.dressingRoom - 6, 0, 100);
      game.standing.fanMood = clamp(game.standing.fanMood - 8, 0, 100);
    }
    /* Der Platz muss wieder besetzt werden */
    var club = FKC.state.club();
    if (club) { S.refill(game, club); S.repriceAll(game, club); }
    return p;
  };

  FKC.coachSquad = S;

})(window.FKC);
