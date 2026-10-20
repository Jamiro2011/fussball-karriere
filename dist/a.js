var FKC_CODES = [
'3CUU-SMZF'
];
(function () {
'use strict';
var SPEICHER = 'fkc.access';
var BUENDEL="g.js?v=202610201101";
var CSS_NACH=[];
function norm(s) {
return String(s == null ? '' : s).replace(/\s+/g, '').toUpperCase();
}
function gueltig(eingabe) {
var codes = (typeof FKC_CODES !== 'undefined' && FKC_CODES) || [];
var n = norm(eingabe);
if (!n) return null;
for (var i = 0; i < codes.length; i++) {
if (norm(codes[i]) === n) return codes[i];
}
return null;
}
function lesen() {
try { return window.localStorage.getItem(SPEICHER); } catch (e) { return null; }
}
function schreiben(v) {
try { window.localStorage.setItem(SPEICHER, v); } catch (e) {  }
}
function loeschen() {
try { window.localStorage.removeItem(SPEICHER); } catch (e) {  }
}
var gestartet = false;
function spielStarten() {
if (gestartet) return;
gestartet = true;
var box = document.getElementById('gate');
if (box && box.parentNode) box.parentNode.removeChild(box);
document.body.classList.remove('is-locked');
CSS_NACH.forEach(function (href) {
var l = document.createElement('link');
l.rel = 'stylesheet';
l.href = href;
document.head.appendChild(l);
});
var frag = document.createDocumentFragment();
if (BUENDEL) {
var eine = document.createElement('script');
eine.src = BUENDEL;
eine.async = false;
frag.appendChild(eine);
} else {
[].slice.call(document.querySelectorAll('script[data-src]'))
.forEach(function (alt) {
var s = document.createElement('script');
s.src = alt.getAttribute('data-src');
s.async = false;
frag.appendChild(s);
if (alt.parentNode) alt.parentNode.removeChild(alt);
});
}
document.body.appendChild(frag);
window.setTimeout(function () {
if (window.FKC && window.FKC.ui) return;
var w = document.createElement('div');
w.className = 'gate';
w.innerHTML =
'<div class="gate-card">' +
'<h1 class="gate-title">Das Spiel konnte nicht geladen werden</h1>' +
'<p class="gate-sub">Die Programmdateien wurden nicht gefunden. ' +
'Wenn die Seite lokal per Doppelklick geöffnet wurde, blockiert ' +
'der Browser das Nachladen — bitte über eine Adresse mit ' +
'<b>http://</b> aufrufen.</p>' +
'<button class="gate-btn" type="button" ' +
'onclick="location.reload()">Neu laden</button>' +
'</div>';
document.body.appendChild(w);
}, 6000);
}
function gateAufbauen() {
var box = document.getElementById('gate');
if (!box) { spielStarten(); return; }
box.hidden = false;
document.body.classList.add('is-locked');
var feld = document.getElementById('gate-input');
var knopf = document.getElementById('gate-btn');
var meldung = document.getElementById('gate-msg');
var karte = box.querySelector('.gate-card') || box;
var fehlversuche = 0;
var gesperrtBis = 0;
function sagen(text, art) {
if (!meldung) return;
meldung.textContent = text || '';
meldung.setAttribute('data-tone', art || '');
}
function pruefen() {
var jetzt = Date.now();
if (jetzt < gesperrtBis) {
sagen('Zu viele Versuche. Bitte ' +
Math.ceil((gesperrtBis - jetzt) / 1000) + ' Sekunden warten.', 'bad');
return;
}
var treffer = gueltig(feld ? feld.value : '');
if (treffer) {
schreiben(treffer);
sagen('Code erkannt. Das Spiel wird geladen …', 'good');
if (knopf) knopf.disabled = true;
if (feld) feld.disabled = true;
window.setTimeout(spielStarten, 260);
return;
}
fehlversuche++;
if (feld) feld.select();
karte.classList.remove('is-wrong');
void karte.offsetWidth;
karte.classList.add('is-wrong');
if (fehlversuche >= 5) {
gesperrtBis = Date.now() + 10000;
fehlversuche = 0;
sagen('Zu viele Versuche. Bitte 10 Sekunden warten.', 'bad');
} else {
sagen('Dieser Code stimmt nicht.', 'bad');
}
}
if (knopf) knopf.addEventListener('click', pruefen);
if (feld) {
feld.addEventListener('keydown', function (e) {
if (e.key === 'Enter') { e.preventDefault(); pruefen(); }
});
feld.addEventListener('input', function () {
if (meldung && meldung.getAttribute('data-tone') === 'bad') sagen('');
});
try { feld.focus(); } catch (e) {  }
}
}
function los() {
var gemerkt = lesen();
if (gemerkt && gueltig(gemerkt)) { spielStarten(); return; }
if (gemerkt) loeschen();
gateAufbauen();
}
if (document.readyState === 'loading') {
document.addEventListener('DOMContentLoaded', los);
} else {
los();
}
})();