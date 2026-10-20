/* ── Charaktererstellung: Trainer ──────────────────────────────────────
   Gleicher Aufbau wie die Spielererstellung — Name mit Würfel,
   Herkunftsland mit echter Flagge, dann die trainerspezifischen
   Bausteine: Lizenzstufe statt Startpunkt, Handschrift statt
   Playstyle, drei konkrete Vereine zur Auswahl.                     */

(function (FKC) {
  'use strict';
  var c = FKC.ui.c, t = FKC.t;

  var draft = null;

  function initDraft() {
    var nation = 'SUI';
    var n = FKC.data.randomName(nation);
    draft = {
      firstName: n.first, lastName: n.last,
      nationality: nation,
      licence: 'uefaB',
      past: 'player',
      /* Eigener Zufallsstrang für die Vorschau: der globale RNG bleibt
         unangetastet, solange nichts angelegt ist — sonst würfelt allein
         das Öffnen des Bildschirms eine laufende Karriere um. */
      previewSeed: FKC.rng.newSeed(),
      philosophy: null,
      clubOptions: null,
      clubPick: 0
    };
    rollPhilosophy();
    refreshClubs();
  }

  function preview() { return FKC.rng.fork(draft.previewSeed); }

  function rollPhilosophy() {
    draft.philosophy = FKC.data.rollPhilosophy(preview());
    /* Nach jedem Wurf einen neuen Vorschau-Seed, sonst kommt beim
       nächsten Klick dieselbe Handschrift wieder heraus. */
    draft.previewSeed = (draft.previewSeed * 1103515245 + 12345) >>> 0;
  }

  function refreshClubs() {
    draft.clubOptions = FKC.data.coachStartClubs(
      FKC.data.youthCountry(draft.nationality), draft.licence, preview(), 3);
    draft.clubPick = 0;
  }

  function currentClub() {
    var o = draft.clubOptions || [];
    return o[draft.clubPick] || o[0] || null;
  }

  function nationFlag(id) {
    return FKC.ui.art.flag(id, 42) +
      '<span class="nation-pick-name">' + c.esc(FKC.data.nationName(id)) + '</span>';
  }

  function philosophyCard() {
    var ph = FKC.data.philosophyById(draft.philosophy);
    if (!ph) return '';
    return '<div class="card" id="phil-card">' +
      '<div class="row-between" style="align-items:flex-start;gap:12px">' +
      '<div style="min-width:0">' +
      '<div class="choice-title">◆ ' + t('philosophy.' + ph.id) + '</div>' +
      '<p class="choice-desc" style="margin-top:6px">' + t('philosophy.desc.' + ph.id) + '</p>' +
      '</div>' +
      '<button class="btn btn-sm" data-act="reroll" title="' + t('ccreate.reroll') + '">🎲</button>' +
      '</div>' +
      '<div class="choice-foot">' + c.chip(t('philosophy.needs.' + ph.needs), 'accent') + '</div>' +
      '</div>';
  }

  function clubOptionsHtml() {
    var opts = draft.clubOptions || [];
    if (!opts.length) return '<p class="u-muted">' + t('create.clubNone') + '</p>';

    return opts.map(function (club, i) {
      var lg = FKC.data.leagueOf(club);
      var mandate = FKC.data.coachMandate(club);
      var bands = FKC.data.mandateBands(mandate, lg ? lg.clubCount : 18);
      var lvl = FKC.data.clubLevel(club);

      return '<button class="choice" data-club="' + i + '" aria-pressed="' +
        (draft.clubPick === i) + '">' +
        '<div class="row" style="gap:12px;align-items:center">' +
        c.crest(club, true) +
        '<div style="min-width:0;flex:1">' +
        '<div class="choice-title">' + c.esc(club.name) + '</div>' +
        '<div class="choice-desc">' + (lg ? c.esc(lg.name) : '') + '</div>' +
        '</div></div>' +
        '<div style="margin-top:12px" class="stack-sm">' +
        c.meter(t('meter.level'), lvl, 'cool', String(lvl)) +
        c.meter(t('cmeter.boardTrust'), Math.min(100, club.prestige), 'warm',
                t('cband.seasons', { n: bands.patience })) +
        '</div>' +
        '<div class="choice-foot">' +
        c.chip(t('mandate.' + mandate), mandate === 'title' || mandate === 'promotion'
               ? 'gold' : mandate === 'survive' ? 'warn' : 'accent') +
        (club.prestige >= 80 ? c.chip(t('tag.bigName'), 'gold') : '') +
        (club.facilities >= 82 ? c.chip(t('tag.topFacilities'), 'accent') : '') +
        '</div></button>';
    }).join('');
  }

  FKC.ui.router.register('coachCreate', {
    topbar: false,

    render: function () {
      if (!draft) initDraft();

      var html = '<h1>' + t('ccreate.title') + '</h1>' +
        '<p class="u-dim" style="margin-top:6px">' + t('ccreate.intro') + '</p>';

      /* Name */
      html += c.sectionTitle(t('ccreate.name'));
      html += '<div class="input-row">' +
        '<input class="input" id="f-first" value="' + c.esc(draft.firstName) +
        '" placeholder="' + t('create.firstName') + '" autocomplete="off">' +
        '<input class="input" id="f-last" value="' + c.esc(draft.lastName) +
        '" placeholder="' + t('create.lastName') + '" autocomplete="off">' +
        '<button class="btn btn-sm" data-act="dice" title="' + t('create.dice') + '">🎲</button>' +
        '</div>';

      /* Nation */
      html += c.sectionTitle(t('ccreate.nation'));
      var leagueNations = FKC.data.leagueNations();
      var others = FKC.data.nations.filter(function (x) { return !x.hasLeague; });
      html += '<select class="input" id="f-nation">';
      html += '<optgroup label="' + t('create.nationLeagues') + '">';
      leagueNations.forEach(function (nn) {
        html += '<option value="' + nn.id + '"' + (nn.id === draft.nationality ? ' selected' : '') +
          '>' + c.esc(FKC.data.nationName(nn.id)) + '</option>';
      });
      html += '</optgroup><optgroup label="' + t('create.nationOther') + '">';
      others.sort(function (a, b) {
        return FKC.data.nationName(a.id).localeCompare(FKC.data.nationName(b.id));
      }).forEach(function (nn) {
        html += '<option value="' + nn.id + '"' + (nn.id === draft.nationality ? ' selected' : '') +
          '>' + c.esc(FKC.data.nationName(nn.id)) + '</option>';
      });
      html += '</optgroup></select>';
      html += '<div class="nation-pick" id="f-nation-flag">' + nationFlag(draft.nationality) + '</div>';
      html += '<p class="u-muted" style="font-size:.78rem;margin-top:6px">' + t('ccreate.nationHint') + '</p>';

      /* Vorgeschichte */
      html += c.sectionTitle(t('ccreate.past'));
      html += '<div class="pill-group">' +
        ['player', 'desk'].map(function (k) {
          return '<button class="pill" data-past="' + k + '" aria-pressed="' +
            (draft.past === k) + '">' + t('ccreate.past.' + k) + '</button>';
        }).join('') + '</div>';
      html += '<p class="u-muted" style="font-size:.76rem;margin:6px 0 0" id="past-hint">' +
        t('ccreate.past.' + draft.past + 'Desc') + '</p>';

      /* Lizenz */
      html += c.sectionTitle(t('ccreate.licence'));
      html += '<div class="stack-sm">';
      FKC.data.coachLicences.forEach(function (l) {
        html += '<button class="choice" data-licence="' + l.id + '" aria-pressed="' +
          (draft.licence === l.id) + '">' +
          '<div class="choice-title">' + t('licence.' + l.id) + '</div>' +
          '<div class="choice-desc">' + t('licence.' + l.id + '_d') + '</div>' +
          '<div class="choice-foot">' +
          c.chip(t('licence.' + l.id + '.start'), l.id === 'uefaPro' ? 'accent'
                 : l.id === 'uefaB' ? 'info' : '') +
          c.chip(t('licence.' + l.id + '.patience'), l.id === 'uefaPro' ? 'warn' : 'good') +
          c.chip(t('card.ovr') + ' ' + l.ovr, 'info') +
          '</div></button>';
      });
      html += '</div>';
      html += '<p class="u-muted" style="font-size:.76rem;margin:8px 0 0">' +
        t('ccreate.licenceHint') + '</p>';

      /* Handschrift */
      html += c.sectionTitle(t('ccreate.philosophy'));
      html += philosophyCard();
      html += '<p class="u-muted" style="font-size:.76rem;margin:8px 0 0">' +
        t('ccreate.philosophyHint') + '</p>';

      /* Erster Verein */
      html += c.sectionTitle(t('ccreate.clubSection'));
      html += '<p class="u-muted" style="font-size:.78rem;margin:0 0 8px">' +
        t('ccreate.clubHint') + '</p>';
      html += '<div class="stack-sm" id="create-clubs">' + clubOptionsHtml() + '</div>';

      html += '<div class="actionbar">' +
        '<button class="btn btn-ghost" data-act="back">' + t('ui.back') + '</button>' +
        '<button class="btn btn-primary" data-act="start">' + t('ccreate.start') + '</button></div>';

      return html;
    },

    bind: function (root) {
      root.addEventListener('input', function (e) {
        if (e.target.id === 'f-first') draft.firstName = e.target.value;
        if (e.target.id === 'f-last') draft.lastName = e.target.value;
      });

      root.addEventListener('change', function (e) {
        if (e.target.id !== 'f-nation') return;
        draft.nationality = e.target.value;
        var n = FKC.data.randomName(draft.nationality);
        draft.firstName = n.first; draft.lastName = n.last;
        refreshClubs();
        FKC.ui.router.reload();
      });

      root.addEventListener('click', function (e) {
        var past = e.target.closest('[data-past]');
        if (past) {
          draft.past = past.getAttribute('data-past');
          root.querySelectorAll('[data-past]').forEach(function (b) {
            b.setAttribute('aria-pressed', b.getAttribute('data-past') === draft.past);
          });
          var hint = root.querySelector('#past-hint');
          if (hint) hint.textContent = t('ccreate.past.' + draft.past + 'Desc');
          return;
        }

        var lic = e.target.closest('[data-licence]');
        if (lic) {
          draft.licence = lic.getAttribute('data-licence');
          root.querySelectorAll('[data-licence]').forEach(function (b) {
            b.setAttribute('aria-pressed', b.getAttribute('data-licence') === draft.licence);
          });
          /* Andere Lizenz, andere Adressen — aber nur diesen Block neu
             zeichnen, sonst springt die Seite nach oben. */
          refreshClubs();
          root.querySelector('#create-clubs').innerHTML = clubOptionsHtml();
          return;
        }

        var club = e.target.closest('[data-club]');
        if (club) {
          draft.clubPick = parseInt(club.getAttribute('data-club'), 10) || 0;
          root.querySelectorAll('[data-club]').forEach(function (b) {
            b.setAttribute('aria-pressed',
              parseInt(b.getAttribute('data-club'), 10) === draft.clubPick);
          });
          return;
        }

        var b = e.target.closest('[data-act]');
        if (!b) return;
        var act = b.getAttribute('data-act');

        if (act === 'dice') {
          var n = FKC.data.randomName(draft.nationality);
          draft.firstName = n.first; draft.lastName = n.last;
          root.querySelector('#f-first').value = n.first;
          root.querySelector('#f-last').value = n.last;

        } else if (act === 'reroll') {
          rollPhilosophy();
          var card = root.querySelector('#phil-card');
          if (card) card.outerHTML = philosophyCard();

        } else if (act === 'back') {
          FKC.ui.router.go('menu');

        } else if (act === 'start') {
          /* Doppelklick darf den Namen nie neu würfeln */
          if (!draft || draft._submitted) return;
          draft.firstName = (root.querySelector('#f-first').value || '').trim();
          draft.lastName = (root.querySelector('#f-last').value || '').trim();
          if (!draft.firstName || !draft.lastName) {
            FKC.ui.router.toast(t('ccreate.needName'), 'bad');
            return;
          }
          draft._submitted = true;
          FKC.rng.seed(FKC.rng.newSeed());

          var game = FKC.state.createCoach({
            firstName: draft.firstName, lastName: draft.lastName,
            nationality: draft.nationality, licence: draft.licence
          });
          FKC.coachCareer.start(game, {
            club: currentClub(),
            philosophy: draft.philosophy,
            playedBefore: draft.past === 'player'
          });
          FKC.save.write();
          draft = null;
          FKC.ui.router.go('coachStory');
        }
      });
    }
  });

})(window.FKC);
