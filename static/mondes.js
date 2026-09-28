'use strict';
// =====================================================================
//  MONDES : ce que le cerveau apprend. Chaque monde fabrique un « L » de la même forme,
//  ce qui permet au cerveau, aux dessins, au film et à la vérification de marcher partout.
//
//   nbJetons, nomsJetons            les choses que le cerveau peut lire (mots, types, couleurs, formes…)
//   sorties                         ses réponses possibles (une sortie du cerveau par réponse)
//   entree                          { courtA, courtB, longA, longB, resumeA, resumeB } : les deux choses qu'il lit
//   jetonsA, jetonsB                les jetons possibles en A et en B
//   contextes                       [{ m2: a, m1: b, total, comptes: Map(réponse → nb), permis: Set(bonnes réponses) }]
//   permis(a, b)                    Set des bonnes réponses dans cette situation
//   descriptions()                  les vraies règles, en phrases (dans la langue de l'interface)
//   couleurJeton(t, voir), couleurSortie(s, voir)   couleur d'affichage (ou null)
//   testDepart                      [a, b] : la situation montrée au départ dans « Tester le cerveau »
// =====================================================================

const langueUI = () => (typeof LANGUE_UI !== 'undefined' ? LANGUE_UI : 'fr');

// Les noms existent en français et en anglais ; L.nomsJetons, L.sorties et L.entree suivent la langue choisie.
function nommer(L, noms) {
  L.nomsEn = l => noms.jetons[l] || noms.jetons.fr;
  L.sortiesEn = l => noms.sorties[l] || noms.sorties.fr;
  L.entreeEn = l => noms.entree[l] || noms.entree.fr;
  Object.defineProperty(L, 'nomsJetons', { get: () => L.nomsEn(langueUI()), configurable: true });
  Object.defineProperty(L, 'sorties', { get: () => L.sortiesEn(langueUI()), configurable: true });
  Object.defineProperty(L, 'entree', { get: () => L.entreeEn(langueUI()), configurable: true });
}

// ---------- Mondes « table » : pour chaque couple (a, b), une seule bonne réponse ----------
// Chaque situation est montrée plusieurs fois au cerveau, toujours avec la même réponse.
function remplirTable(L, reponse, repetitions = 12) {
  L.reponse = reponse;
  L.contextes = [];
  for (const a of L.jetonsA) for (const b of L.jetonsB) {
    const s = reponse(a, b);
    L.contextes.push({ m2: a, m1: b, total: repetitions, comptes: new Map([[s, repetitions]]), permis: new Set([s]) });
  }
  L.permis = (a, b) => new Set([reponse(a, b)]);
  L.descriptions = () => L.regles.map(r => r.texte(langueUI()));
}

// Lit les lignes « MOT-CLÉ: gauche -> droite » de la réponse de l'IA.
// motsCles : { MOTCLE: indice de la réponse }. Chaque ligne donne toutes les cases (a, b) de gauche × droite.
function lireBlocTable(L, texte, motsCles) {
  const index = new Map();
  for (const l of ['fr', 'en']) L.nomsEn(l).forEach((n, i) => index.set(n.toLowerCase(), i));
  const cles = Object.keys(motsCles).sort((a, b) => b.length - a.length).join('|');
  const re = new RegExp(`^(${cles})\\s*:\\s*(.*)$`, 'i');
  const jetons = (s, permis) => {
    if (/(^|\s)\*(\s|$)/.test(s)) return permis.slice();
    return s.toLowerCase().replace(/[«»"'`,;.()]/g, ' ').split(/\s+/).filter(m => index.has(m)).map(m => index.get(m)).filter(t => permis.includes(t));
  };
  const lignes = [];
  for (const brut of texte.split('\n')) {
    const m = brut.replace(/^[\s>*\-`]+/, '').match(re);
    if (!m) continue;
    const [g, d] = m[2].split(/->|→|=>/);
    const gauche = jetons(g || '', L.jetonsA), droite = jetons(d || '', L.jetonsB);
    const s = motsCles[m[1].toUpperCase()];
    const cases = [];
    for (const a of gauche) for (const b of droite) cases.push([a, b, s]);
    if (cases.length) lignes.push({ type: m[1].toUpperCase(), texte: brut.trim().replace(/`/g, ''), gauche, droite, reponse: s, cases });
  }
  return lignes.length ? lignes : null;
}

// La table devinée par l'IA : ce qu'elle a écrit, et la réponse par défaut pour le reste.
function tableIA(L, bloc) {
  const dite = new Map();
  for (const l of bloc) for (const [a, b, s] of l.cases) dite.set(a * L.nbJetons + b, s);
  return (a, b) => (dite.has(a * L.nbJetons + b) ? dite.get(a * L.nbJetons + b) : L.parDefaut);
}

const noteTable = f => (f >= 0.999 ? 'ok' : f >= 0.5 ? 'moitie' : 'rate');

// Chaque vraie règle : les cases qu'elle décide sont-elles justes dans la table de l'IA ?
function evaluerTable(L, bloc) {
  const ia = tableIA(L, bloc);
  const nomCase = (a, b) => `${L.nomsJetons[a]} ${L.symboleCase || '→'} ${L.nomsJetons[b]}`;
  return L.regles.map(r => {
    // Pour une règle « par défaut », seules comptent ses cases. Pour les autres, on compte aussi les cases
    // où l'IA a mis quelque chose de spécial alors que la vraie réponse est la réponse par défaut.
    const cases = r.cases.filter(([a, b]) => r.toutes || L.reponse(a, b) !== L.parDefaut || ia(a, b) !== L.parDefaut);
    if (!cases.length) return { verdict: 'ok', detail: '' };
    const fausses = cases.filter(([a, b]) => ia(a, b) !== L.reponse(a, b));
    const f = 1 - fausses.length / cases.length;
    const detail = fausses.length
      ? tr(`${cases.length - fausses.length} case${cases.length - fausses.length > 1 ? 's' : ''} juste${cases.length - fausses.length > 1 ? 's' : ''} sur ${cases.length}`,
        `${cases.length - fausses.length} of ${cases.length} cells right`) + ' · ' +
        fausses.slice(0, 3).map(([a, b]) => `${nomCase(a, b)}${tr(' :', ':')} ${tr("l'IA dit", 'AI says')} ${L.sorties[ia(a, b)]}, ${tr('vrai', 'true')} ${L.sorties[L.reponse(a, b)]}`).join(' ; ') +
        (fausses.length > 3 ? ' …' : '')
      : '';
    return { verdict: noteTable(f), detail };
  });
}

// Chaque ligne écrite par l'IA : quelle part de ses cases est juste ?
function affirmationsTable(L, bloc) {
  return bloc.map(l => {
    const p = l.cases.filter(([a, b, s]) => L.reponse(a, b) === s).length / l.cases.length;
    return { texte: l.texte, verdict: p >= 0.999 ? 'vrai' : p >= 0.5 ? 'souvent' : 'faux', part: p };
  });
}

// La comparaison case par case : vraie réponse dans chaque case, en vert si l'IA a juste, en rouge sinon.
function grilleComparaison(L, bloc, qui = tr('IA', 'AI')) {
  const ia = tableIA(L, bloc);
  let justes = 0;
  const lignes = L.jetonsA.map(a => `<tr><th style="color:${L.couleurJeton(a, true) || 'inherit'}">${L.nomsJetons[a]}</th>` + L.jetonsB.map(b => {
    const vrai = L.reponse(a, b), dit = ia(a, b), ok = vrai === dit;
    if (ok) justes++;
    return `<td class="${ok ? 'juste' : 'faux'}" title="${tr('vrai', 'true')} : ${L.sorties[vrai]} · ${qui} : ${L.sorties[dit]}">${L.symbole(vrai)}${ok ? '' : `<small>${L.symbole(dit)}</small>`}</td>`;
  }).join('') + '</tr>').join('');
  const total = L.jetonsA.length * L.jetonsB.length;
  return `<h3>${tr('La table case par case', 'The table, cell by cell')} · ${justes} / ${total} ${tr('cases justes', 'cells right')}</h3>
    <p class="aide">${tr(`Lignes : ${L.entree.longA}. Colonnes : ${L.entree.longB}. Chaque case montre la vraie réponse ; en rouge, une erreur (sa réponse en petit).`,
      `Rows: ${L.entree.longA}. Columns: ${L.entree.longB}. Each cell shows the true answer; in red, a mistake (its answer in small).`)}</p>
    <div class="grille-defile"><table class="grille"><tr><th></th>${L.jetonsB.map(b => `<th style="color:${L.couleurJeton(b, true) || 'inherit'}">${L.nomsJetons[b]}</th>`).join('')}</tr>${lignes}</table></div>`;
}

// ---------- Le piège « loup dans la neige » ----------
// On n'entraîne le cerveau que sur une partie des situations, choisies pour qu'un raccourci explique tout.
// Les autres situations existent quand même dans le monde : c'est là qu'on voit s'il a pris le raccourci.
function restreindreEntrainement(L, garder) {
  L.contextesComplets = L.contextes;
  L.contextes = L.contextes.filter(c => garder(c.m2, c.m1));
}

// Le bandeau du piège : combien il juge bien ce qu'il a vu, et ce qu'il n'a jamais vu. L'histoire est dans le « ? ».
function infosPiege(labo, g, L, histoire) {
  const j = justesseCerveau(labo, g), piege = j.jamais[0] < j.jamais[1];
  const texte = tr("Histoire vraie : un réseau de neurones devait reconnaître les loups et les chiens. Il avait presque tout bon… mais il regardait la neige, pas l'animal : sur ses photos d'entraînement, les loups étaient toujours dans la neige. ",
    'True story: a neural network had to tell wolves from dogs. It got almost everything right… but it was looking at the snow, not the animal: in its training photos, wolves were always in the snow. ') +
    histoire + tr(" Pour le corriger : dans « Tester le cerveau », choisis un cas mal jugé (ou « tous ») et clique sur « Apprends-lui ».", ' To correct it: in « Test the brain », pick a case it gets wrong (or « any ») and click « Teach it ».');
  return `<div class="piege">🐺 <b>${tr('Le loup dans la neige', 'The wolf in the snow')}</b> <span class="info" tabindex="0" data-tip="${texte}">?</span><br>` +
    tr(`Situations vues pendant l'entraînement : <b>${j.vus[0]} / ${j.vus[1]}</b> bien jugées · jamais vues : <b class="${piege ? 'ko' : 'bon'}">${j.jamais[0]} / ${j.jamais[1]}</b> bien jugées`,
      `Situations seen in training: <b>${j.vus[0]} / ${j.vus[1]}</b> judged right · never seen: <b class="${piege ? 'ko' : 'bon'}">${j.jamais[0]} / ${j.jamais[1]}</b> judged right`) +
    (piege ? tr("<br>Il a l'air parfait sur ce qu'il a vu… mais il se trompe sur le reste : il a pris un raccourci.", '<br>It looks perfect on what it saw… but it is wrong on the rest: it took a shortcut.') : '') + '</div>';
}
