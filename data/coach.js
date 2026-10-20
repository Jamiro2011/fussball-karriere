/* ── Trainerdaten ──────────────────────────────────────────────────────
   Alles, was es nur in der Trainerkarriere gibt: Lizenzstufen,
   taktische Philosophien, die fünf Trainerattribute, Charakterzüge und
   die Erwartung, die ein Verein an seinen Trainer stellt.

   Ligen, Vereine, Nationen, Flaggen und Wettbewerbe kommen unverändert
   aus den bestehenden Dateien — hier steht kein einziger Verein noch
   einmal drin.                                                        */

window.FKC = window.FKC || {};
FKC.data = FKC.data || {};

(function (FKC) {
  'use strict';

  var clamp = function (v, a, b) { return FKC.util.clamp(v, a, b); };

  /* ── Die fünf Trainerattribute ────────────────────────────────────
     Feste Reihenfolge = Reihenfolge in der Oberfläche. Anders als beim
     Spieler gibt es keine Positionen, also auch nur **eine**
     Gewichtung: Trainer werden alle nach demselben Massstab gemessen.
     Die Handschrift steckt nicht in der Gewichtung, sondern in der
     Philosophie — die hat ihre eigene Achse.                        */
  FKC.data.coachAttrKeys = ['tactics', 'manMgmt', 'transfers', 'youth', 'media'];

  FKC.data.coachWeights = {
    tactics: 0.30, manMgmt: 0.26, transfers: 0.18, youth: 0.14, media: 0.12
  };

  /* ── Trainerlizenzen ──────────────────────────────────────────────
     Das Gegenstück zu Dorfverein / NLZ / Akademie beim Spieler: die
     Lizenz bestimmt, wo die Karriere anfängt — und wie viel Geduld man
     dort bekommt.

     band    Fenster im nach Niveau sortierten Vereinsfeld des Landes
             (0 = schwächster Verein, 1 = stärkster). Daraus werden die
             drei Startadressen gezogen.
     patience  Zuschlag auf die Geduld des Vorstands in Saisons. Wer
             ganz unten anfängt, bekommt Zeit; wer oben einsteigt,
             hat sie nicht.                                          */
  var licences = [
    { id: 'amateur', ageFrom: 29, ageTo: 36, ovr: 44, reputation: 5,
      band: [0.00, 0.22], potentialShift: -3, budget: 0.55, patience: 2 },
    { id: 'uefaB',   ageFrom: 32, ageTo: 40, ovr: 50, reputation: 18,
      band: [0.28, 0.56], potentialShift: 0,  budget: 0.85, patience: 1 },
    { id: 'uefaPro', ageFrom: 35, ageTo: 44, ovr: 56, reputation: 33,
      band: [0.58, 0.86], potentialShift: 3,  budget: 1.15, patience: -1 }
  ];

  FKC.data.coachLicences = licences;
  FKC.data.coachLicenceById = function (id) { return FKC.util.byId(licences, id); };

  /* ── Taktische Philosophien ───────────────────────────────────────
     Die Handschrift des Trainers. Sie sticht von Anfang an hervor
     (philosophyLevel startet erhöht) und prägt sich über die Karriere
     weiter aus — gleiches Prinzip wie die Signaturstärke beim Spieler.

     needs      Welche Spielereigenschaft die Handschrift verlangt.
                Passt der Kader dazu, wirkt sie voll; passt er nicht,
                verpufft sie. Genau das macht Transfers wichtig.
     attack/defence/control
                Wie die Handschrift eine Saison färbt: Tore, Gegentore
                und wie berechenbar die Mannschaft ist.
     signature  Gewichte für die Signaturstärke — welches der fünf
                Attribute bei diesem Trainertyp herausragt.          */
  var philosophies = [
    { id: 'possession', needs: 'tec', attack: 0.60, defence: 0.35, control: 0.90,
      signature: { tactics: 3, youth: 2, manMgmt: 1, transfers: 1, media: 1 } },
    { id: 'counter',    needs: 'sp',  attack: 0.80, defence: 0.50, control: 0.30,
      signature: { tactics: 2, transfers: 3, manMgmt: 1, youth: 1, media: 1 } },
    { id: 'press',      needs: 'phy', attack: 0.72, defence: 0.60, control: 0.55,
      signature: { manMgmt: 3, youth: 2, tactics: 2, transfers: 1, media: 1 } },
    { id: 'defensive',  needs: 'phy', attack: 0.30, defence: 0.95, control: 0.50,
      signature: { tactics: 2, manMgmt: 2, transfers: 1, youth: 1, media: 1 } }
  ];

  FKC.data.coachPhilosophies = philosophies;
  FKC.data.philosophyById = function (id) { return FKC.util.byId(philosophies, id); };

  FKC.data.rollPhilosophy = function (rng) {
    return (rng || FKC.rng).pick(philosophies).id;
  };

  /** Signaturattribut passend zur Handschrift ziehen */
  FKC.data.coachSignature = function (philosophyId, rng) {
    var r = rng || FKC.rng;
    var p = FKC.data.philosophyById(philosophyId) || philosophies[0];
    var keys = FKC.data.coachAttrKeys;
    return r.weighted(keys, function (k) { return p.signature[k] || 1; }) || keys[0];
  };

  /* ── Charakterzüge ────────────────────────────────────────────────
     Wie beim Spieler: ein bis zwei Stück, sie verschieben
     Wahrscheinlichkeiten und schalten eigene Ereignisse frei.      */
  var traits = [
    { id: 'motivator',     weight: 8, effects: { moraleBoost: 8, manMgmt: 4, comeback: 0.15 } },
    { id: 'tactician',     weight: 7, effects: { tacticEdge: 0.14, tactics: 5 } },
    { id: 'youthWhisperer', weight: 7, effects: { youthGrowth: 0.35, youth: 5, wageSave: 0.08 } },
    { id: 'dealmaker',     weight: 7, effects: { transferEdge: 0.22, transfers: 5 } },
    { id: 'mediaDarling',  weight: 6, effects: { mediaRisk: -0.35, media: 6, reputation: 6 } },
    { id: 'hothead',       weight: 6, effects: { mediaRisk: 0.45, boardTrust: -6, dressingRoom: -5, bigGame: 6 } },
    { id: 'disciplinarian', weight: 7, effects: { consistency: 10, dressingRoom: -4, defence: 0.08 } },
    { id: 'fanFavourite',  weight: 6, effects: { fanMood: 12, pressureRes: 6 } },
    { id: 'journeyman',    weight: 7, effects: { adaptability: 18, offerBoost: 0.18 } },
    { id: 'loyalist',      weight: 6, effects: { loyaltyGain: 0.4, boardTrust: 6, offerBoost: -0.10 } },
    { id: 'firefighter',   weight: 5, effects: { survival: 0.18, pressureRes: 14 } },
    { id: 'perfectionist', weight: 6, effects: { growth: 0.14, dressingRoom: -4, consistency: 6 } },
    { id: 'showman',       weight: 5, effects: { reputation: 10, mediaRisk: 0.22, fanMood: 6 } },
    { id: 'analyst',       weight: 6, effects: { tacticEdge: 0.09, tactics: 3, transfers: 3, media: -4 } }
  ];

  FKC.data.coachTraits = traits;
  FKC.data.coachTraitById = function (id) { return FKC.util.byId(traits, id); };

  /** Summiert einen Effektwert über alle Charakterzüge des Trainers */
  FKC.data.coachTraitBonus = function (game, key) {
    var sum = 0;
    var list = (game && game.hidden && game.hidden.traits) || [];
    list.forEach(function (id) {
      var t = FKC.data.coachTraitById(id);
      if (t && t.effects[key] != null) sum += t.effects[key];
    });
    return sum;
  };

  /* ── Versteckte Grundwerte ────────────────────────────────────────
     Dieselbe Dreiteilung wie beim Spieler: erst fällt die Klasse, dann
     das Potenzial darin. Zielbild über viele Karrieren ist 25 %
     schwach, 50 % mittel, 25 % stark.                              */
  FKC.data.rollCoachHidden = function (licenceId, philosophyId) {
    var r = FKC.rng;
    var lic = FKC.data.coachLicenceById(licenceId) || licences[0];

    var roll = r.next();
    var tier = roll < 0.25 ? 'low' : roll < 0.75 ? 'mid' : 'high';

    var base;
    if (tier === 'low')      base = r.gaussInt(64, 5, 52, 72);
    else if (tier === 'mid') base = r.gaussInt(76, 4, 70, 83);
    else                     base = r.gaussInt(88, 5, 82, 99);

    var potential = clamp(base + lic.potentialShift, 52, 99);

    var picked = [];
    var pool = traits.slice();
    var count = r.chance(0.45) ? 2 : 1;
    for (var i = 0; i < count; i++) {
      var t = r.weighted(pool, function (x) { return x.weight; });
      if (!t) break;
      picked.push(t.id);
      pool = pool.filter(function (x) { return x !== t; });
    }

    var hidden = {
      potential: potential,
      tier: tier,
      philosophy: philosophyId,
      /* Die Handschrift ist von Anfang an erkennbar — sie startet klar
         über dem neutralen Mittelwert und wächst mit jeder Saison, in
         der man ihr treu bleibt. */
      philosophyLevel: r.gaussInt(58, 6, 46, 72),
      signature: FKC.data.coachSignature(philosophyId, r),
      ambition: r.gaussInt(58, 16, 20, 96),
      temperament: r.gaussInt(55, 17, 15, 96),
      loyalty: r.gaussInt(55, 16, 12, 95),
      adaptability: r.gaussInt(58, 16, 18, 96),
      pressureRes: r.gaussInt(58, 15, 20, 96),
      consistency: r.gaussInt(60, 14, 25, 95),
      bigGame: r.gaussInt(55, 16, 20, 96),
      traits: picked
    };

    ['adaptability', 'pressureRes', 'consistency', 'bigGame'].forEach(function (k) {
      hidden[k] = clamp(hidden[k] + FKC.data.coachTraitBonusOf(picked, k), 5, 99);
    });

    return hidden;
  };

  /** Wie coachTraitBonus, aber direkt auf einer Liste von IDs */
  FKC.data.coachTraitBonusOf = function (ids, key) {
    var s = 0;
    (ids || []).forEach(function (id) {
      var t = FKC.data.coachTraitById(id);
      if (t && t.effects[key] != null) s += t.effects[key];
    });
    return s;
  };

  /* ── Startadressen zur Lizenz ─────────────────────────────────────
     Genau wie beim Spieler drei konkrete Vereine zur Auswahl statt
     einer Zuweisung. Gezogen wird aus dem Niveaufenster der Lizenz
     innerhalb des Heimatlandes.                                     */
  FKC.data.coachStartClubs = function (country, licenceId, rng, n) {
    var r = rng || FKC.rng;
    var lic = FKC.data.coachLicenceById(licenceId) || licences[0];

    var pool = FKC.data.clubsOfCountry(country);
    /* Kleine Ligensysteme (Schweiz, Schottland) haben zu wenige
       Vereine für ein enges Fenster — dann wird das ganze Land
       genommen und nur noch nach Niveau geschnitten. */
    if (pool.length < 8) pool = FKC.data.clubs.slice();

    var sorted = pool.slice().sort(function (a, b) {
      return FKC.data.clubLevel(a) - FKC.data.clubLevel(b);
    });

    var lo = Math.floor(sorted.length * lic.band[0]);
    var hi = Math.max(lo + 3, Math.ceil(sorted.length * lic.band[1]));
    var band = sorted.slice(lo, Math.min(hi, sorted.length));
    if (band.length < 3) band = sorted.slice(0, Math.min(6, sorted.length));

    return r.sample(band, Math.min(n || 3, band.length))
      .sort(function (a, b) { return FKC.data.clubLevel(b) - FKC.data.clubLevel(a); });
  };

  /* ── Erwartung des Vereins ────────────────────────────────────────
     Was ein Verein von seinem Trainer verlangt, hängt davon ab, wo er
     in seiner eigenen Liga steht — nicht an einem absoluten Wert. Ein
     Tabellenführer der zweiten Liga will aufsteigen, ein Aufsteiger
     will nur bleiben.                                              */
  FKC.data.coachMandate = function (club) {
    if (!club) return 'survive';
    var lg = FKC.data.leagueOf(club);
    if (!lg) return 'survive';
    var peers = FKC.data.clubsOf(lg.id);
    if (peers.length < 2) return 'midtable';

    var stronger = 0;
    peers.forEach(function (c) { if (c.strength > club.strength) stronger++; });
    var pct = stronger / peers.length;          // 0 = stärkster Verein der Liga

    if (lg.tier >= 2) {
      if (pct <= 0.18) return 'promotion';
      if (pct <= 0.55) return 'midtable';
      return 'survive';
    }
    if (pct <= 0.13) return 'title';
    if (pct <= 0.36) return 'europe';
    if (pct <= 0.70) return 'midtable';
    return 'survive';
  };

  /* Zielmarken je Auftrag. `patience` ist die Zahl der Saisons, die man
     bekommt, bevor eine verfehlte Erwartung wirklich gefährlich wird.
     `prestige` gewichtet den Auftrag im Karriere-Endergebnis.       */
  var MANDATE = {
    title: {
      great: function () { return 1; },
      good:  function () { return 2; },
      ok:    function () { return 4; },
      patience: 2, prestige: 1.40
    },
    europe: {
      great: function () { return 2; },
      good:  function (n) { return Math.max(3, Math.ceil(n * 0.20)); },
      ok:    function (n) { return Math.max(6, Math.ceil(n * 0.38)); },
      patience: 3, prestige: 1.18
    },
    midtable: {
      great: function (n) { return Math.max(3, Math.ceil(n * 0.25)); },
      good:  function (n) { return Math.max(6, Math.ceil(n * 0.45)); },
      ok:    function (n) { return Math.max(9, Math.ceil(n * 0.72)); },
      patience: 4, prestige: 1.00
    },
    survive: {
      great: function (n) { return Math.ceil(n * 0.45); },
      good:  function (n) { return Math.ceil(n * 0.65); },
      ok:    function (n) { return Math.max(1, n - 3); },
      patience: 5, prestige: 0.85
    },
    promotion: {
      great: function () { return 1; },
      good:  function () { return 2; },
      ok:    function (n) { return Math.max(4, Math.ceil(n * 0.35)); },
      patience: 3, prestige: 1.10
    }
  };

  FKC.data.mandateIds = ['title', 'europe', 'midtable', 'survive', 'promotion'];

  /**
   * Die drei Marken einer Erwartung für eine Liga dieser Grösse.
   * great = übertroffen, good = erfüllt, ok = gerade noch geduldet.
   */
  FKC.data.mandateBands = function (mandateId, size) {
    var m = MANDATE[mandateId] || MANDATE.midtable;
    var n = Math.max(6, size || 18);
    return {
      id: mandateId,
      great: clamp(m.great(n), 1, n),
      good:  clamp(m.good(n), 1, n),
      ok:    clamp(m.ok(n), 1, n),
      patience: m.patience,
      prestige: m.prestige
    };
  };

  /* ── Trainer-Verdikte (Rückblick am Ende) ─────────────────────────
     Eigene Schwellen, weil eine Trainerkarriere anders punktet als
     eine Spielerkarriere: mehr Titel, keine eigenen Tore.          */
  FKC.data.coachVerdicts = [
    { id: 'immortal',    min: 1500, minPeak: 88 },
    { id: 'legend',      min: 1100, minPeak: 83 },
    { id: 'worldclass',  min: 760,  minPeak: 77 },
    { id: 'respected',   min: 520,  minPeak: 70 },
    { id: 'solid',       min: 340,  minPeak: 0 },
    { id: 'journeyman',  min: 170,  minPeak: 0 },
    { id: 'grafter',     min: 95,   minPeak: 0 },
    { id: 'unfulfilled', min: 50,   minPeak: 0 },
    { id: 'nearly',      min: 0,    minPeak: 0 }
  ];

  FKC.data.coachVerdictFor = function (score, peakOvr) {
    var peak = peakOvr == null ? 99 : peakOvr;
    var list = FKC.data.coachVerdicts;
    for (var i = 0; i < list.length; i++) {
      if (score >= list[i].min && peak >= (list[i].minPeak || 0)) return list[i];
    }
    return list[list.length - 1];
  };

})(window.FKC);
