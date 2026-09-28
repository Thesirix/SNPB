'use strict';
// =====================================================================
//  APP : relie le monde choisi, le cerveau, les dessins et l'analyse.
// =====================================================================

const $ = id => document.getElementById(id);
const MONDES = { langue: MONDE_LANGUE, combats: MONDE_COMBATS, creature: MONDE_CREATURE };
let monde = MONDE_LANGUE;
let L = null, labo = null;
let enCours = false;
let selection = null;
let ongletJournal = 'histoire';
let reglesRevelees = false;
let texteIA = '';                // dernière réponse de l'IA collée
let blocCerveau = null;          // les règles réécrites par le cerveau : { texte, gen }
let reglesCerveauRevelees = false;
let correctionEnCours = null;    // { image, zone } : une correction est en train d'être apprise
let reflexionCourante = null;    // la dernière réflexion du cerveau (ce qu'il pense de lui-même)
const GENERATIONS_CORRECTION = 150;
let positionsCarte = null;
let positionsNeurones = [];
let vueReseau = creerVueReseau();
let etatPanneau = {};            // état du dessin propre au monde (combats en cours, créature…)
let camCarte = null, camReseau = null;
let derniereMaj = 0;
let derniereGenAffichee = -1;
let resumes = new Map();         // id du neurone -> petit résumé de ce qu'il fait
let importances = new Map();     // id du neurone -> points de score perdus sans lui (sa taille dans le dessin)
let objectif = 0;                // génération à atteindre
let debutSeance = 0;             // génération où la séance d'entraînement a commencé (pour la barre)
let chrono = null;               // { gen, temps } du dernier passage dans la boucle
let tempsParGen = null;          // moyenne glissante, pour le temps restant

// Tempérament : combien un neurone « coûte » au cerveau.
const TEMPERAMENTS = {
  econome: { penaliteNeurone: 0.0005, penaliteConnexion: 0.0003, probaAjoutNeurone: 0.1, probaSupprNeurone: 0.02 },
  equilibre: { penaliteNeurone: 0.0001, penaliteConnexion: 0.00015, probaAjoutNeurone: 0.18, probaSupprNeurone: 0.015 },
  explorateur: { penaliteNeurone: 0, penaliteConnexion: 0.0001, probaAjoutNeurone: 0.25, probaSupprNeurone: 0.01 },
};

const voirFamilles = () => $('voirRegles').checked;
const pct = x => (x * 100).toFixed(1) + ' %';
const options = (obj, choisi) => Object.entries(obj).map(([k, v]) => `<option value="${k}"${k === choisi ? ' selected' : ''}>${v}</option>`).join('');

// ---------- Création ----------
function remplirMenus() {
  const [m, mo, ta] = [$('monde').value || 'langue', $('mode').value, $('taille').value];
  $('monde').innerHTML = options(Object.fromEntries(Object.entries(MONDES).map(([k, v]) => [k, v.nom()])), m);
  const mondeChoisi = MONDES[$('monde').value];
  $('mode').innerHTML = options(mondeChoisi.modes(), mo);
  $('taille').innerHTML = options(mondeChoisi.tailles(), ta);
}

function nouveauMonde() {
  monde = MONDES[$('monde').value];
  $('taille').disabled = !!(monde.sansTaille && monde.sansTaille($('mode').value));
  L = monde.generer($('mode').value, Number($('graine').value) || 1, $('taille').value);
  reglesRevelees = false;
  texteIA = '';
  blocCerveau = null;
  reglesCerveauRevelees = false;
  $('rapport').innerHTML = '';
  $('rapportBloc').classList.add('cache');
  $('grilleComparaison').innerHTML = '';
  $('invention').innerHTML = '';
  $('panneauMonde').innerHTML = monde.panneau.html;
  etatPanneau = {};
  if (monde.panneau.preparer) monde.panneau.preparer(L);
  remplirTest(false);
  majTextesMonde();
  nouveauCerveau();
}

// Les textes qui dépendent du monde et de la langue
function majTextesMonde() {
  $('titreMonde').textContent = monde.panneau.titre();
  $('aideMonde').textContent = monde.panneau.aide();
  $('titreCarte').textContent = monde.titreCarte();
  $('aideCarte').textContent = monde.aideCarte();
  $('zoneInventer').classList.toggle('cache', !monde.inventer);
  $('regles').innerHTML = `<b>${tr('Règles secrètes', 'Secret rules')}</b><ol>` + L.descriptions().map(d => `<li>${d}</li>`).join('') + '</ol>';
  $('labelA').textContent = L.entree.longA;
  $('labelB').textContent = L.entree.longB;
  afficherVraiesRegles();
}

// Les deux menus de « Tester le cerveau » : ce qu'il lit en A et en B
function remplirTest(garder) {
  const [a, b] = garder ? [$('t2').value, $('t1').value] : L.testDepart.map(String);
  $('t2').innerHTML = L.jetonsA.map(t => `<option value="${t}">${L.nomsJetons[t]}</option>`).join('');
  $('t1').innerHTML = L.jetonsB.map(t => `<option value="${t}">${L.nomsJetons[t]}</option>`).join('');
  $('t2').value = a; $('t1').value = b;
  const choix = $('bonneReponse').value, [ca, cb] = [$('corrA').value, $('corrB').value];
  const tous = (ids, court) => `<option value="-1">${tr('— tous —', '— any —')} (${court})</option>` + ids.map(t => `<option value="${t}">${L.nomsJetons[t]}</option>`).join('');
  $('corrA').innerHTML = tous(L.jetonsA, L.entree.courtA);
  $('corrB').innerHTML = tous(L.jetonsB, L.entree.courtB);
  $('corrA').value = garder && ca ? ca : a; $('corrB').value = garder && cb ? cb : b;
  $('bonneReponse').innerHTML = L.sorties.map((s, i) => `<option value="${i}">${s}</option>`).join('');
  if (garder && choix) $('bonneReponse').value = choix;
}

function nouveauCerveau() {
  labo = new Labo(L, Number($('graine').value) || 1);
  selection = null;
  blocCerveau = null;
  reglesCerveauRevelees = false;
  $('statutReecrire').textContent = '';
  $('resultatCorrection').innerHTML = '';
  correctionEnCours = null;
  reflexionCourante = null;
  dernierResultat = null;
  majPenseesVide();
  $('resultatReflexion').innerHTML = '';
  afficherReglesCerveau();
  vueReseau = creerVueReseau();
  arreterLecture();
  film.index = null;
  positionsCarte = Float64Array.from(labo.champion.plong);
  objectif = 0;
  arreter();
  majProgression();
  majPanneaux(true);
}

// ---------- Entraînement, progression et temps restant ----------
function demarrer() {
  if (labo.generation >= objectif) { debutSeance = labo.generation; objectif = labo.generation + Number($('duree').value); }
  enCours = true;
  chrono = { gen: labo.generation, temps: performance.now() };
  majBoutonEntrainer();
}

function arreter() {
  enCours = false;
  majBoutonEntrainer();
}

function majBoutonEntrainer() {
  const g = labo ? labo.generation : 0;
  if (enCours) $('entrainer').textContent = '⏸ Pause';
  else if (!g) $('entrainer').textContent = tr('▶ Entraîner', '▶ Train');
  else if (g < objectif) $('entrainer').textContent = tr('▶ Reprendre', '▶ Resume');
  else $('entrainer').textContent = tr(`▶ Continuer (+${$('duree').value})`, `▶ Continue (+${$('duree').value})`);
}

function duree(s) {
  s = Math.max(0, Math.round(s));
  return s >= 60 ? `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s` : `${s} s`;
}

function majProgression() {
  if (!objectif) {
    $('progRempli').style.width = '0%';
    $('progTexte').textContent = tr('Prêt. Clique sur ▶ Entraîner.', 'Ready. Click ▶ Train.');
    return;
  }
  const fait = Math.min(1, Math.max(0, (labo.generation - debutSeance) / (objectif - debutSeance)));
  $('progRempli').style.width = (fait * 100).toFixed(1) + '%';
  if (labo.generation >= objectif) {
    $('progTexte').textContent = tr(`✓ Terminé : ${labo.generation} générations.`, `✓ Done: ${labo.generation} generations.`);
  } else if (!enCours) {
    $('progTexte').textContent = tr(`En pause · génération ${labo.generation} / ${objectif}`, `Paused · generation ${labo.generation} / ${objectif}`);
  } else {
    const eta = tempsParGen ? (objectif - labo.generation) * tempsParGen / 1000 : null;
    $('progTexte').textContent = tr(`Génération ${labo.generation} / ${objectif}`, `Generation ${labo.generation} / ${objectif}`) +
      (eta !== null ? tr(` · reste ≈ ${duree(eta)}`, ` · ≈ ${duree(eta)} left`) : tr(' · calcul du temps restant…', ' · estimating time left…'));
  }
}

// ---------- Boucle principale ----------
function boucle() {
  if (enCours && labo) {
    const debut = performance.now();
    while (labo.generation < objectif && performance.now() - debut < 35) labo.etape();
    // temps réel par génération, affichage compris : sert à estimer le temps restant
    const maintenant = performance.now();
    if (chrono && labo.generation > chrono.gen) {
      const mesure = (maintenant - chrono.temps) / (labo.generation - chrono.gen);
      tempsParGen = tempsParGen ? tempsParGen * 0.9 + mesure * 0.1 : mesure;
    }
    chrono = { gen: labo.generation, temps: maintenant };
    if (labo.generation >= objectif) { arreter(); majPanneaux(false); if (correctionEnCours) bilanCorrection(); else afficherReflexion(); }
  }
  if (labo) {
    dessiner();
    const maintenant = performance.now();
    if (maintenant - derniereMaj > 300 && labo.generation !== derniereGenAffichee) {
      derniereMaj = maintenant;
      majPanneaux(false);
    }
    majProgression();
  }
  requestAnimationFrame(boucle);
}

function contexteTest() {
  const a = Number($('t2').value), b = Number($('t1').value);
  return L.ajusterTest ? L.ajusterTest(a, b) : [a, b];
}

function dessiner() {
  const g = cerveauAffiche();
  // la carte glisse doucement vers les nouvelles positions
  for (let k = 0; k < positionsCarte.length; k++) positionsCarte[k] += (g.plong[k] - positionsCarte[k]) * 0.15;
  const [m2, m1] = contexteTest();
  dessinerCarte($('carte'), camCarte, L, positionsCarte, voirFamilles(), [m2, m1], conceptsCerveau(labo, g));
  const activation = labo.activer(g, m2, m1);
  positionsNeurones = dessinerReseau($('reseau'), camReseau, labo, g, vueReseau, activation, selection, voirFamilles(),
    { tousLiens: $('tousLiens').checked, resumes, mots: [m2, m1], gen: g.gen, banniere: film.index === null, eteints: labo.eteints, importances });
  if (monde.panneau.dessiner) monde.panneau.dessiner(labo, g, L, voirFamilles(), etatPanneau);
}

// ---------- Panneaux texte ----------
function majPanneaux(force) {
  const g = labo.champion;
  derniereGenAffichee = labo.generation;
  $('sGen').textContent = labo.generation;
  $('sScore').textContent = pct(Math.min(1, g.score / labo.scoreMax));
  $('sJuste').textContent = pct(g.justesse);
  $('sCaches').textContent = g.nbCaches;
  $('sLiens').textContent = g.nbConns;
  $('sEspeces').textContent = labo.especes.length || 1;
  dessinerCourbe($('courbe'), labo.stats);
  majResumes();
  majEteints();
  majConcepts();
  majDirect();
  majTest();
  majNeurone();
  majJournal(force);
  majFilm();
}

// Sous chaque neurone : ce qui l'allume, calculé automatiquement à partir de son activité.
function majResumes() {
  const g = cerveauAffiche();
  resumes = new Map();
  const caches = [...g.noeuds].filter(id => labo.estCache(id));
  importances = new Map(caches.map(id => [id, expliquerNeurone(labo, g, id).perte]));
  if (caches.length > 10 && !caches.includes(selection)) return;
  for (const id of caches.length > 10 ? [selection] : caches) resumes.set(id, etiquetteNeurone(labo, g, id));
}

// Le bandeau des neurones éteints à la main : le cerveau affiché (monde, test, table) marche sans eux.
function majEteints() {
  const zone = $('bandeauEteints');
  if (!labo.eteints.size) { zone.classList.add('cache'); return; }
  const g = cerveauAffiche();
  const ids = [...labo.eteints].sort((a, b) => a - b);
  const presents = ids.filter(id => g.noeuds.has(id)), absents = ids.filter(id => !g.noeuds.has(id));
  const avant = memo(labo, g).score, apres = scoreReponses(labo, reponsesCerveau(labo, g, labo.eteints));
  zone.classList.remove('cache');
  zone.innerHTML = `🔌 <b>${tr('Neurones éteints', 'Switched-off neurons')}${tr(' :', ':')} ${presents.map(id => 'N' + id).join(', ') || '—'}</b>` +
    (absents.length ? ` <span class="statut">(${tr('absents de ce cerveau', 'not in this brain')}${tr(' :', ':')} ${absents.map(id => 'N' + id).join(', ')})</span>` : '') +
    `<br>${tr(`Tout le labo utilise maintenant le cerveau sans eux (le monde, le test, la table). Score : <b>${apres.toFixed(1)} %</b> au lieu de ${avant.toFixed(1)} %.`,
      `The whole lab now uses the brain without them (the world, the test, the table). Score: <b>${apres.toFixed(1)} %</b> instead of ${avant.toFixed(1)} %.`)}
    <br><button id="toutRallumer">${tr('💡 Tout rallumer', '💡 Switch all back on')}</button>`;
  $('toutRallumer').onclick = () => { labo.eteints.clear(); apresEteindre(); };
}

// Sous la carte : les concepts que le cerveau a inventés (les éléments qu'il traite pareil).
function majConcepts() {
  const g = cerveauAffiche(), cs = conceptsCerveau(labo, g);
  const infos = monde.panneau.infos ? monde.panneau.infos(labo, g, L) : '';
  if ($('infosMonde').innerHTML !== infos) $('infosMonde').innerHTML = infos;   // pas de réécriture inutile (l'info-bulle resterait ouverte)
  $('concepts').innerHTML = `<div class="regard">👁️ <b>${tr('Ce qu\'il regarde pour décider', 'What it looks at to decide')}</b>${tr(' : ', ': ')}${phraseRegard(L, regardCerveau(labo, g))}</div>` +
    `<b>${tr('Concepts inventés par le cerveau', 'Concepts invented by the brain')}</b>` +
    (cs.length ? `<span class="statut"> — ${tr('des éléments qu\'il traite pareil (reliés sur la carte)', 'elements it treats the same (linked on the map)')}</span><ul>${cs.map(c => `<li>${phraseConcept(L, c)}</li>`).join('')}</ul>`
      : `<div class="statut">${tr('Pas encore : il traite chaque élément à part.', 'Not yet: it treats each element separately.')}</div>`);
}

function basculerNeurone(id) {
  if (labo.eteints.has(id)) labo.eteints.delete(id); else labo.eteints.add(id);
  apresEteindre();
}

function apresEteindre() {
  majEteints();
  majTest();
  majNeurone();
}

// Une phrase qui raconte ce qui vient de se passer.
function majDirect() {
  const g = labo.champion;
  if (!labo.generation) { $('direct').textContent = ''; return; }
  const n = g.nbCaches, s = n > 1 ? 's' : '';
  const score = Math.min(100, g.score / labo.scoreMax * 100).toFixed(1);
  let phrase = tr(`Génération ${labo.generation} : le meilleur cerveau prédit à ${score} % aussi bien qu'un cerveau qui connaîtrait les règles, avec ${n} neurone${s} au milieu.`,
    `Generation ${labo.generation}: the best brain predicts ${score} % as well as a brain that knew the rules, with ${n} neuron${s} in the middle.`);
  const dernier = g.histoire.slice().reverse().find(e => e.type === 'neurone+' || e.type === 'neurone-' || e.type === 'mort');
  if (dernier) {
    const gain = ((dernier.scoreApres || 0) - (dernier.scoreAvant || 0)) / labo.scoreMax * 100;
    const pousse = dernier.type === 'neurone+';
    phrase += tr(` Dernier changement de forme gardé (génération ${dernier.gen}) : il ${pousse ? 'a fait pousser' : 'a détruit'} le neurone N${dernier.noeud}`,
      ` Last shape change kept (generation ${dernier.gen}): it ${pousse ? 'grew' : 'destroyed'} neuron N${dernier.noeud}`) +
      (Math.abs(gain) >= 0.05 ? `, score ${gain > 0 ? '+' : ''}${gain.toFixed(1)} pt.` : tr(', sans changer le score (cerveau plus simple).', ', without changing the score (simpler brain).'));
  }
  $('direct').textContent = phrase;
}

function majTest() {
  const g = cerveauAffiche();
  const [m2, m1] = contexteTest();
  if (Number($('t2').value) !== m2) $('t2').value = m2;
  const { probas } = labo.activer(g, m2, m1);
  const permis = L.permis(m2, m1);
  const ordre = probas.map((p, m) => [m, p]).sort((a, b) => b[1] - a[1]);
  $('barres').innerHTML = ordre.map(([m, p]) => {
    const interdit = voirFamilles() && !permis.has(m);
    return `<div class="ligne"><span>${L.sorties[m]}</span><div class="fond"><div class="rempli${interdit ? ' interdit' : ''}" style="width:${(p * 100).toFixed(1)}%"></div></div><span class="nombre">${Math.round(p * 100)}%</span></div>`;
  }).join('') + (voirFamilles() ? `<div class="statut" style="margin-top:6px">${tr('En rouge : réponses fausses selon les règles secrètes.', 'In red: wrong answers according to the secret rules.')}</div>` : '');
}

// Seulement pour la langue secrète : le cerveau écrit une phrase mot par mot.
function inventerPhrase() {
  const g = labo.champion;
  let m2 = L.DEBUT, m1 = L.DEBUT;
  const morceaux = [];
  let fautes = 0;
  for (let i = 0; i < LONGUEUR_PHRASE; i++) {
    const { probas } = labo.activer(g, m2, m1);
    let r = Math.random(), m = 0;
    for (; m < probas.length - 1; m++) { r -= probas[m]; if (r <= 0) break; }
    const ok = motsPossibles(L, m2, m1).includes(m);
    if (!ok) fautes++;
    morceaux.push(`<span class="${ok ? '' : 'mauvais'}" title="${ok ? tr('respecte les règles', 'follows the rules') : tr('enfreint une règle secrète', 'breaks a secret rule')}">${L.mots[m]}</span>`);
    m2 = m1; m1 = m;
  }
  $('invention').innerHTML = morceaux.join(' ') + '<br><span class="statut">' +
    (fautes ? `<span style="color:var(--ko)">${tr(`✗ ${fautes} mot(s) enfreignent les règles secrètes`, `✗ ${fautes} word(s) break the secret rules`)}</span>`
      : `<span class="bon">${tr('✓ phrase conforme aux règles secrètes', '✓ sentence follows the secret rules')}</span>`) + '</span>';
}

function majNeurone() {
  const g = cerveauAffiche();
  const zone = $('neurone'), canvas = $('profil'), top = $('topCtx');
  if (selection === null) {
    zone.textContent = tr('Aucun neurone sélectionné. Clique sur un point du milieu dans le cerveau.', 'No neuron selected. Click a point in the middle of the brain.');
    canvas.classList.add('cache'); top.innerHTML = ''; return;
  }
  if (!g.noeuds.has(selection)) {
    zone.textContent = film.index === null
      ? tr(`N${selection} n'existe pas dans le meilleur cerveau : il a été détruit, ou un autre cerveau sans lui a pris la tête.`, `N${selection} does not exist in the best brain: it was destroyed, or another brain without it took the lead.`)
      : tr(`N${selection} n'existe pas dans le cerveau de cette image du film.`, `N${selection} does not exist in the brain of this film frame.`);
    canvas.classList.add('cache'); top.innerHTML = '';
    return;
  }
  const naissance = g.histoire.find(e => e.type === 'neurone+' && e.noeud === selection);
  const entrants = g.conns.filter(c => c.actif && c.vers === selection).map(c => `${labo.nomNoeud(c.de)} (${c.poids.toFixed(2)})`);
  const sortants = g.conns.filter(c => c.actif && c.de === selection).map(c => `${labo.nomNoeud(c.vers)} (${c.poids.toFixed(2)})`);
  const ex = expliquerNeurone(labo, g, selection), eteint = labo.eteints.has(selection);
  const niveau = ex.perte >= 10 ? tr('Indispensable', 'Essential') : ex.perte >= 0.5 ? tr('Utile', 'Useful') : tr('Presque inutile', 'Almost useless');
  const peu = ex.faible ? tr(' (effet faible)', ' (weak effect)') : '';
  const roles = ex.roles.length
    ? `<ul class="roles">${ex.roles.slice(0, 3).map(r => `<li>→ <b>${L.sorties[r.sortie]}</b>${tr(' :', ':')} ${grouperSituations(L, r.cases, 2)}</li>`).join('')}</ul>` +
      (ex.roles.length > 3 ? `<span class="statut">${tr(`+ ${ex.roles.length - 3} autres`, `+ ${ex.roles.length - 3} more`)}</span>` : '')
    : ` ${tr('ne pousse vers aucune réponse en particulier', 'does not push towards any answer in particular')}`;
  const liste = xs => xs.slice(0, 8).map(x => `<li>${phraseChangement(L, x)}</li>`).join('') + (xs.length > 8 ? '<li>…</li>' : '');
  const casse = ex.casse.length
    ? `<details><summary>${tr(`Sans lui, ${ex.casse.length} situation${ex.casse.length > 1 ? 's deviennent fausses' : ' devient fausse'}`, `Without it, ${ex.casse.length} situation${ex.casse.length > 1 ? 's become' : ' becomes'} wrong`)}</summary><ul class="roles">${liste(ex.casse)}</ul></details>` : '';
  const repare = ex.repare.length
    ? `<details><summary>${tr(`Sans lui, ${ex.repare.length} situation${ex.repare.length > 1 ? 's deviennent justes' : ' devient juste'} (là, il gêne)`, `Without it, ${ex.repare.length} situation${ex.repare.length > 1 ? 's become' : ' becomes'} right (there, it gets in the way)`)}</summary><ul class="roles">${liste(ex.repare)}</ul></details>` : '';
  zone.innerHTML = `<b>N${selection}</b>${naissance ? tr(` · né à la génération ${naissance.gen}`, ` · born at generation ${naissance.gen}`) : ''}${eteint ? ` · <b style="color:var(--ko)">${tr('éteint', 'switched off')}</b>` : ''}
    <div class="explique">
      ${g.sens && g.sens.has(selection) ? `<div class="construit">📐 <b>${tr("Construit par l'Architecte pour", 'Built by the Architect for')}</b>${tr(' : ', ': ')}${txt(g.sens.get(selection))}</div>` : ''}
      <div><b>${tr('Son rôle', 'Its role')}</b>${peu}${tr(' :', ':')}${roles}</div>
      <div><b>${niveau}</b> — ${tr('sans lui', 'without it')}${tr(' :', ':')} ${ex.score.toFixed(1)} % → <b>${ex.scoreSans.toFixed(1)} %</b></div>
      ${casse}${repare}
      <div><button id="eteindre" class="${eteint ? 'principal' : ''}" title="${tr('Le monde, le test et la table utiliseront le cerveau sans lui', 'The world, the test and the table will use the brain without it')}">${eteint ? tr(`💡 Rallumer N${selection}`, `💡 Switch N${selection} back on`) : tr(`🔌 Éteindre N${selection}`, `🔌 Switch off N${selection}`)}</button></div>
    </div>
    <details><summary class="statut">${tr('Ses liens et son activité', 'Its links and activity')}</summary>
    <span class="statut">${tr('Reçoit de', 'Receives from')} : ${entrants.join(', ') || '—'}<br>${tr('Envoie vers', 'Sends to')} : ${sortants.join(', ') || '—'}</span>
    <p class="statut" style="margin-top:6px">${tr(`Ci-dessous, chaque case = une situation (${L.entree.courtA}, ${L.entree.courtB}). Bleu = il s'allume, orange = il s'éteint en négatif.`,
      `Below, each cell = a situation (${L.entree.courtA}, ${L.entree.courtB}). Blue = it switches on, orange = it goes negative.`)}</p></details>`;
  $('eteindre').onclick = () => basculerNeurone(selection);
  canvas.classList.remove('cache');
  const profil = labo.profilNeurone(g, selection);
  dessinerProfil(canvas, L, profil, voirFamilles());
  const tries = profil.slice().sort((a, b) => b.valeur - a.valeur);
  const ligne = p => `<div><span>${L.nomsJetons[p.m2]} ${L.nomsJetons[p.m1]}</span><span>${p.valeur.toFixed(2)}</span></div>`;
  top.innerHTML = `<b>${tr("S'allume le plus :", 'Most switched on:')}</b>` + tries.slice(0, 6).map(ligne).join('') +
    `<b style="display:block;margin-top:6px">${tr('Le plus négatif :', 'Most negative:')}</b>` + tries.slice(-4).reverse().map(ligne).join('');
}

// ---------- Journal ----------
function majJournal(force) {
  const zone = $('journal');
  const haut = zone.scrollTop;
  const g = labo.champion;
  const rel = s => s === undefined ? '?' : pct(Math.min(1.2, s / labo.scoreMax));
  const gen = tr('gén.', 'gen.');
  let html = '';
  if (ongletJournal === 'histoire') {
    const evts = g.histoire.slice().reverse();
    if (!evts.length) html = `<div class="statut">${tr('Pas encore de changement de forme.', 'No shape change yet.')}</div>`;
    for (const e of evts) {
      const gain = (e.scoreApres || 0) - (e.scoreAvant || 0);
      const suppression = e.type === 'lien-' || e.type === 'neurone-' || e.type === 'mort';
      let raison;
      if (gain > 1e-4) raison = tr(`gardé : a fait mieux que son parent (+${(gain / labo.scoreMax * 100).toFixed(1)} pts)`, `kept: did better than its parent (+${(gain / labo.scoreMax * 100).toFixed(1)} pts)`);
      else if (suppression && gain > -2e-3) raison = tr('gardé : presque le même score avec un cerveau plus simple', 'kept: almost the same score with a simpler brain');
      else raison = tr('a survécu sans aider tout de suite (protégé dans son espèce le temps de mûrir)', 'survived without helping right away (protected in its species while it matures)');
      const classe = e.type.endsWith('+') ? 'plus' : 'moins';
      const pourquoi = e.guide
        ? `🧠 ${tr('décidé par la réflexion (Chercheur ou Architecte), pas par le hasard : sa raison est écrite dans le film', 'decided by reflection (Researcher or Architect), not by chance: its reason is written in the film')}`
        : `score ${rel(e.scoreAvant)} → ${rel(e.scoreApres)} · ${raison}`;
      html += `<div class="evt"><span class="gen">${gen} ${e.gen}</span><span class="${classe}">${e.type.endsWith('+') ? '＋' : '－'}</span> ${txt(e.texte)}
        <div class="raison">${pourquoi}</div></div>`;
    }
  } else if (ongletJournal === 'rejets') {
    const rejets = labo.rejets.slice().reverse().slice(0, 80);
    if (!rejets.length) html = `<div class="statut">${tr("Pas encore d'essai raté. Ici s'affichent les changements de forme tentés sur le meilleur cerveau qui ont fait moins bien, avec ce qu'ils auraient cassé.", 'No failed attempt yet. Here you see the shape changes tried on the best brain that did worse, with what they would have broken.')}</div>`;
    for (const r of rejets) html += `<div class="evt">${phraseEssai(labo, r)}</div>`;
  } else if (ongletJournal === 'details') {
    const entrees = labo.journal.slice().reverse().slice(0, 80);
    if (!entrees.length) html = `<div class="statut">${tr("Lance l'entraînement pour voir chaque réglage.", 'Start training to see each adjustment.')}</div>`;
    for (const j of entrees) {
      const lignes = j.structure.map(e => `★ ${txt(e.texte)}`).concat(j.details.map(txt));
      const montre = lignes.slice(0, 30);
      const titre = j.heritier === false
        ? `<b style="color:var(--famC)">${tr(`⇄ un autre cerveau prend la tête (espèce ${j.espece})`, `⇄ another brain takes the lead (species ${j.espece})`)}</b>`
        : tr('nouveau meilleur cerveau', 'new best brain');
      const sens = j.sens ? phrasesReglages(labo, j.sens) : [];
      html += `<div class="evt"><span class="gen">${gen} ${j.gen}</span> ${titre} · score ${rel(j.scoreAvant)} → ${rel(j.scoreApres)}
        ${sens.length ? `<div class="sens">🔧 ${sens.join('<br>')}</div>` : ''}
        <ul>${montre.map(l => `<li>${l}</li>`).join('')}${lignes.length > 30 ? `<li>${tr(`… et ${lignes.length - 30} autres réglages`, `… and ${lignes.length - 30} other adjustments`)}</li>` : ''}</ul></div>`;
    }
  } else {
    const noms = {
      'neurone+': tr('nouveaux neurones', 'new neurons'), 'neurone-': tr('neurones détruits', 'neurons destroyed'),
      'lien+': tr('nouveaux liens', 'new links'), 'lien-': tr('liens détruits', 'links destroyed'),
    };
    for (const s of labo.stats.slice().reverse().slice(0, 120)) {
      const parties = Object.entries(s.essais).filter(([, v]) => v[0]).map(([k, v]) => `${v[0]} ${noms[k]} (${tr(`${v[1]} ont fait mieux que leur parent`, `${v[1]} did better than their parent`)})`);
      html += `<div class="evt"><span class="gen">${gen} ${s.gen}</span> ${parties.join(' · ') || tr('seulement des réglages de poids', 'only weight adjustments')} <span class="raison">· score ${pct(Math.min(1, s.scoreRel))}</span></div>`;
    }
  }
  zone.innerHTML = html;
  zone.scrollTop = force ? 0 : haut;
}

// ---------- Analyse par l'IA ----------
function afficherRapport(texte) {
  texteIA = texte;
  $('rapport').innerHTML = markdownVersHtml(texte);
  $('rapportBloc').classList.remove('cache');
  afficherVraiesRegles();
}

// Vérification des règles (celles réécrites par le cerveau, ou celles du défi) : à gauche les règles à vérifier,
// à droite les vraies. Une fois révélées : ✔/✘ à gauche, ✅/🟡/❌ à droite. Tout est calculé ici, sans rien d'externe.
function rendreVerification({ bloc, vide, gauche: idG, droite: idD, grille: idGrille, revele, reveler, cerveau }) {
  $(idGrille).innerHTML = '';
  let gauche = vide;
  if (bloc) {
    const aff = revele ? monde.affirmations(L, bloc) : null;
    const ic = { vrai: '✔', souvent: '≈', faux: '✘', inconnu: '?' };
    const dit = { vrai: tr('vrai', 'true'), souvent: tr('vrai seulement une partie du temps', 'only partly true'), faux: tr('faux', 'false'), inconnu: tr('situation jamais rencontrée', 'situation never seen') };
    if (aff) {
      const nf = aff.filter(a => a.verdict === 'faux').length, ns = aff.filter(a => a.verdict === 'souvent').length;
      const s = nf > 1 ? 's' : '', s2 = ns > 1 ? 's' : '';
      gauche = `<div class="bilan">${nf || ns
        ? [nf ? `<span class="ko">${tr(`${nf} fausse${s}`, `${nf} false`)}</span>` : '', ns ? `<span class="moyen">${tr(`${ns} vraie${s2} seulement en partie`, `${ns} only partly true`)}</span>` : ''].filter(Boolean).join(' · ') + ` ${tr('sur', 'out of')} ${aff.length} ${tr('affirmations', 'statements')}`
        : tr(`Tout ce qu'${cerveau ? 'il' : 'elle'} affirme est vrai (${aff.length} affirmations)`, `Everything it states is true (${aff.length} statements)`)}</div>`;
    } else gauche = `<div class="statut">${tr(`${bloc.length} règles. Clique sur « Révéler » pour les vérifier.`, `${bloc.length} rules. Click "Reveal" to check them.`)}</div>`;
    gauche += '<div class="affirmations">' + bloc.map((l, i) => {
      const a = aff && aff[i];
      return `<div class="aff ${a ? a.verdict : ''}"><span class="icone">${a ? ic[a.verdict] : '•'}</span><span>${monde.phrase(L, l)}${a && a.verdict !== 'vrai' ? ` <span class="raison">— ${dit[a.verdict]}${a.part !== null && a.verdict === 'souvent' ? ` (${Math.round(a.part * 100)} %)` : ''}</span>` : ''}</span></div>`;
    }).join('') + '</div>';
  }
  $(idG).innerHTML = gauche;

  if (!revele) {
    $(idD).innerHTML = `${tr('Cachées.', 'Hidden.')} <button id="${idD}Reveler">${tr('Révéler', 'Reveal')}</button>`;
    $(idD + 'Reveler').onclick = reveler;
    return;
  }
  const notes = bloc ? monde.evaluer(L, bloc) : null;
  const ICONE = { ok: '✅', moitie: '🟡', rate: '❌' };
  let html = '';
  if (notes) {
    const n = k => notes.filter(x => x.verdict === k).length;
    html += `<div class="bilan">${tr(`${cerveau ? 'Il' : 'Elle'} en a trouvé <b>${n('ok')}</b> sur ${notes.length} · ${n('moitie')} à moitié · ${n('rate')} ratée${n('rate') > 1 ? 's' : ''}`,
      `It found <b>${n('ok')}</b> of ${notes.length} · ${n('moitie')} half · ${n('rate')} missed`)}</div>`;
  }
  html += '<ol class="verifiees">' + L.descriptions().map((t, i) => notes && notes[i]
    ? `<li class="${notes[i].verdict}"><span class="icone">${ICONE[notes[i].verdict]}</span> ${t}${notes[i].detail ? `<div class="raison">${notes[i].detail}</div>` : ''}</li>`
    : `<li>${t}</li>`).join('') + '</ol>';
  $(idD).innerHTML = html;
  if (bloc && monde.grille) $(idGrille).innerHTML = monde.grille(L, bloc, cerveau ? tr('cerveau', 'brain') : tr('IA', 'AI'));
}

// Le défi (copier-coller vers une IA gratuite)
function afficherVraiesRegles() {
  const bloc = texteIA ? monde.lireBloc(L, texteIA) : null;
  let vide = `<div class="statut">${tr("Pas encore d'analyse.", 'No analysis yet.')}</div>`;
  if (texteIA && !bloc) vide = `<div class="statut">${tr("Pas de bloc de règles dans sa réponse, donc pas de vérification automatique. Vérifie que tu as copié toute sa réponse, et que le texte vient bien de ce monde (refais une copie sinon).",
    'No rules block in its answer, so no automatic check. Make sure you copied its whole answer, and that the text comes from this world (copy it again otherwise).')}</div>` +
    `<div class="rapport">${markdownVersHtml(extraireRegles(texteIA) || texteIA.slice(0, 1500))}</div>`;
  rendreVerification({ bloc, vide, gauche: 'devine', droite: 'vraies', grille: 'grilleComparaison', revele: reglesRevelees,
    reveler: () => { reglesRevelees = true; afficherVraiesRegles(); } });
  afficherReglesCerveau();
}

// Ce que le cerveau a compris : les règles qu'il réécrit lui-même, vérifiées de la même façon
function afficherReglesCerveau() {
  const bloc = blocCerveau ? monde.lireBloc(L, blocCerveau.texte) : null;
  const vide = `<div class="statut">${blocCerveau
    ? tr("Le cerveau n'a pas encore trouvé de règle claire : entraîne-le plus longtemps, puis recommence.", 'The brain has not found a clear rule yet: train it longer, then try again.')
    : tr('Clique sur « Le cerveau réécrit les règles ».', 'Click "The brain rewrites the rules".')}</div>`;
  rendreVerification({ bloc, vide, gauche: 'devineCerveau', droite: 'vraiesCerveau', grille: 'grilleCerveau', revele: reglesCerveauRevelees, cerveau: true,
    reveler: () => { reglesCerveauRevelees = true; afficherReglesCerveau(); } });
}

function reecrireRegles() {
  const g = cerveauAffiche();
  blocCerveau = { texte: reglesDuCerveau(labo, g, monde), gen: g.gen ?? labo.generation };
  majStatutReecrire();
  afficherReglesCerveau();
}

function majStatutReecrire() {
  if (!blocCerveau) { $('statutReecrire').textContent = ''; return; }
  const n = (monde.lireBloc(L, blocCerveau.texte) || []).length;
  $('statutReecrire').textContent = tr(`Règles écrites par le cerveau de la génération ${blocCerveau.gen} (${n} règle${n > 1 ? 's' : ''}).`,
    `Rules written by the brain of generation ${blocCerveau.gen} (${n} rule${n > 1 ? 's' : ''}).`);
}

// ---------- Correction : tu apprends au cerveau la bonne réponse, et il explique ce que ça a changé ----------
function corrigerCerveau() {
  const a = Number($('corrA').value), b = Number($('corrB').value), s = Number($('bonneReponse').value);
  // « tous » = toutes les situations de ce monde avec l'autre élément choisi
  const cases = situationsExplicateur(labo).filter(c => (a < 0 || c.m2 === a) && (b < 0 || c.m1 === b)).map(c => [c.m2, c.m1]);
  if (!cases.length) {
    $('resultatCorrection').innerHTML = `<div class="statut">${tr("Cette situation n'existe pas dans ce monde : rien à corriger.", 'This situation does not exist in this world: nothing to correct.')}</div>`;
    return;
  }
  appliquerCorrection(cases, s, { a, b });
}

// Le professeur : la bonne réponse (selon les vraies règles) partout où il se trompe, même là où il n'a jamais rien vu.
function corrigerToutesErreurs() {
  const g = labo.champion, base = memo(labo, g).base;
  const cases = [];
  situationsExplicateur(labo).forEach((c, i) => {
    const vraies = L.permis(c.m2, c.m1);
    if (!vraies.has(meilleure(base[i]))) cases.push([c.m2, c.m1, [...vraies]]);
  });
  if (!cases.length) {
    $('resultatCorrection').innerHTML = `<div class="statut">${tr('Il ne se trompe nulle part : rien à corriger.', 'It is right everywhere: nothing to correct.')}</div>`;
    return;
  }
  appliquerCorrection(cases, null, { a: -1, b: -1, prof: true });
}

// Réparation guidée : la réflexion répare tout de suite, en écrivant ses raisons.
// Réparation naturelle : le cerveau apprend la correction, puis l'entraînement continue tout seul (c'est là que des
// neurones peuvent naître ou changer de rôle). À la fin, un bilan dit ce que la correction a changé dans sa tête.
function appliquerCorrection(cases, s, quoi, zone = 'resultatCorrection') {
  if (enCours) arreter();
  labo.corriger(cases, s, quoi);
  film.index = null;
  const image = labo.album.length - 1;
  if ($('modeReparation').value === 'guidee') {
    reparationGuidee(labo);
    $(zone).innerHTML = expliquerImage(labo, image) + expliquerImage(labo, labo.album.length - 1) +
      `<div class="statut">${tr('Corrections apprises', 'Corrections learned')}${tr(' : ', ': ')}${labo.corrections.map(c => phraseCorrection(L, c)).join(' · ')}.</div>`;
    majPanneaux(true);
    if (reflexionCourante) afficherReflexion();
    return;
  }
  correctionEnCours = { image, zone };
  $(zone).innerHTML = expliquerImage(labo, image) +
    `<div class="statut">⏳ ${tr(`Je continue l'entraînement ${GENERATIONS_CORRECTION} générations pour intégrer ta correction : regarde le cerveau et le film. Le bilan s'affichera ici.`,
      `I keep training for ${GENERATIONS_CORRECTION} generations to take your correction in: watch the brain and the film. The summary will show up here.`)}</div>`;
  debutSeance = labo.generation;
  objectif = labo.generation + GENERATIONS_CORRECTION;
  demarrer();
  majPanneaux(true);
}

// Bilan : le cerveau juste après la correction, comparé au meilleur cerveau à la fin de l'entraînement.
function bilanCorrection() {
  const avant = labo.album[correctionEnCours.image], apres = labo.champion, zone = correctionEnCours.zone;
  correctionEnCours = null;
  const caches = g => [...g.noeuds].filter(id => labo.estCache(id));
  const plus = caches(apres).filter(id => !avant.noeuds.has(id)), moins = caches(avant).filter(id => !apres.noeuds.has(id));
  const img = { ...apres, heritier: true, rejets: [], score: apres.score, bilan: true };
  const liste = labo.corrections.map(c => phraseCorrection(L, c)).join(' · ');
  $(zone).innerHTML = `<div class="film-titre">📋 ${tr(`Bilan de ta correction, après ${GENERATIONS_CORRECTION} générations`, `Summary of your correction, after ${GENERATIONS_CORRECTION} generations`)} · ` +
    `${avant.nbCaches} → ${apres.nbCaches} ${tr('neurones', 'neurons')}</div>` + journalDecisions(labo, avant, img, plus, moins) +
    `<div class="statut">${tr('Corrections apprises', 'Corrections learned')}${tr(' : ', ': ')}${liste}.</div>`;
  if (reflexionCourante) afficherReflexion();
}

// ---------- Réflexion : le cerveau s'observe, puis agit tout seul ----------
// Ce qu'il pense de lui-même (affiché après chaque entraînement et après chaque réflexion).
function afficherReflexion() {
  const r = reflechir(labo, labo.champion);
  reflexionCourante = r;
  $('statutReflexion').textContent = tr(`Cerveau de la génération ${labo.generation}.`, `Brain at generation ${labo.generation}.`);
  $('pensees').innerHTML = '<ul class="decisions">' + r.pensees.map(p => `<li>${p}</li>`).join('') + '</ul>';
}

// « Laisse-le réfléchir » : il agit selon le mode choisi, et raconte chaque tour.
let dernierResultat = null;
function laisserReflechir() {
  if (enCours) arreter();
  const mode = $('modeReflexion').value;
  dernierResultat = mode === 'prudent' ? reflexionPrudente(labo, monde) : mode === 'architecte' ? construireParLeSens(labo, monde) : reflexionEmpirique(labo, monde);
  film.index = null;
  afficherResultatReflexion();
  reecrireRegles();   // ses déductions, à vérifier dans « Ce que le cerveau a compris »
  majPanneaux(true);
  afficherReflexion();
}

function afficherResultatReflexion() {
  if (!dernierResultat) { $('resultatReflexion').innerHTML = ''; return; }
  $('resultatReflexion').innerHTML = dernierResultat.map((t, k) =>
    `<details${k === dernierResultat.length - 1 || k === dernierResultat.length - 2 ? ' open' : ''}><summary><b>${txt(t.titre)}</b></summary><ul class="decisions">${t.lignes.map(l => `<li>${txt(l)}</li>`).join('')}</ul></details>`).join('');
}

async function copierPrompt() {
  const prompt = construirePrompt(labo, labo.champion, $('avecPredictions').checked, monde);
  try {
    await navigator.clipboard.writeText(prompt);
    $('statutAnalyse').textContent = tr(`✓ Copié : le cerveau de la génération ${labo.generation}. Passe à l'étape 3.`, `✓ Copied: the brain of generation ${labo.generation}. Go to step 3.`);
  } catch {
    // Si le navigateur bloque la copie automatique, on met le texte dans la zone pour une copie à la main.
    $('reponseManuelle').value = prompt;
    $('reponseManuelle').select();
    $('statutAnalyse').textContent = tr("Copie automatique bloquée : le texte est sélectionné dans la zone ci-dessous, fais Ctrl + C, puis vide la zone avant l'étape 6.",
      'Automatic copy blocked: the text is selected in the box below, press Ctrl + C, then empty the box before step 6.');
  }
}

// Changer la langue de l'interface : on garde le monde, le cerveau et l'analyse.
function appliquerLangue(l) {
  changerLangue(l);
  remplirMenus();
  remplirTest(true);
  majTextesMonde();
  majBoutonEntrainer();
  majProgression();
  majPanneaux(true);
  if (reflexionCourante) afficherReflexion(); else majPenseesVide();
  afficherResultatReflexion();
  majStatutReecrire();
}

function majPenseesVide() {
  $('pensees').innerHTML = `<div class="statut">${tr('Entraîne le cerveau, puis clique sur « Laisse-le réfléchir ».', 'Train the brain, then click "Let it think".')}</div>`;
}

// Les longues explications sont repliées : un « ? » à côté du titre les déplie.
function replierAides() {
  for (const p of document.querySelectorAll('.carte > .aide')) {
    const h = p.previousElementSibling;
    if (!h || h.tagName !== 'H2') continue;
    const titre = document.createElement('div');
    titre.className = 'titre-carte';
    h.before(titre);
    const b = document.createElement('button');
    b.className = 'info';
    b.textContent = '?';
    b.onclick = () => p.classList.toggle('cache');
    titre.append(h, b);
    p.classList.add('cache');
  }
}

// ---------- Branchements ----------
function brancher() {
  const boutonsLangue = [...$('langueUI').querySelectorAll('button')];
  const marquerLangue = () => boutonsLangue.forEach(b => b.classList.toggle('actif', b.dataset.langue === LANGUE_UI));
  boutonsLangue.forEach(b => { b.onclick = () => { appliquerLangue(b.dataset.langue); marquerLangue(); }; });
  marquerLangue();
  traduirePage();
  replierAides();
  remplirMenus();
  $('monde').onchange = () => { $('mode').value = ''; $('taille').value = ''; remplirMenus(); nouveauMonde(); };
  $('mode').onchange = () => nouveauMonde();
  $('taille').onchange = () => nouveauMonde();
  $('generer').onclick = () => nouveauMonde();
  const appliquerTemperament = () => Object.assign(REGLAGES, TEMPERAMENTS[$('temperament').value]);
  $('temperament').onchange = appliquerTemperament;
  appliquerTemperament();
  $('recommencer').onclick = () => nouveauCerveau();
  $('entrainer').onclick = () => { if (enCours) arreter(); else demarrer(); majProgression(); };
  $('duree').onchange = () => { if (!enCours) arreter(); };
  $('voirRegles').onchange = () => {
    $('regles').classList.toggle('cache', !voirFamilles());
    majPanneaux(false);
  };
  $('t1').onchange = $('t2').onchange = () => { $('corrA').value = $('t2').value; $('corrB').value = $('t1').value; majTest(); };
  $('inventer').onclick = inventerPhrase;
  $('reecrire').onclick = reecrireRegles;
  $('apprendre').onclick = corrigerCerveau;
  $('apprendreTout').onclick = corrigerToutesErreurs;
  $('reflechir').onclick = laisserReflechir;
  camCarte = new Camera3D($('carte'), { yaw: -0.6, pitch: 0.35 });
  camReseau = new Camera3D($('reseau'), { yaw: -0.45, pitch: 0.25, distance: 6, balance: 0.2 });
  $('vueFace').onclick = () => camReseau.reinitialiser();
  camReseau.surClic = (x, y) => {
    let best = null, dist = 22;   // les neurones importants sont plus gros
    for (const p of positionsNeurones) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < dist) { dist = d; best = p.id; }
    }
    selection = best;
    majResumes();
    majNeurone();
  };
  brancherFilm();
  document.querySelectorAll('.onglets button').forEach(b => b.onclick = () => {
    document.querySelectorAll('.onglets button').forEach(x => x.classList.toggle('actif', x === b));
    ongletJournal = b.dataset.onglet;
    majJournal(true);
  });
  $('copier').onclick = copierPrompt;
  $('afficherManuel').onclick = () => {
    const texte = $('reponseManuelle').value.trim();
    if (!texte) { $('statutAnalyse').textContent = tr("La zone est vide : colle d'abord la réponse de l'IA.", "The box is empty: paste the AI's answer first."); return; }
    if (texte.startsWith('Tu es chercheur en interprétabilité') || texte.startsWith('You are an interpretability researcher')) {
      $('statutAnalyse').textContent = tr("Ça, c'est le texte à envoyer à l'IA, pas sa réponse. Colle plutôt ce que l'IA t'a répondu.",
        "That is the text to send to the AI, not its answer. Paste what the AI answered instead.");
      return;
    }
    afficherRapport(texte);
    $('statutAnalyse').textContent = reglesRevelees ? tr('✓ Analyse affichée et vérifiée.', '✓ Analysis shown and checked.') : tr('✓ Analyse affichée. Clique sur « Révéler » pour comparer.', '✓ Analysis shown. Click "Reveal" to compare.');
    $('comparaison').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  window.addEventListener('resize', () => labo && majPanneaux(false));
}

lireCouleurs();
brancher();
nouveauMonde();
requestAnimationFrame(boucle);
