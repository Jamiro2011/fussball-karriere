/* ── Erzählbildschirm: Trainerkarriere ─────────────────────────────────
   Zeigt die jeweils aktuelle Szene: Einstieg, Saisonvorbereitung,
   Transferfenster, Pressekonferenz, Ereignis, Saisonbilanz,
   Vorstandsbewertung, Vereinsfrage, Vertragsverhandlung.

   Aufbau bewusst identisch zur Spielerkarriere (js/ui/screens/story.js) —
   es soll sich anfühlen wie dasselbe Spiel aus anderer Perspektive. */

(function (FKC) {
  'use strict';
  var c = FKC.ui.c, t = FKC.t;

  var pendingCelebration = null;
  var celebratedSeason = null;

  FKC.ui.router.register('coachStory', {

    render: function () {
      var game = FKC.state.game;
      if (!game) return '';
      var scene = FKC.coachCareer.nextScene();
      if (!scene) return '<p>' + t('story.none') + '</p>';

      if (scene.kind === 'retire') {
        setTimeout(function () { FKC.ui.router.go('coachRetire'); }, 0);
        return '';
      }

      switch (scene.kind) {
        case 'intro':          return renderIntro(game, scene);
        case 'prep':           return renderPrep(game, scene);
        case 'transferWindow': return renderTransferWindow(game, scene);
        case 'scene':          return renderScene(game, scene);
        case 'seasonReview':   return renderSeasonReview(game, scene);
        case 'boardReview':    return renderBoardReview(game, scene);
        case 'jobChoice':      return renderJob(game, scene);
        case 'nationalOffer':  return renderNationalOffer(game, scene);
        case 'contract':       return renderContract(game, scene);
        default:               return '';
      }
    },

    bind: function (root) {
      if (pendingCelebration) {
        var feier = pendingCelebration;
        pendingCelebration = null;
        /* Der Merker gehört zu genau einer Karriere. Wurde zwischen
           Vormerken und Start eine andere geladen (Karriereende, neue
           Karriere, Import), verfällt die Feier — sonst bekäme der neue
           Trainer am ersten Tag den Pokal seines Vorgängers gezeigt. */
        var g = FKC.state.game;
        if (g && g.meta && feier.owner === g.meta.createdAt) {
          setTimeout(function () {
            FKC.guard('Titelfeier', function () { FKC.ui.celebrate(feier.items); });
          }, 60);
        }
      }

      root.addEventListener('click', function (e) {
        /* Ausrichtung umschalten, ohne den Bildschirm aufzulösen */
        var app = e.target.closest('[data-approach]');
        if (app) {
          var key = FKC.coachCareer.setApproach(FKC.state.game,
            app.getAttribute('data-approach'));
          if (key) {
            root.querySelectorAll('[data-approach]').forEach(function (b) {
              b.setAttribute('aria-pressed', b.getAttribute('data-approach') === key);
            });
            var hint = root.querySelector('#approach-hint');
            if (hint) hint.textContent = t('capproach.' + key + '_d');
          }
          return;
        }

        var ch = e.target.closest('[data-choice]');
        if (ch) {
          FKC.coachCareer.choose(ch.getAttribute('data-choice'));
          FKC.ui.router.reload();
          return;
        }
        var next = e.target.closest('[data-next]');
        if (next) {
          FKC.coachCareer.ack();
          FKC.ui.router.reload();
          return;
        }
        var hub = e.target.closest('[data-hub]');
        if (hub) FKC.ui.router.go('coachHub');
      });
    }
  });

  /* ── Kopf ───────────────────────────────────────────────────────── */
  function head(age, kicker) {
    return '<div class="story-head"><div class="story-age">' +
      t('story.age', { n: age }) + (kicker ? ' · ' + c.esc(kicker) : '') + '</div></div>';
  }

  function outcome(res) {
    return '<div class="outcome" style="margin-top:22px" data-tone="' + res.tone + '">' +
      '<div class="story-text">' + res.text + '</div>' + c.chips(res.chips) + '</div>';
  }

  /* ── Trainerattribute als Raster ────────────────────────────────── */
  function attrGrid(game, deltas) {
    var html = '<div class="attrs">';
    FKC.data.coachAttrKeys.forEach(function (k) {
      var v = game.attributes[k];
      var d = deltas && deltas[k];
      html += '<div class="attr" data-level="' + FKC.coachAttr.level(v) + '">' +
        '<span class="attr-key">' + c.esc(t('cattr.short.' + k)) + '</span>' +
        '<span class="attr-bar"><i style="width:' + Math.max(3, v) + '%"></i></span>' +
        '<span class="attr-val">' + v +
        (d ? '<span class="attr-delta ' + (d > 0 ? 'u-good' : 'u-bad') + '">' +
          (d > 0 ? '+' : '') + d + '</span>' : '') +
        '</span></div>';
    });
    return html + '</div>';
  }
  FKC.ui.coachAttrGrid = attrGrid;

  /* ── Einstieg ───────────────────────────────────────────────────── */
  function renderIntro(game, scene) {
    var club = scene.club;
    var ph = FKC.data.philosophyById(game.hidden.philosophy);

    var html = head(scene.age, t('cintro.kicker'));
    html += '<h1>' + t('cintro.title') + '</h1>';
    html += '<div class="story-text" style="margin-top:12px">' +
      (club
        ? t('cintro.text', { name: c.esc(FKC.state.fullName()), club: c.esc(club.name),
                             mandate: t('mandate.' + game.status.mandate) })
        : t('cintro.textNoClub', { name: c.esc(FKC.state.fullName()) })) +
      '</div>';

    html += '<div class="card" style="margin-top:20px">' +
      '<div class="row" style="gap:10px;align-items:center;margin-bottom:12px">' +
      FKC.ui.art.flag(game.identity.nationality, 28) +
      '<b>' + c.esc(FKC.data.nationName(game.identity.nationality)) + '</b></div>' +
      c.kv([
        [t('cintro.licence'), t('licence.' + game.identity.licence)],
        [t('stat.age'), String(game.identity.age)],
        [t('card.ovr'), String(game.ovr)]
      ]) + '</div>';

    if (ph) {
      html += '<div class="card" style="margin-top:12px">' +
        '<div class="row-between"><span class="u-up">' + t('cintro.yourHand') + '</span>' +
        c.chip(t('philosophy.needs.' + ph.needs), 'accent') + '</div>' +
        '<div class="choice-title" style="margin-top:10px">◆ ' + t('philosophy.' + ph.id) + '</div>' +
        '<p class="u-muted" style="font-size:.84rem;margin:8px 0 0">' +
        t('philosophy.desc.' + ph.id) + '</p></div>';
    }

    if (club) {
      var lg = FKC.data.leagueOf(club);
      html += '<div class="card" style="margin-top:12px">' +
        '<div class="row-between"><span class="u-up">' + t('cintro.firstJob') + '</span>' +
        c.chip(t('mandate.' + game.status.mandate), 'gold') + '</div>' +
        '<div style="margin-top:10px">' + c.clubLine(club, lg ? lg.name : '') + '</div>' +
        '<p class="u-muted" style="font-size:.8rem;margin:12px 0 0">' +
        t('mandate.desc.' + game.status.mandate) + '</p></div>';
    }

    html += '<div class="actionbar"><button class="btn btn-primary" data-next>' +
      t('cintro.begin') + '</button></div>';
    return html;
  }

  /* ── Saisonvorbereitung ─────────────────────────────────────────── */
  function renderPrep(game, scene) {
    var html = head(scene.age, t('cprep.kicker', { season: scene.season }));
    html += '<h1>' + t('cprep.title') + '</h1>';
    html += '<div class="story-text" style="margin-top:12px">' + t('cprep.text') + '</div>';

    if (scene.result) {
      html += outcome(scene.result);
      html += '<div class="actionbar"><button class="btn btn-primary" data-next>' +
        t('cprep.play') + '</button></div>';
      return html;
    }

    /* Die eigene Handschrift und wie gut der Kader dazu passt */
    var ph = FKC.data.philosophyById(scene.philosophy);
    if (ph) {
      var fitKey = scene.fit >= 1.15 ? 'great' : scene.fit >= 0.95 ? 'good'
                 : scene.fit >= 0.75 ? 'ok' : 'bad';
      html += '<div class="card card-quiet" style="margin-top:16px">' +
        '<div class="row-between"><span class="u-up">' + t('cprep.handwriting') + '</span>' +
        c.chip('◆ ' + t('philosophy.' + ph.id), 'accent') + '</div>' +
        '<div style="margin-top:10px">' +
        c.meter(t('philosophy.level'), game.hidden.philosophyLevel, 'grass') +
        (scene.national ? '' :
          '<div style="margin-top:8px">' +
          c.meter(t('philosophy.fit'), FKC.util.clamp((scene.fit - 0.4) / 1.0 * 100, 0, 100),
                  'warm', t('philosophy.fit.' + fitKey)) + '</div>') +
        '</div></div>';
    }

    html += c.sectionTitle(t('cprep.approachSection'));
    html += '<div class="pill-group" id="approach-pills">' +
      FKC.coachSeason.approachIds.map(function (k) {
        return '<button class="pill" data-approach="' + k + '" aria-pressed="' +
          (scene.approach === k) + '">' + t('capproach.' + k) + '</button>';
      }).join('') + '</div>';
    html += '<p class="u-muted" style="font-size:.78rem;margin:8px 0 0" id="approach-hint">' +
      t('capproach.' + (scene.approach || 'balanced') + '_d') + '</p>';

    html += c.sectionTitle(t('cprep.workSection'));
    html += '<div class="stack" style="margin-top:6px">';
    scene.options.forEach(function (o) {
      html += '<button class="choice" data-choice="' + o.id + '">' +
        '<div class="choice-title">' + t('cwork.' + o.id) + '</div>' +
        '<div class="choice-desc">' + t('cwork.' + o.id + '_d') + '</div>' +
        '<div class="choice-foot">' + c.chip('↑ ' + t('cattr.' + o.focus), 'accent') +
        '</div></button>';
    });
    html += '</div>';
    return html;
  }

  /* ── Transferfenster ────────────────────────────────────────────── */
  function playerLine(p, extra) {
    var inj = p.injury ? ' <span class="chip chip-bad">' + t('csquad.injured') + '</span>' : '';
    return '<div class="row" style="gap:10px;align-items:center">' +
      '<span class="pl-pos">' + t('pos.short.' + p.pos) + '</span>' +
      '<div style="min-width:0;flex:1">' +
      '<div class="choice-title" style="font-size:.92rem">' + c.esc(p.name) + inj + '</div>' +
      '<div class="club-meta">' + FKC.ui.art.flag(p.nat, 16) + ' ' +
      t('card.age', { n: p.age }) + (extra ? ' · ' + extra : '') + '</div>' +
      '</div>' +
      '<span class="pl-ovr" data-tier="' + FKC.coachAttr.tier(p.ovr) + '">' + p.ovr + '</span>' +
      '</div>';
  }

  function playerTraits(p) {
    return '<div class="pill-group" style="margin-top:8px">' +
      c.chip(t('csquad.speed') + ' ' + p.sp) +
      c.chip(t('csquad.tech') + ' ' + p.tec) +
      c.chip(t('csquad.phys') + ' ' + p.phy) + '</div>';
  }

  function renderTransferWindow(game, scene) {
    var html = head(scene.age, t('ctransfer.kicker') + ' · ' + scene.season);
    html += '<h1>' + t('ctransfer.title') + '</h1>';
    html += '<div class="story-text" style="margin-top:12px">' + t('ctransfer.text') + '</div>';

    /* Budget und Kaderlage */
    html += '<div class="card" style="margin-top:16px">' + c.kv([
      [t('ctransfer.budget'), '<b>' + FKC.i18n.money(scene.budget.transfer) + '</b>'],
      [t('ctransfer.wageBill'), FKC.i18n.money(FKC.coachSquad.wageBill(game)) + t('unit.perYear')],
      [t('ctransfer.wageRoom'), (scene.wageRoom < 0 ? '<span class="u-bad">' : '<span>') +
        FKC.i18n.money(scene.wageRoom) + '</span>'],
      [t('cmeter.squadStrength'), '<b>' + scene.strength + '</b>'],
      [t('ctransfer.avgAge'), String(scene.avgAge)]
    ]) + '</div>';

    /* Rückmeldungen der laufenden Sitzung */
    if (scene.feed && scene.feed.length) {
      html += '<div class="stack-sm" style="margin-top:12px">' +
        scene.feed.slice(-4).map(function (f) {
          return '<div class="outcome" data-tone="' + f.tone + '">' +
            '<div class="story-text">' + t(f.key, f.params) + '</div></div>';
        }).join('') + '</div>';
    }

    /* Kaufen */
    html += c.sectionTitle(t('ctransfer.buySection'));
    if (!scene.buys.length) {
      html += '<div class="card"><p class="u-muted" style="margin:0">' +
        t('ctransfer.noTargets') + '</p></div>';
    } else {
      html += '<div class="stack-sm">';
      scene.buys.forEach(function (o) {
        var afford = o.fee <= scene.budget.transfer && o.wage <= scene.wageRoom + 1;
        html += '<div class="card">' +
          playerLine(o.player, o.fromId
            ? t('ctransfer.from', { club: c.esc(o.fromName) }) : t('ctransfer.free')) +
          playerTraits(o.player) +
          '<div style="margin-top:10px">' + c.kv([
            [t('ctransfer.fee'), o.fee ? FKC.i18n.money(o.fee) : t('ctransfer.free')],
            [t('ctransfer.wage'), FKC.i18n.money(o.wage) + t('unit.perYear')]
          ]) + '</div>' +
          '<div class="choice-foot">' +
          (o.needSlot ? c.chip(t('ctransfer.needSlot'), 'warn') : '') +
          c.chip(o.fit >= 0.55 ? t('ctransfer.fitGood') : t('ctransfer.fitBad'),
                 o.fit >= 0.55 ? 'good' : '') +
          '</div>' +
          '<button class="btn btn-sm btn-block" style="margin-top:10px"' +
          (afford ? '' : ' disabled') + ' data-choice="buy:' + c.esc(o.key) + '">' +
          t('ctransfer.buy') + '</button>' +
          '</div>';
      });
      html += '</div>';
    }

    /* Verkaufen */
    html += c.sectionTitle(t('ctransfer.sellSection'));
    if (!scene.sells.length) {
      html += '<div class="card"><p class="u-muted" style="margin:0">' +
        t('ctransfer.noOffers') + '</p></div>';
    } else {
      html += '<div class="stack-sm">';
      scene.sells.forEach(function (o) {
        html += '<div class="card">' +
          playerLine(o.player, t('ctransfer.to', { club: c.esc(o.toName) })) +
          '<div style="margin-top:10px">' + c.kv([
            [t('ctransfer.fee'), FKC.i18n.money(o.fee)],
            [t('csquad.contract'), t('csquad.years', { n: o.player.years })]
          ]) + '</div>' +
          (o.starter ? '<div class="choice-foot">' +
            c.chip(t('ctransfer.starter'), 'warn') + '</div>' : '') +
          '<button class="btn btn-sm btn-block" style="margin-top:10px" ' +
          'data-choice="sell:' + c.esc(o.key) + '">' + t('ctransfer.sell') + '</button>' +
          '</div>';
      });
      html += '</div>';
    }

    /* Der Kader */
    html += c.sectionTitle(t('ctransfer.xiSection'));
    html += '<div class="card"><div class="stack-sm">' +
      scene.xi.map(function (p) {
        return '<div class="pl-row">' + playerLine(p,
          t('csquad.form') + ' ' + p.form + ' · ' + t('csquad.morale') + ' ' + p.morale) +
          '</div>';
      }).join('') + '</div></div>';

    html += '<div class="actionbar"><button class="btn btn-primary btn-block" ' +
      'data-choice="done">' + t('ctransfer.done') + '</button></div>';
    return html;
  }

  /* ── Szene mit Entscheidung ─────────────────────────────────────── */
  function renderScene(game, scene) {
    var html = head(scene.age, t('cat.' + scene.category));
    html += '<h1>' + c.esc(scene.title) + '</h1>';
    html += '<div class="story-text" style="margin-top:12px">' + scene.text + '</div>';

    if (!scene.result) {
      html += '<div class="stack" style="margin-top:22px">' +
        scene.choices.map(c.choice).join('') + '</div>';
    } else {
      html += outcome(scene.result);
      html += '<div class="actionbar"><button class="btn btn-primary" data-next>' +
        t('ui.continue') + '</button></div>';
    }
    return html;
  }

  /* ── Saisonbilanz ───────────────────────────────────────────────── */
  function renderSeasonReview(game, scene) {
    var r = scene.record;
    var html = head(scene.age, t('cseason.kicker', { season: r.season }));
    html += '<h1>' + t('cseason.title') + '</h1>';

    if (r.national) return renderNationalSeason(game, scene, html);

    var club = FKC.data.clubById(r.clubId);
    var lg = FKC.data.leagueById(r.leagueId);

    /* Verein, Platzierung, Bilanz */
    html += '<div class="card" style="margin-top:16px">' +
      '<div style="margin-bottom:14px">' + c.clubLine(club, lg ? lg.name : '') + '</div>' +
      c.stats([
        { value: r.leaguePos, label: t('cseason.position') },
        { value: r.points, label: t('cseason.points') },
        { value: r.w + '–' + r.d + '–' + r.l, label: t('cseason.wdl') }
      ]) +
      '<div style="margin-top:12px">' + c.kv([
        [t('cseason.matches'), String(r.matches)],
        [t('cseason.goals'), r.gf + ':' + r.ga],
        [t('cseason.ppg'), FKC.util.round(r.points / Math.max(1, r.matches), 2).toFixed(2)],
        [t('season.cup'), t('season.stage.' + r.cup)],
        r.cont ? [FKC.data.compName(r.cont.id), t('season.stage.' + r.cont.result)] : null
      ].filter(Boolean)) + '</div></div>';

    /* Tabelle direkt darunter */
    var tb = game.tables;
    if (tb && tb.leagueId === r.leagueId && FKC.ui.leagueTable) {
      var rows = FKC.ui.leagueRows(tb, tb.leagueId);
      if (rows && rows.length) {
        html += '<div style="margin-top:12px">' +
          FKC.ui.leagueTable(rows, lg, tb.clubId) + '</div>';
      }
    }

    /* Auf- oder Abstieg */
    if (r.move) {
      var toLg = FKC.data.leagueById(r.move.to);
      html += '<div class="outcome" data-tone="' + (r.move.dir === 'up' ? 'good' : 'bad') +
        '" style="margin-top:12px"><div class="story-text">' +
        t(r.move.dir === 'up' ? 'season.promoted' : 'season.relegated', {
          club: c.esc(club ? club.name : ''), league: c.esc(toLg ? toLg.name : '')
        }) + '</div></div>';
    }

    /* Woran es lag — die Bestandteile des Trainerzuschlags */
    if (r.parts) {
      var p = r.parts;
      var maxAbs = Math.max(0.6, Math.abs(p.coach), Math.abs(p.squad),
                            Math.abs(p.hand), Math.abs(p.room), Math.abs(p.approach));
      html += c.sectionTitle(t('cseason.impact'));
      html += '<div class="card"><div class="stack-sm">' +
        [['coach', p.coach], ['squad', p.squad], ['hand', p.hand],
         ['room', p.room], ['approach', p.approach]].map(function (row) {
          var v = row[1];
          return c.meter(t('cseason.impact.' + row[0]),
            (v / maxAbs) * 50 + 50,
            v >= 0 ? 'grass' : 'warm',
            (v > 0 ? '+' : '') + FKC.util.round(v, 1));
        }).join('') + '</div>' +
        '<p class="u-muted" style="font-size:.78rem;margin:12px 0 0">' +
        t('cseason.impactHint') + '</p></div>';
    }

    html += honours(game, r);
    html += development(game, scene, r);

    html += '<div class="actionbar">' +
      '<button class="btn btn-ghost" data-hub>' + t('ui.overview') + '</button>' +
      '<button class="btn btn-primary" data-next>' + t('ui.continue') + '</button></div>';
    return html;
  }

  /* ── Saison als Nationaltrainer ─────────────────────────────────── */
  function renderNationalSeason(game, scene, html) {
    var r = scene.record;
    var nation = FKC.data.nationById(r.nationId);

    html += '<div class="card" style="margin-top:16px">' +
      '<div class="row" style="gap:10px;align-items:center;margin-bottom:14px">' +
      FKC.ui.art.flag(r.nationId, 30) +
      '<b>' + c.esc(FKC.data.nationName(r.nationId)) + '</b></div>' +
      c.stats([
        { value: r.matches, label: t('cseason.matches') },
        { value: r.w + '–' + r.d + '–' + r.l, label: t('cseason.wdl') },
        { value: r.gf + ':' + r.ga, label: t('cseason.goals') }
      ]) + '</div>';

    var tour = r.tournament;
    if (tour) {
      html += c.sectionTitle(FKC.data.compName(tour.compId));
      html += '<div class="outcome" data-tone="' +
        (tour.result === 'won' ? 'good' : tour.qualified ? 'mixed' : 'bad') + '">' +
        '<div class="story-text">' +
        (tour.qualified
          ? t('cnational.result', { name: FKC.data.compName(tour.compId),
                                    stage: t('season.stage.' + tour.result) })
          : t('cnational.noQual', { name: FKC.data.compName(tour.compId),
                                    nation: c.esc(FKC.data.nationName(r.nationId)) })) +
        '</div></div>';

      if (tour.detail && FKC.state.game.tables && FKC.state.game.tables.tournament) {
        html += '<p class="u-muted" style="font-size:.78rem;margin:10px 0 0">' +
          t('tables.groupStage') + ' · ' + t('nav.tables') + '</p>';
      }
    } else {
      html += '<div class="card card-quiet" style="margin-top:12px">' +
        '<p class="u-muted" style="margin:0">' + t('cnational.noTournament') + '</p></div>';
    }

    html += honours(game, r);
    html += development(game, scene, r);

    html += '<div class="actionbar">' +
      '<button class="btn btn-ghost" data-hub>' + t('ui.overview') + '</button>' +
      '<button class="btn btn-primary" data-next>' + t('ui.continue') + '</button></div>';
    return html;
  }

  /* ── Titel und Auszeichnungen einer Saison ──────────────────────── */
  function honours(game, r) {
    var titles = r.titles || [];
    var awards = r.awards || [];
    if (!titles.length && !awards.length) return '';

    /* Gewonnene Titel bekommen eine Inszenierung, keine Textzeile */
    var feierbar = titles.map(function (tr) {
      return { id: tr.compId, name: tr.name,
               sub: t('celebrate.sub', { season: r.season,
                 club: (FKC.data.clubById(r.clubId) || {}).name ||
                       (r.nationId ? FKC.data.nationName(r.nationId) : '') }) };
    }).concat(awards.map(function (a) {
      return { id: a.id, name: t('award.' + a.id),
               sub: t('celebrate.subAward', { season: r.season }) };
    }));

    var key = (game.meta && game.meta.createdAt) + '|c|' + r.season;
    if (feierbar.length && celebratedSeason !== key) {
      celebratedSeason = key;
      pendingCelebration = { owner: game.meta && game.meta.createdAt, items: feierbar };
    }

    var html = c.sectionTitle(t('cseason.honours'));
    html += '<div class="card"><div class="trophy-row">' +
      titles.map(function (tr) {
        return '<div class="trophy-mini">' + FKC.ui.trophy(tr.compId, 46, tr.national) +
          '<div class="trophy-name">' + c.esc(tr.name) + '</div></div>';
      }).join('') +
      awards.map(function (a) {
        return '<div class="trophy-mini">' + FKC.ui.trophy(a.id, 46) +
          '<div class="trophy-name">' + c.esc(t('award.' + a.id)) + '</div></div>';
      }).join('') + '</div></div>';
    return html;
  }

  /* ── Entwicklung des Trainers ───────────────────────────────────── */
  function development(game, scene, r) {
    var diff = r.ovrEnd - r.ovrStart;
    var html = c.sectionTitle(t('cseason.development'));
    html += '<div class="card">' +
      '<div class="row-between" style="margin-bottom:12px">' +
      '<span class="u-dim">' + t('card.ovr') + '</span>' +
      '<span><b style="font-size:1.15rem">' + r.ovrEnd + '</b>' +
      (diff !== 0 ? ' <span class="' + (diff > 0 ? 'u-good' : 'u-bad') +
        '" style="font-size:.82rem">(' + (diff > 0 ? '+' : '') + diff + ')</span>' : '') +
      '</span></div>' +
      attrGrid(game, scene.deltas) + '</div>';
    return html;
  }

  /* ── Vorstandsbewertung ─────────────────────────────────────────── */
  function renderBoardReview(game, scene) {
    var suffix = scene.national ? 'Nat' : '';
    var html = head(scene.age, t('cboard.kicker'));
    html += '<h1>' + t(scene.national ? 'cboard.titleNat' : 'cboard.title') + '</h1>';

    html += '<div class="card" style="margin-top:16px">' + c.kv([
      [t('cboard.mandateWas'), '<b>' + t('mandate.' + scene.mandate) + '</b>'],
      scene.record.leagueSize
        ? [t('cboard.result'), t('cboard.resultPos', { n: scene.record.leaguePos,
                                                       of: scene.record.leagueSize })]
        : null,
      [t('cboard.seasonsMissed'), String(game.status.seasonsMissed)]
    ].filter(Boolean)) + '</div>';

    var tone = scene.grade >= 2 ? 'good' : scene.grade === 1 ? 'good'
             : scene.grade === 0 ? 'mixed' : 'bad';
    html += '<div class="outcome" data-tone="' + tone + '" style="margin-top:12px">' +
      '<div class="story-text">' + t('cboard.' + scene.verdictKey + suffix) + '</div></div>';

    /* Der Stand nach der Saison */
    html += '<div class="card" style="margin-top:12px"><div class="stack-sm">' +
      c.meter(t('cmeter.boardTrust'), scene.standing.boardTrust, 'grass') +
      c.meter(t('cmeter.fanMood'), scene.standing.fanMood, 'warm') +
      c.meter(t('cmeter.dressingRoom'), scene.standing.dressingRoom, 'cool') +
      c.meter(t('cmeter.pressure'), scene.standing.pressure, 'warm') +
      '</div></div>';

    /* Wie es um den Posten steht */
    var riskKey = scene.risk >= 60 ? 'critical' : scene.risk >= 35 ? 'shaky'
                : scene.risk >= 15 ? 'watched' : 'safe';
    html += '<div class="card card-quiet" style="margin-top:12px">' +
      '<div class="row-between"><span class="u-dim">' + t('cboard.risk') + '</span>' +
      c.chip(t('cboard.risk.' + riskKey),
             riskKey === 'critical' ? 'bad' : riskKey === 'shaky' ? 'warn'
             : riskKey === 'watched' ? '' : 'good') + '</div></div>';

    if (scene.sacked) {
      html += '<div class="outcome" data-tone="bad" style="margin-top:12px">' +
        '<div class="story-text"><strong>' + t('cboard.sacked') + '</strong><br>' +
        t(scene.national ? 'cboard.sackedNatText' : 'cboard.sackedText',
          { club: c.esc(scene.club) }) + '</div>' +
        (scene.payoff ? c.chips([{ label: t('cboard.payoff') + ' ' +
          FKC.i18n.money(scene.payoff), tone: 'neutral' }]) : '') +
        '</div>';
    } else {
      html += '<p class="u-dim" style="margin-top:14px">' + t('cboard.stay') + '</p>';
    }

    html += '<div class="actionbar"><button class="btn btn-primary" data-next>' +
      t('cboard.continue') + '</button></div>';
    return html;
  }

  /* ── Vereinsfrage ───────────────────────────────────────────────── */
  function renderJob(game, scene) {
    var html = head(scene.age, t('cjob.kicker'));
    html += '<h1>' + t(scene.free ? 'cjob.freeTitle' : 'cjob.title') + '</h1>';
    html += '<div class="story-text" style="margin-top:12px">' +
      t(scene.free ? 'cjob.freeText' : 'cjob.text') + '</div>';

    if (scene.result) {
      html += outcome(scene.result);
      html += '<div class="actionbar"><button class="btn btn-primary" data-next>' +
        t('ui.continue') + '</button></div>';
      return html;
    }

    /* Eigene Vertragslage */
    if (scene.contract && scene.contract.yearsLeft > 0) {
      html += '<div class="card card-quiet" style="margin-top:16px">' + c.kv([
        [t('cjob.remaining'), t('ccontract.yearsValue', { n: scene.contract.yearsLeft })],
        [t('cjob.salary'), FKC.i18n.money(scene.contract.salary) + t('unit.perYear')],
        [t('cjob.compensation'), FKC.i18n.money(scene.compensation)]
      ]) +
        '<p class="u-muted" style="font-size:.78rem;margin:10px 0 0">' +
        t(scene.wantsOut ? 'cjob.requestFiled' : 'cjob.underContract') + '</p></div>';
    }

    html += '<div class="stack" style="margin-top:20px">';

    if (!scene.offers.length) {
      html += '<div class="card"><p class="u-muted" style="margin:0">' +
        t('cjob.noOffers') + '</p></div>';
    }

    scene.offers.forEach(function (o) {
      html += '<button class="choice" data-choice="' + c.esc(o.key) + '">';
      html += '<div class="row" style="gap:12px;align-items:flex-start">' +
        c.crest({ name: o.name, short: o.short, color: o.color }, true) +
        '<div style="min-width:0;flex:1">' +
        '<div class="choice-title">' + c.esc(o.name) +
        (o.stay ? ' <span class="chip chip-accent">' + t('cjob.current') + '</span>' : '') +
        '</div>' +
        '<div class="choice-desc">' +
        (o.country ? FKC.ui.art.flag(o.country, 18) + ' ' : '') +
        c.esc(o.leagueName || '') + ' · ' +
        FKC.i18n.money(o.salary) + t('unit.perYear') + '</div>' +
        '</div></div>';

      html += '<div style="margin-top:12px" class="stack-sm">' +
        c.meter(t('cjob.axis.sport'), o.rating.sport, 'grass') +
        c.meter(t('cjob.axis.money'), o.rating.money, 'warm') +
        c.meter(t('cjob.axis.risk'), o.rating.risk, 'cool') +
        '</div>';

      if (!o.stay && o.chance != null) {
        html += '<div class="transfer-chance" data-level="' +
          (o.chance >= 60 ? 'high' : o.chance >= 30 ? 'mid' : 'low') + '">' +
          '<span>' + t('cjob.chance') + '</span><b>' + o.chance + '%</b></div>';
      }

      var tags = [];
      (o.tagKeys || []).forEach(function (k) {
        var tone = k === 'ctag.hotSeat' || k === 'ctag.thinIce' ? 'warn'
                 : k === 'ctag.money' ? 'gold'
                 : k.indexOf('mandate.') === 0 ? 'info' : 'accent';
        tags.push(c.chip(t(k), tone));
      });
      if (o.abroad) tags.push(c.chip(t('tag.abroad'), 'warn'));
      if (o.renew) tags.push(c.chip(t('transfer.renew'), 'accent'));
      html += '<div class="choice-foot">' + tags.join('') + '</div>';
      html += '</button>';
    });

    if (scene.canQuit) {
      html += c.choice({ id: 'quit', label: t('cjob.quit'),
                         desc: t('cjob.quit_d'), risk: 'high' });
    }
    if (scene.free) {
      html += c.choice({ id: 'wait', label: t('cjob.wait'),
                         desc: t('cjob.wait_d'), risk: 'high' });
    }
    if (scene.canRetire) {
      html += c.choice({ id: 'retire', label: t('cjob.retire'),
                         desc: t('cjob.retire_d'), risk: 'low' });
    }

    html += '</div>';
    return html;
  }

  /* ── Angebot eines Verbands ─────────────────────────────────────── */
  function renderNationalOffer(game, scene) {
    var o = scene.offer;
    var html = head(scene.age, t('cnational.kicker'));
    html += '<h1>' + t('cnational.title') + '</h1>';
    html += '<div class="story-text" style="margin-top:12px">' +
      t('cnational.text', { nation: c.esc(o.name) }) + '</div>';

    if (scene.result) {
      html += outcome(scene.result);
      html += '<div class="actionbar"><button class="btn btn-primary" data-next>' +
        t('ui.continue') + '</button></div>';
      return html;
    }

    html += '<div class="card" style="margin-top:18px">' +
      '<div class="row" style="gap:12px;align-items:center;margin-bottom:14px">' +
      FKC.ui.art.flag(o.nationId, 40) +
      '<div><div class="pc-name" style="font-size:1.05rem">' + c.esc(o.name) + '</div>' +
      '<div class="club-meta">' + t('cnational.federation') + '</div></div></div>' +
      c.kv([
        [t('cjob.salary'), FKC.i18n.money(o.salary) + t('unit.perYear')],
        [t('ccontract.mandate'), t('mandate.' + o.mandate)]
      ]) +
      '<p class="u-muted" style="font-size:.8rem;margin:12px 0 0">' +
      t('mandate.desc.' + o.mandate) + '</p>' +
      '<div style="margin-top:12px" class="stack-sm">' +
      c.meter(t('cjob.axis.sport'), o.rating.sport, 'grass') +
      c.meter(t('cjob.axis.money'), o.rating.money, 'warm') +
      c.meter(t('cjob.axis.risk'), o.rating.risk, 'cool') +
      '</div></div>';

    html += '<div class="stack" style="margin-top:20px">' +
      c.choice({ id: 'accept', label: t('cnational.accept'),
                 desc: t('cnational.accept_d'), risk: 'medium' }) +
      c.choice({ id: 'decline', label: t('cnational.decline'),
                 desc: t('cnational.decline_d'), risk: 'low' }) +
      '</div>';
    return html;
  }

  /* ── Vertragsverhandlung ────────────────────────────────────────── */
  function renderContract(game, scene) {
    var html = head(scene.age, t('ccontract.kicker'));
    html += '<h1>' + t('ccontract.title.' + scene.offerKind) + '</h1>';
    html += '<div class="story-text" style="margin-top:12px">' +
      t('ccontract.text.' + scene.offerKind, {
        club: c.esc(scene.clubName), fee: FKC.i18n.money(scene.fee)
      }) + '</div>';

    html += '<div class="card" style="margin-top:18px">' +
      '<div class="row" style="gap:12px;align-items:center;margin-bottom:14px">' +
      c.crest({ name: scene.clubName, short: scene.short, color: scene.color }, true) +
      '<div><div class="pc-name" style="font-size:1.05rem">' + c.esc(scene.clubName) + '</div>' +
      '<div class="club-meta">' + c.esc(scene.leagueName || '') +
      (scene.mandate ? ' · ' + t('mandate.' + scene.mandate) : '') + '</div></div></div>';

    html += '<div class="terms">' +
      '<div class="term"><span>' + t('ccontract.years') + '</span><b>' +
      t('ccontract.yearsValue', { n: scene.terms.years }) + '</b></div>' +
      '<div class="term"><span>' + t('ccontract.salary') + '</span><b>' +
      FKC.i18n.money(scene.terms.salary) + '</b></div></div>';

    var rows = [];
    if (scene.current && scene.offerKind === 'renew') {
      rows.push([t('ccontract.currentSalary'), FKC.i18n.money(scene.current.salary)]);
    }
    if (scene.fee) rows.push([t('ccontract.fee'), FKC.i18n.money(scene.fee)]);
    if (scene.round) rows.push([t('ccontract.rounds'), String(scene.round)]);
    if (rows.length) html += '<div style="margin-top:14px">' + c.kv(rows) + '</div>';
    html += '</div>';

    if (scene.result) {
      html += outcome(scene.result);
      html += '<div class="actionbar"><button class="btn btn-primary" data-next>' +
        t('ui.continue') + '</button></div>';
      return html;
    }

    html += '<div class="stack" style="margin-top:20px">';
    [['accept', 'low'], ['money', 'medium'], ['years', 'medium'], ['decline', 'high']]
      .forEach(function (o) {
        html += c.choice({ id: o[0], label: t('ccontract.opt.' + o[0]),
                           desc: t('ccontract.opt.' + o[0] + '_d'), risk: o[1] });
      });
    html += '</div>';
    return html;
  }

})(window.FKC);
