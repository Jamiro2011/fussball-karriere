/* ── Karriereende: Trainer-Rückblick ───────────────────────────────────
   Das Gesamturteil über die Laufbahn an der Seitenlinie. Aufbau wie
   der Spieler-Rückblick (js/ui/screens/retire.js).                  */

(function (FKC) {
  'use strict';
  var c = FKC.ui.c, t = FKC.t;

  function card(id, name, count, national) {
    return '<div class="trophy-card">' +
      (count > 1 ? '<span class="trophy-count">×' + count + '</span>' : '') +
      '<div class="trophy-art">' + FKC.ui.trophy(id, 58, national) + '</div>' +
      '<div class="trophy-name">' + c.esc(name) + '</div></div>';
  }

  FKC.ui.router.register('coachRetire', {

    render: function () {
      var game = FKC.state.game;
      if (!game) { setTimeout(function () { FKC.ui.router.go('menu'); }, 0); return ''; }

      if (!game.pending || game.pending.kind !== 'retire') {
        game.pending = { kind: 'retire' };
      }
      var s = game.pending.summary ||
              (game.pending.summary = FKC.coachCareer.buildRetrospective(game));

      var html = '<div class="hero" style="padding-bottom:var(--sp-4)">' +
        '<div class="hero-kicker">' + t('cretire.kicker', { age: s.retiredAt }) + '</div>' +
        '<h1 style="margin-top:14px">' + c.esc(FKC.state.fullName()) + '</h1>' +
        '<p style="margin-top:10px;display:flex;align-items:center;justify-content:center;gap:8px">' +
        FKC.ui.art.flag(game.identity.nationality, 24) +
        t('cretire.sub', { seasons: s.seasons }) + '</p></div>';

      /* Verdikt */
      html += '<div class="playercard" style="text-align:center">' +
        '<div class="hero-kicker" style="letter-spacing:.24em">' + t('cretire.verdict') + '</div>' +
        '<h2 style="margin:10px 0 8px;font-size:1.8rem;color:var(--gold)">' +
        t('cverdict.' + s.verdictId) + '</h2>' +
        '<div class="career-score"><b>' + (s.rated != null ? s.rated : '—') +
        '</b><span>' + t('cretire.ratingOf100') + '</span></div>' +
        '<p class="u-dim" style="font-size:.9rem;margin:0 auto;max-width:38ch">' +
        t('cverdict.desc.' + s.verdictId) + '</p></div>';

      /* Zusammensetzung */
      html += c.sectionTitle(t('cretire.breakdown'));
      var parts = s.parts || {};
      var maxPart = Math.max(1, parts.rating || 0, parts.trophies || 0,
                             parts.national || 0, parts.record || 0, parts.awards || 0);
      html += '<div class="card"><div class="stack-sm">' +
        ['rating', 'trophies', 'national', 'record', 'awards'].map(function (k) {
          var v = parts[k] || 0;
          return c.meter(t('cretire.part.' + k), v / maxPart * 100,
                         k === 'trophies' ? 'warm' : k === 'national' ? 'cool' : 'grass',
                         FKC.i18n.num(v));
        }).join('') + '</div>' +
        '<div class="kv" style="margin-top:12px"><span>' + t('cretire.total') +
        '</span><span><b>' + FKC.i18n.num(s.score) + '</b></span></div></div>';

      /* Handschrift */
      var ph = FKC.data.philosophyById(s.philosophy);
      if (ph) {
        html += c.sectionTitle(t('cretire.handwriting'));
        html += '<div class="card">' +
          '<div class="choice-title">◆ ' + t('philosophy.' + ph.id) + '</div>' +
          '<p class="u-muted" style="font-size:.84rem;margin:8px 0 12px">' +
          t('philosophy.desc.' + ph.id) + '</p>' +
          c.meter(t('philosophy.level'), s.philosophyLevel, 'grass') + '</div>';
      }

      /* Eckdaten */
      var tot = s.totals;
      var winRate = tot.matches ? Math.round(tot.w / tot.matches * 100) : 0;
      html += c.sectionTitle(t('cretire.numbers'));
      html += '<div class="card">' + c.stats([
        { value: s.peakOvr, label: t('cretire.peak') },
        { value: tot.matches, label: t('cretire.matches') },
        { value: winRate + '%', label: t('cretire.winRate') }
      ]) + '<div style="margin-top:12px">' + c.kv([
        [t('cseason.wdl'), tot.w + ' / ' + tot.d + ' / ' + tot.l],
        [t('cseason.goals'), tot.gf + ':' + tot.ga],
        [t('cretire.ppg'), s.ppg.toFixed(2)],
        [t('chub.sackings'), String(s.sackings)],
        [t('chub.balance'), FKC.i18n.money(s.finances)]
      ]) + '</div></div>';

      /* Stationen */
      html += c.sectionTitle(t('cretire.clubs'));
      html += '<div class="card">' + (FKC.ui.coachStations
        ? FKC.ui.coachStations(game) : '') + '</div>';

      /* Verlauf */
      if (game.ovrHistory.length > 3) {
        html += c.sectionTitle(t('cretire.curve'));
        html += '<div class="card">' + FKC.ui.art.historyChart([
          { values: game.ovrHistory.map(function (p) { return { x: p.age, y: p.ovr }; }),
            color: 'var(--accent)', label: t('card.ovr') },
          { values: game.ovrHistory.filter(function (p) { return p.trust != null; })
              .map(function (p) { return { x: p.age, y: p.trust }; }),
            color: 'var(--warn)', label: t('cmeter.boardTrust'), dashed: true }
        ], { h: 96 }) +
          '<div class="row-between u-muted" style="margin-top:4px;font-size:.72rem">' +
          '<span>' + t('story.age', { n: game.ovrHistory[0].age }) + '</span>' +
          '<span>' + t('story.age', { n: s.retiredAt }) + '</span></div></div>';
      }

      /* Titel und Auszeichnungen */
      html += c.sectionTitle(t('cretire.trophies'));
      if (s.trophies.length || s.awards.length) {
        var byAward = {};
        s.awards.forEach(function (a) {
          var k = a.id + '|' + (a.compId || '');
          if (!byAward[k]) {
            byAward[k] = { id: a.id, count: 0,
              label: t('award.' + a.id) + (a.compId ? ' · ' + FKC.data.compName(a.compId) : '') };
          }
          byAward[k].count++;
        });
        html += '<div class="cabinet">' +
          s.trophies.map(function (tr) {
            return card(tr.compId, tr.name, tr.count, tr.national);
          }).join('') +
          Object.keys(byAward).map(function (k) {
            return card(byAward[k].id, byAward[k].label, byAward[k].count, false);
          }).join('') + '</div>';
        html += '<button class="btn btn-block btn-sm" style="margin-top:12px" data-act="cabinet">' +
          t('hub.openCabinet') + '</button>';
      } else {
        html += '<div class="card"><p class="u-muted" style="margin:0">' +
          t('cretire.noTrophies') + '</p></div>';
      }

      /* Nationalmannschaft */
      html += c.sectionTitle(t('cretire.national'));
      html += '<div class="card">';
      if (s.national.nationId || s.national.tournaments.length) {
        html += c.kv([
          [t('chub.nation'), s.national.nationId
            ? c.esc(FKC.data.nationName(s.national.nationId)) : '—'],
          [t('cseason.tournament'), s.national.tournaments.length
            ? s.national.tournaments.filter(function (x) { return x.qualified; })
                .map(function (x) {
                  return FKC.data.compName(x.compId) + ' (' + t('season.stage.' + x.result) + ')';
                }).join(', ') || t('cretire.noneNat')
            : t('cretire.noneNat')]
        ]);
      } else {
        html += '<p class="u-muted" style="margin:0">' + t('cretire.noneNat') + '</p>';
      }
      html += '</div>';

      html += '<div class="actionbar">' +
        '<button class="btn btn-ghost" data-act="menu">' + t('cretire.toMenu') + '</button>' +
        '<button class="btn btn-primary" data-act="new">' + t('cretire.newCareer') + '</button></div>';

      return html;
    },

    bind: function (root) {
      root.addEventListener('click', function (e) {
        var b = e.target.closest('[data-act]');
        if (!b) return;
        var act = b.getAttribute('data-act');
        if (act === 'cabinet') {
          FKC.ui.router.go('trophies');
        } else if (act === 'new') {
          FKC.ui.router.confirm(t('menu.newWarnCoachTitle'), t('menu.newWarnCoachText'), function () {
            FKC.save.clear('coach');
            FKC.ui.router.go('coachCreate');
          }, true);
        } else {
          FKC.ui.router.go('menu');
        }
      });
    }
  });

})(window.FKC);
