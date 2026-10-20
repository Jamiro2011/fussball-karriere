/* ── Spielstand ────────────────────────────────────────────────────────
   Zwei Slots in localStorage, einer je Karriereart. Spieler- und
   Trainerkarriere existieren dadurch nebeneinander und überschreiben
   sich nie gegenseitig.

     fkc.save.v1    Spielerkarriere
     fkc.coach.v1   Trainerkarriere

   Autosave nach jedem Phasenwechsel. Zusätzlich Export/Import als
   Textblock (Backup, Gerätewechsel).                                */

window.FKC = window.FKC || {};

(function (FKC) {
  'use strict';

  var SLOTS = {
    player: { key: 'fkc.save.v1',  last: 'fkc.lastPlayer' },
    coach:  { key: 'fkc.coach.v1', last: 'fkc.lastCoach' }
  };

  /** Karriereart eines Spielstands — Altstände ohne Angabe sind Spieler */
  function modeOf(g) {
    return (g && g.meta && g.meta.mode === 'coach') ? 'coach' : 'player';
  }

  function slot(mode) {
    return SLOTS[mode] || SLOTS.player;
  }

  var save = {

    SLOTS: SLOTS,
    modeOf: modeOf,

    /** Karriereart des gerade geladenen Spielstands */
    mode: function () { return modeOf(FKC.state.game); },

    write: function () {
      var g = FKC.state.game;
      if (!g) return false;
      var mode = modeOf(g);
      var s = slot(mode);

      g.meta.updatedAt = Date.now();
      g.meta.lang = FKC.i18n.lang;
      g.meta.mode = mode;
      /* Der Name wird redundant in meta abgelegt. Sollte identity je
         beschädigt ankommen, lässt er sich daraus wiederherstellen —
         ein Default- oder Zufallsname darf ihn nie überschreiben.  */
      g.meta.playerName = g.identity.firstName + ' ' + g.identity.lastName;
      g.rng.state = FKC.rng.state;          // RNG-Stand mitnehmen
      try {
        localStorage.setItem(s.key, JSON.stringify(g));
        localStorage.setItem(s.last, g.meta.playerName);
        return true;
      } catch (e) {
        console.warn('[save] Schreiben fehlgeschlagen', e);
        return false;
      }
    },

    /** Name des zuletzt gespeicherten Charakters, auch ohne Spielstand */
    lastPlayerName: function (mode) {
      try { return localStorage.getItem(slot(mode || 'player').last); }
      catch (e) { return null; }
    },

    /** War der zuletzt gelesene Spielstand unbrauchbar? Je Slot. */
    corrupt: false,
    corruptIn: { player: false, coach: false },

    /**
     * Mindeststruktur eines Spielstands. Fehlt eines dieser Felder,
     * ist der Stand unbrauchbar — dann lieber sauber ablehnen als
     * beim Rendern mit einem TypeError die ganze Seite zu killen.
     */
    isUsable: function (g) {
      if (!g || !g.meta || !g.identity || !g.identity.firstName ||
          !g.career || !g.career.phase || !g.status) return false;
      if (modeOf(g) === 'coach') {
        return !!(g.attributes && g.hidden && g.standing);
      }
      return !!(g.attributes && g.hidden);
    },

    read: function (mode) {
      var m = mode || 'player';
      var s = slot(m);
      this.corruptIn[m] = false;
      if (m === 'player') this.corrupt = false;

      var raw;
      try { raw = localStorage.getItem(s.key); }
      catch (e) { console.warn('[save] Speicher nicht lesbar', e); return null; }
      if (!raw) return null;

      var g;
      try { g = JSON.parse(raw); }
      catch (e) {
        console.warn('[save] Spielstand ist kein gültiges JSON', e);
        this.corruptIn[m] = true; this.corrupt = true;
        return null;
      }

      try { g = this.migrate(g, m); }
      catch (e) {
        console.warn('[save] Migration fehlgeschlagen', e);
        this.corruptIn[m] = true; this.corrupt = true;
        return null;
      }

      if (!this.isUsable(g)) {
        console.warn('[save] Spielstand unvollständig — wird nicht geladen');
        this.corruptIn[m] = true; this.corrupt = true;
        return null;
      }
      return g;
    },

    load: function (mode) {
      var g = this.read(mode || 'player');
      if (!g) return null;
      FKC.state.game = g;
      g.rng = g.rng || { seed: FKC.rng.newSeed() };
      FKC.rng.seed(g.rng.seed);
      if (g.rng.state) FKC.rng.state = g.rng.state;
      return g;
    },

    exists: function (mode) {
      try { return !!localStorage.getItem(slot(mode || modeOf(FKC.state.game)).key); }
      catch (e) { return false; }
    },

    /** Kurzinfo für den Startbildschirm, ohne den Save zu laden */
    peek: function (mode) {
      var m = mode || 'player';
      var g = this.read(m);
      if (!g) return null;
      /* Defensiv: der Startbildschirm darf an keinem fehlenden Feld
         scheitern, sonst bleibt die ganze Seite leer.              */
      var id = g.identity || {}, career = g.career || {}, status = g.status || {};
      return {
        mode: m,
        name: ((id.firstName || '?') + ' ' + (id.lastName || '')).trim(),
        age: id.age != null ? id.age : '?',
        phase: career.phase || (m === 'coach' ? 'club' : 'childhood'),
        ovr: g.ovr || 0,
        clubId: status.clubId || null,
        year: id.year || 0,
        trophies: (career.trophies || []).length,
        updatedAt: (g.meta && g.meta.updatedAt) || 0
      };
    },

    clear: function (mode) {
      var m = mode || modeOf(FKC.state.game);
      try { localStorage.removeItem(slot(m).key); } catch (e) {}
      if (FKC.state.game && modeOf(FKC.state.game) === m) FKC.state.game = null;
    },

    /* ── Versionsmigration ────────────────────────────────────────── */
    migrate: function (g, mode) {
      if (!g.meta) return null;
      /* Der Slot bestimmt die Karriereart. Ältere Spielerstände kennen
         das Feld nicht — sie liegen im Spieler-Slot und sind es damit. */
      g.meta.mode = (mode === 'coach') ? 'coach' : (g.meta.mode || 'player');

      /* Identität absichern: ein leerer Name wird aus meta rekonstruiert,
         nie durch einen neuen Zufallsnamen ersetzt. */
      if (g.identity && (!g.identity.firstName || !g.identity.lastName) && g.meta.playerName) {
        var parts = String(g.meta.playerName).split(' ');
        g.identity.firstName = g.identity.firstName || parts.shift();
        g.identity.lastName = g.identity.lastName || parts.join(' ');
        console.warn('[save] Name aus meta wiederhergestellt:', g.meta.playerName);
      }

      if (g.meta.mode !== 'coach') {
        /* Auszeichnungen aus älteren Ständen auf die genaueren Namen
           umstellen. „Goldener Ball" ist inzwischen dem besten Spieler
           eines **Turniers** vorbehalten; die alte Saisonauszeichnung
           gleichen Namens wird deshalb zum Fussballer des Jahres. */
        var renamed = { topscorer: 'goldenBoot',
                        playerOfSeason: 'ballon', goldenBall: 'ballon',
                        tournamentTopScorer: 'goldenBootTournament',
                        tournamentBestPlayer: 'goldenBallTournament' };
        if (g.career && g.career.awards) {
          g.career.awards.forEach(function (a) { if (renamed[a.id]) a.id = renamed[a.id]; });
        }
      }

      /* Ältere Stände kennen die Liga-Welt noch nicht */
      if (!g.world) g.world = { clubLeague: {}, moves: [], seasons: 0 };

      g.meta.saveVersion = FKC.state.SAVE_VERSION;
      return g;
    },

    /* ── Export / Import ──────────────────────────────────────────── */

    exportText: function () {
      var g = FKC.state.game;
      if (!g) return '';
      g.rng.state = FKC.rng.state;
      g.meta.mode = modeOf(g);
      try { return btoa(unescape(encodeURIComponent(JSON.stringify(g)))); }
      catch (e) { return JSON.stringify(g); }
    },

    importText: function (text) {
      var g;
      try {
        var json = text.trim().charAt(0) === '{'
          ? text
          : decodeURIComponent(escape(atob(text.trim())));
        g = JSON.parse(json);
      } catch (e) { return false; }
      if (!g || !g.identity || !g.career) return false;
      /* Die Karriereart steckt im Text selbst — ein exportierter
         Trainerstand darf niemals im Spieler-Slot landen. */
      var m = modeOf(g);
      g = this.migrate(g, m);
      if (!this.isUsable(g)) return false;
      FKC.state.game = g;
      FKC.rng.seed(g.rng && g.rng.seed ? g.rng.seed : FKC.rng.newSeed());
      if (g.rng && g.rng.state) FKC.rng.state = g.rng.state;
      this.write();
      return m;
    },

    KEY: SLOTS.player.key
  };

  FKC.save = save;

})(window.FKC);
