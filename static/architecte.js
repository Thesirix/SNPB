'use strict';
// =====================================================================
//  L'ARCHITECTE (moteur 3) : il construit ses neurones à partir du sens, comme KBANN
//  (Knowledge-Based Artificial Neural Networks, Towell et Shavlik, 1994) : des règles d'abord,
//  un neurone par règle ensuite, et l'apprentissage ne fait qu'affiner.
//  Ici, les règles ne viennent pas d'un humain : il les tire lui-même des cas qu'il a vus.
//   1. il répertorie tous ses cas ;
//   2. il en tire le sens : des concepts (ce qui se comporte pareil), des règles, des exceptions ;
//   3. il crée un neurone par règle, câblé exprès, et lui apprend à reconnaître ses cas (et seulement eux) ;
//   4. il vérifie que chaque neurone fait bien ce que dit sa règle.
// =====================================================================

function construireParLeSens(labo, monde) {
  const L = labo.L, tours = [], cas = labo.contextes.filter(c => c.total > 0);
  const cleRep = c => [...c.permis].sort((x, y) => x - y).join(',');
  const nom = t => L.nomsJetons[t];
  const sep = L.symboleCase || '+';
  const nomsRep = cle => { const ss = cle.split(',').map(Number); return ss.slice(0, 4).map(s => L.sorties[s]).join(' / ') + (ss.length > 4 ? ` (+${ss.length - 4})` : ''); };

  // ---------- 1. Répertorier ----------
  tours.push({ titre: enDeuxLangues(() => `📋 ${tr('Je répertorie mes cas', 'I list my cases')}`), lignes: [enDeuxLangues(() =>
    `📋 ${tr(`J'ai <b>${cas.length}</b> situations en mémoire (vues pendant l'entraînement, corrigées ou essayées).`, `I have <b>${cas.length}</b> situations in memory (seen in training, corrected or tried).`)}`)] });

  // ---------- 2. Le sens : concepts, règles, exceptions ----------
  // Deux éléments forment un concept s'ils donnent les mêmes réponses avec tous les partenaires qu'ils ont en commun.
  const concepts = role => {
    const profils = new Map();
    for (const c of cas) {
      const [t, v] = role === 'A' ? [c.m2, c.m1] : [c.m1, c.m2];
      if (!profils.has(t)) profils.set(t, new Map());
      profils.get(t).set(v, cleRep(c));
    }
    const pareil = (x, y) => {
      let communs = 0;
      for (const [v, r] of profils.get(x)) {
        const r2 = profils.get(y).get(v);
        if (r2 === undefined) continue;
        if (r2 !== r) return false;
        communs++;
      }
      return communs >= 2;
    };
    const groupes = [];
    for (const t of [...profils.keys()].sort((a, b) => a - b)) {
      const g = groupes.find(gr => gr.every(x => pareil(x, t)));
      if (g) g.push(t); else groupes.push([t]);
    }
    return groupes;
  };
  const GA = concepts('A'), GB = concepts('B');
  const gA = new Map(), gB = new Map();
  GA.forEach((g, i) => g.forEach(t => gA.set(t, i)));
  GB.forEach((g, j) => g.forEach(t => gB.set(t, j)));

  // La réponse la plus fréquente : ce sera la réponse « par défaut » (pas besoin de neurone pour elle)
  const frequence = new Map();
  for (const c of cas) frequence.set(cleRep(c), (frequence.get(cleRep(c)) || 0) + 1);
  const defaut = [...frequence].sort((x, y) => y[1] - x[1])[0][0];

  // Majorité de chaque bloc (concept de A × concept de B)
  const blocs = new Map();
  for (const c of cas) {
    const k = gA.get(c.m2) + ',' + gB.get(c.m1);
    if (!blocs.has(k)) blocs.set(k, new Map());
    const m = blocs.get(k);
    m.set(cleRep(c), (m.get(cleRep(c)) || 0) + 1);
  }
  const majorite = k => [...blocs.get(k)].sort((x, y) => y[1] - x[1])[0][0];

  // Les règles. Si toute une colonne (un concept de B) a la même réponse quel que soit A, une seule règle « tout + B ».
  const regles = [];
  GB.forEach((gb, j) => {
    const ks = GA.map((_, i) => i + ',' + j).filter(k => blocs.has(k));
    if (!ks.length) return;
    const reps = new Set(ks.map(majorite));
    if (reps.size === 1 && ks.length > 1) { const rep = majorite(ks[0]); if (rep !== defaut) regles.push({ A: null, B: gb, rep }); return; }
    for (const k of ks) { const rep = majorite(k); if (rep !== defaut) regles.push({ A: GA[Number(k.split(',')[0])], B: gb, rep }); }
  });
  const couvre = (r, c) => (r.A === null || r.A.includes(c.m2)) && r.B.includes(c.m1);
  const attendu = c => { const r = regles.find(x => couvre(x, c)); return r ? r.rep : defaut; };
  const exceptions = cas.filter(c => cleRep(c) !== attendu(c)).map(c => ({ A: [c.m2], B: [c.m1], rep: cleRep(c), exception: true }));
  const toutes = regles.concat(exceptions);
  const phraseRegle = r => `${r.A === null ? tr('tout', 'any') : r.A.map(nom).join(', ')} ${sep} ${r.B.map(nom).join(', ')} → <b>${nomsRep(r.rep)}</b>`;

  const lignesSens = [];
  for (const [G, long] of [[GA, () => L.entree.longA], [GB, () => L.entree.longB]]) {
    const grands = G.filter(g => g.length > 1);
    if (grands.length) lignesSens.push(enDeuxLangues(() => `💡 ${tr('Concepts', 'Concepts')} (${long()})${tr(' : ', ': ')}${grands.map(g => `(${g.map(nom).join(', ')})`).join(' · ')} — ${tr('ils donnent toujours les mêmes réponses', 'they always give the same answers')}.`));
  }
  lignesSens.push(enDeuxLangues(() => `💡 ${tr('Réponse la plus fréquente, ma réponse par défaut', 'Most frequent answer, my default answer')}${tr(' : ', ': ')}« ${nomsRep(defaut)} ».`));
  lignesSens.push(enDeuxLangues(() => `💡 ${tr(`J'en tire ${regles.length} règle${regles.length > 1 ? 's' : ''} et ${exceptions.length} exception${exceptions.length > 1 ? 's' : ''}.`, `I draw ${regles.length} rule${regles.length > 1 ? 's' : ''} and ${exceptions.length} exception${exceptions.length > 1 ? 's' : ''}.`)}`));
  tours.push({ titre: enDeuxLangues(() => `💡 ${tr("Le sens que j'en tire", 'The meaning I draw from them')}`), lignes: lignesSens });

  // ---------- 3. Construire : un neurone par règle, câblé exprès, puis affiné ----------
  const avant = labo.champion, scoreAvant = memo(labo, avant).score, nAvant = avant.nbCaches;
  const K = toutes.length, S = labo.nbSorties, nb = L.nbJetons, h = labo.h;
  const ids = toutes.map(() => labo.prochainNoeud++);
  const cible = (k, c) => (couvre(toutes[k], c) && (toutes[k].exception || !exceptions.some(e => couvre(e, c))) ? 1 : -1);
  const cibles = cas.map(c => toutes.map((_, k) => cible(k, c)));
  // Les poids de départ viennent du sens : chaque neurone pousse vers les réponses de sa règle
  const E = Float64Array.from({ length: nb * DIM }, () => h.gauss() * 0.3);
  const W1 = toutes.map(() => Float64Array.from({ length: BIAIS + 1 }, () => h.gauss() * 0.5));
  const W2 = Array.from({ length: S }, (_, s) => Float64Array.from(toutes, r => (r.rep.split(',').map(Number).includes(s) ? (r.exception ? 4 : 3) : -1.5)));
  const b2 = Float64Array.from({ length: S }, (_, s) => (defaut.split(',').map(Number).includes(s) ? 1.5 : -1.5));
  apprendreParLeSens(labo, cas, cibles, E, W1, W2, b2);

  const lignesConstruction = toutes.map((r, k) => enDeuxLangues(() => r.exception
    ? `🧩 ${tr(`Je crée <b>N${ids[k]}</b> pour une exception`, `I create <b>N${ids[k]}</b> for an exception`)}${tr(' : ', ': ')}${phraseRegle(r)}.`
    : `🧩 ${tr(`Je crée <b>N${ids[k]}</b> parce que`, `I create <b>N${ids[k]}</b> because`)} ${phraseRegle(r)} (${cas.filter(c => cible(k, c) > 0).length} ${tr('cas', 'cases')}).`));
  if (!K) lignesConstruction.push(enDeuxLangues(() => `🧩 ${tr("Tous mes cas donnent la même réponse : je n'ai besoin d'aucun neurone.", 'All my cases give the same answer: I need no neuron.')}`));
  tours.push({ titre: enDeuxLangues(() => `🧩 ${tr(`Je construis ${K} neurone${K > 1 ? 's' : ''}, un par règle`, `I build ${K} neuron${K > 1 ? 's' : ''}, one per rule`)}`), lignes: lignesConstruction });

  // Le nouveau cerveau
  const g = { id: labo.prochainId++, noeuds: new Set(), conns: [], plong: E, histoire: [], nouveaux: [], ne: labo.generation, lignee: [], espece: avant.espece, sens: new Map() };
  for (let i = 0; i < PREMIERE_SORTIE + S; i++) g.noeuds.add(i);
  for (let s = 0; s < S; s++) g.conns.push({ innov: labo.innovation(BIAIS, PREMIERE_SORTIE + s), de: BIAIS, vers: PREMIERE_SORTIE + s, poids: b2[s], actif: true });
  toutes.forEach((r, k) => {
    const id = ids[k];
    g.noeuds.add(id);
    for (let e = 0; e <= BIAIS; e++) g.conns.push({ innov: labo.innovation(e, id), de: e, vers: id, poids: W1[k][e], actif: true });
    for (let s = 0; s < S; s++) g.conns.push({ innov: labo.innovation(id, PREMIERE_SORTIE + s), de: id, vers: PREMIERE_SORTIE + s, poids: W2[s][k], actif: true });
    const texte = enDeuxLangues(() => phraseRegle(r) + (r.exception ? tr(' (exception)', ' (exception)') : ''));
    g.sens.set(id, texte);
    g.histoire.push({ type: 'neurone+', noeud: id, gen: labo.generation, guide: true, texte: enDeuxLangues(() => `${tr(`Neurone N${id} construit par l'Architecte`, `Neuron N${id} built by the Architect`)}${tr(' : ', ': ')}${phraseRegle(r)}`) });
  });
  g.conns.sort((a, b) => a.innov - b.innov);
  labo.evaluer(g);

  // ---------- 4. Vérifier : chaque neurone fait-il ce que dit sa règle ? ----------
  const prog = labo.compiler(g), v = new Float64Array(prog.taille), p = new Float64Array(S);
  const bons = toutes.map(() => 0);
  cas.forEach((c, n) => {
    labo.propager(g, prog, c.m2, c.m1, v, p);
    toutes.forEach((_, k) => { if ((v[prog.idx.get(ids[k])] > 0) === (cibles[n][k] > 0)) bons[k]++; });
  });
  const lignesVerif = toutes.map((r, k) => {
    const ok = bons[k] >= cas.length * 0.95, faux = cas.length - bons[k];
    return enDeuxLangues(() => ok
      ? `<b class="bon">✓</b> <b>N${ids[k]}</b> ${tr("s'allume sur les cas de sa règle, et seulement eux.", 'switches on for the cases of its rule, and only them.')}`
      : `<b class="ko">✗</b> <b>N${ids[k]}</b> ${tr(`se trompe sur ${faux} cas : ma carte en 3D n'arrive pas à séparer ces éléments.`, `is wrong on ${faux} cases: my 3D map cannot separate these elements.`)}`);
  });
  const scoreApres = memo(labo, g).score, reste = situationsExplicateur(labo).filter(c => c.jamaisVu).length;
  lignesVerif.push(enDeuxLangues(() => `📊 ${tr('Avant (cerveau de l\'Évolution)', 'Before (Evolution brain)')}${tr(' : ', ': ')}${scoreAvant.toFixed(1)} %, ${nAvant} ${tr('neurones au sens mesuré après coup', 'neurons with a meaning measured afterwards')}. ` +
    `${tr('Maintenant (construit par le sens)', 'Now (built from meaning)')}${tr(' : ', ': ')}<b>${scoreApres.toFixed(1)} %</b>, ${K} ${tr('neurones, chacun né avec sa règle', 'neurons, each born with its rule')}.`));
  if (reste) lignesVerif.push(enDeuxLangues(() => `🔮 ${tr(`Pour les ${reste} situations que je n'ai jamais vues, j'applique mes règles : leurs concepts décident à ma place.`, `For the ${reste} situations I have never seen, I apply my rules: their concepts decide for me.`)}`));
  tours.push({ titre: enDeuxLangues(() => `✅ ${tr('Je vérifie chaque neurone', 'I check each neuron')}`), lignes: lignesVerif });

  labo.installer(g);
  labo.photo(g, { reflexion: tours.flatMap(t => t.lignes), heritier: true, architecte: true, especeAvant: avant.espece });
  tours.push(deductions(labo, monde));
  return tours;
}

// Affinage : un petit réseau à une couche (entrées → neurones-règles → réponses). En plus de bien répondre,
// chaque neurone doit s'allumer (+1) sur les cas de sa règle et s'éteindre (−1) ailleurs : on lui apprend son sens.
function apprendreParLeSens(labo, cas, cibles, E, W1, W2, b2, tours = 800, pas = 0.08, poidsSens = 1) {
  const S = W2.length, K = W1.length, n = cas.length;
  const x = new Float64Array(BIAIS + 1), hk = new Float64Array(K), z = new Float64Array(S), dh = new Float64Array(K);
  for (let t = 0; t < tours; t++) {
    const gE = new Float64Array(E.length), gW1 = W1.map(w => new Float64Array(w.length)), gW2 = W2.map(w => new Float64Array(w.length)), gb2 = new Float64Array(S);
    cas.forEach((c, i) => {
      for (let d = 0; d < DIM; d++) { x[d] = E[c.m2 * DIM + d]; x[DIM + d] = E[c.m1 * DIM + d]; }
      x[BIAIS] = 1;
      for (let k = 0; k < K; k++) { let s = 0; for (let e = 0; e <= BIAIS; e++) s += W1[k][e] * x[e]; hk[k] = Math.tanh(s); }
      let mx = -Infinity;
      for (let s = 0; s < S; s++) { let v = b2[s]; for (let k = 0; k < K; k++) v += W2[s][k] * hk[k]; z[s] = v; mx = Math.max(mx, v); }
      let tot = 0;
      for (let s = 0; s < S; s++) { z[s] = Math.exp(z[s] - mx); tot += z[s]; }
      dh.fill(0);
      for (let s = 0; s < S; s++) {
        const ds = z[s] / tot - (c.comptes.get(s) || 0) / c.total;
        gb2[s] += ds;
        for (let k = 0; k < K; k++) { gW2[s][k] += ds * hk[k]; dh[k] += ds * W2[s][k]; }
      }
      for (let k = 0; k < K; k++) {
        const d = (dh[k] + poidsSens * 2 * (hk[k] - cibles[i][k])) * (1 - hk[k] * hk[k]);
        for (let e = 0; e <= BIAIS; e++) gW1[k][e] += d * x[e];
        for (let dd = 0; dd < DIM; dd++) { gE[c.m2 * DIM + dd] += d * W1[k][dd]; gE[c.m1 * DIM + dd] += d * W1[k][DIM + dd]; }
      }
    });
    const f = pas / n, borne = w => Math.max(-8, Math.min(8, w));
    for (let s = 0; s < S; s++) { b2[s] = borne(b2[s] - f * gb2[s] * 4); for (let k = 0; k < K; k++) W2[s][k] = borne(W2[s][k] - f * gW2[s][k] * 4); }
    for (let k = 0; k < K; k++) for (let e = 0; e <= BIAIS; e++) W1[k][e] = borne(W1[k][e] - f * gW1[k][e] * 4);
    for (let q = 0; q < E.length; q++) E[q] = Math.max(-1, Math.min(1, E[q] - f * gE[q] * 2));
  }
}
