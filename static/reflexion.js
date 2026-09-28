'use strict';
// =====================================================================
//  RÉFLEXION (le « système 2 ») : le cerveau s'observe avec l'explicateur, doute, repère ses raccourcis,
//  puis agit tout seul, en écrivant ses raisons. Deux façons de faire face à l'inconnu :
//   - prudent   : il ne devine plus ce qu'il n'a jamais vu, il l'évite ;
//   - empirique : il l'essaie dans le monde, observe le vrai résultat, apprend de ses surprises et se répare.
//  L'intuition (le réseau) s'entraîne toujours normalement : la réflexion n'agit que quand on la lance.
// =====================================================================

// Un texte calculé tout de suite dans les deux langues (pour le film, qui peut changer de langue plus tard).
function enDeuxLangues(f) {
  const avant = LANGUE_UI;
  LANGUE_UI = 'fr'; const fr = f();
  LANGUE_UI = 'en'; const en = f();
  LANGUE_UI = avant;
  return { fr, en };
}

const nomSituation = (L, a, b) => `${L.nomsJetons[a]} ${L.symboleCase || '+'} ${L.nomsJetons[b]}`;
const pourcent = x => Math.round(x * 100) + ' %';

// ---------- 1. S'observer : ce qu'il regarde, ce qu'il n'a jamais vu, ses doutes ----------
function reflechir(labo, g) {
  const L = labo.L, sit = situationsExplicateur(labo), base = memo(labo, g).base;
  const regard = regardCerveau(labo, g), pensees = [];
  const jamais = [], hesite = [];
  sit.forEach((c, i) => {
    const s = meilleure(base[i]), x = { a: c.m2, b: c.m1, s, sur: base[i][s], jamaisVu: !!c.jamaisVu };
    if (c.jamaisVu) jamais.push(x);
    else if (confiance(c, base[i]) < 0.6) hesite.push(x);
  });
  const nom = r => (r === 'A' ? L.entree.longA : L.entree.longB);

  pensees.push(`👁️ ${tr('Pour décider, je regarde', 'To decide, I look at')} ${phraseRegard(L, regard)}.`);

  // Un raccourci ? Tout ce que j'ai vu s'explique-t-il avec une seule des deux choses ?
  const seul = role => {
    const reponse = new Map();
    for (const c of labo.contextes) {
      const k = role === 'A' ? c.m2 : c.m1, r = [...c.permis].sort().join(',');
      if (reponse.has(k) && reponse.get(k) !== r) return false;
      reponse.set(k, r);
    }
    return true;
  };
  const raccourci = seul('A') ? 'A' : seul('B') ? 'B' : null;
  if (raccourci) pensees.push(`⚠️ ${tr(`Tout ce que j'ai vu s'explique avec <b>${nom(raccourci)}</b> seul. C'est peut-être un raccourci : la vraie règle pourrait aussi dépendre de ${nom(raccourci === 'A' ? 'B' : 'A')}.`,
    `Everything I saw can be explained with <b>${nom(raccourci)}</b> alone. It may be a shortcut: the real rule could also depend on ${nom(raccourci === 'A' ? 'B' : 'A')}.`)}`);
  const fort = regard.A >= regard.B ? 'A' : 'B';
  if (Math.max(regard.A, regard.B) >= 0.8) pensees.push(`⚠️ ${tr(`Je décide presque uniquement avec ${nom(fort)} (${pourcent(regard[fort])}). Si ${nom(fort === 'A' ? 'B' : 'A')} compte aussi, je me trompe.`,
    `I decide almost only with ${nom(fort)} (${pourcent(regard[fort])}). If ${nom(fort === 'A' ? 'B' : 'A')} matters too, I am wrong.`)}`);

  // Ce que je n'ai jamais vu, et où je suis trop sûr de moi
  const tropSur = jamais.filter(x => x.sur >= 0.8);
  if (jamais.length) pensees.push(`❓ ${tr(`Je n'ai jamais vu <b>${jamais.length}</b> situations sur ${sit.length}.`, `I have never seen <b>${jamais.length}</b> situations out of ${sit.length}.`)}` +
    (tropSur.length ? ' ' + tr(`Pourtant, je suis sûr de moi (plus de 80 %) sur ${tropSur.length} d'entre elles : je ne fais que deviner, c'est dangereux.`,
      `Yet I am sure of myself (over 80 %) on ${tropSur.length} of them: I am only guessing, that is dangerous.`) : ''));
  if (hesite.length) pensees.push(`🤏 ${tr(`J'hésite encore sur ${hesite.length} situation${hesite.length > 1 ? 's' : ''} que j'ai pourtant vue${hesite.length > 1 ? 's' : ''}`, `I still hesitate on ${hesite.length} situation${hesite.length > 1 ? 's' : ''} I did see`)}${tr(' : ', ': ')}${hesite.slice(0, 4).map(x => nomSituation(L, x.a, x.b)).join(', ')}${hesite.length > 4 ? ' …' : ''}.`);

  // Ma conclusion
  // Un piège seulement s'il reste plusieurs situations jamais vues où il devine avec trop d'assurance
  const piege = jamais.length >= 3 && (raccourci || tropSur.length > jamais.length / 2);
  pensees.push(piege
    ? `🐺 <b>${tr("Conclusion : je suis peut-être tombé dans un piège. Je suis parfait sur ce que j'ai vu, mais je devine le reste avec trop d'assurance. Je ne dois plus deviner : soit je me méfie (prudent), soit j'essaie (empirique).",
      'Conclusion: I may have fallen into a trap. I am perfect on what I saw, but I guess the rest too confidently. I must stop guessing: either I am careful (cautious), or I try (empirical).')}</b>`
    : jamais.length ? `🤔 ${tr("Conclusion : il y a des situations que je n'ai jamais vues. Je peux m'en méfier (prudent) ou les essayer (empirique).", 'Conclusion: there are situations I have never seen. I can be wary of them (cautious) or try them (empirical).')}`
      : hesite.length ? `🤔 ${tr("Conclusion : j'ai tout vu, mais je n'ai pas encore tout compris. L'entraînement doit continuer.", 'Conclusion: I have seen everything, but I have not understood it all yet. Training must go on.')}`
        : `🙂 ${tr("Conclusion : j'ai vu toutes les situations et je les réussis. Je peux faire confiance à ce que j'ai appris.", 'Conclusion: I have seen every situation and I get them right. I can trust what I learned.')}`);

  return { pensees, jamais, piege };
}

// ---------- 2. Choisir quoi essayer ----------
// Les essais les plus utiles : des situations jamais vues, d'abord celles où il est le plus sûr de lui (si c'est un raccourci,
// c'est là qu'il le découvrira), en variant les concepts pour couvrir le plus de cas avec peu d'essais.
function choisirEssais(labo, g, jamais, max = 6) {
  const concepts = conceptsCerveau(labo, g);
  const groupe = (role, t) => { const c = concepts.find(x => x.role === role && x.membres.includes(t)); return c ? c.cle : t; };
  const candidats = jamais.slice().sort((x, y) => y.sur - x.sur);
  const pris = [], cases = new Set(), lignes = new Set(), colonnes = new Set();
  for (const passe of [0, 1]) for (const x of candidats) {
    if (pris.length >= max) break;
    if (pris.includes(x)) continue;
    const ca = groupe('A', x.a), cb = groupe('B', x.b), cle = ca + '|' + cb;
    if (cases.has(cle)) continue;
    if (passe === 0 && (lignes.has(ca) || colonnes.has(cb))) continue;   // d'abord des essais tous différents
    pris.push(x); cases.add(cle); lignes.add(ca); colonnes.add(cb);
  }
  return pris;
}

// ---------- 3. Se réparer avec une raison, et vérifier ----------
// Après une correction : d'abord régler les poids ; si ça ne suffit pas, faire pousser un neurone exprès et vérifier
// qu'il répare vraiment quelque chose (sinon le retirer) ; enfin, retirer les neurones devenus inutiles.
function reparationGuidee(labo, intro = []) {
  const L = labo.L, lignes = intro.slice(), dit = f => lignes.push(enDeuxLangues(f));
  const erreurs = g => aRevoir(labo, g);
  const points = g => memo(labo, g).score;
  const liste = cs => phraseParReponse(L, cs.map(c => [c.m2, c.m1, [...c.permis][0]]));
  const caches = g => [...g.noeuds].filter(id => labo.estCache(id));
  let g = labo.champion, err = erreurs(g);

  if (!err.length) dit(() => `✅ ${tr('Je réussis déjà tout ce que je connais : rien à réparer.', 'I already get right everything I know: nothing to repair.')}`);
  else {
    const n0 = err.length;
    dit(() => `🔍 ${tr(`Je me trompe ou j'hésite encore sur ${n0} situation${n0 > 1 ? 's' : ''} que je connais`, `I am still wrong or hesitating on ${n0} situation${n0 > 1 ? 's' : ''} I know`)} ${liste(err)}`);
    // 1. D'abord, simplement régler mes poids
    const g1 = labo.cloner(g);
    labo.apprendre(g1, 60); labo.evaluer(g1);
    const e1 = erreurs(g1), gagne = err.length - e1.length;
    if (g1.fitness > g.fitness) { g = g1; err = e1; }
    dit(() => `🔧 ${tr("D'abord, je règle simplement mes poids", 'First, I simply tune my weights')}${tr(' : ', ': ')}` +
      (gagne > 0 ? tr(`${gagne} situation${gagne > 1 ? 's' : ''} réparée${gagne > 1 ? 's' : ''}.`, `${gagne} situation${gagne > 1 ? 's' : ''} repaired.`) : tr('ça ne suffit pas.', 'that is not enough.')));
    // 2. Si mes liens ne suffisent pas : un neurone exprès, puis vérification.
    // Il insiste tant qu'il progresse (jusqu'à 8 neurones), et abandonne après 2 échecs de suite.
    for (let essai = 0, echecs = 0; essai < 8 && echecs < 2 && err.length; essai++) {
      const cible = err.slice(), g2 = labo.cloner(g);
      const id = labo.neuroneCible(g2, enDeuxLangues(() => tr(`Neurone N${labo.prochainNoeud} créé exprès par la réflexion`, `Neuron N${labo.prochainNoeud} created on purpose by reflection`)));
      labo.apprendre(g2, Math.min(600, 150 + 8 * cible.length)); labo.evaluer(g2);   // plus il y a à réparer, plus il s'entraîne
      const e2 = erreurs(g2), repare = cible.filter(c => !e2.includes(c)), ex = expliquerNeurone(labo, g2, id);
      if (repare.length && ex.perte >= 0.5 && g2.fitness > g.fitness) {
        dit(() => `🌱 ${tr(`Mes liens ne suffisent pas : je fais pousser <b>N${id}</b> exprès pour`, `My links are not enough: I grow <b>N${id}</b> on purpose for`)} ${liste(cible)}. ` +
          `<b class="bon">✓</b> ${tr(`Vérification : il ${phraseRoles(labo, ex, 1)}, et répare ${repare.length} situation${repare.length > 1 ? 's' : ''}. Je le garde.`, `Check: it ${phraseRoles(labo, ex, 1)}, and repairs ${repare.length} situation${repare.length > 1 ? 's' : ''}. I keep it.`)}`);
        g = g2; err = e2; echecs = 0;
      } else {
        echecs++;
        dit(() => `🌱 ${tr(`J'essaie un neurone <b>N${id}</b> pour`, `I try a neuron <b>N${id}</b> for`)} ${liste(cible)}. <b class="ko">✗</b> ${tr("Vérification : il n'a rien réparé. Je le retire.", 'Check: it repaired nothing. I remove it.')}`);
      }
    }
  }
  // 3. Ménage : les neurones devenus inutiles
  let retires = 0;
  for (const id of caches(g)) {
    if (retires >= 3) break;
    const ex = expliquerNeurone(labo, g, id);
    if (ex.perte >= 0.2) continue;
    const g3 = labo.cloner(g);
    labo.retirerNeuroneChoisi(g3, id, enDeuxLangues(() => tr(`Neurone N${id} retiré par la réflexion : il ne servait plus à rien`, `Neuron N${id} removed by reflection: it was no longer useful`)));
    labo.apprendre(g3, 30); labo.evaluer(g3);
    if (points(g3) >= points(g) - 0.3 && erreurs(g3).length <= err.length) {
      const perte = Math.max(0, ex.perte);
      dit(() => `✂️ ${tr(`<b>N${id}</b> ne servait presque plus à rien (sans lui : −${perte.toFixed(1)} pt) : je le retire, cerveau plus simple.`, `<b>N${id}</b> was almost useless (without it: −${perte.toFixed(1)} pt): I remove it, simpler brain.`)}`);
      g = g3; err = erreurs(g3); retires++;
    }
  }
  const reste = err.length;
  dit(() => reste
    ? `🤔 ${tr(`Il me reste ${reste} erreur${reste > 1 ? 's' : ''} : l'entraînement normal pourra continuer à chercher.`, `${reste} mistake${reste > 1 ? 's' : ''} left: normal training can keep searching.`)}`
    : `✅ ${tr('Je réussis maintenant tout ce que je connais, sans hésiter.', 'I now get right everything I know, without hesitating.')}`);
  if (g !== labo.champion) labo.installer(g);
  labo.photo(g, { reflexion: lignes, heritier: true });
  return lignes;
}

// Erreurs sur ce qu'il a appris (vu ou vécu)
function erreursConnues(labo, g) {
  const base = memo(labo, g).base, index = new Map(situationsExplicateur(labo).map((c, i) => [c, i]));
  return labo.contextes.filter(c => !estJuste(c, base[index.get(c)]));
}

// Une situation jamais vue ni vécue : en mode prudent, il n'y touche pas.
function estInconnu(labo, a, b) {
  if (!labo.prudence) return false;
  if (!labo.inconnus || labo.inconnus.version !== labo.versionDonnees)
    labo.inconnus = { version: labo.versionDonnees, cles: new Set(situationsExplicateur(labo).filter(c => c.jamaisVu).map(c => c.m2 * labo.L.nbJetons + c.m1)) };
  return labo.inconnus.cles.has(a * labo.L.nbJetons + b);
}

// ---------- 4. Mode prudent : il ne devine plus, il évite ----------
// Renvoie des « tours » : { titre, lignes } (textes dans les deux langues).
function reflexionPrudente(labo, monde) {
  const L = labo.L, tours = exercer(labo);
  labo.prudence = true;
  labo.inconnus = null;
  const n = situationsExplicateur(labo).filter(c => c.jamaisVu).length;
  tours.push({ titre: enDeuxLangues(() => `🛡️ ${tr('Prudence face à l\'inconnu', 'Caution with the unknown')}`), lignes: [enDeuxLangues(() => n
    ? `🛡️ ${tr(`Je n'ai jamais vu <b>${n}</b> situations. Je ne devine plus : je les marque « je ne sais pas »`, `I have never seen <b>${n}</b> situations. I stop guessing: I mark them "I don't know"`)}${monde.prudence ? ' ' + monde.prudence() : ''}. ` +
      tr("Je ne me tromperai plus sur elles… mais je n'apprendrai rien de nouveau tant que je ne les essaie pas.", "I will no longer be wrong about them… but I will learn nothing new until I try them.")
    : `🙂 ${tr("J'ai vu toutes les situations : rien d'inconnu à craindre.", 'I have seen every situation: nothing unknown to fear.')}`)] });
  tours.push(deductions(labo, monde));
  return tours;
}

// ---------- 5. Mode empirique : il essaie, observe, apprend de ses surprises ----------
// Chaque tour : il choisit quelques situations jamais vues, les essaie dans le monde, compare avec ce qu'il prévoyait,
// apprend le vrai résultat et se répare (réparation guidée). Il s'arrête quand ses prédictions sont confirmées
// deux tours de suite, ou quand il n'y a plus rien d'inconnu.
function reflexionEmpirique(labo, monde, maxTours = 8) {
  const L = labo.L, tours = exercer(labo);
  labo.prudence = false;
  let calme = 0, essaisTotal = 0, surprisesTotal = 0;
  for (let tour = 1; tour <= maxTours; tour++) {
    const g = labo.champion, base = memo(labo, g).base, jamais = [];
    situationsExplicateur(labo).forEach((c, i) => { if (c.jamaisVu) { const s = meilleure(base[i]); jamais.push({ a: c.m2, b: c.m1, s, sur: base[i][s] }); } });
    if (!jamais.length) break;
    const essais = choisirEssais(labo, g, jamais), reste = jamais.length;
    const intro = [enDeuxLangues(() => `🧪 ${tr(`J'essaie ${essais.length} situations que je n'ai jamais vues (il en reste ${reste}).`, `I try ${essais.length} situations I have never seen (${reste} left).`)}`)];
    let surprises = 0;
    for (const x of essais) {
      const vraies = [...L.permis(x.a, x.b)], ok = vraies.includes(x.s);
      if (!ok) surprises++;
      intro.push(enDeuxLangues(() => `${ok ? '<b class="bon">✓</b>' : '<b class="ko">✗</b>'} ${monde.verbeEssai()} <b>${nomSituation(L, x.a, x.b)}</b>${tr(' : ', ': ')}` +
        `${tr('je prévoyais', 'I expected')} « ${L.sorties[x.s]} » (${pourcent(x.sur)}) → ${tr('résultat', 'result')} « ${vraies.map(s => L.sorties[s]).join(' / ')} »` +
        (ok ? tr(' — confirmé.', ' — confirmed.') : tr(' — <b>surprise !</b>', ' — <b>surprise!</b>'))));
    }
    essaisTotal += essais.length; surprisesTotal += surprises;
    labo.corriger(essais.map(x => [x.a, x.b, [...L.permis(x.a, x.b)]]), null, { a: -1, b: -1, experiences: true });
    const lignes = reparationGuidee(labo, intro);
    calme = surprises ? 0 : calme + 1;
    const s = surprises;
    tours.push({ titre: enDeuxLangues(() => `🧪 ${tr('Tour', 'Round')} ${tour} · ${s ? tr(`${s} surprise${s > 1 ? 's' : ''} sur ${essais.length}`, `${s} surprise${s > 1 ? 's' : ''} out of ${essais.length}`) : tr('tout était prévu', 'everything was expected')}`), lignes });
    if (calme >= 2) break;
  }
  const reste = situationsExplicateur(labo).filter(c => c.jamaisVu).length;
  tours.push({ titre: enDeuxLangues(() => `📊 ${tr('Bilan', 'Summary')}`), lignes: [enDeuxLangues(() =>
    `📊 ${tr(`${essaisTotal} essais, ${surprisesTotal} surprise${surprisesTotal > 1 ? 's' : ''}.`, `${essaisTotal} tries, ${surprisesTotal} surprise${surprisesTotal > 1 ? 's' : ''}.`)} ` +
    (!essaisTotal ? tr("Il n'y avait rien d'inconnu à essayer.", 'There was nothing unknown to try.')
      : calme >= 2 ? tr(`Mes deux derniers tours n'ont donné aucune surprise : je pense avoir compris la règle. Il reste ${reste} situations jamais essayées, que je prédis maintenant avec ce que j'ai appris.`,
        `My last two rounds gave no surprise: I think I have understood the rule. ${reste} situations are still untried, which I now predict with what I learned.`)
        : reste ? tr(`J'ai encore des surprises : il reste ${reste} situations jamais essayées. Relance-moi pour continuer.`, `I still get surprises: ${reste} situations are still untried. Run me again to go on.`)
          : tr("J'ai tout essayé : il ne reste plus rien d'inconnu.", 'I have tried everything: nothing unknown is left.')))] });
  tours.push(deductions(labo, monde));
  return tours;
}

// Ce qu'il connaît mal : les situations vues (ou vécues) où il se trompe, ou hésite (moins de 60 % sur les bonnes réponses).
function aRevoir(labo, g) {
  const base = memo(labo, g).base, index = new Map(situationsExplicateur(labo).map((c, i) => [c, i]));
  return labo.contextes.filter(c => { const p = base[index.get(c)]; return !estJuste(c, p) || confiance(c, p) < 0.6; });
}

// ---------- S'exercer : sur ce qu'il connaît, jusqu'à le comprendre (ou jusqu'à ne plus progresser) ----------
function exercer(labo, maxTours = 6) {
  const tours = [];
  for (let k = 1; k <= maxTours; k++) {
    const avant = aRevoir(labo, labo.champion).length;
    if (!avant) break;
    const lignes = reparationGuidee(labo);
    const apres = aRevoir(labo, labo.champion).length;
    tours.push({ titre: enDeuxLangues(() => `🏋️ ${tr("Je m'exerce sur ce que je connais", 'I practise on what I know')} · ${tr('tour', 'round')} ${k} · ${avant} → ${apres} ${tr('situations à revoir', 'situations to review')}`), lignes });
    if (apres >= avant) {
      lignes.push(enDeuxLangues(() => `🤔 ${tr("Je ne progresse plus en m'exerçant seul : l'entraînement normal prendra le relais.", 'I no longer progress by practising alone: normal training will take over.')}`));
      break;
    }
  }
  return tours;
}

// ---------- Ses déductions : ses concepts, et les règles qu'il en tire ----------
function deductions(labo, monde) {
  const L = labo.L, g = labo.champion, lignes = [];
  const concepts = conceptsCerveau(labo, g);
  lignes.push(enDeuxLangues(() => concepts.length
    ? `💡 ${tr('Mes concepts (ce que je traite pareil)', 'My concepts (what I treat the same)')}${tr(' : ', ': ')}${concepts.map(c => phraseConcept(L, c)).join(' · ')}`
    : `💡 ${tr('Je ne traite encore aucun élément pareil : pas de concept.', 'I do not treat any elements the same yet: no concept.')}`));
  const bloc = monde.lireBloc(L, reglesDuCerveau(labo, g, monde)) || [];
  lignes.push(enDeuxLangues(() => bloc.length
    ? `💡 ${tr(`J'en déduis ${bloc.length} règle${bloc.length > 1 ? 's' : ''}`, `I deduce ${bloc.length} rule${bloc.length > 1 ? 's' : ''}`)}${tr(' :', ':')}<ul>${bloc.map(l => `<li>${monde.phrase(L, l)}</li>`).join('')}</ul>${tr('Tu peux les vérifier dans « Ce que le cerveau a compris ».', 'You can check them in « What the brain understood ».')}`
    : `💡 ${tr("Je n'en déduis pas encore de règle claire.", 'I cannot deduce a clear rule yet.')}`));
  return { titre: enDeuxLangues(() => `💡 ${tr('Ce que j\'en déduis', 'What I deduce')}`), lignes };
}
