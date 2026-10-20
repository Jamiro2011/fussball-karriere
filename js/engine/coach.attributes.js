/* ── Trainerattribute & Overall-Rating ─────────────────────────────────
   Gleiche Logik wie beim Spieler: Attribute 1-99, daraus ein gewichtetes
   Overall-Rating mit harter Obergrenze 99 und — sobald die Karriere
   läuft — einer Untergrenze von 40.

   Der Unterschied zum Spieler liegt darin, was ein Trainer besser
   macht: nicht Spielzeit und Training, sondern Erfahrung und Erfolg.
   Ein Trainer, der über der Erwartung abschneidet, wächst; einer, der
   Saison für Saison enttäuscht, verliert an Rating.                 */

window.FKC = window.FKC || {};

(function (FKC) {
  'use strict';

  var A = {};
  var clamp = function (v, a, b) { return FKC.util.clamp(v, a, b); };

  /* ── Startwerte ─────────────────────────────────────────────────────
     Die Attribute werden so kalibriert, dass das Rating am Start genau
     den Wert der gewählten Lizenz ergibt. Die Signaturstärke liegt
     dabei spürbar über dem Rest — gleiches Prinzip wie beim Spieler. */
  A.startingSet = function (game) {
    var r = FKC.rng;
    var keys = FKC.data.coachAttrKeys;
    var lic = FKC.data.coachLicenceById(game.identity.licence) ||
              FKC.data.coachLicences[0];
    var sig = game.hidden.signature;
    var out = {};

    /* Grundstreuung um den Lizenzwert. Bewusst eng: die Unterschiede
       zwischen den Attributen sollen von Signatur und Philosophie
       kommen, nicht vom Rauschen. */
    keys.forEach(function (k) {
      out[k] = r.gaussInt(lic.ovr, 6, 24, 78);
    });

    if (sig && out[sig] != null) out[sig] += r.int(8, 12);

    /* Charakterzüge greifen direkt auf die Startwerte durch */
    keys.forEach(function (k) {
      out[k] = clamp(out[k] + FKC.data.coachTraitBonus(game, k), 12, 88);
    });

    A.calibrate(out, lic.ovr, keys);
    return out;
  };

  /**
   * Verschiebt alle Attribute so, dass das Rating den Zielwert trifft.
   * Nötig, weil der Spezialisten-Bonus nicht linear ist.
   */
  A.calibrate = function (attrs, target, keys) {
    keys = keys || FKC.data.coachAttrKeys;
    for (var pass = 0; pass < 8; pass++) {
      var diff = target - A.ovrOf(attrs);
      if (diff === 0) break;
      var step = diff > 0 ? Math.max(1, Math.round(diff * 0.9))
                          : Math.min(-1, Math.round(diff * 0.9));
      keys.forEach(function (k) { attrs[k] = clamp(attrs[k] + step, 12, 92); });
    }
    /* Letzter Feinschliff über das am stärksten gewichtete Attribut */
    var main = keys[0], w = FKC.data.coachWeights;
    keys.forEach(function (k) { if ((w[k] || 0) > (w[main] || 0)) main = k; });
    for (var i = 0; i < 12; i++) {
      var d = target - A.ovrOf(attrs);
      if (d === 0) break;
      attrs[main] = clamp(attrs[main] + (d > 0 ? 1 : -1), 12, 95);
    }
    return attrs;
  };

  /* ── Overall-Rating ─────────────────────────────────────────────── */
  A.ovrOf = function (attrs) {
    var w = FKC.data.coachWeights;
    var sum = 0, wsum = 0;
    for (var k in w) {
      if (attrs[k] == null) continue;
      sum += attrs[k] * w[k];
      wsum += w[k];
    }
    var base = wsum > 0 ? sum / wsum : 0;

    /* Spezialisten-Bonus: ein herausragender Wert hebt das Rating
       leicht — ein Trainer mit einer echten Spezialität ist mehr wert
       als einer, der überall gleich mittelmässig ist. */
    var vals = FKC.data.coachAttrKeys.map(function (k) { return attrs[k] || 0; });
    var top = Math.max.apply(null, vals);
    var bonus = top > base + 12 ? Math.min(2.5, (top - base - 12) / 6) : 0;

    return Math.min(99, Math.round(base + bonus));
  };

  /** Sicherheitsnetz: kappt alle wachsenden Werte bei 99 */
  A.enforceCaps = function (game) {
    FKC.data.coachAttrKeys.forEach(function (k) {
      if (game.attributes[k] > 99) game.attributes[k] = 99;
    });
    var h = game.hidden;
    if (h) {
      if (h.potential > 99) h.potential = 99;
      ['philosophyLevel', 'ambition', 'temperament', 'loyalty', 'adaptability',
       'pressureRes', 'consistency', 'bigGame'].forEach(function (k) {
        if (h[k] > 99) h[k] = 99;
      });
    }
    if (game.ovr > 99) game.ovr = 99;
    if (game.peakOvr > 99) game.peakOvr = 99;
  };

  /** Rating neu berechnen */
  A.recalc = function (game) {
    A.enforceCaps(game);
    var raw = A.ovrOf(game.attributes);
    game.ovr = clamp(raw, 40, 99);
    if (game.ovr > game.peakOvr) game.peakOvr = game.ovr;
    return game.ovr;
  };

  /* Für die Verlaufsdiagramme wird pro Jahr Rating, Vorstandsvertrauen
     und Renommee festgehalten — nicht nur der aktuelle Stand. */
  A.pushHistory = function (game) {
    game.ovrHistory.push({
      age: game.identity.age,
      ovr: game.ovr,
      trust: Math.round(game.standing.boardTrust),
      rep: Math.round(game.status.reputation)
    });
  };

  A.strongest = function (game) {
    var keys = FKC.data.coachAttrKeys, best = keys[0];
    keys.forEach(function (k) {
      if (game.attributes[k] > game.attributes[best]) best = k;
    });
    return best;
  };

  A.weakest = function (game) {
    var keys = FKC.data.coachAttrKeys, worst = keys[0];
    keys.forEach(function (k) {
      if (game.attributes[k] < game.attributes[worst]) worst = k;
    });
    return worst;
  };

  A.level = function (v) { return v >= 75 ? 'high' : (v >= 45 ? 'mid' : 'low'); };

  A.tier = function (ovr) {
    if (ovr >= 85) return 'elite';
    if (ovr >= 68) return 'good';
    if (ovr >= 50) return 'mid';
    return 'low';
  };

  /* ── Potenzialanzeige ───────────────────────────────────────────────
     Wie beim Spieler bleibt der genaue Wert verborgen. Die Spanne wird
     schmaler, je mehr Saisons ein Trainer hinter sich hat — irgendwann
     weiss die Branche, was sie an einem hat.                        */
  A.potentialRange = function (game) {
    var seasons = game.career.seasons.length;
    var width = seasons <= 1 ? 10 : seasons <= 3 ? 8 : seasons <= 6 ? 6
              : seasons <= 10 ? 4 : 2;
    if (game.status.reputation >= 60) width -= 1;
    if (game.career.trophies.length >= 3) width -= 1;
    width = Math.max(1, width);

    var pot = game.hidden.potential;
    var shift = ((pot * 7 + game.identity.age) % 5) - 2;
    var low = clamp(Math.round(pot - width + shift * 0.4), game.ovr, 99);
    var high = clamp(Math.round(pot + width + shift * 0.4), low + 1, 99);
    return { low: low, high: high, width: width };
  };

  A.potentialTier = function (game) {
    var p = game.hidden.potential;
    return p >= 90 ? 'elite' : p >= 82 ? 'high' : p >= 72 ? 'good'
         : p >= 62 ? 'mid' : 'low';
  };

  /* ══ Entwicklung ═════════════════════════════════════════════════
     Ein Trainerjahr. Anders als beim Spieler hängt das Budget nicht an
     der Alterskurve allein, sondern vor allem daran, wie die Saison
     gelaufen ist. Erfahrung macht besser — Misserfolg auch, aber
     langsamer, und irgendwann verbraucht sich einer.               */

  /* Grundbudget nach Alter. Trainer entwickeln sich langsamer als
     Spieler, dafür über zwanzig Jahre und mehr. Der Abbau setzt erst
     jenseits der Sechzig ein. */
  var CURVE = [
    [28, 3.6], [32, 4.0], [38, 4.2], [44, 3.8], [50, 3.2],
    [56, 2.4], [61, 1.5], [65, 0.6], [69, -0.8], [75, -2.6]
  ];

  function lookup(table, age) {
    if (age <= table[0][0]) return table[0][1];
    for (var i = 1; i < table.length; i++) {
      if (age <= table[i][0]) {
        var a = table[i - 1], b = table[i];
        return FKC.util.lerp(a[1], b[1], (age - a[0]) / (b[0] - a[0]));
      }
    }
    return table[table.length - 1][1];
  }

  A.ageBudget = function (age) { return lookup(CURVE, age); };

  /**
   * Ein Entwicklungsjahr.
   * ctx = { grade: -2..+2 (Abschneiden gegen die Erwartung),
   *         quality: 0-100 (Niveau des Vereins),
   *         focus: Attributschlüssel aus der Saisonarbeit,
   *         bonusPoints: Zahl aus Ereignissen }
   */
  A.yearly = function (game, ctx) {
    ctx = ctx || {};
    var r = FKC.rng;
    var keys = FKC.data.coachAttrKeys;
    var before = {};
    keys.forEach(function (k) { before[k] = game.attributes[k]; });
    var ovrBefore = game.ovr;

    var budget = A.ageBudget(game.identity.age);
    budget *= 1 + FKC.data.coachTraitBonus(game, 'growth');

    if (budget > 0) {
      /* Wie weit ist noch Luft nach oben? */
      var gap = game.hidden.potential - game.ovr;
      var gapFactor = clamp(gap / 8, 0.02, 1.4);
      if (gap <= -2) gapFactor = 0;
      else if (gap <= 0) gapFactor *= 0.12;

      /* Erfolg ist der stärkste Lehrmeister. Eine Saison klar über der
         Erwartung bringt gut das Doppelte einer verpatzten. */
      var grade = ctx.grade == null ? 0 : ctx.grade;
      var gradeFactor = clamp(0.55 + (grade + 2) * 0.28, 0.5, 1.6);

      /* Ein grosser Verein bildet besser aus als ein kleiner — bessere
         Stäbe, härtere Gegner, mehr Wettbewerbe. */
      var quality = ctx.quality != null ? ctx.quality : 55;
      var qualityFactor = 0.6 + (quality / 100) * 0.7;

      /* Ehrgeiz ist beim Trainer, was Arbeitseinstellung beim Spieler ist */
      var ambitionFactor = 0.75 + (game.hidden.ambition / 100) * 0.5;

      budget += ctx.bonusPoints || 0;
      budget *= gapFactor * gradeFactor * qualityFactor * ambitionFactor;
      budget *= r.float(0.85, 1.18);

      /* Verteilung: Grundgewicht, Signaturstärke, Saisonschwerpunkt */
      var avg = 0;
      keys.forEach(function (k) { avg += game.attributes[k]; });
      avg /= keys.length;

      var sig = game.hidden.signature;
      var w = FKC.data.coachWeights;
      var weights = {};
      keys.forEach(function (k) {
        var x = (w[k] || 0.1) * 0.6 + 0.12;
        if (ctx.focus === k) x *= 2.2;
        if (k === sig) x *= 1.7;
        if (game.attributes[k] < avg - 12) x *= 1.5;
        if (game.attributes[k] >= 85) x *= 0.45;
        else if (game.attributes[k] >= 78) x *= 0.7;
        x *= r.float(0.6, 1.4);
        weights[k] = x;
      });

      var cap = clamp(game.hidden.potential + 7, 55, 99);
      distribute(game, keys, weights, budget, 1, cap, sig, Math.min(99, cap + 5));

      /* Solange Luft nach oben ist, soll sich jedes Jahr etwas bewegen */
      A.recalc(game);
      if (game.ovr === ovrBefore && game.ovr < game.hidden.potential) {
        var main = sig || keys[0];
        for (var t = 0; t < 6 && game.ovr === ovrBefore; t++) {
          game.attributes[main] = clamp(game.attributes[main] + 1, 5, 99);
          A.recalc(game);
        }
      }

    } else if (budget < 0) {
      /* Ausbrennen im Alter: Medienarbeit und Kaderführung zuerst,
         das taktische Wissen bleibt am längsten. */
      var loss = -budget * r.float(0.8, 1.25);
      loss *= 1 - clamp((game.hidden.ambition - 55) / 260, -0.12, 0.18);
      var bias = { media: 1.7, manMgmt: 1.4, transfers: 1.1, youth: 1.0, tactics: 0.5 };
      var lw = {};
      keys.forEach(function (k) { lw[k] = (bias[k] || 1) * r.float(0.7, 1.3); });
      distribute(game, keys, lw, loss, -1);
    }

    /* Die Handschrift prägt sich weiter aus, solange man ihr treu
       bleibt — das ist die Entsprechung zur Signaturstärke, die beim
       Spieler schneller wächst als der Rest. */
    var stick = game.flags.philosophyKept !== false;
    game.hidden.philosophyLevel = clamp(
      game.hidden.philosophyLevel + (stick ? r.int(1, 3) : -r.int(1, 3)), 20, 99);

    A.recalc(game);

    var deltas = {};
    keys.forEach(function (k) {
      var d = game.attributes[k] - before[k];
      if (d !== 0) deltas[k] = d;
    });

    return { deltas: deltas, ovrBefore: ovrBefore, ovrAfter: game.ovr, budget: budget };
  };

  /** Punktebudget ganzzahlig auf die Attribute verteilen */
  function distribute(game, keys, weights, amount, sign, cap, sigKey, sigCap) {
    var total = 0;
    keys.forEach(function (k) { total += weights[k]; });
    if (total <= 0) return;

    var max = cap || 99;
    var rest = 0;
    keys.forEach(function (k) {
      var share = (weights[k] / total) * amount + rest;
      var whole = Math.floor(share);
      rest = share - whole;
      if (whole <= 0) return;
      var limit = Math.min(99, (sigKey && k === sigKey) ? (sigCap || max) : max);
      var v = game.attributes[k] + sign * whole;
      game.attributes[k] = clamp(v, 5, sign > 0 ? limit : 99);
    });
  }

  /** Einmalige Anpassung, z. B. durch Ereignisse */
  A.bump = function (game, key, delta) {
    if (game.attributes[key] == null) return 0;
    var before = game.attributes[key];
    game.attributes[key] = clamp(before + delta, 5, 99);
    A.recalc(game);
    return game.attributes[key] - before;
  };

  /* ── Marktwert eines Trainers ───────────────────────────────────────
     Kein Ablösewert wie beim Spieler, sondern das Gehaltsniveau, das
     dieser Trainer am Markt aufruft. Wird im Hub und in den Angeboten
     gezeigt.                                                        */
  A.marketWage = function (game) {
    var base = Math.pow(1.135, Math.max(0, game.ovr - 40)) * 90000;
    base *= 0.8 + game.status.reputation / 180;
    base *= 1 + game.career.trophies.length * 0.03;
    var club = FKC.state.club();
    if (club) {
      var lg = FKC.data.leagueOf(club);
      base *= 0.7 + (club.finances / 100) * 0.5;
      if (lg) base *= 0.7 + (lg.strength / 100) * 0.5;
    }
    if (game.identity.age >= 64) base *= 0.8;
    return Math.max(24000, Math.round(base / 10000) * 10000);
  };

  FKC.coachAttr = A;

})(window.FKC);
