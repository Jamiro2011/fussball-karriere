/* ── Effekt-Engine für die Trainerkarriere ─────────────────────────────
   Gleiches Prinzip wie bei der Spielerkarriere: Ereignisse und
   Entscheidungen liefern deklarative Effektlisten. Dadurch lassen sie
   sich anwenden UND automatisch anzeigen ("Vorstand 48 (−12)").

   Bewusst eine eigene Datei statt eines Schalters in effects.js: die
   Werte, die ein Trainer hat, sind andere als die eines Spielers. Ein
   gemeinsames handle() mit zwei Hälften wäre nur schwerer zu lesen. */

window.FKC = window.FKC || {};

(function (FKC) {
  'use strict';

  var E = {};
  var clamp = function (v, a, b) { return FKC.util.clamp(v, a, b); };

  /* ── Anwenden ───────────────────────────────────────────────────── */

  E.apply = function (game, effects) {
    var applied = [];
    (effects || []).forEach(function (fx) {
      if (!fx) return;
      if (handle(game, fx) !== false) applied.push(fx);
    });
    FKC.coachAttr.recalc(game);
    return applied;
  };

  function handle(game, fx) {
    var s = game.status, st = game.standing, h = game.hidden;

    switch (fx.type) {

      case 'attr':
        if (game.attributes[fx.key] == null) return false;
        game.attributes[fx.key] = clamp(game.attributes[fx.key] + fx.delta, 5, 99);
        return true;

      case 'attrRandom': {
        var keys = fx.keys || FKC.data.coachAttrKeys;
        var k = FKC.rng.pick(keys);
        fx.resolvedKey = k;
        if (game.attributes[k] == null) return false;
        game.attributes[k] = clamp(game.attributes[k] + fx.delta, 5, 99);
        return true;
      }

      case 'attrAll':
        FKC.data.coachAttrKeys.forEach(function (key) {
          game.attributes[key] = clamp(game.attributes[key] + fx.delta, 5, 99);
        });
        return true;

      case 'potential':
        h.potential = clamp(h.potential + fx.delta, 40, 99);
        return true;

      case 'boardTrust':
        st.boardTrust = clamp(st.boardTrust + fx.delta, 0, 100);
        return true;

      case 'fanMood':
        st.fanMood = clamp(st.fanMood + fx.delta, 0, 100);
        return true;

      case 'dressingRoom':
        st.dressingRoom = clamp(st.dressingRoom + fx.delta, 0, 100);
        return true;

      /* Druck ist der Zähler, an dem das Entlassungsrisiko hängt.
         Er baut sich über schlechte Serien auf und über gute ab. */
      case 'pressure':
        st.pressure = clamp(st.pressure + fx.delta, 0, 100);
        return true;

      case 'reputation':
        s.reputation = clamp(s.reputation + fx.delta, 0, 100);
        return true;

      case 'money':
        game.career.finances.balance = Math.max(-5e6,
          game.career.finances.balance + fx.delta);
        return true;

      /* Transferbudget für das laufende Fenster */
      case 'budget':
        game.squad.budget.transfer = Math.max(0, game.squad.budget.transfer + fx.delta);
        return true;

      case 'hidden':
        if (h[fx.key] == null) return false;
        h[fx.key] = clamp(h[fx.key] + fx.delta, 1, 99);
        return true;

      case 'philosophy':
        h.philosophyLevel = clamp(h.philosophyLevel + fx.delta, 15, 99);
        return true;

      case 'trait':
        h.traits = h.traits || [];
        if (h.traits.indexOf(fx.id) < 0) h.traits.push(fx.id);
        return true;

      case 'flag':
        game.flags[fx.key] = fx.value === undefined ? true : fx.value;
        return true;

      case 'growthBonus':
        game.flags.growthBonus = (game.flags.growthBonus || 0) + fx.points;
        return true;

      case 'club':
        E.moveToClub(game, fx.club || FKC.data.clubById(fx.clubId), fx.clubType);
        return true;

      /* Stimmung im ganzen Kader — die häufigste Folge einer
         Trainerentscheidung überhaupt. */
      case 'squadMorale':
        (game.squad.players || []).forEach(function (p) {
          p.morale = clamp(p.morale + fx.delta, 0, 100);
        });
        return true;

      /* Einen einzelnen Spieler treffen (Konflikt mit einem Star) */
      case 'playerMorale': {
        var pl = FKC.coachSquad.byId(game, fx.playerId);
        if (!pl) return false;
        pl.morale = clamp(pl.morale + fx.delta, 0, 100);
        fx.resolvedName = pl.name;
        return true;
      }

      /* Verletzungswelle: die n besten Spieler fallen Wochen aus */
      case 'squadInjury': {
        var hurt = FKC.coachSquad.injure(game, fx.count || 1, fx.weeks || 8);
        fx.resolvedCount = hurt.length;
        return true;
      }

      case 'timeline':
        FKC.state.logTimeline({ text: { key: fx.key, params: fx.params }, mark: fx.mark });
        return true;

      case 'none':
        return true;

      default:
        console.warn('[coachEffects] unbekannter Typ:', fx.type);
        return false;
    }
  }

  /* ── Vereinswechsel ─────────────────────────────────────────────── */
  E.moveToClub = function (game, club, clubType) {
    if (!club) return;
    var prev = game.status.clubId;

    game.status.clubId = club.id;
    game.status.clubType = clubType || 'club';
    game.status.seasonsAtClub = 0;
    game.status.seasonsMissed = 0;
    game.status.mandate = FKC.data.coachMandate(club);

    /* Ein neuer Trainer startet mit Vorschusslorbeeren, aber ohne
       gewachsene Bindung — genau wie beim Spieler die Vereinstreue. */
    game.standing.boardTrust = 62;
    game.standing.fanMood = 58;
    game.standing.dressingRoom = 55;
    game.standing.pressure = Math.max(0, game.standing.pressure - 40);

    if (prev !== club.id) {
      /* Jede noch offene Station schliessen — das kann der bisherige
         Verein sein oder ein Amt als Nationaltrainer. */
      for (var i = game.career.clubsManaged.length - 1; i >= 0; i--) {
        var st = game.career.clubsManaged[i];
        if (st.to == null && (st.clubId === prev || st.national)) {
          st.to = game.identity.year;
          break;
        }
      }
      game.career.clubsManaged.push({
        clubId: club.id, from: game.identity.year, to: null,
        matches: 0, w: 0, d: 0, l: 0, trophies: 0, mandate: game.status.mandate
      });
    }

    /* Neuer Verein, neuer Kader und neues Budget */
    FKC.coachSquad.build(game, club);
  };

  /* ── Beschreiben (für die Oberfläche) ───────────────────────────── */

  E.describe = function (game, fx) {
    var t = FKC.t;
    var n = function (v) { return (v > 0 ? '+' : '') + v; };
    var now = function (label, value, delta) {
      return label + ' ' + Math.round(value) + ' (' + n(delta) + ')';
    };

    switch (fx.type) {
      case 'attr':
        return chip(now(t('cattr.' + fx.key), game.attributes[fx.key], fx.delta), fx.delta);
      case 'attrRandom': {
        var rk = fx.resolvedKey || (fx.keys || FKC.data.coachAttrKeys)[0];
        return chip(now(t('cattr.' + rk), game.attributes[rk], fx.delta), fx.delta);
      }
      case 'attrAll':
        return chip(n(fx.delta) + ' ' + t('ceffect.allAttrs') + ' · ' +
                    t('card.ovr') + ' ' + game.ovr, fx.delta);
      case 'potential':
        return chip(t('effect.potential', { v: n(fx.delta) }), fx.delta);
      case 'boardTrust':
        return chip(now(t('ceffect.boardTrust'), game.standing.boardTrust, fx.delta), fx.delta);
      case 'fanMood':
        return chip(now(t('ceffect.fanMood'), game.standing.fanMood, fx.delta), fx.delta);
      case 'dressingRoom':
        return chip(now(t('ceffect.dressingRoom'), game.standing.dressingRoom, fx.delta), fx.delta);
      case 'pressure':
        return chip(now(t('ceffect.pressure'), game.standing.pressure, fx.delta), -fx.delta);
      case 'reputation':
        return chip(now(t('effect.reputation'), game.status.reputation, fx.delta), fx.delta);
      case 'money':
        return chip((fx.delta > 0 ? '+' : '−') + FKC.i18n.money(Math.abs(fx.delta)) +
                    ' · ' + FKC.i18n.money(game.career.finances.balance), fx.delta);
      case 'budget':
        return chip(t('ceffect.budget', { v: (fx.delta > 0 ? '+' : '−') +
                    FKC.i18n.money(Math.abs(fx.delta)) }), fx.delta);
      case 'hidden':
        return chip(n(fx.delta) + ' ' + t('chidden.' + fx.key), fx.delta);
      case 'philosophy':
        return chip(now(t('ceffect.philosophy'), game.hidden.philosophyLevel, fx.delta), fx.delta);
      case 'trait':
        return chip(t('effect.trait', { name: t('ctrait.' + fx.id) }), 1);
      case 'growthBonus':
        return chip(t('effect.growthBonus'), 1);
      case 'club':
        return chip(t('effect.newClub', { club: (fx.club && fx.club.name) || '' }), 1);
      case 'squadMorale':
        return chip(t('ceffect.squadMorale', { v: n(fx.delta) }), fx.delta);
      case 'playerMorale':
        return chip((fx.resolvedName || '') + ' ' + n(fx.delta), fx.delta);
      case 'squadInjury':
        return chip(t('ceffect.squadInjury', { n: fx.resolvedCount != null
                    ? fx.resolvedCount : (fx.count || 1) }), -1);
      default:
        return null;
    }

    function chip(label, tone) {
      return { label: label, tone: tone > 0 ? 'good' : (tone < 0 ? 'bad' : 'neutral') };
    }
  };

  E.describeAll = function (game, effects) {
    return (effects || []).map(function (fx) { return E.describe(game, fx); })
                          .filter(Boolean);
  };

  FKC.coachEffects = E;

})(window.FKC);
