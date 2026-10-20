/* ── Startbildschirm ───────────────────────────────────────────────────
   Zwei eigenständige Karrierearten, zwei getrennte Spielstände:
   Spielerkarriere und Trainerkarriere. Beide können nebeneinander
   bestehen, jede hat ihre eigene Fortsetzen-Karte.                  */

(function (FKC) {
  'use strict';
  var c = FKC.ui.c, t = FKC.t;

  /* Karte für einen vorhandenen Spielstand */
  function continueCard(peek, mode) {
    var club = FKC.data.clubById(peek.clubId);
    var isCoach = mode === 'coach';
    var phaseKey = (isCoach ? 'cphase.' : 'phase.') + peek.phase;

    var sub = c.esc(peek.name) + ' · ' +
      t('menu.continueSub', { age: peek.age, phase: t(phaseKey) }) +
      (club ? ' · ' + c.esc(club.name) : '');

    var chips = c.chip(t(isCoach ? 'menu.coachChip' : 'menu.playerChip'),
                       isCoach ? 'gold' : 'info') +
      c.chip(t(phaseKey), 'accent');
    if (isCoach || peek.phase !== 'childhood') {
      chips += c.chip(t('card.ovr') + ' ' + peek.ovr, 'info');
    }
    if (peek.trophies) chips += c.chip('🏆 ' + peek.trophies, 'gold');

    return '<button class="choice" data-act="continue-' + mode + '">' +
      '<div class="choice-title">' +
      t(isCoach ? 'menu.continueCoach' : 'menu.continue') + '</div>' +
      '<div class="choice-desc">' + sub + '</div>' +
      '<div class="choice-foot">' + chips + '</div></button>';
  }

  FKC.ui.router.register('menu', {
    topbar: false,

    render: function () {
      var peekPlayer = FKC.save.peek('player');
      var peekCoach = FKC.save.peek('coach');

      var html = '<div class="hero">' +
        '<div class="hero-ball"></div>' +
        '<div class="hero-kicker">' + t('menu.kicker') + '</div>' +
        '<h1>' + t('menu.title') + ' <em>' + t('menu.titleAccent') + '</em></h1>' +
        '<p>' + t('menu.tagline') + '</p></div>';

      html += '<div class="stack">';

      if (peekPlayer) html += continueCard(peekPlayer, 'player');
      if (peekCoach) html += continueCard(peekCoach, 'coach');

      /* Spielstand vorhanden, aber unlesbar */
      if ((!peekPlayer && FKC.save.corruptIn.player) ||
          (!peekCoach && FKC.save.corruptIn.coach)) {
        html += '<div class="outcome" data-tone="bad" style="margin-bottom:4px">' +
          '<div class="story-text"><strong>' + t('menu.corruptTitle') + '</strong><br>' +
          t('menu.corruptText') + '</div>' +
          '<button class="btn btn-danger btn-sm btn-block" style="margin-top:12px" ' +
          'data-act="dropCorrupt">' + t('menu.corruptDrop') + '</button></div>';
      }

      /* Es gab schon einmal einen Spielstand, jetzt ist keiner mehr da —
         typisch, wenn der Browser den Speicher bei file:// nicht behält. */
      var lost = !peekPlayer && !FKC.save.corruptIn.player && FKC.save.lastPlayerName('player');
      if (lost) {
        html += '<div class="outcome" data-tone="bad" style="margin-bottom:4px">' +
          '<div class="story-text"><strong>' + t('menu.lostTitle') + '</strong><br>' +
          t('menu.lostText', { name: c.esc(lost) }) + '</div></div>';
      }

      /* ── Neue Karriere: erst die Art wählen ───────────────────────── */
      html += '<div class="section-title" style="margin-top:8px">' +
        '<span class="u-up">' + t('menu.pickMode') + '</span></div>';

      html += '<button class="choice" data-act="new-player">' +
        '<div class="choice-title">' + t('menu.newPlayer') + '</div>' +
        '<div class="choice-desc">' + t('menu.newPlayerSub') + '</div></button>';

      html += '<button class="choice" data-act="new-coach">' +
        '<div class="choice-title">' + t('menu.newCoach') + '</div>' +
        '<div class="choice-desc">' + t('menu.newCoachSub') + '</div></button>';

      html += '<button class="choice" data-act="settings">' +
        '<div class="choice-title">' + t('menu.settings') + '</div>' +
        '<div class="choice-desc">' + t('menu.settingsSub') + '</div></button>';

      html += '</div>';

      html += '<div class="row-between" style="margin-top:28px">' +
        '<span class="u-muted" style="font-size:.78rem">' + t('menu.footer') + '</span>' +
        '<button class="tb-btn" data-act="lang">' + FKC.i18n.lang.toUpperCase() + '</button></div>';

      return html;
    },

    bind: function (root) {
      root.addEventListener('click', function (e) {
        var b = e.target.closest('[data-act]');
        if (!b) return;
        var act = b.getAttribute('data-act');

        if (act === 'dropCorrupt') {
          if (FKC.save.corruptIn.player) FKC.save.clear('player');
          if (FKC.save.corruptIn.coach) FKC.save.clear('coach');
          FKC.ui.router.reload();

        } else if (act === 'lang') {
          FKC.i18n.setLang(FKC.i18n.lang === 'de' ? 'en' : 'de');

        } else if (act === 'continue-player') {
          FKC.save.load('player');
          var ph = FKC.state.game.career.phase;
          FKC.ui.router.go(ph === 'retired' ? 'retire' : ph === 'pro' ? 'hub' : 'story');

        } else if (act === 'continue-coach') {
          FKC.save.load('coach');
          FKC.ui.router.go(FKC.state.game.career.phase === 'retired'
            ? 'coachRetire' : 'coachHub');

        } else if (act === 'new-player') {
          start('player', 'create', 'menu.newWarnTitle', 'menu.newWarnText');

        } else if (act === 'new-coach') {
          start('coach', 'coachCreate', 'menu.newWarnCoachTitle', 'menu.newWarnCoachText');

        } else if (act === 'settings') {
          FKC.ui.router.go('settings');
        }
      });

      function start(mode, screen, titleKey, textKey) {
        if (FKC.save.exists(mode)) {
          FKC.ui.router.confirm(t(titleKey), t(textKey), function () {
            FKC.save.clear(mode);
            FKC.state.game = null;
            FKC.ui.router.go(screen);
          }, true);
        } else {
          FKC.state.game = null;
          FKC.ui.router.go(screen);
        }
      }
    }
  });

})(window.FKC);
