'use strict';
// =====================================================================
//  LANGUE : fabrique une petite langue qui suit des règles secrètes.
//  Le cerveau ne verra jamais ces règles, seulement les phrases.
// =====================================================================

const LONGUEUR_PHRASE = 4;
const NOMS_FAMILLES = ['A', 'B', 'C', 'D', 'E'];

// Hasard reproductible : la même graine donne toujours la même langue.
function creerHasard(graine) {
  let a = graine >>> 0;
  const h = () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  h.entier = n => Math.floor(h() * n);
  h.choisir = tab => tab[h.entier(tab.length)];
  h.melanger = tab => {
    const b = tab.slice();
    for (let i = b.length - 1; i > 0; i--) { const j = h.entier(i + 1); [b[i], b[j]] = [b[j], b[i]]; }
    return b;
  };
  h.gauss = () => {
    let u = 0, v = 0;
    while (!u) u = h();
    while (!v) v = h();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  return h;
}

const SYLLABES = ['bli', 'zor', 'me', 'fa', 'tu', 'no', 'kra', 'vo', 'shi', 'pa', 'du', 'ri', 'lo', 'gek', 'ma', 'ti', 'sna', 'up', 'wen', 'ko'];
const MOTS_ANGLAIS = ['apple', 'Tuesday', 'guitar', 'river', 'blue', 'window', 'tiger', 'cloud', 'pencil', 'seven',
  'violin', 'desert', 'candle', 'orange', 'hammer', 'ghost', 'bicycle', 'pepper', 'moon', 'sugar',
  'ladder', 'piano', 'forest', 'button', 'rocket', 'lemon', 'thunder', 'carpet', 'mirror', 'spoon'];

const MODES = {
  invente: 'Mots inventés',
  absurde: 'Anglais, règles absurdes',
  normal: 'Anglais normal',
};

function genererLangue(mode, graine, taille = 'petite') {
  const h = creerHasard(graine);
  const L = mode === 'normal' ? langueNormale() : langueAuHasard(mode, h, taille);
  const nbPhrases = 50 * L.mots.length;
  L.mode = mode;
  L.graine = graine;
  L.DEBUT = L.mots.length;          // jeton spécial « début de phrase »
  L.nbJetons = L.mots.length + 1;
  L.familleDe = [];
  L.familles.forEach((f, g) => f.forEach(m => { L.familleDe[m] = g; }));

  L.phrases = [];
  for (let i = 0; i < nbPhrases; i++) {
    const phrase = [];
    let m2 = L.DEBUT, m1 = L.DEBUT;
    for (let p = 0; p < LONGUEUR_PHRASE; p++) {
      const m = h.choisir(motsPossibles(L, m2, m1));
      phrase.push(m);
      m2 = m1; m1 = m;
    }
    L.phrases.push(phrase);
  }
  L.contextes = construireContextes(L);
  return L;
}

// Difficulté : plus de mots, de familles et de règles = le cerveau doit faire pousser plus de neurones.
const TAILLES = {
  petite: { nom: 'Petite (12 mots)', mots: 12, familles: 3, paires: 1, combos: 0, interdits: 1 },
  moyenne: { nom: 'Moyenne (16 mots)', mots: 16, familles: 4, paires: 2, combos: 2, interdits: 2 },
  grande: { nom: 'Grande (20 mots)', mots: 20, familles: 5, paires: 3, combos: 3, interdits: 2 },
};

// Les mots au hasard + des règles tirées au hasard.
function langueAuHasard(mode, h, taille) {
  const T = TAILLES[taille] || TAILLES.petite;
  let mots;
  if (mode === 'absurde') {
    mots = h.melanger(MOTS_ANGLAIS).slice(0, T.mots);
  } else {
    const vus = new Set();
    mots = [];
    while (mots.length < T.mots) {
      const m = h.choisir(SYLLABES) + h.choisir(SYLLABES);
      if (!vus.has(m)) { vus.add(m); mots.push(m); }
    }
  }
  const nbFam = T.familles;
  const tous = [...Array(nbFam).keys()];
  const ordre = h.melanger(mots.map((_, i) => i));
  const familles = [];
  for (let g = 0; g < nbFam; g++) familles.push(ordre.slice(g * 4, g * 4 + 4).sort((a, b) => a - b));

  // Ordre des familles. Deux familles peuvent se suivre elles-mêmes : la règle
  // « même famille » se déclenche alors dans plusieurs cas, ce qui oblige le cerveau
  // à comparer les deux mots (impossible avec de simples liens directs).
  const depart = h.entier(nbFam);
  const autre = h.choisir(tous.filter(x => x !== depart));
  const transitions = [];
  for (let g = 0; g < nbFam; g++) {
    if (g === depart || g === autre) transitions[g] = [g, h.choisir(tous.filter(x => x !== g))];
    else transitions[g] = h.melanger(tous.filter(x => x !== g)).slice(0, 1 + h.entier(2));
  }
  // Chaque famille doit être atteignable, sinon ses mots n'apparaîtraient jamais.
  for (;;) {
    const vues = new Set([depart]);
    const pile = [depart];
    while (pile.length) for (const s of transitions[pile.pop()]) if (!vues.has(s)) { vues.add(s); pile.push(s); }
    const manquante = tous.find(g => !vues.has(g));
    if (manquante === undefined) break;
    transitions[h.choisir([...vues])].push(manquante);
  }
  transitions.forEach(t => t.sort());

  const L = { mots, familles, depart: [depart], transitions, regles: [] };
  L.familleDe = [];
  familles.forEach((f, g) => f.forEach(m => { L.familleDe[m] = g; }));
  const indices = mots.map((_, i) => i);
  const cibles = new Set();

  const comboAlors = h.choisir(indices);
  cibles.add(comboAlors);
  L.regles.push({ type: 'combo_famille', alors: [comboAlors] });

  // Combinaisons précises : « après X puis Y vient toujours Z » (X et Y de familles différentes).
  const pairesVues = new Set();
  for (let k = 0; k < T.combos; k++) {
    for (let essai = 0; essai < 50; essai++) {
      const si2 = h.choisir(indices);
      const suite = baseTransition(L, si2).filter(m => L.familleDe[m] !== L.familleDe[si2]);
      if (!suite.length) continue;
      const si1 = h.choisir(suite);
      if (pairesVues.has(si2 + ',' + si1)) continue;
      pairesVues.add(si2 + ',' + si1);
      const alors = h.choisir(indices);
      cibles.add(alors);
      L.regles.push({ type: 'combo_mots', si2, si1, alors: [alors] });
      break;
    }
  }

  const sources = new Set();
  for (const si of h.melanger(indices).slice(0, T.paires)) {
    const alors = h.choisir(indices.filter(i => i !== si));
    sources.add(si); cibles.add(alors);
    L.regles.push({ type: 'paire', si, alors: [alors] });
  }

  // Interdit : on retire un mot qui serait normalement permis après un autre.
  const candidats = [];
  indices.forEach(u => {
    if (sources.has(u)) return;
    const base = baseTransition(L, u);
    base.forEach(v => { if (!cibles.has(v) && base.length > 1) candidats.push([u, v]); });
  });
  for (const [u, v] of h.melanger(candidats).slice(0, T.interdits)) L.regles.push({ type: 'interdit', apres: u, jamais: v });
  delete L.familleDe;
  return L;
}

// Une vraie grammaire anglaise miniature.
function langueNormale() {
  const mots = ['the', 'a', 'my', 'cat', 'dog', 'baby', 'eats', 'drinks', 'likes', 'fish', 'milk', 'ball'];
  const i = m => mots.indexOf(m);
  return {
    mots,
    familles: [[0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11]],
    depart: [0],
    transitions: [[1], [2], [3], [0]],
    regles: [
      { type: 'combo_mots', si2: i('dog'), si1: i('likes'), alors: [i('ball')] },
      { type: 'combo_mots', si2: i('cat'), si1: i('likes'), alors: [i('fish')] },
      { type: 'combo_mots', si2: i('baby'), si1: i('likes'), alors: [i('milk'), i('ball')] },
      { type: 'paire', si: i('eats'), alors: [i('fish')] },
      { type: 'paire', si: i('drinks'), alors: [i('milk')] },
    ],
  };
}

function baseTransition(L, m1) {
  const g = L.familleDe ? L.familleDe[m1] : L.familles.findIndex(f => f.includes(m1));
  return [].concat(...L.transitions[g].map(s => L.familles[s]));
}

// Le moteur des règles secrètes : quels mots ont le droit de venir ensuite ?
function motsPossibles(L, m2, m1) {
  if (!L.familleDe) { L.familleDe = []; L.familles.forEach((f, g) => f.forEach(m => { L.familleDe[m] = g; })); }
  const DEBUT = L.mots.length;
  if (m1 === DEBUT) return [].concat(...L.depart.map(g => L.familles[g]));
  let possibles = baseTransition(L, m1);
  let force = false;
  for (const r of L.regles) {                       // les combinaisons passent en premier
    if (r.type === 'combo_famille' && m2 !== DEBUT && L.familleDe[m2] === L.familleDe[m1]) { possibles = r.alors; force = true; break; }
    if (r.type === 'combo_mots' && m2 === r.si2 && m1 === r.si1) { possibles = r.alors; force = true; break; }
  }
  if (!force) for (const r of L.regles) if (r.type === 'paire' && m1 === r.si) { possibles = r.alors; force = true; }
  if (!force) for (const r of L.regles) {
    if (r.type === 'interdit' && m1 === r.apres && possibles.length > 1) possibles = possibles.filter(m => m !== r.jamais);
  }
  return possibles;
}

// Toutes les situations rencontrées : (mot -2, mot -1) -> quels mots suivent, combien de fois.
function construireContextes(L) {
  const parCle = new Map();
  for (const phrase of L.phrases) {
    let m2 = L.DEBUT, m1 = L.DEBUT;
    for (const m of phrase) {
      const cle = m2 * L.nbJetons + m1;
      if (!parCle.has(cle)) parCle.set(cle, { m2, m1, total: 0, comptes: new Map(), permis: new Set(motsPossibles(L, m2, m1)) });
      const c = parCle.get(cle);
      c.total++;
      c.comptes.set(m, (c.comptes.get(m) || 0) + 1);
      m2 = m1; m1 = m;
    }
  }
  return [...parCle.values()].sort((a, b) => a.m2 - b.m2 || a.m1 - b.m1);
}

function decrireRegles(L, l = 'fr') {
  const en = l === 'en';
  const q = m => en ? `"${L.mots[m]}"` : `« ${L.mots[m]} »`;
  const fam = g => (en ? 'family ' : 'famille ') + NOMS_FAMILLES[g];
  const liste = ids => ids.map(q).join(', ');
  const out = [];
  out.push(en
    ? `Words are sorted into ${L.familles.length} hidden families: ` + L.familles.map((f, g) => `${NOMS_FAMILLES[g]} = ${liste(f)}`).join('; ') + '.'
    : `Les mots sont rangés en ${L.familles.length} familles cachées : ` + L.familles.map((f, g) => `${NOMS_FAMILLES[g]} = ${liste(f)}`).join(' ; ') + '.');
  out.push(en ? `A sentence always starts with a word from ${L.depart.map(fam).join(' or ')}.`
    : `Une phrase commence toujours par un mot de la ${L.depart.map(fam).join(' ou ')}.`);
  if (L.mode === 'normal') {
    out.push(en ? 'Fixed order: determiner (A) → animal (B) → verb (C) → object (D).' : 'Ordre fixe : déterminant (A) → animal (B) → verbe (C) → objet (D).');
  } else {
    L.transitions.forEach((t, g) => {
      out.push(en ? `After a word from ${fam(g)} only words from ${t.map(fam).join(' or ')} can come.`
        : `Après un mot de la ${fam(g)} viennent seulement des mots de la ${t.map(fam).join(' ou de la ')}.`);
    });
  }
  for (const r of L.regles) {
    if (r.type === 'combo_famille') out.push(en
      ? `Combination: if the two previous words are from the same family, the next word is always ${q(r.alors[0])}. This rule comes before all others.`
      : `Combinaison : si les deux mots précédents sont de la même famille, le mot suivant est toujours ${q(r.alors[0])}. Cette règle passe avant toutes les autres.`);
    if (r.type === 'combo_mots') out.push(en
      ? `Combination: after ${q(r.si2)} then ${q(r.si1)}, the next word is ${r.alors.length > 1 ? 'either ' + r.alors.map(q).join(' or ') : 'always ' + q(r.alors[0])}.`
      : `Combinaison : après ${q(r.si2)} puis ${q(r.si1)}, le mot suivant est ${r.alors.length > 1 ? 'soit ' + r.alors.map(q).join(' soit ') : 'toujours ' + q(r.alors[0])}.`);
    if (r.type === 'paire') out.push(en
      ? `Fixed pair: after ${q(r.si)} always comes ${liste(r.alors)}${L.mode === 'normal' ? '' : ' (unless the combination applies)'}.`
      : `Paire fixe : après ${q(r.si)} vient toujours ${liste(r.alors)}${L.mode === 'normal' ? '' : ' (sauf si la combinaison s\'applique)'}.`);
    if (r.type === 'interdit') out.push(en
      ? `Forbidden: ${q(r.jamais)} never comes right after ${q(r.apres)}.`
      : `Interdit : ${q(r.jamais)} ne vient jamais juste après ${q(r.apres)}.`);
  }
  return out;
}

// ---------- Le monde « Langue secrète » ----------
function genererMondeLangue(mode, graine, taille) {
  const L = genererLangue(mode, graine, taille);
  const tous = [...Array(L.nbJetons).keys()];
  Object.assign(L, { jetonsA: tous, jetonsB: tous, jetonSpecial: L.DEBUT, testDepart: [L.DEBUT, L.DEBUT] });
  nommer(L, {
    jetons: { fr: L.mots.concat(['(début)']), en: L.mots.concat(['(start)']) },
    sorties: { fr: L.mots, en: L.mots },
    entree: {
      fr: { courtA: 'mot-2', courtB: 'mot-1', longA: 'avant-dernier mot', longB: 'dernier mot', resumeA: 'si avant-dernier :', resumeB: 'après :' },
      en: { courtA: 'word-2', courtB: 'word-1', longA: 'second-to-last word', longB: 'last word', resumeA: 'if second-to-last:', resumeB: 'after:' },
    },
  });
  L.permis = (a, b) => new Set(motsPossibles(L, a, b));
  L.ajusterTest = (a, b) => (b === L.DEBUT ? [L.DEBUT, b] : [a, b]);   // avant le premier mot, il n'y a que (début)
  L.descriptions = () => decrireRegles(L, langueUI());
  if (mode === 'piege') {
    // Le piège : pendant l'entraînement, après chaque mot ne vient qu'une seule famille de mots.
    // Le cerveau peut croire que c'est l'avant-dernier mot qui décide, alors que c'est le dernier.
    const h = creerHasard(graine + 1), apres = new Map();
    for (const c of L.contextes) if (c.m2 !== L.DEBUT && c.m1 !== L.DEBUT) {
      if (!apres.has(c.m2)) apres.set(c.m2, new Set());
      apres.get(c.m2).add(L.familleDe[c.m1]);
    }
    const choix = new Map([...apres].map(([m, fs]) => [m, h.choisir([...fs])]));
    restreindreEntrainement(L, (a, b) => a === L.DEBUT || b === L.DEBUT || L.familleDe[b] === choix.get(a));
    L.descriptions = () => decrireRegles(L, langueUI()).concat(tr(
      "<i>Le piège : pendant l'entraînement, après chaque mot ne venait qu'une seule famille de mots. L'avant-dernier mot semblait donc décider de tout, alors que c'est le dernier qui compte.</i>",
      '<i>The trap: during training, after each word only one family of words came. So the second-to-last word seemed to decide everything, while the last one is what matters.</i>'));
  }
  L.couleurJeton = (t, voir) => (t === L.DEBUT ? COULEURS.doux : voir ? couleurFamille(L.familleDe[t]) : null);
  L.couleurSortie = (s, voir) => (voir ? couleurFamille(L.familleDe[s]) : null);
  return L;
}

const MONDE_LANGUE = {
  id: 'langue',
  nom: () => tr('Langue secrète', 'Secret language'),
  modes: () => ({ invente: tr('Mots inventés', 'Made-up words'), absurde: tr('Anglais, règles absurdes', 'English, absurd rules'), normal: tr('Anglais normal', 'Normal English'),
    piege: tr('🐺 Le loup dans la neige (phrases trompeuses)', '🐺 The wolf in the snow (misleading sentences)') }),
  tailles: () => ({ petite: tr('Petite (12 mots)', 'Small (12 words)'), moyenne: tr('Moyenne (16 mots)', 'Medium (16 words)'), grande: tr('Grande (20 mots)', 'Large (20 words)') }),
  sansTaille: mode => mode === 'normal',
  verbeEssai: () => tr("J'écoute ce qui suit", 'I listen to what follows'),
  generer: genererMondeLangue,
  titreCarte: () => tr('Carte des mots', 'Word map'),
  aideCarte: () => tr('Chaque mot a une position en 3D (x, y, z) que le cerveau déplace lui-même. Personne ne décide des axes. Glisse avec la souris pour faire tourner.',
    'Each word has a 3D position (x, y, z) that the brain moves by itself. Nobody decides the axes. Drag with the mouse to rotate.'),
  panneau: {
    titre: () => tr('La langue', 'The language'),
    aide: () => tr('Quelques phrases que le cerveau lit. Il ne connaît pas les règles : il doit les découvrir.', 'A few sentences the brain reads. It does not know the rules: it has to discover them.'),
    html: '<div id="phrases" class="phrases"></div>',
    infos: (labo, g, L) => (L.mode !== 'piege' ? '' : infosPiege(labo, g, L, tr(
      "Ici : pendant l'entraînement, après chaque mot ne venait qu'une seule famille de mots. Le cerveau peut croire que c'est l'avant-dernier mot qui décide du mot suivant, alors que c'est le dernier. Les situations jamais vues le trahissent.",
      'Here: during training, after each word only one family of words came. The brain may believe the second-to-last word decides the next word, while it is the last one. Never-seen situations give it away.'))),
    preparer: L => { document.getElementById('phrases').innerHTML = L.phrases.slice(0, 40).map(p => `<div>${p.map(m => L.mots[m]).join(' ')}</div>`).join(''); },
  },
  inventer: true,
  prompt: {
    tache: L => tr(`Sa tâche : deviner le mot suivant dans une langue inconnue de ${L.mots.length} mots. Les phrases font ${LONGUEUR_PHRASE} mots et suivent des règles secrètes.`,
      `Its task: guess the next word in an unknown language of ${L.mots.length} words. Sentences are ${LONGUEUR_PHRASE} words long and follow secret rules.`),
    vocabulaire: L => tr(`# Vocabulaire\n${L.mots.map(m => `« ${m} »`).join(', ')}\nJeton spécial : « (début) », utilisé quand il n'y a pas encore de mot avant.`,
      `# Vocabulary\n${L.mots.map(m => `"${m}"`).join(', ')}\nSpecial token: "(start)", used when there is no word before yet.`),
    indiceRegles: () => tr('Une liste numérotée. Une règle par ligne, formulée concrètement avec les mots (familles de mots, ordre, paires fixes, combinaisons, interdits...).',
      'A numbered list. One rule per line, stated concretely with the words (word families, order, fixed pairs, combinations, forbidden pairs...).'),
    consigne: () => consigneBloc(),
  },
  lireBloc: (L, texte) => lireBloc(L, texte),
  evaluer: (L, bloc) => evaluerVraiesRegles(L, bloc),
  affirmations: (L, bloc) => verifierAffirmations(L, bloc),
  phrase: (L, l) => phraseRegle(L, l),
};

if (typeof module !== 'undefined') module.exports = { TAILLES, creerHasard, genererLangue, motsPossibles, MODES, NOMS_FAMILLES, LONGUEUR_PHRASE };
