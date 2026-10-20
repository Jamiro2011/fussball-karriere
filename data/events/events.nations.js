/* ── Ereignisse rund um Herkunft und Nationalmannschaft ────────────────
   Doppelte Staatsbürgerschaft: Viele Spieler mit Wurzeln in Kosovo oder
   Albanien wachsen in der Schweiz, in Deutschland oder in Österreich auf.
   Wer in einem Land aufwächst und Wurzeln in einem anderen hat, bekommt
   mit 17 **eine** Frage: für welches Nationalteam? Die Antwort gilt für
   die ganze Karriere — ein Verbandswechsel ist, einmal gespielt, nicht
   mehr möglich.

   Die Wahl hat Folgen, die das Spiel ohnehin kennt: Stärke und Dichte
   der Nationalmannschaft (Stammplatzchance), ihre Qualifikationsrate
   (Turniere) und die Reaktion von Familie und Umfeld.

   Feste Station (spine), Alter 17, Jugendphase — damit sie genau einmal
   kommt und nicht im Ereignispool gegen zwanzig andere antritt.

   `textParams` gilt in events.js für Titel, Text, Optionen **und**
   Ergebnistext gleichermassen — deshalb stehen beide Ländernamen dort. */

window.FKC = window.FKC || {};
FKC.data = FKC.data || {};

(function (FKC) {
  'use strict';

  var K = function (id, part) { return 'ev.' + id + '.' + part; };

  function heim(g)   { return FKC.data.nationName(g.identity.nationality); }
  function wurzel(g) { return FKC.data.nationName(g.identity.heritage); }

  /* Ist das Aufwachsland die stärkere Mannschaft? Steuert nur die
     Nebenwirkungen; Stammplatz und Turniere regelt national.js selbst. */
  function staerker(g) {
    var a = FKC.data.nationById(g.identity.nationality);
    var b = FKC.data.nationById(g.identity.heritage);
    return a && b && a.strength >= b.strength;
  }

  var spine = [
    {
      id: 'nat_choice', spine: true, phase: 'youth', age: 17, category: 'national',
      when: function (g) {
        return !!g.identity.heritage &&
               g.identity.heritage !== g.identity.nationality &&
               !g.flags.natChosen;
      },
      title: K('nat_choice', 'title'),
      text: K('nat_choice', 'text'),
      textParams: function (g) { return { home: heim(g), roots: wurzel(g) }; },
      choices: [
        {
          id: 'home', label: K('nat_choice', 'home'), desc: K('nat_choice', 'home_d'),
          risk: 'low', result: K('nat_choice', 'home_r'),
          effects: function (g) {
            /* Das Land, in dem man aufgewachsen ist: das Umfeld freut
               sich, die Familie hatte sich insgeheim etwas anderes
               erhofft. */
            return [
              { type: 'natTeam', value: g.identity.nationality },
              { type: 'fanRelation', delta: 6 },
              { type: 'morale', delta: 3 },
              { type: 'familySupport', delta: staerker(g) ? -5 : -2 }
            ];
          }
        },
        {
          id: 'roots', label: K('nat_choice', 'roots'), desc: K('nat_choice', 'roots_d'),
          risk: 'medium', result: K('nat_choice', 'roots_r'),
          effects: function (g) {
            /* Die Wurzeln: Familie und Diaspora tragen einen, im
               Aufwachsland reagieren manche kühl. Bei der kleineren
               Mannschaft ist man schneller gesetzt — und seltener an
               einem Turnier. */
            return [
              { type: 'natTeam', value: g.identity.heritage },
              { type: 'familySupport', delta: 8 },
              { type: 'morale', delta: 6 },
              { type: 'reputation', delta: staerker(g) ? 2 : 0 },
              { type: 'fanRelation', delta: -4 }
            ];
          }
        }
      ]
    }
  ];

  FKC.data.spine = (FKC.data.spine || []).concat(spine);

})(window.FKC);
