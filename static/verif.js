'use strict';
// =====================================================================
//  VÉRIFICATION : compare les règles devinées par l'IA avec les vraies.
//  L'IA termine sa réponse par un petit bloc aux lignes normalisées
//  (FAMILLE:, DEBUT:, APRES:, PAIRE:, COMBO:, COMBO_FAMILLE:, INTERDIT:).
// =====================================================================

// Consigne ajoutée à la fin du texte envoyé à l'IA.
function consigneBloc() {
  return tr(`## 5. Bloc pour la vérification automatique
Recopie tes règles dans ce format exact, entre une ligne DEBUT-REGLES et une ligne FIN-REGLES. Une règle par ligne, seulement des mots du vocabulaire, sans guillemets :
FAMILLE: mot mot mot        (un groupe de mots qui se comportent pareil ; une ligne par famille)
DEBUT: mot mot mot          (les mots qui peuvent commencer une phrase)
APRES: mot mot -> mot mot   (après n'importe lequel des mots de gauche viennent seulement les mots de droite)
PAIRE: mot -> mot           (après ce mot vient toujours ce mot)
COMBO: mot mot -> mot       (après ces deux mots, dans cet ordre, vient toujours ce mot)
COMBO_FAMILLE: mot          (si les deux mots précédents sont de la même famille, vient toujours ce mot)
INTERDIT: mot -> mot        (le mot de droite ne vient jamais juste après celui de gauche)`, `## 5. Block for automatic checking
Copy your rules in this exact format, between a line BEGIN-RULES and a line END-RULES. One rule per line, only words from the vocabulary, no quotes:
FAMILY: word word word        (a group of words that behave the same; one line per family)
START: word word word         (the words that can start a sentence)
AFTER: word word -> word word (after any of the left words, only the right words can come)
PAIR: word -> word            (after this word always comes this word)
COMBO: word word -> word      (after these two words, in this order, always comes this word)
COMBO_FAMILY: word            (if the two previous words are from the same family, this word always comes)
FORBIDDEN: word -> word       (the right word never comes right after the left one)`);
}

// Mots-clés acceptés (français ou anglais) -> type interne.
const MOTS_CLES = { FAMILLE: 'FAMILLE', FAMILY: 'FAMILLE', DEBUT: 'DEBUT', START: 'DEBUT', APRES: 'APRES', AFTER: 'APRES', PAIRE: 'PAIRE', PAIR: 'PAIRE',
  COMBO_FAMILLE: 'COMBO_FAMILLE', COMBO_FAMILY: 'COMBO_FAMILLE', COMBO: 'COMBO', INTERDIT: 'INTERDIT', FORBIDDEN: 'INTERDIT' };

// Lit le bloc dans la réponse de l'IA. Renvoie null s'il n'y en a pas.
function lireBloc(L, texte) {
  const index = new Map(L.mots.map((m, i) => [m.toLowerCase(), i]));
  const mots = s => s.toLowerCase().replace(/[«»"'`*,;.()]/g, ' ').split(/\s+/).filter(m => index.has(m)).map(m => index.get(m));
  const lignes = [];
  for (const brut of texte.split('\n')) {
    const m = brut.replace(/^[\s>*\-`]+/, '').match(/^(COMBO_FAMILLE|COMBO_FAMILY|FAMILLE|FAMILY|DEBUT|DÉBUT|START|APRES|APRÈS|AFTER|PAIRE|PAIR|COMBO|INTERDIT|FORBIDDEN)\s*:\s*(.*)$/i);
    if (!m) continue;
    const type = MOTS_CLES[m[1].toUpperCase().replace('É', 'E').replace('È', 'E')];
    const [g, dr] = m[2].split(/->|→|=>/);
    const ligne = { type, texte: brut.trim().replace(/`/g, ''), gauche: mots(g || ''), droite: mots(dr || '') };
    if (ligne.gauche.length || ligne.droite.length) lignes.push(ligne);
  }
  return lignes.length ? lignes : null;
}

const egal = (a, b) => a.size === b.size && [...a].every(x => b.has(x));
const jaccard = (a, b) => {
  const inter = [...a].filter(x => b.has(x)).length;
  return a.size + b.size - inter ? inter / (a.size + b.size - inter) : 1;
};
const note = (x, bon = 0.95, moyen = 0.5) => x >= bon ? 'ok' : x >= moyen ? 'moitie' : 'rate';

// Pour chaque vraie règle (dans l'ordre de L.descriptions) : trouvée (ok), à moitié (moitie) ou ratée (rate).
function evaluerVraiesRegles(L, bloc) {
  const q = m => tr(`« ${L.mots[m]} »`, `"${L.mots[m]}"`);
  const de = type => bloc.filter(l => l.type === type);
  const res = [];

  // 1. Les familles : chaque vraie famille est comparée au groupe de l'IA qui lui ressemble le plus.
  const famIA = de('FAMILLE').map(l => new Set(l.gauche));
  const detailsFam = [], scores = [];
  L.familles.forEach((f, g) => {
    const vraie = new Set(f);
    let meilleur = null, s = 0;
    for (const fi of famIA) { const j = jaccard(vraie, fi); if (j > s) { s = j; meilleur = fi; } }
    scores.push(s);
    const icone = { ok: '✅', moitie: '🟡', rate: '❌' }[note(s)];
    let d = `${NOMS_FAMILLES[g]} ${icone}`;
    if (meilleur && s < 1) {
      const manque = f.filter(m => !meilleur.has(m)), trop = [...meilleur].filter(m => !vraie.has(m));
      d += ` (${[manque.length ? tr('manque ', 'missing ') + manque.map(q).join(', ') : '', trop.length ? tr('en trop ', 'extra ') + trop.map(q).join(', ') : ''].filter(Boolean).join(' ; ')})`;
    }
    detailsFam.push(d);
  });
  const moyFam = scores.reduce((a, b) => a + b, 0) / scores.length;
  res.push({ verdict: famIA.length ? note(Math.min(...scores) === 1 ? 1 : moyFam, 1, 0.6) : 'rate',
    detail: famIA.length ? detailsFam.join(' · ') + (famIA.length !== L.familles.length ? tr(` — l'IA a fait ${famIA.length} familles au lieu de ${L.familles.length}`, ` — the AI made ${famIA.length} families instead of ${L.familles.length}`) : '') : tr('aucune famille donnée', 'no family given') });

  // 2. Le début des phrases
  const vraiDebut = new Set(motsPossibles(L, L.mots.length, L.mots.length));
  const debutIA = new Set(de('DEBUT').flatMap(l => l.gauche.concat(l.droite)));
  const sDebut = debutIA.size ? jaccard(vraiDebut, debutIA) : 0;
  res.push({ verdict: note(sDebut), detail: debutIA.size ? `${tr("l'IA dit", 'the AI says')} : ${[...debutIA].map(q).join(', ')}` : tr('pas trouvé', 'not found') });

  // 3. Ce qui peut suivre chaque famille (on ignore les mots qui ont une paire fixe ou un interdit : ils suivent leurs propres règles)
  const speciaux = new Set(L.regles.flatMap(r => r.type === 'paire' ? [r.si] : r.type === 'interdit' ? [r.apres] : []));
  const suiteIA = new Map();
  for (const l of de('APRES')) for (const u of l.gauche) {
    if (!suiteIA.has(u)) suiteIA.set(u, new Set());
    l.droite.forEach(v => suiteIA.get(u).add(v));
  }
  // Les mots imposés par une combinaison peuvent aussi apparaître après : l'IA ne se trompe pas si elle les ajoute.
  const cibleCombo = new Set(L.regles.flatMap(r => r.type.startsWith('combo') ? r.alors : []));
  const sansCombo = (ia, vrai) => new Set([...ia].filter(m => vrai.has(m) || !cibleCombo.has(m)));
  const ecartListe = (vrai, ia) => {
    const manque = [...vrai].filter(m => !ia.has(m)), trop = [...ia].filter(m => !vrai.has(m));
    return [manque.length ? tr('manque ', 'missing ') + manque.map(q).join(', ') : '', trop.length ? tr('en trop ', 'extra ') + trop.map(q).join(', ') : ''].filter(Boolean).join(' ; ');
  };
  const evalFamille = g => {
    const vrai = new Set(baseTransition(L, L.familles[g][0]));
    const mots = L.familles[g].filter(u => !speciaux.has(u));
    const ecarts = [];
    const s = mots.map(u => {
      if (!suiteIA.has(u)) return 0;
      const ia = sansCombo(suiteIA.get(u), vrai), j = jaccard(vrai, ia);
      if (j < 1) ecarts.push(`${tr('après', 'after')} ${q(u)} : ${ecartListe(vrai, ia)}`);
      return j;
    });
    const trouves = s.filter(x => x >= 0.95).length, total = s.length;
    const sansAvis = mots.filter(u => !suiteIA.has(u)).length;
    const detail = trouves === total ? '' : [tr(`bonne liste pour ${trouves} mot${trouves > 1 ? 's' : ''} sur ${total}`, `right list for ${trouves} of ${total} words`),
      sansAvis ? tr(`rien dit pour ${sansAvis} mot${sansAvis > 1 ? 's' : ''}`, `nothing said for ${sansAvis} word${sansAvis > 1 ? 's' : ''}`) : '', ecarts[0] || ''].filter(Boolean).join(' · ');
    return { score: s.length ? s.reduce((a, b) => a + b, 0) / s.length : 1, trouves, total, detail };
  };
  if (L.mode === 'normal') {
    const e = L.familles.map((_, g) => evalFamille(g));
    const moy = e.reduce((a, x) => a + x.score, 0) / e.length;
    res.push({ verdict: note(moy), detail: e.map(x => x.detail).filter(Boolean).join(' · ') });
  } else {
    L.transitions.forEach((_, g) => {
      const e = evalFamille(g);
      res.push({ verdict: note(e.score), detail: suiteIA.size ? e.detail : tr('pas trouvé', 'not found') });
    });
  }

  // 4. Les règles spéciales
  const combos = de('COMBO'), paires = de('PAIRE'), interdits = de('INTERDIT');
  for (const r of L.regles) {
    const alors = new Set(r.alors || []);
    if (r.type === 'combo_famille') {
      const dit = de('COMBO_FAMILLE').flatMap(l => l.gauche.concat(l.droite));
      const cas = combos.filter(l => l.gauche.length === 2 && L.familleDe[l.gauche[0]] === L.familleDe[l.gauche[1]] && l.droite.some(m => alors.has(m)));
      if (dit.some(m => alors.has(m))) res.push({ verdict: 'ok', detail: '' });
      else if (cas.length) res.push({ verdict: 'moitie', detail: tr(`l'IA a vu ${cas.length} cas précis, mais pas la règle générale`, `the AI saw ${cas.length} specific cases, but not the general rule`) });
      else res.push({ verdict: 'rate', detail: dit.length ? `${tr("l'IA dit", 'the AI says')} ${dit.map(q).join(', ')}` : tr('pas trouvé', 'not found') });
    }
    if (r.type === 'combo_mots') {
      const l = combos.find(c => c.gauche[0] === r.si2 && c.gauche[1] === r.si1);
      if (l && egal(new Set(l.droite), alors)) res.push({ verdict: 'ok', detail: '' });
      else if (l) res.push({ verdict: 'moitie', detail: tr(`bonne situation, mais l'IA dit ${l.droite.map(q).join(', ')}`, `right situation, but the AI says ${l.droite.map(q).join(', ')}`) });
      else if (paires.some(p => p.gauche[0] === r.si1 && p.droite.some(m => alors.has(m)))) res.push({ verdict: 'moitie', detail: tr(`l'IA a vu ${q(r.si1)} → ${[...alors].map(q).join(', ')}, sans le mot d'avant`, `the AI saw ${q(r.si1)} → ${[...alors].map(q).join(', ')}, without the word before`) });
      else res.push({ verdict: 'rate', detail: tr('pas trouvé', 'not found') });
    }
    if (r.type === 'paire') {
      const l = paires.find(p => p.gauche[0] === r.si) || de('APRES').find(p => p.gauche.length === 1 && p.gauche[0] === r.si);
      if (l && egal(sansCombo(new Set(l.droite), alors), alors)) res.push({ verdict: 'ok', detail: '' });
      else if (l && l.droite.some(m => alors.has(m))) res.push({ verdict: 'moitie', detail: `${tr("l'IA dit", 'the AI says')} ${l.droite.map(q).join(', ')}` });
      else res.push({ verdict: 'rate', detail: tr('pas trouvé', 'not found') });
    }
    if (r.type === 'interdit') {
      if (interdits.some(l => l.gauche[0] === r.apres && l.droite.includes(r.jamais))) res.push({ verdict: 'ok', detail: '' });
      else if (suiteIA.has(r.apres) && !suiteIA.get(r.apres).has(r.jamais) && [...suiteIA.get(r.apres)].some(m => L.familleDe[m] === L.familleDe[r.jamais]))
        res.push({ verdict: 'moitie', detail: tr(`l'IA l'a retiré de la liste après ${q(r.apres)}, sans le dire comme un interdit`, `the AI removed it from the list after ${q(r.apres)}, without stating it as forbidden`) });
      else res.push({ verdict: 'rate', detail: tr('pas trouvé', 'not found') });
    }
  }
  return res;
}

// Chaque affirmation de l'IA, testée sur la vraie langue (toutes les situations rencontrées).
function verifierAffirmations(L, bloc) {
  const DEBUT = L.mots.length;
  // Les combinaisons passent avant les autres règles : pour tester une règle simple, on ignore les cas où une combinaison s'applique.
  const combo = c => L.regles.some(r =>
    (r.type === 'combo_famille' && c.m2 !== DEBUT && L.familleDe[c.m2] === L.familleDe[c.m1]) ||
    (r.type === 'combo_mots' && c.m2 === r.si2 && c.m1 === r.si1));
  const simples = (L.contextesComplets || L.contextes).filter(c => !combo(c));
  const part = (filtre, test, ctx = simples) => {
    const cas = ctx.filter(filtre);
    return cas.length ? cas.filter(test).length / cas.length : null;
  };
  return bloc.map(l => {
    const G = new Set(l.gauche), D = new Set(l.droite);
    let p = null;
    switch (l.type) {
      case 'FAMILLE': {
        const fams = new Set(l.gauche.map(m => L.familleDe[m]));
        p = fams.size === 1 ? 1 : 0;
        break;
      }
      case 'DEBUT': p = egal(new Set(motsPossibles(L, DEBUT, DEBUT)), new Set(l.gauche.concat(l.droite))) ? 1 : 0; break;
      case 'APRES': p = part(c => G.has(c.m1), c => [...c.permis].every(m => D.has(m))); break;
      case 'PAIRE': p = part(c => G.has(c.m1), c => egal(c.permis, D)); break;
      case 'COMBO': p = l.gauche.length === 2 ? part(c => c.m2 === l.gauche[0] && c.m1 === l.gauche[1], c => egal(c.permis, D), (L.contextesComplets || L.contextes)) : 0; break;
      case 'COMBO_FAMILLE': {
        const cible = new Set(l.gauche.concat(l.droite));
        p = part(c => c.m2 !== DEBUT && L.familleDe[c.m2] === L.familleDe[c.m1], c => egal(c.permis, cible), (L.contextesComplets || L.contextes));
        break;
      }
      case 'INTERDIT': p = part(c => G.has(c.m1), c => ![...D].some(m => c.permis.has(m))); break;
    }
    const verdict = p === null ? 'inconnu' : p >= 0.9 ? 'vrai' : p >= 0.5 ? 'souvent' : 'faux';
    return { texte: l.texte, verdict, part: p };
  });
}

// Une ligne du bloc de l'IA, dite avec des phrases.
function phraseRegle(L, l) {
  const q = ids => ids.map(m => `<b>${L.mots[m]}</b>`).join(', ');
  const tout = l.gauche.concat(l.droite);
  switch (l.type) {
    case 'FAMILLE': return tr(`Famille : ${q(tout)}`, `Family: ${q(tout)}`);
    case 'DEBUT': return tr(`Une phrase commence par ${q(tout)}`, `A sentence starts with ${q(tout)}`);
    case 'APRES': return tr(`Après ${q(l.gauche)} → seulement ${q(l.droite)}`, `After ${q(l.gauche)} → only ${q(l.droite)}`);
    case 'PAIRE': return tr(`Après ${q(l.gauche)} → toujours ${q(l.droite)}`, `After ${q(l.gauche)} → always ${q(l.droite)}`);
    case 'COMBO': return tr(`${q(l.gauche.slice(0, 1))} puis ${q(l.gauche.slice(1))} → toujours ${q(l.droite)}`, `${q(l.gauche.slice(0, 1))} then ${q(l.gauche.slice(1))} → always ${q(l.droite)}`);
    case 'COMBO_FAMILLE': return tr(`Deux mots de la même famille à la suite → toujours ${q(tout)}`, `Two words of the same family in a row → always ${q(tout)}`);
    case 'INTERDIT': return tr(`Jamais ${q(l.droite)} juste après ${q(l.gauche)}`, `Never ${q(l.droite)} right after ${q(l.gauche)}`);
  }
  return l.texte;
}
