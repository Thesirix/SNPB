'use strict';
// =====================================================================
//  LANGUE DE L'INTERFACE : français ou anglais.
//  Dans le code : tr('texte français', 'English text').
//  Dans la page : un élément avec data-en="..." est traduit automatiquement.
// =====================================================================

// Anglais par défaut ; le choix fait avec les drapeaux est mémorisé dans le navigateur.
let LANGUE_UI = 'en';
try { if (localStorage.getItem('labo-langue') === 'fr') LANGUE_UI = 'fr'; } catch { /* stockage indisponible */ }

const tr = (fr, en) => (LANGUE_UI === 'en' && en !== undefined ? en : fr);

// Un texte qui existe dans les deux langues (pour le journal, calculé une fois et affiché plus tard).
const bi = (fr, en) => ({ fr, en });
const txt = x => (x && typeof x === 'object' && 'fr' in x ? (LANGUE_UI === 'en' ? x.en : x.fr) : x);

function traduirePage() {
  document.documentElement.lang = LANGUE_UI;
  document.title = LANGUE_UI === 'en' ? 'SNPB' : 'CNPS';   // Semantic Neuroplastic Brain / Cerveau Neuroplastique Sémantique
  for (const el of document.querySelectorAll('[data-en]')) {
    if (el.dataset.fr === undefined) el.dataset.fr = el.innerHTML;
    el.innerHTML = LANGUE_UI === 'en' ? el.dataset.en : el.dataset.fr;
  }
  for (const el of document.querySelectorAll('[data-en-placeholder]')) {
    if (el.dataset.frPlaceholder === undefined) el.dataset.frPlaceholder = el.placeholder;
    el.placeholder = LANGUE_UI === 'en' ? el.dataset.enPlaceholder : el.dataset.frPlaceholder;
  }
  for (const el of document.querySelectorAll('[data-en-tip]')) {
    if (el.dataset.frTip === undefined) el.dataset.frTip = el.dataset.tip;
    el.dataset.tip = LANGUE_UI === 'en' ? el.dataset.enTip : el.dataset.frTip;
  }
  for (const el of document.querySelectorAll('[data-en-title]')) {
    if (el.dataset.frTitle === undefined) el.dataset.frTitle = el.title;
    el.title = LANGUE_UI === 'en' ? el.dataset.enTitle : el.dataset.frTitle;
  }
}

function changerLangue(l) {
  LANGUE_UI = l;
  try { localStorage.setItem('labo-langue', l); } catch { /* tant pis */ }
  traduirePage();
}
