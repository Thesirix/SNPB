'use strict';
// =====================================================================
//  FILM : revoir la croissance du cerveau image par image.
//  Pour chaque image : ce que le hasard a tenté, et pourquoi la sélection l'a gardé.
// =====================================================================

const film = { index: null, lecture: null };   // index null = en direct

const cerveauAffiche = () => film.index === null || !labo.album[film.index] ? labo.champion : labo.album[film.index];

const ICONES = { 'neurone+': '🌱', 'neurone-': '✂️', mort: '🍂', 'lien+': '➕', 'lien-': '➖' };

// Pourquoi ce changement est resté : le hasard propose, la sélection garde ce qui marche.
function raisonEvenement(labo, e) {
  if (e.guide) return tr('Décidé par la réflexion (Chercheur ou Architecte), pas par le hasard : sa raison est écrite dans le film.', 'Decided by reflection (Researcher or Architect), not by chance: its reason is written in the film.');
  const gain = ((e.scoreApres ?? 0) - (e.scoreAvant ?? e.scoreApres ?? 0)) / labo.scoreMax * 100;
  const g = `${gain >= 0 ? '+' : ''}${gain.toFixed(1)} pt`;
  const aide = gain > 0.05;
  const garde = `<b class="bon">${tr('Gardé', 'Kept')}</b>`;
  const espece = tr(`Le score a baissé (${g}), mais ce cerveau a survécu grâce à son espèce.`, `The score dropped (${g}), but this brain survived thanks to its species.`);
  switch (e.type) {
    case 'neurone+':
      return tr('Le hasard a coupé ce lien en deux et mis un neurone au milieu. ', 'Chance cut this link in two and put a neuron in the middle. ') + (aide
        ? tr(`${garde} : le cerveau prédit mieux avec lui (${g}).`, `${garde}: the brain predicts better with it (${g}).`)
        : tr(`Il n'a pas aidé tout de suite (${g}). Son espèce le protège le temps que ses poids s'ajustent.`, `It did not help right away (${g}). Its species protects it while its weights adjust.`));
    case 'neurone-':
      return tr('Le hasard a supprimé ce neurone. ', 'Chance deleted this neuron. ') + (gain > -0.2
        ? tr(`${garde} : le cerveau fait presque aussi bien sans lui (${g}) et un neurone de moins coûte moins cher.`, `${garde}: the brain does almost as well without it (${g}) and one neuron less costs less.`)
        : espece);
    case 'mort':
      return tr('Nettoyage automatique : un lien voisin a disparu, ce neurone était isolé et ne servait plus à rien.', 'Automatic cleanup: a nearby link disappeared, this neuron was cut off and useless.');
    case 'lien+':
      return tr('Le hasard a ajouté ce lien. ', 'Chance added this link. ') + (aide ? tr(`${garde} : il aide (${g}).`, `${garde}: it helps (${g}).`) : tr(`Gardé sans gain net (${g}).`, `Kept without a real gain (${g}).`));
    case 'lien-':
      return tr('Le hasard a coupé ce lien. ', 'Chance cut this link. ') + (gain > -0.2 ? tr(`${garde} : il ne servait presque à rien (${g}).`, `${garde}: it was almost useless (${g}).`) : espece);
  }
  return '';
}

// Explication d'une image de l'album, en HTML.
function expliquerImage(labo, i) {
  const album = labo.album, img = album[i], prec = album[i - 1];
  const pct = s => (Math.min(1, s / labo.scoreMax) * 100).toFixed(1) + ' %';
  const ecart = (a, b) => { const d = (b - a) / labo.scoreMax * 100; return `${d >= 0 ? '+' : ''}${d.toFixed(1)} pt`; };
  const nn = img.nbCaches;
  const out = [`<div class="film-titre">${tr('Image', 'Frame')} ${i + 1} / ${album.length} · ${tr('génération', 'generation')} ${img.gen} · score ${pct(img.score)}` +
    `${prec ? ` (${ecart(prec.score, img.score)})` : ''} · ${nn} ${tr('neurone', 'neuron')}${nn > 1 ? 's' : ''}</div>`];
  if (img.avantCorrection) {
    out.push(tr('<p>📸 Le cerveau juste avant ta correction.</p>', '<p>📸 The brain right before your correction.</p>'));
    return out.join('');
  }
  if (!prec) {
    out.push(tr("<p>Le point de départ : aucun neurone, seulement quelques liens tirés au hasard entre ce qu'il lit et sa réponse.</p>",
      '<p>The starting point: no neuron, only a few random links between what it reads and its answer.</p>'));
    return out.join('');
  }
  const plus = [...img.noeuds].filter(id => labo.estCache(id) && !prec.noeuds.has(id));
  const moins = [...prec.noeuds].filter(id => labo.estCache(id) && !img.noeuds.has(id));
  const noms = ids => ids.map(id => 'N' + id).join(', ');

  if (!img.heritier) {
    const diff = [plus.length ? tr(`il a en plus ${noms(plus)}`, `it also has ${noms(plus)}`) : '', moins.length ? tr(`il n'a pas ${noms(moins)}`, `it does not have ${noms(moins)}`) : ''].filter(Boolean).join(', ');
    const gain = (img.score - prec.score) / labo.scoreMax * 100;
    const e = ecart(prec.score, img.score);
    const pourquoi = gain > 0.05 ? tr(`il prédit mieux (${e})`, `it predicts better (${e})`)
      : img.nbCaches < prec.nbCaches || img.nbConns < prec.nbConns ? tr(`il prédit presque pareil (${e}) avec un cerveau plus simple`, `it predicts almost the same (${e}) with a simpler brain`)
      : tr(`il est à peine meilleur une fois le « loyer » des neurones compté (${e})`, `it is barely better once the neurons' "rent" is counted (${e})`);
    const suite = (diff ? tr(` Par rapport à l'ancien, ${diff}.`, ` Compared with the old one, ${diff}.`) : '') + '</p>';
    out.push(img.espece !== img.especeAvant
      ? tr(`<p class="film-autre">⇄ <b>Un cerveau d'une autre espèce prend la tête</b> (espèce ${img.espece}). Il ne descend pas du précédent : il a grandi à part, et ${pourquoi}.${suite}`,
        `<p class="film-autre">⇄ <b>A brain from another species takes the lead</b> (species ${img.espece}). It does not descend from the previous one: it grew apart, and ${pourquoi}.${suite}`)
      : tr(`<p class="film-cousin">↔ <b>Un cousin prend la tête</b> : un cerveau de la même espèce qui ne descend pas directement du précédent (ils ont un ancêtre commun), et ${pourquoi}.${suite}`,
        `<p class="film-cousin">↔ <b>A cousin takes the lead</b>: a brain of the same species that does not directly descend from the previous one (they share an ancestor), and ${pourquoi}.${suite}`));
  }
  if (img.reflexion) out.push(`<div class="film-titre">${img.architecte
    ? `🧩 ${tr("L'Architecte remplace le cerveau par un cerveau construit à partir du sens", 'The Architect replaces the brain with a brain built from meaning')}`
    : `🔬 ${tr('Le Chercheur se répare : ce qu\'il a décidé, et pourquoi', 'The Researcher repairs itself: what it decided, and why')}`}</div><ul class="decisions">${img.reflexion.map(l => `<li>${txt(l)}</li>`).join('')}</ul>`);
  // (les neurones nés ou retirés par la réflexion sont déjà racontés au-dessus)
  out.push(journalDecisions(labo, prec, img, img.reflexion ? [] : plus, img.reflexion ? [] : moins));
  const evts = img.evenements;
  if (evts.length) {
    out.push(`<details><summary>${tr('Détail technique : ce que le hasard a tenté', 'Technical detail: what chance tried')}</summary><ul class="film-evts">` + evts.map(e =>
      `<li><span class="gen">${tr('gén.', 'gen.')} ${e.gen}</span> ${ICONES[e.type] || ''} ${txt(e.texte)}<div class="raison">${raisonEvenement(labo, e)}</div></li>`).join('') + '</ul></details>');
  } else if (img.heritier && !img.correction) {
    out.push(tr('<p class="statut">Pas de mutation de forme : des liens ont été rallumés ou éteints en mélangeant deux parents (croisement).</p>',
      '<p class="statut">No shape mutation: some links were switched on or off by mixing two parents (crossover).</p>'));
  }
  return out.join('');
}

// Le journal de décisions, en mots : chaque neurone né ou mort avec son rôle (mesuré par l'explicateur),
// et ce que le cerveau a appris ou oublié à cette image.
function journalDecisions(labo, prec, img, plus, moins) {
  const L = labo.L, lignes = [];
  const pt = x => x.toFixed(1);
  if (img.correction) lignes.push(`✏️ <b>${tr("Tu m'as corrigé", 'You corrected me')}</b>${tr(' : ', ': ')}${phraseCorrection(L, img.correction)}. ${tr('Je me réentraîne avec cet exemple.', 'I retrain with this example.')}`);
  if (img.correction || img.bilan) {
    // Ce qui a changé dans le rôle des neurones qui existaient déjà
    let n = 0;
    for (const id of img.noeuds) {
      if (n >= (img.bilan ? 8 : 4) || !labo.estCache(id) || !prec.noeuds.has(id)) continue;
      const avant = phraseRoles(labo, expliquerNeurone(labo, prec, id), 1), apres = phraseRoles(labo, expliquerNeurone(labo, img, id), 1);
      if (avant === apres) continue;
      lignes.push(`🔁 <b>N${id}</b>${tr(' : avant, il ', ': before, it ')}${avant}${tr(' ; maintenant, il ', '; now, it ')}${apres}.`);
      n++;
    }
  }
  for (const id of plus) {
    const e = expliquerNeurone(labo, img, id);
    const role = phraseRoles(labo, e, 1);
    lignes.push(img.heritier
      ? `🌱 <b>${tr(`J'essaie un nouveau neurone, N${id}.`, `I try a new neuron, N${id}.`)}</b> ${tr(`Il ${role}.`, `It ${role}.`)} ` + (e.perte >= 0.5
        ? tr(`Sans lui, je perdrais ${pt(e.perte)} pt → <b class="bon">je le garde</b>.`, `Without it, I would lose ${pt(e.perte)} pt → <b class="bon">I keep it</b>.`)
        : tr(`Pour l'instant il ne sert presque à rien (sans lui : −${pt(Math.max(0, e.perte))} pt). Je le garde quand même, le temps que ses poids s'ajustent.`,
          `For now it is almost useless (without it: −${pt(Math.max(0, e.perte))} pt). I keep it anyway, while its weights adjust.`))
      : `🌱 ${tr(`Ce cerveau a <b>N${id}</b>, qui ${role}`, `This brain has <b>N${id}</b>, which ${role}`)} (${tr('sans lui', 'without it')} : −${pt(Math.max(0, e.perte))} pt).`);
  }
  for (const id of moins) {
    const e = expliquerNeurone(labo, prec, id);
    const role = phraseRoles(labo, e, 1);
    lignes.push(img.heritier
      ? `✂️ <b>${tr(`Je retire N${id}.`, `I remove N${id}.`)}</b> ${tr(`Dans le cerveau d'avant, il ${role}.`, `In the previous brain, it ${role}.`)} ` + (e.perte < 0.5
        ? tr(`Sans lui, je ne perdais que ${pt(Math.max(0, e.perte))} pt → <b class="bon">je le retire</b> : même résultat avec un cerveau plus simple.`,
          `Without it, I only lost ${pt(Math.max(0, e.perte))} pt → <b class="bon">I remove it</b>: same result with a simpler brain.`)
        : tr(`Il comptait (−${pt(e.perte)} pt sans lui), mais mes autres neurones ont repris son rôle : je fais ${img.score >= prec.score ? 'aussi bien' : 'presque aussi bien'} sans lui.`,
          `It mattered (−${pt(e.perte)} pt without it), but my other neurons took over its role: I do ${img.score >= prec.score ? 'as well' : 'almost as well'} without it.`))
      : `✂️ ${tr(`Ce cerveau n'a pas <b>N${id}</b>, qui dans l'ancien ${role}.`, `This brain does not have <b>N${id}</b>, which in the old one ${role}.`)}`);
  }
  const { appris, oublie } = differenceCerveaux(labo, prec, img);
  const ra = regardCerveau(labo, prec), rb = regardCerveau(labo, img);
  if (Math.abs(rb.A - ra.A) >= 0.1) {
    const plus = rb.A > ra.A ? L.entree.courtA : L.entree.courtB;
    lignes.push(`👁️ <b>${tr(`Je regarde maintenant plus : ${plus}`, `I now look more at: ${plus}`)}</b> <span class="statut">(${phraseRegard(L, ra)} → ${phraseRegard(L, rb)})</span>`);
  }
  const concepts = differenceConcepts(labo, prec, img);
  for (const c of concepts.nes) lignes.push(`💡 <b>${tr('Nouveau concept', 'New concept')}</b>${tr(' : ', ': ')}${phraseConcept(L, c)} — ${tr('je les traite maintenant pareil', 'I now treat them the same')}.`);
  for (const { c, ajoutes } of concepts.grandis) lignes.push(`💡 <b>${ajoutes.map(t => L.nomsJetons[t]).join(', ')}</b> ${tr(ajoutes.length > 1 ? 'rejoignent le concept' : 'rejoint le concept', ajoutes.length > 1 ? 'join the concept' : 'joins the concept')} ${phraseConcept(L, c)}.`);
  for (const c of concepts.defaits) lignes.push(`💔 ${tr('Concept défait', 'Concept broken up')}${tr(' : ', ': ')}${phraseConcept(L, c)} — ${tr('je ne les traite plus pareil', 'I no longer treat them the same')}.`);
  if (appris.length) lignes.push(`📚 <b>${tr(`J'ai appris ${appris.length} situation${appris.length > 1 ? 's' : ''}`, `I learned ${appris.length} situation${appris.length > 1 ? 's' : ''}`)}</b> ${phraseParReponse(L, appris)}`);
  if (oublie.length) lignes.push(`⚠️ <b>${tr(`Je me trompe maintenant sur ${oublie.length} situation${oublie.length > 1 ? 's' : ''}`, `I am now wrong on ${oublie.length} situation${oublie.length > 1 ? 's' : ''}`)}</b> ${tr('(ma nouvelle réponse)', '(my new answer)')} ${phraseParReponse(L, oublie)}`);
  if (img.heritier) {
    const reglages = phrasesReglages(labo, expliquerReglages(labo, prec, img));
    if (reglages.length) lignes.push(`🔧 <b>${tr('Réglage des poids', 'Weight tuning')}</b>${tr(' : ', ': ')}${reglages.join('<br>')}`);
  }
  if (img.rejets && img.rejets.length) lignes.push(`<details><summary>❌ ${tr(`${img.rejets.length} essai${img.rejets.length > 1 ? 's' : ''} raté${img.rejets.length > 1 ? 's' : ''} depuis l'image d'avant`, `${img.rejets.length} failed attempt${img.rejets.length > 1 ? 's' : ''} since the previous frame`)}</summary><ul class="film-evts">${img.rejets.map(r => `<li>${phraseEssai(labo, r)}</li>`).join('')}</ul></details>`);
  if (!lignes.length) lignes.push(img.score > prec.score + 1e-4
    ? tr('Aucune réponse préférée ne change : je suis juste plus sûr de mes réponses.', 'No preferred answer changes: I am just more confident in my answers.')
    : tr('Aucune réponse ne change : seule la forme du cerveau a bougé.', 'No answer changes: only the shape of the brain moved.'));
  return `<ul class="decisions">${lignes.map(l => `<li>${l}</li>`).join('')}</ul>`;
}

function majFilm() {
  const n = labo.album.length;
  const i = film.index === null ? n - 1 : film.index;
  $('filmCurseur').max = Math.max(0, n - 1);
  $('filmCurseur').value = i;
  $('filmDirect').classList.toggle('principal', film.index === null);
  $('filmLire').textContent = film.lecture ? '⏸ Pause' : tr('▶ Rejouer la croissance', '▶ Replay the growth');
  $('filmPourquoi').innerHTML = n
    ? (film.index === null ? `<div class="statut">${tr('● En direct. Dernier changement de forme :', '● Live. Last shape change:')}</div>` : '') + expliquerImage(labo, i)
    : '';
}

function allerImage(i) {
  film.index = i === null ? null : Math.max(0, Math.min(labo.album.length - 1, i));
  majResumes();
  majEteints();
  majConcepts();
  majNeurone();
  majTest();
  majFilm();
}

function arreterLecture() {
  clearInterval(film.lecture);
  film.lecture = null;
}

function brancherFilm() {
  $('filmCurseur').oninput = () => { arreterLecture(); allerImage(Number($('filmCurseur').value)); };
  $('filmPrec').onclick = () => { arreterLecture(); allerImage((film.index ?? labo.album.length - 1) - 1); };
  $('filmSuiv').onclick = () => { arreterLecture(); if (film.index !== null) allerImage(film.index + 1); };
  $('filmDirect').onclick = () => { arreterLecture(); allerImage(null); };
  $('filmLire').onclick = () => {
    if (film.lecture) { arreterLecture(); majFilm(); return; }
    if (film.index === null || film.index >= labo.album.length - 1) film.index = 0;
    film.lecture = setInterval(() => {
      if (film.index >= labo.album.length - 1) { arreterLecture(); allerImage(null); return; }
      allerImage(film.index + 1);
    }, 1100);
    allerImage(film.index);
  };
}
