'use strict';
// =====================================================================
//  ANALYSE : prépare le dossier envoyé à l'IA d'audit.
//  Elle ne reçoit que l'intérieur du cerveau, jamais les exemples ni les règles.
// =====================================================================

// Le monde fournit sa tâche, son vocabulaire, l'indice pour les règles et le format du bloc de vérification.
function construirePrompt(labo, g, avecPredictions, monde) {
  const L = labo.L, P = monde.prompt, E = L.entree;
  const nom = t => L.nomsJetons[t];
  const pct = x => Math.round(x * 100) + ' %';
  const caches = [...g.noeuds].filter(id => labo.estCache(id)).sort((a, b) => a - b);
  const lignes = [];

  lignes.push(tr(`Tu es chercheur en interprétabilité. On a fait grandir un tout petit réseau de neurones évolutif (NEAT : sa forme évolue par mutations au hasard + sélection, et ses poids sont affinés par descente de gradient). ${P.tache(L)}

Tu ne vois PAS les exemples d'entraînement, seulement l'intérieur du réseau. Ta mission : expliquer ce que fait chaque neurone, puis retrouver les règles secrètes.`,
  `You are an interpretability researcher. We grew a tiny evolving neural network (NEAT: its shape evolves through random mutations + selection, and its weights are fine-tuned by gradient descent). ${P.tache(L)}

You do NOT see the training examples, only the inside of the network. Your mission: explain what each neuron does, then recover the secret rules.`));

  lignes.push('\n' + P.vocabulaire(L));

  lignes.push(tr(`
# Comment le réseau calcule
- 6 entrées : x, y et z de la position du ${E.longA} (${E.courtA}), x, y et z de la position du ${E.longB} (${E.courtB}), plus un biais constant = 1.
- Neurones cachés : tanh(somme des entrées × poids), valeur entre -1 et 1.
- Une sortie par réponse possible (${L.sorties.join(', ')}) : somme des entrées × poids, puis softmax pour obtenir des probabilités.`,
  `
# How the network computes
- 6 inputs: x, y and z of the position of the ${E.longA} (${E.courtA}), x, y and z of the position of the ${E.longB} (${E.courtB}), plus a constant bias = 1.
- Hidden neurons: tanh(sum of inputs × weights), value between -1 and 1.
- One output per possible answer (${L.sorties.join(', ')}): sum of inputs × weights, then softmax to get probabilities.`));

  lignes.push(tr('\n# Carte apprise (coordonnées x, y, z entre -1 et 1)', '\n# Learned map (x, y, z coordinates between -1 and 1)'));
  for (let t = 0; t < L.nbJetons; t++) lignes.push(`${nom(t)} : (${[...g.plong.subarray(t * DIM, t * DIM + DIM)].map(v => v.toFixed(2)).join(', ')})`);

  lignes.push(tr('\n# Liens actifs (de → vers : poids)', '\n# Active links (from → to: weight)'));
  for (const c of g.conns) if (c.actif) lignes.push(`${labo.nomNoeud(c.de)} → ${labo.nomNoeud(c.vers)} : ${c.poids.toFixed(2)}`);

  if (caches.length) {
    lignes.push(tr(`\n# Activation de chaque neurone caché dans chaque situation rencontrée (${E.courtA}, ${E.courtB} : valeur)`,
      `\n# Activation of each hidden neuron in each situation seen (${E.courtA}, ${E.courtB}: value)`));
    for (const id of caches) {
      const profil = labo.profilNeurone(g, id);
      lignes.push(`\n## N${id}`);
      lignes.push(profil.map(p => `${nom(p.m2)}, ${nom(p.m1)} : ${p.valeur.toFixed(2)}`).join(' | '));
    }
  } else {
    lignes.push(tr("\n# Neurones cachés\nAucun : le réseau n'en a pas eu besoin (ou pas encore). Tout passe par des liens directs.",
      '\n# Hidden neurons\nNone: the network did not need any (or not yet). Everything goes through direct links.'));
  }

  if (avecPredictions) {
    lignes.push(tr(`\n# Prédictions du réseau (${E.courtA}, ${E.courtB} → réponses probables, au-dessus de 5 %)`,
      `\n# Network predictions (${E.courtA}, ${E.courtB} → likely answers, above 5 %)`));
    const prog = labo.compiler(g);
    for (const c of labo.contextes) {
      const { probas } = labo.activer(g, c.m2, c.m1, prog);
      const top = probas.map((p, m) => [m, p]).filter(([, p]) => p >= 0.05).sort((a, b) => b[1] - a[1]);
      lignes.push(`${nom(c.m2)}, ${nom(c.m1)} → ${top.map(([m, p]) => `${L.sorties[m]} ${pct(p)}`).join(', ')}`);
    }
  }

  lignes.push(tr('\n# Histoire de la construction (mutations gardées par la sélection, de la plus ancienne à la plus récente)',
    '\n# Construction history (mutations kept by selection, oldest to newest)'));
  const hist = g.histoire.filter(e => e.type !== 'lien+' || e.scoreApres > e.scoreAvant).slice(-60);
  for (const e of hist) {
    const avant = e.scoreAvant !== undefined ? pct(e.scoreAvant / labo.scoreMax) : '?';
    const apres = e.scoreApres !== undefined ? pct(e.scoreApres / labo.scoreMax) : '?';
    lignes.push(`${tr('Génération', 'Generation')} ${e.gen} : ${txt(e.texte)} (score ${avant} → ${apres})`);
  }
  lignes.push(tr(`Score final : ${pct(g.score / labo.scoreMax)} du score d'un cerveau qui connaîtrait parfaitement les règles.`,
    `Final score: ${pct(g.score / labo.scoreMax)} of the score of a brain that knew the rules perfectly.`));

  lignes.push(tr(`
# Ce que je te demande
Réponds en français, avec des phrases simples, en utilisant exactement ces titres :

## 1. Ce que fait chaque neurone caché
Pour chaque neurone : le « concept » qu'il détecte, en une ou deux phrases, avec les noms concernés. S'il n'y en a pas, explique ce que font les liens directs importants.

## 2. Pourquoi le cerveau a cette forme
Explique les choix de construction visibles dans l'histoire : quels neurones ont été créés ou détruits, et ce que ça a apporté.

## 3. Règles devinées
${P.indiceRegles()}

## 4. Confiance
Pour chaque règle devinée : sûr, probable ou hypothèse.

`, `
# What I am asking you
Answer in English, with simple sentences, using exactly these headings:

## 1. What each hidden neuron does
For each neuron: the "concept" it detects, in one or two sentences, with the names involved. If there are none, explain what the important direct links do.

## 2. Why the brain has this shape
Explain the construction choices visible in the history: which neurons were created or destroyed, and what that brought.

## 3. Guessed rules
${P.indiceRegles()}

## 4. Confidence
For each guessed rule: sure, likely or hypothesis.

`) + P.consigne());
  return lignes.join('\n');
}

// Les titres de la réponse : « ## 3. Règles devinées », ou « 3. Règles devinées » quand le copier-coller a perdu les #.
const TITRE_SECTION = /^\s*(?:#{1,4}\s*)?(\d)[.)]?\s+(Ce que fait|Pourquoi le cerveau|Règles devinées|Regles devinees|Confiance|Bloc pour|What each|Why the brain|Guessed rules|Confidence|Block for)/i;

// Petit rendu Markdown (titres, listes, gras) — suffisant pour le rapport. Le bloc de vérification n'est pas affiché.
function markdownVersHtml(md) {
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const enLigne = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
  const out = [];
  let liste = null, dansBloc = false;
  const fermer = () => { if (liste) { out.push(`</${liste}>`); liste = null; } };
  for (const brut of md.split('\n')) {
    const l = brut.trimEnd();
    let m;
    if (/DEBUT-REGLES|BEGIN-RULES/.test(l)) { dansBloc = true; continue; }
    if (/FIN-REGLES|END-RULES/.test(l)) { dansBloc = false; continue; }
    if (dansBloc || /^\s*```/.test(l) || /Bloc pour la vérification|Block for automatic/i.test(l)) continue;
    if (TITRE_SECTION.test(l) || (m = l.match(/^#{1,4}\s+(.*)/))) { fermer(); out.push(`<h3>${enLigne(m ? m[1] : l.replace(/^\s*#*\s*/, ''))}</h3>`); }
    else if ((m = l.match(/^\s*[-*]\s+(.*)/))) { if (liste !== 'ul') { fermer(); out.push('<ul>'); liste = 'ul'; } out.push(`<li>${enLigne(m[1])}</li>`); }
    else if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))) { if (liste !== 'ol') { fermer(); out.push('<ol>'); liste = 'ol'; } out.push(`<li>${enLigne(m[1])}</li>`); }
    else if (!l.trim()) fermer();
    else { fermer(); out.push(`<p>${enLigne(l)}</p>`); }
  }
  fermer();
  return out.join('\n');
}

// Isole la section « Règles devinées » (entre le titre 3 et le titre suivant).
function extraireRegles(md) {
  const lignes = md.split('\n');
  const debut = lignes.findIndex(l => { const m = l.match(TITRE_SECTION); return m && m[1] === '3'; });
  if (debut < 0) return '';
  let fin = lignes.findIndex((l, i) => i > debut && TITRE_SECTION.test(l));
  if (fin < 0) fin = lignes.length;
  return lignes.slice(debut + 1, fin).join('\n').trim();
}
