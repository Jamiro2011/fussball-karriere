/* ── Einstellungen ─────────────────────────────────────────────────── */

(function (FKC) {
  'use strict';
  var c = FKC.ui.c, t = FKC.t;

  FKC.ui.router.register('settings', {
    render: function () {
      /* Exportiert wird immer die **geladene** Karriere. Gelöscht werden
         kann jede der beiden — sie liegen in getrennten Slots. */
      var has = FKC.state.exists();
      var hasPlayer = FKC.save.exists('player');
      var hasCoach = FKC.save.exists('coach');
      var html = '<h1>' + t('settings.title') + '</h1>';

      html += c.sectionTitle(t('settings.language'));
      html += '<div class="pill-group">' +
        '<button class="pill" data-lang="de" aria-pressed="' + (FKC.i18n.lang === 'de') + '">Deutsch</button>' +
        '<button class="pill" data-lang="en" aria-pressed="' + (FKC.i18n.lang === 'en') + '">English</button>' +
        '</div>';

      html += c.sectionTitle(t('settings.save'));
      html += '<div class="stack-sm">';
      html += '<button class="btn btn-block" data-act="export"' + (has ? '' : ' disabled') + '>' +
        t('settings.export') + '</button>';
      html += '<button class="btn btn-block" data-act="import">' + t('settings.import') + '</button>';
      if (hasPlayer) {
        html += '<button class="btn btn-danger btn-block" data-act="delete-player">' +
          t('settings.delete') + ' · ' + t('menu.playerChip') + '</button>';
      }
      if (hasCoach) {
        html += '<button class="btn btn-danger btn-block" data-act="delete-coach">' +
          t('settings.delete') + ' · ' + t('menu.coachChip') + '</button>';
      }
      html += '</div>';

      html += c.sectionTitle(t('settings.about'));
      html += '<p class="u-dim" style="font-size:.88rem">' + t('settings.aboutText') + '</p>';

      html += '<div class="actionbar"><button class="btn btn-primary" data-act="back">' +
        t('ui.back') + '</button></div>';
      return html;
    },

    bind: function (root) {
      root.addEventListener('click', function (e) {
        var lang = e.target.closest('[data-lang]');
        if (lang) { FKC.i18n.setLang(lang.getAttribute('data-lang')); return; }

        var b = e.target.closest('[data-act]');
        if (!b) return;
        var act = b.getAttribute('data-act');

        if (act === 'back') {
          FKC.ui.router.go(!FKC.state.exists() ? 'menu'
            : FKC.state.isCoach() ? 'coachHub' : 'hub');

        } else if (act === 'export') {
          var text = FKC.save.exportText();
          FKC.ui.router.sheet(
            '<h2>' + t('settings.export') + '</h2>' +
            '<p class="u-dim" style="font-size:.85rem;margin-top:8px">' + t('settings.exportHint') + '</p>' +
            '<textarea class="input" rows="6" readonly style="margin-top:12px;font-size:.72rem">' +
            c.esc(text) + '</textarea>' +
            '<button class="btn btn-primary btn-block" style="margin-top:14px" data-copy>' +
            t('settings.copy') + '</button>'
          ).addEventListener('click', function (ev) {
            if (!ev.target.closest('[data-copy]')) return;
            var ta = document.querySelector('#overlay-sheet textarea');
            ta.select();
            try { document.execCommand('copy'); FKC.ui.router.toast(t('settings.copied'), 'good'); }
            catch (err) { FKC.ui.router.toast(t('settings.copyFail'), 'bad'); }
          });

        } else if (act === 'import') {
          FKC.ui.router.sheet(
            '<h2>' + t('settings.import') + '</h2>' +
            '<p class="u-dim" style="font-size:.85rem;margin-top:8px">' + t('settings.importHint') + '</p>' +
            '<textarea class="input" rows="6" style="margin-top:12px;font-size:.72rem"></textarea>' +
            '<button class="btn btn-primary btn-block" style="margin-top:14px" data-do>' +
            t('settings.importDo') + '</button>'
          ).addEventListener('click', function (ev) {
            if (!ev.target.closest('[data-do]')) return;
            var val = document.querySelector('#overlay-sheet textarea').value;
            /* Die Karriereart steckt im Text — ein Trainerstand landet
               nie im Spieler-Slot und umgekehrt. */
            var mode = FKC.save.importText(val);
            if (mode) {
              FKC.ui.router.closeSheet();
              FKC.ui.router.toast(t('settings.importOk'), 'good');
              var g = FKC.state.game;
              FKC.ui.router.go(mode === 'coach'
                ? (g.career.phase === 'retired' ? 'coachRetire' : 'coachHub')
                : (g.career.phase === 'retired' ? 'retire'
                   : g.career.phase === 'pro' ? 'hub' : 'story'));
            } else {
              FKC.ui.router.toast(t('settings.importFail'), 'bad');
            }
          });

        } else if (act === 'delete-player' || act === 'delete-coach') {
          var slot = act === 'delete-coach' ? 'coach' : 'player';
          FKC.ui.router.confirm(t('settings.deleteTitle'), t('settings.deleteText'), function () {
            FKC.save.clear(slot);
            FKC.ui.router.toast(t('settings.deleted'), 'bad');
            FKC.ui.router.go('menu');
          }, true);
        }
      });
    }
  });

})(window.FKC);
