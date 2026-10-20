/* ── Übersicht: Trainer ────────────────────────────────────────────────
   Die zentrale Karteikarte der Trainerkarriere — Werte, Stand beim
   Verein, Kader, Verlauf. Gegenstück zu js/ui/screens/hub.js.       */

(function (FKC) {
  'use strict';
  var c = FKC.ui.c, t = FKC.t;

  /* ── Trainerkarte ───────────────────────────────────────────────── */
  function coachCard(game) {
    var club = FKC.state.club();
    var tier = FKC.coachAttr.tier(game.ovr);
    var ph = FKC.data.philosophyById(game.hidden.philosophy);

    var html = '<div class="playercard"><div class="pc-top">';
    html += '<div class="badge-stack">';
    html += '<div class="ovr-badge" data-tier="' + tier + '">' +
      '<span class="ovr-num">' + game.ovr + '</span>' +
      '<span class="ovr-lbl">' + t('card.ovr') + '</span></div>';
    if (game.career.phase !== 'retired' && game.ovr < game.hidden.potential) {
      var pr = FKC.coachAttr.potentialRange(game);
      html += '<div class="pot-badge" data-tier="' + FKC.coachAttr.potentialTier(game) + '">' +
        '<span class="pot-num">' + pr.low + '–' + pr.high + '</span>' +
        '<span class="pot-lbl">' + t('card.potential') + '</span></div>';
    }
    html += '</div>';

    html += '<div class="pc-id"><div class="pc-name">' + c.esc(FKC.state.fullName()) + '</div>' +
      '<div class="pc-sub">' + FKC.ui.art.flag(game.identity.nationality, 20) + ' ' +
      c.esc(FKC.data.nationName(game.identity.nationality)) + '</div>' +
      '<div class="pc-sub">' + t('cphase.' + game.career.phase) + ' · ' +
      t('card.age', { n: FKC.state.age() }) + '</div>';
    if (ph) {
      html += '<div class="pc-sub" style="margin-top:6px">' +
        c.chip('◆ ' + t('philosophy.' + ph.id), 'accent') + '</div>';
    }
    if (club) {
      html += '<div class="pc-sub" style="margin-top:6px">' + c.crest(club) +
        '<span class="club-name">' + c.esc(club.name) + '</span></div>';
    } else if (game.national.teamId) {
      html += '<div class="pc-sub" style="margin-top:6px">' +
        FKC.ui.art.flag(game.national.teamId, 20) + ' <span class="club-name">' +
        c.esc(FKC.data.nationName(game.national.teamId)) + '</span></div>';
    }
    html += '</div></div>';

    /* Karrierebilanz */
    var tot = game.career.totals;
    if (tot.matches > 0) {
      html += '<div class="pc-career">' + [
        [t('cseason.matches'), tot.matches],
        [t('cseason.wdl'), tot.w + '–' + tot.d + '–' + tot.l],
        [t('cseason.ppg'), FKC.util.round(tot.points / tot.matches, 2).toFixed(2)]
      ].map(function (s) {
        return '<div class="pc-career-item"><b>' + s[1] + '</b><span>' + s[0] + '</span></div>';
      }).join('') + '</div>';
    }

    var keys = [[t('chub.marketWage'), FKC.i18n.money(FKC.coachAttr.marketWage(game))],
                [t('cmeter.reputation'), Math.round(game.status.reputation)]];
    if (game.status.contract) {
      keys.push([t('chub.contract'), t('hub.yearsLeft', { n: game.status.contract.yearsLeft })]);
    } else {
      keys.push([t('chub.sackings'), String(game.career.sackings || 0)]);
    }
    html += '<div class="pc-keys">' + keys.map(function (k) {
      return '<div class="pc-key"><span>' + c.esc(k[0]) + '</span><b>' + c.esc(k[1]) + '</b></div>';
    }).join('') + '</div>';

    html += (FKC.ui.coachAttrGrid ? FKC.ui.coachAttrGrid(game, null) : '');
    html += '</div>';
    return html;
  }

  /* ── Kaderzeile ─────────────────────────────────────────────────── */
  function playerRow(p, isXI) {
    return '<div class="pl-row' + (isXI ? ' is-xi' : '') + '">' +
      '<span class="pl-pos">' + t('pos.short.' + p.pos) + '</span>' +
      '<div style="min-width:0;flex:1">' +
      '<div class="pl-name">' + c.esc(p.name) +
      (p.injury ? ' <span class="chip chip-bad">' + t('csquad.injured') + '</span>' : '') +
      '</div>' +
      '<div class="club-meta">' + FKC.ui.art.flag(p.nat, 14) + ' ' +
      t('card.age', { n: p.age }) + ' · ' + FKC.i18n.money(p.value) +
      ' · ' + t('csquad.years', { n: p.years }) + '</div></div>' +
      '<span class="pl-ovr" data-tier="' + FKC.coachAttr.tier(p.ovr) + '">' + p.ovr + '</span>' +
      '</div>';
  }

  FKC.ui.router.register('coachHub', {

    render: function () {
      var game = FKC.state.game;
      if (!game) { setTimeout(function () { FKC.ui.router.go('menu'); }, 0); return ''; }

      var club = FKC.state.club();
      var html = coachCard(game);

      /* Stand beim Verein */
      html += c.sectionTitle(t('chub.standing'));
      html += '<div class="card"><div class="stack-sm">' +
        c.meter(t('cmeter.boardTrust'), game.standing.boardTrust, 'grass') +
        c.meter(t('cmeter.fanMood'), game.standing.fanMood, 'warm') +
        c.meter(t('cmeter.dressingRoom'), game.standing.dressingRoom, 'cool') +
        c.meter(t('cmeter.pressure'), game.standing.pressure, 'warm') +
        '</div></div>';

      /* Verein oder Nationalmannschaft */
      html += c.sectionTitle(game.career.phase === 'national' ? t('chub.nation') : t('chub.club'));
      html += '<div class="card">';
      if (club) {
        var lg = FKC.data.leagueOf(club);
        html += '<div style="margin-bottom:12px">' + c.clubLine(club, lg ? lg.name : '') + '</div>';
        var rows = [[t('chub.since'), t('chub.seasons', { n: game.status.seasonsAtClub })]];
        if (game.status.mandate) rows.push([t('chub.mandate'), t('mandate.' + game.status.mandate)]);
        if (game.status.contract) {
          rows.push([t('chub.salary'), FKC.i18n.money(game.status.contract.salary) + t('unit.perYear')]);
          rows.push([t('chub.contract'), t('hub.yearsLeft', { n: game.status.contract.yearsLeft })]);
        }
        if (game.status.contComp) {
          rows.push([t('season.national'), FKC.data.compName(game.status.contComp)]);
        }
        html += c.kv(rows);
        if (game.status.mandate) {
          html += '<p class="u-muted" style="font-size:.8rem;margin:12px 0 0">' +
            t('mandate.desc.' + game.status.mandate) + '</p>';
        }
      } else if (game.national.teamId) {
        html += '<div class="row" style="gap:10px;align-items:center;margin-bottom:12px">' +
          FKC.ui.art.flag(game.national.teamId, 30) +
          '<b>' + c.esc(FKC.data.nationName(game.national.teamId)) + '</b></div>';
        var nrows = [[t('chub.since'), String(game.national.since)]];
        if (game.status.mandate) nrows.push([t('chub.mandate'), t('mandate.' + game.status.mandate)]);
        if (game.status.contract) {
          nrows.push([t('chub.salary'), FKC.i18n.money(game.status.contract.salary) + t('unit.perYear')]);
          nrows.push([t('chub.contract'), t('hub.yearsLeft', { n: game.status.contract.yearsLeft })]);
        }
        html += c.kv(nrows);
      } else {
        html += '<p class="u-muted">' + t('chub.noClub') + '</p>';
      }
      html += '</div>';

      /* Handschrift */
      var ph = FKC.data.philosophyById(game.hidden.philosophy);
      if (ph) {
        html += c.sectionTitle(t('chub.philosophy'));
        html += '<div class="card">' +
          '<div class="row-between"><span class="choice-title">◆ ' +
          t('philosophy.' + ph.id) + '</span>' +
          c.chip(t('philosophy.needs.' + ph.needs), 'accent') + '</div>' +
          '<p class="u-muted" style="font-size:.84rem;margin:8px 0 12px">' +
          t('philosophy.desc.' + ph.id) + '</p>' +
          c.meter(t('philosophy.level'), game.hidden.philosophyLevel, 'grass') +
          (club && (game.squad.players || []).length
            ? '<div style="margin-top:8px">' + c.meter(t('philosophy.fit'),
                FKC.util.clamp((FKC.coachSquad.fit(game) - 0.4) / 1.0 * 100, 0, 100), 'warm') +
              '</div>'
            : '') +
          '</div>';
      }

      /* Kader */
      if (club && (game.squad.players || []).length) {
        var xi = {};
        FKC.coachSquad.bestXI(game).forEach(function (p) { xi[p.id] = 1; });
        var list = FKC.coachSquad.sorted(game);

        html += c.sectionTitle(t('chub.squad'));
        html += '<div class="card">' + c.kv([
          [t('cmeter.squadStrength'), '<b>' + Math.round(FKC.coachSquad.strength(game)) + '</b>'],
          [t('ctransfer.avgAge'), String(FKC.coachSquad.avgAge(game))],
          [t('ctransfer.wageBill'), FKC.i18n.money(FKC.coachSquad.wageBill(game)) + t('unit.perYear')],
          [t('ctransfer.budget'), FKC.i18n.money(game.squad.budget.transfer)]
        ]) + '<div class="squad-list" style="margin-top:14px">' +
          list.map(function (p) { return playerRow(p, !!xi[p.id]); }).join('') +
          '</div></div>';
      }

      /* Trainertyp */
      var traits = (game.hidden.traits || []);
      if (traits.length) {
        html += c.sectionTitle(t('chub.traits'));
        html += '<div class="card"><div class="pill-group">' +
          traits.map(function (id) { return c.chip(t('ctrait.' + id), 'accent'); }).join('') +
          '</div><p class="u-muted" style="font-size:.8rem;margin-top:10px">' +
          traits.map(function (id) { return t('ctrait.desc.' + id); }).join(' ') +
          '</p></div>';
      }

      /* Trophäenschrank */
      var titles = game.career.trophies.length + game.career.awards.length;
      html += c.sectionTitle(t('chub.trophies'));
      html += '<div class="card"><div class="row-between">' +
        '<span class="u-dim" style="font-size:.88rem">' +
        (titles ? t('cabinet.sub', { n: titles }) : t('cabinet.empty')) + '</span>' +
        '<span class="row" style="gap:8px">' +
        '<button class="btn btn-sm" data-act="tables">' + t('hub.openTables') + '</button>' +
        '<button class="btn btn-sm" data-act="cabinet">' + t('hub.openCabinet') + '</button>' +
        '</span></div>';
      if (titles) {
        var groups = [], index = {};
        function collect(id, name, national) {
          var k = id + '|' + name;
          if (!index[k]) { index[k] = { compId: id, name: name, n: 0, national: national };
                           groups.push(index[k]); }
          index[k].n++;
        }
        game.career.trophies.forEach(function (tr) {
          collect(tr.compId, tr.name || FKC.data.compName(tr.compId), tr.national);
        });
        game.career.awards.forEach(function (a) { collect(a.id, t('award.' + a.id), false); });
        html += '<div class="trophy-row" style="margin-top:14px">' +
          groups.map(function (tr) {
            return '<div class="trophy-mini">' +
              FKC.ui.trophy(tr.compId, 48, tr.national) +
              (tr.n > 1 ? '<span class="trophy-count">' + tr.n + '×</span>' : '') +
              '<div class="trophy-name">' + c.esc(tr.name) + '</div></div>';
          }).join('') + '</div>';
      }
      html += '</div>';

      /* Stationen */
      html += c.sectionTitle(t('chub.stations'));
      html += '<div class="card">' + stations(game) + '</div>';

      /* Verlauf */
      if (game.ovrHistory.length > 2) {
        html += c.sectionTitle(t('chub.progress'));
        html += '<div class="card">' + FKC.ui.art.historyChart([
          { values: game.ovrHistory.map(function (p) { return { x: p.age, y: p.ovr }; }),
            color: 'var(--accent)', label: t('card.ovr') },
          { values: game.ovrHistory.filter(function (p) { return p.trust != null; })
              .map(function (p) { return { x: p.age, y: p.trust }; }),
            color: 'var(--warn)', label: t('cmeter.boardTrust'), dashed: true }
        ], { h: 92 }) +
          '<div class="row-between u-muted" style="margin-top:4px;font-size:.72rem">' +
          '<span>' + t('story.age', { n: game.ovrHistory[0].age }) + '</span>' +
          '<span>' + t('story.age', { n: FKC.state.age() }) + '</span></div></div>';
      }

      /* Zeitstrahl */
      html += c.sectionTitle(t('chub.timeline'));
      html += '<div class="card">' + c.timeline(game.career.timeline.slice().reverse()) + '</div>';

      /* Freiwillig aufhören */
      if (game.career.phase !== 'retired' && FKC.state.age() >= 55) {
        html += '<div style="margin-top:20px" class="u-center">' +
          '<button class="btn btn-danger btn-sm" data-act="retire">' +
          t('chub.retireNow') + '</button></div>';
      }

      html += '<div class="actionbar">';
      if (game.career.phase === 'retired') {
        html += '<button class="btn btn-primary btn-block" data-act="retro">' +
          t('chub.showRetro') + '</button>';
      } else {
        html += '<button class="btn btn-primary btn-block" data-act="continue">' +
          t(game.status.clubId || game.career.phase === 'national'
            ? 'chub.startSeason' : 'chub.continue') + '</button>';
      }
      html += '</div>';

      return html;
    },

    bind: function (root) {
      root.addEventListener('click', function (e) {
        var b = e.target.closest('[data-act]');
        if (!b) return;
        var act = b.getAttribute('data-act');

        if (act === 'continue') {
          FKC.ui.router.go('coachStory');
        } else if (act === 'cabinet') {
          FKC.ui.router.go('trophies');
        } else if (act === 'tables') {
          FKC.ui.router.go('tables');
        } else if (act === 'retro') {
          FKC.ui.router.go('coachRetire');
        } else if (act === 'retire') {
          FKC.ui.router.confirm(t('chub.retireTitle'), t('chub.retireText'), function () {
            FKC.coachCareer.retire(FKC.state.game, 'choice');
            FKC.ui.router.go('coachRetire');
          }, true);
        }
      });
    }
  });

  /* ── Stationen als Liste ────────────────────────────────────────── */
  function stations(game) {
    var list = game.career.clubsManaged || [];
    if (!list.length) return '<p class="u-muted" style="margin:0">' + t('timeline.empty') + '</p>';
    return list.slice().reverse().map(function (st) {
      var name, crest;
      if (st.national) {
        name = FKC.data.nationName(st.nationId);
        crest = FKC.ui.art.flag(st.nationId, 22) + ' ';
      } else {
        var club = FKC.data.clubById(st.clubId);
        name = club ? club.name : st.clubId;
        crest = club ? c.crest(club) + ' ' : '';
      }
      var games = st.matches || 0;
      return '<div class="kv"><span>' + crest + c.esc(name) + '</span>' +
        '<span class="u-mono-num">' + st.from + '–' + (st.to || '') +
        ' · ' + st.w + '–' + st.d + '–' + st.l +
        (st.trophies ? ' · 🏆' + st.trophies : '') + '</span></div>';
    }).join('');
  }

  FKC.ui.coachStations = stations;

})(window.FKC);
