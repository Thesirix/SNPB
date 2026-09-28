'use strict';
// =====================================================================
//  EXPLICATEUR : dit ce que fait chaque neurone, sans IA externe.
//  Méthode : on passe toutes les situations dans le cerveau, une fois normalement
//  et une fois avec le neurone éteint. La différence, c'est son rôle.
//  Marche pour tous les mondes : il ne connaît que les situations (a, b) et les réponses.
// =====================================================================

const SEUIL_ROLE = 0.15;         // à partir de quel changement de probabilités un neurone « compte » dans une situation
const SEUIL_MINI = 0.02;         // en dessous, on considère qu'il ne fait rien du tout
const memoExplications = new WeakMap();   // cerveau → { base, neurones: Map(id → explication) }

// Les situations que l'explicateur regarde. Pour les mondes « table », TOUTES les combinaisons,
// même celles jamais vues pendant l'entraînement : c'est là qu'on voit si le cerveau a pris un raccourci.
function situationsExplicateur(labo) {
  if (labo.situations && labo.situations.version === labo.versionDonnees) return labo.situations.liste;
  const L = labo.L;
  let liste = labo.contextes;
  if (!L.reponse && L.contextesComplets) {
    // Langue avec piège : toutes les situations de la vraie langue, dont celles jamais montrées au cerveau
    const cle = c => c.m2 * L.nbJetons + c.m1, vues = new Map(labo.contextes.map(c => [cle(c), c]));
    liste = L.contextesComplets.map(c => vues.get(cle(c)) || { m2: c.m2, m1: c.m1, permis: c.permis, comptes: new Map(), total: 0, jamaisVu: true });
    const dedans = new Set(L.contextesComplets.map(cle));
    for (const c of labo.contextes) if (!dedans.has(cle(c))) liste.push(c);
  } else if (L.reponse) {
    const vues = new Map(labo.contextes.map(c => [c.m2 * L.nbJetons + c.m1, c]));
    liste = [];
    for (const a of L.jetonsA) for (const b of L.jetonsB)
      liste.push(vues.get(a * L.nbJetons + b) || { m2: a, m1: b, permis: L.permis(a, b), comptes: new Map(), total: 0, jamaisVu: true });
  }
  labo.situations = { version: labo.versionDonnees, liste };
  return liste;
}

// Les probabilités du cerveau dans chaque situation, avec certains neurones éteints (ou aucun).
function reponsesCerveau(labo, g, eteints = null) {
  const prog = labo.compiler(g, eteints);
  const v = new Float64Array(prog.taille);
  return situationsExplicateur(labo).map(c => {
    const p = new Float64Array(labo.nbSorties);
    labo.propager(g, prog, c.m2, c.m1, v, p);
    return p;
  });
}

// Le score (en % d'un cerveau qui connaîtrait les règles) correspondant à ces réponses.
function scoreReponses(labo, reps) {
  let ll = 0;
  situationsExplicateur(labo).forEach((c, i) => { for (const [m, n] of c.comptes) ll += n * Math.log(reps[i][m] + 1e-9); });
  return Math.min(1, Math.exp(ll / labo.nbExemples) / labo.scoreMax) * 100;
}

const meilleure = p => { let k = 0; for (let s = 1; s < p.length; s++) if (p[s] > p[k]) k = s; return k; };
// Une situation est « juste » si la réponse préférée du cerveau est permise par les règles.
const estJuste = (c, p) => c.permis.has(meilleure(p));

function memo(labo, g) {
  let m = memoExplications.get(g);
  if (!m || m.version !== labo.versionDonnees) {   // après une correction, les exemples ont changé : on recalcule
    const base = reponsesCerveau(labo, g);
    m = { base, score: scoreReponses(labo, base), neurones: new Map(), version: labo.versionDonnees };
    memoExplications.set(g, m);
  }
  return m;
}

// Raconte une liste de situations en peu de mots : « rouge, rose + étoile, croix ; vert + losange ».
function grouperSituations(L, cases, max = 3) {
  const nom = t => L.nomsJetons[t];
  const tousA = new Set(L.jetonsA), tousB = new Set(L.jetonsB);
  const liste = (ids, tous) => (ids.length === tous.size && ids.length > 2 ? tr('tout', 'any') : ids.map(nom).join(', '));
  // Deux façons de regrouper (par A ou par B) : on garde la plus courte
  const essai = (cleA) => {
    const par = new Map();
    for (const [a, b] of cases) {
      const [k, v] = cleA ? [a, b] : [b, a];
      if (!par.has(k)) par.set(k, new Set());
      par.get(k).add(v);
    }
    const groupes = new Map();   // même ensemble de partenaires → on fusionne
    for (const [k, vs] of par) {
      const cle = [...vs].sort((x, y) => x - y).join(',');
      if (!groupes.has(cle)) groupes.set(cle, { ks: [], vs: [...vs].sort((x, y) => x - y) });
      groupes.get(cle).ks.push(k);
    }
    return [...groupes.values()].sort((x, y) => y.ks.length * y.vs.length - x.ks.length * x.vs.length)
      .map(gr => cleA ? [gr.ks, gr.vs] : [gr.vs, gr.ks]);
  };
  const parA = essai(true), parB = essai(false);
  const groupes = parB.length < parA.length ? parB : parA;
  const sep = L.symboleCase || '+';
  const textes = groupes.map(([as, bs]) => `${liste(as, tousA)} ${sep} ${liste(bs, tousB)}`);
  return textes.slice(0, max).join(' ; ') + (textes.length > max ? tr(` ; +${textes.length - max} autres`, ` ; +${textes.length - max} more`) : '');
}

// Ce que fait un neurone dans un cerveau :
//  roles   : vers quelle réponse il pousse, et dans quelles situations
//  perte   : combien de points de score le cerveau perd sans lui
//  casse   : les situations qui deviennent fausses sans lui
function expliquerNeurone(labo, g, id) {
  const m = memo(labo, g);
  if (m.neurones.has(id)) return m.neurones.get(id);
  const sans = reponsesCerveau(labo, g, new Set([id]));
  const parSortie = new Map(), casse = [], repare = [];
  // Pour chaque situation : de combien les probabilités bougent sans lui, et vers quelle réponse il poussait
  const effets = situationsExplicateur(labo).map((c, i) => {
    const avec = m.base[i], sansLui = sans[i];
    let ecart = 0, pousse = 0, plus = -Infinity;
    for (let s = 0; s < avec.length; s++) {
      const d = avec[s] - sansLui[s];
      ecart += Math.abs(d) / 2;
      if (d > plus) { plus = d; pousse = s; }
    }
    return { ecart, pousse };
  });
  // Un neurone à l'effet étalé (petit partout) a quand même un rôle : le seuil s'adapte à son effet le plus fort
  const maxEcart = Math.max(0, ...effets.map(x => x.ecart));
  const seuil = Math.max(SEUIL_MINI, Math.min(SEUIL_ROLE, maxEcart / 2));
  situationsExplicateur(labo).forEach((c, i) => {
    const avec = m.base[i], sansLui = sans[i], { ecart, pousse } = effets[i];
    if (ecart >= seuil) {
      if (!parSortie.has(pousse)) parSortie.set(pousse, { sortie: pousse, cases: [], poids: 0 });
      const r = parSortie.get(pousse);
      r.cases.push([c.m2, c.m1]); r.poids += ecart * c.total;
    }
    const j1 = estJuste(c, avec), j2 = estJuste(c, sansLui);
    if (j1 && !j2) casse.push({ a: c.m2, b: c.m1, avant: meilleure(avec), apres: meilleure(sansLui) });
    if (!j1 && j2) repare.push({ a: c.m2, b: c.m1, avant: meilleure(avec), apres: meilleure(sansLui) });
  });
  const roles = [...parSortie.values()].sort((a, b) => b.poids - a.poids);
  const scoreSans = scoreReponses(labo, sans);
  const e = { id, roles, casse, repare, score: m.score, scoreSans, perte: m.score - scoreSans, faible: maxEcart < SEUIL_ROLE };
  e.utile = roles.length > 0 || e.perte >= 0.5;
  m.neurones.set(id, e);
  return e;
}

// Deux petites lignes à écrire sous le neurone dans le dessin du cerveau.
function etiquetteNeurone(labo, g, id) {
  const e = expliquerNeurone(labo, g, id);
  if (!e.roles.length) return [e.perte >= 0.5 ? tr(`sans lui : −${e.perte.toFixed(0)} pt`, `without it: −${e.perte.toFixed(0)} pt`) : tr('ne sert presque à rien', 'almost useless')];
  const r = e.roles[0];
  return [`${e.faible ? '(' : ''}→ ${labo.L.sorties[r.sortie]}${e.faible ? ')' : ''}${e.roles.length > 1 ? ` (+${e.roles.length - 1})` : ''}`, grouperSituations(labo.L, r.cases, 1)];
}

// Une situation qui change de réponse : « rouge + étoile : poison → rien ».
function phraseChangement(L, x) {
  return `${L.nomsJetons[x.a]} ${L.symboleCase || '+'} ${L.nomsJetons[x.b]}${tr(' :', ':')} ${L.sorties[x.avant]} → ${L.sorties[x.apres]}`;
}

// Le rôle d'un neurone en une phrase : « pousse vers poison pour rouge, rose + étoile ».
function phraseRoles(labo, e, max = 2, groupes = 2) {
  if (!e.roles.length) return tr('ne pousse vers aucune réponse en particulier', 'does not push towards any answer in particular');
  const peu = e.faible ? tr('un peu ', 'slightly ') : '';
  return e.roles.slice(0, max).map(r => tr(`pousse ${peu}vers « ${labo.L.sorties[r.sortie]} » pour ${grouperSituations(labo.L, r.cases, groupes)}`,
    `pushes ${peu}towards "${labo.L.sorties[r.sortie]}" for ${grouperSituations(labo.L, r.cases, groupes)}`)).join(tr(' ; et ', '; and ')) +
    (e.roles.length > max ? tr(` (et ${e.roles.length - max} autre${e.roles.length - max > 1 ? 's' : ''} rôle${e.roles.length - max > 1 ? 's' : ''})`, ` (and ${e.roles.length - max} more role${e.roles.length - max > 1 ? 's' : ''})`) : '');
}

// Ce qui a changé dans les réponses entre deux cerveaux : ce qu'il a appris, ce qu'il a oublié.
function differenceCerveaux(labo, avant, apres) {
  const ra = memo(labo, avant).base, rb = memo(labo, apres).base;
  const appris = [], oublie = [];
  situationsExplicateur(labo).forEach((c, i) => {
    const ja = estJuste(c, ra[i]), jb = estJuste(c, rb[i]);
    if (!ja && jb) appris.push([c.m2, c.m1, meilleure(rb[i])]);
    if (ja && !jb) oublie.push([c.m2, c.m1, meilleure(rb[i])]);
  });
  return { appris, oublie };
}

// « → poison : rouge + étoile ; → nourrit : vert + losange »
function phraseParReponse(L, cases) {
  const par = new Map();
  for (const [a, b, s] of cases) { if (!par.has(s)) par.set(s, []); par.get(s).push([a, b]); }
  return [...par].map(([s, cs]) => `→ <b>${L.sorties[s]}</b>${tr(' :', ':')} ${grouperSituations(L, cs, 2)}`).join(' · ');
}

// =====================================================================
//  CONCEPTS : les éléments que le cerveau traite pareil.
//  Deux couleurs (ou deux mots, deux types…) forment un concept quand le cerveau donne
//  les mêmes réponses pour l'une et pour l'autre, quelle que soit la chose lue à côté.
// =====================================================================
const SEUIL_CONCEPT = 0.12;      // écart moyen de probabilités en dessous duquel deux éléments sont « pareils »
const COULEURS_CONCEPTS = ['#ffd166', '#7cd992', '#ff7eb6', '#5cc8ff', '#b69cff', '#ff9f5a', '#9aa1b5'];

function conceptsCerveau(labo, g) {
  const m = memo(labo, g);
  if (m.concepts) return m.concepts;
  const L = labo.L, concepts = [];
  for (const role of ['A', 'B']) {
    // Pour chaque élément : ses réponses selon ce qu'il y a à côté
    const profils = new Map();
    situationsExplicateur(labo).forEach((c, i) => {
      const [t, voisin] = role === 'A' ? [c.m2, c.m1] : [c.m1, c.m2];
      if (t === L.jetonSpecial) return;
      if (!profils.has(t)) profils.set(t, new Map());
      profils.get(t).set(voisin, m.base[i]);
    });
    const ids = [...profils.keys()];
    const ecart = (t1, t2) => {
      let somme = 0, n = 0;
      for (const [v, p] of profils.get(t1)) {
        const q = profils.get(t2).get(v);
        if (!q) continue;
        let d = 0;
        for (let s = 0; s < p.length; s++) d += Math.abs(p[s] - q[s]) / 2;
        somme += d; n++;
      }
      return n >= 2 ? somme / n : Infinity;
    };
    const d = new Map();
    for (const a of ids) for (const b of ids) if (a < b) d.set(a + ',' + b, ecart(a, b));
    const dist = (a, b) => (a === b ? 0 : d.get(Math.min(a, b) + ',' + Math.max(a, b)));
    // Au début, le cerveau répond presque pareil à tout : tout se ressemble, ce ne sont pas des concepts.
    // On attend qu'il distingue vraiment les éléments, et « pareil » veut dire bien plus proche que la moyenne.
    const finies = [...d.values()].filter(Number.isFinite);
    const moyenne = finies.reduce((s, x) => s + x, 0) / Math.max(1, finies.length);
    if (moyenne < 0.15) continue;
    const seuil = Math.min(SEUIL_CONCEPT, moyenne * 0.4);
    // Regroupement : on fusionne les groupes les plus proches tant que TOUS leurs membres restent proches
    const groupes = ids.map(t => [t]);
    for (;;) {
      let best = null, bestD = seuil;
      for (let i = 0; i < groupes.length; i++) for (let j = i + 1; j < groupes.length; j++) {
        let pire = 0;
        for (const a of groupes[i]) for (const b of groupes[j]) pire = Math.max(pire, dist(a, b));
        if (pire < bestD) { bestD = pire; best = [i, j]; }
      }
      if (!best) break;
      groupes[best[0]] = groupes[best[0]].concat(groupes[best[1]]);
      groupes.splice(best[1], 1);
    }
    for (const gr of groupes) if (gr.length >= 2) concepts.push({ role, membres: gr.sort((a, b) => a - b) });
  }
  concepts.sort((a, b) => (a.role < b.role ? -1 : a.role > b.role ? 1 : b.membres.length - a.membres.length));
  concepts.forEach((c, i) => { c.couleur = COULEURS_CONCEPTS[i % COULEURS_CONCEPTS.length]; c.cle = c.role + ':' + c.membres.join(','); });
  m.concepts = concepts;
  return concepts;
}

// « couleur de l'objet : rouge, rose, jaune »
function phraseConcept(L, c) {
  return `<span style="color:${c.couleur}">●</span> <span class="statut">${c.role === 'A' ? L.entree.longA : L.entree.longB}${tr(' :', ':')}</span> <b>${c.membres.map(t => L.nomsJetons[t]).join(', ')}</b>`;
}

// Les concepts qui sont nés, ont grandi ou se sont défaits entre deux cerveaux.
function differenceConcepts(labo, avant, apres) {
  const ca = conceptsCerveau(labo, avant), cb = conceptsCerveau(labo, apres);
  const cles = new Set(ca.map(c => c.cle)), clesB = new Set(cb.map(c => c.cle));
  const nes = [], grandis = [], defaits = [];
  for (const c of cb) {
    if (cles.has(c.cle)) continue;
    const ancien = ca.find(x => x.role === c.role && x.membres.every(t => c.membres.includes(t)));
    if (ancien) grandis.push({ c, ajoutes: c.membres.filter(t => !ancien.membres.includes(t)) });
    else nes.push(c);
  }
  for (const c of ca) {
    if (clesB.has(c.cle)) continue;
    if (!cb.some(x => x.role === c.role && c.membres.every(t => x.membres.includes(t)))) defaits.push(c);
  }
  return { nes, grandis, defaits };
}

// =====================================================================
//  RÉGLAGES DES POIDS : ce que la descente de gradient a renforcé ou affaibli.
// =====================================================================
// Confiance = part de ses chances posée sur des réponses permises.
const confiance = (c, p) => { let s = 0; for (const m of c.permis) s += p[m]; return s; };

function expliquerReglages(labo, avant, apres) {
  const ra = memo(labo, avant).base, rb = memo(labo, apres).base;
  const plusSur = [], moinsSur = [];
  situationsExplicateur(labo).forEach((c, i) => {
    const d = confiance(c, rb[i]) - confiance(c, ra[i]);
    const x = { a: c.m2, b: c.m1, s: meilleure(rb[i]), avant: confiance(c, ra[i]), apres: confiance(c, rb[i]), d };
    // Les situations qui passent de fausse à juste (ou l'inverse) sont déjà dans « appris / oublié »
    if (d > 0.1 && estJuste(c, ra[i]) && estJuste(c, rb[i])) plusSur.push(x);
    if (d < -0.1 && estJuste(c, ra[i]) && estJuste(c, rb[i])) moinsSur.push(x);
  });
  plusSur.sort((x, y) => y.d - x.d); moinsSur.sort((x, y) => x.d - y.d);
  const av = new Map(avant.conns.filter(c => c.actif).map(c => [c.innov, c]));
  const liens = apres.conns.filter(c => c.actif && av.has(c.innov))
    .map(c => ({ de: c.de, vers: c.vers, avant: av.get(c.innov).poids, apres: c.poids }))
    .filter(x => Math.abs(x.apres - x.avant) > 0.15)
    .sort((x, y) => Math.abs(y.apres - y.avant) - Math.abs(x.apres - x.avant));
  return { plusSur, moinsSur, liens: liens.slice(0, 3), nbLiens: liens.length };
}

// Un lien réglé, dit avec du sens : « N7 pousse plus fort vers poison ».
function phraseLien(labo, x) {
  const L = labo.L, fort = Math.abs(x.apres) > Math.abs(x.avant), sens = x.apres >= 0;
  const chiffres = ` <span class="statut">(${x.avant.toFixed(2)} → ${x.apres.toFixed(2)})</span>`;
  const entree = id => `${id < DIM ? L.entree.courtA : L.entree.courtB} (${'xyz'[id % DIM]})`;
  const qui = x.de === BIAIS ? null : labo.estCache(x.de) ? `N${x.de}` : entree(x.de);
  if (labo.estSortie(x.vers)) {
    const rep = `« ${labo.nomNoeud(x.vers)} »`;
    if (!qui) return tr(`${rep} devient ${sens ? 'plus' : 'moins'} probable par défaut`, `${rep} becomes ${sens ? 'more' : 'less'} likely by default`) + chiffres;
    return tr(`${qui} pousse ${fort ? 'plus' : 'moins'} fort ${sens ? 'vers' : 'contre'} ${rep}`, `${qui} pushes ${fort ? 'harder' : 'less'} ${sens ? 'towards' : 'against'} ${rep}`) + chiffres;
  }
  if (!qui) return tr(`N${x.vers} s'allume ${sens ? 'plus' : 'moins'} facilement`, `N${x.vers} switches on ${sens ? 'more' : 'less'} easily`) + chiffres;
  return tr(`N${x.vers} écoute ${fort ? 'plus' : 'moins'} ${qui}`, `N${x.vers} listens ${fort ? 'more' : 'less'} to ${qui}`) + chiffres;
}

// « rouge + étoile (poison) : 60 % → 90 % »
function phraseConfiance(L, x) {
  return `${L.nomsJetons[x.a]} ${L.symboleCase || '+'} ${L.nomsJetons[x.b]} <span class="statut">(${L.sorties[x.s]})</span> ${Math.round(x.avant * 100)} % → ${Math.round(x.apres * 100)} %`;
}

function phrasesReglages(labo, r) {
  const L = labo.L, lignes = [];
  const liste = xs => xs.slice(0, 3).map(x => phraseConfiance(L, x)).join(' · ') + (xs.length > 3 ? ' …' : '');
  if (r.plusSur.length) lignes.push(tr(`Plus sûr sur ${r.plusSur.length} situation${r.plusSur.length > 1 ? 's' : ''}`, `More confident on ${r.plusSur.length} situation${r.plusSur.length > 1 ? 's' : ''}`) + tr(' : ', ': ') + liste(r.plusSur));
  if (r.moinsSur.length) lignes.push(tr(`Moins sûr sur ${r.moinsSur.length} situation${r.moinsSur.length > 1 ? 's' : ''}`, `Less confident on ${r.moinsSur.length} situation${r.moinsSur.length > 1 ? 's' : ''}`) + tr(' : ', ': ') + liste(r.moinsSur));
  if (r.liens.length) lignes.push(tr('Pour ça', 'To do this') + tr(' : ', ': ') + r.liens.map(x => phraseLien(labo, x)).join(' ; ') +
    (r.nbLiens > r.liens.length ? tr(` (+${r.nbLiens - r.liens.length} petits réglages)`, ` (+${r.nbLiens - r.liens.length} small adjustments)`) : ''));
  return lignes;
}

// =====================================================================
//  ESSAIS RATÉS : un enfant du meilleur cerveau a changé de forme et a fait moins bien.
//  On mesure ce qu'il aurait cassé.
// =====================================================================
const ICONES_ESSAI = { 'neurone+': '🌱', 'neurone-': '✂️', mort: '🍂', 'lien+': '➕', 'lien-': '➖' };

function expliquerEssai(labo, parent, enfant) {
  const diff = differenceCerveaux(labo, parent, enfant);
  const retires = enfant.nouveaux.filter(e => (e.type === 'neurone-' || e.type === 'mort') && parent.noeuds.has(e.noeud))
    .map(e => ({ id: e.noeud, e: expliquerNeurone(labo, parent, e.noeud) }));
  return { appris: diff.appris, oublie: diff.oublie, retires };
}

function phraseEssai(labo, r) {
  const L = labo.L, perte = (r.scoreAvant - r.scoreApres) / labo.scoreMax * 100;
  const quoi = r.evenements.map(e => `${ICONES_ESSAI[e.type] || ''} ${txt(e.texte)}`).join(' · ');
  const morceaux = [];
  for (const x of r.sens.retires) morceaux.push(`N${x.id} ${phraseRoles(labo, x.e, 1)}`);
  if (r.sens.oublie.length) morceaux.push(tr(`je me serais trompé sur ${r.sens.oublie.length} situation${r.sens.oublie.length > 1 ? 's' : ''} ${phraseParReponse(L, r.sens.oublie)}`,
    `I would have been wrong on ${r.sens.oublie.length} situation${r.sens.oublie.length > 1 ? 's' : ''} ${phraseParReponse(L, r.sens.oublie)}`));
  if (r.sens.appris.length) morceaux.push(tr(`j'aurais appris ${r.sens.appris.length} situation${r.sens.appris.length > 1 ? 's' : ''}, mais pas assez pour compenser`,
    `I would have learned ${r.sens.appris.length} situation${r.sens.appris.length > 1 ? 's' : ''}, but not enough to make up for it`));
  if (!r.sens.oublie.length && !r.sens.appris.length) morceaux.push(tr('aucune réponse ne change, mais je suis moins sûr de moi', 'no answer changes, but I am less confident'));
  return `<span class="gen">${tr('gén.', 'gen.')} ${r.gen}</span> ${quoi}<div class="raison">❌ ${tr('Pas gardé', 'Not kept')} (−${perte.toFixed(1)} pt)${tr(' : ', ': ')}${morceaux.join(' ; ')}.</div>`;
}

// Combien de situations le cerveau juge bien : celles vues pendant l'entraînement, et celles jamais vues.
function justesseCerveau(labo, g) {
  const base = memo(labo, g).base, r = { vus: [0, 0], jamais: [0, 0] };
  situationsExplicateur(labo).forEach((c, i) => {
    const k = c.jamaisVu ? r.jamais : r.vus;
    k[1]++;
    if (estJuste(c, base[i])) k[0]++;
  });
  return r;
}

// =====================================================================
//  LE CERVEAU RÉÉCRIT LES RÈGLES : à partir de ses concepts et de ses réponses, il écrit
//  les règles qu'il pense avoir trouvées, dans le même format que celui demandé à l'IA.
//  On les vérifie donc exactement de la même façon.
// =====================================================================
function reglesDuCerveau(labo, g, monde) {
  return labo.L.reponse ? reglesTable(labo, g, monde) : reglesLangue(labo, g);
}

// Mondes « table » : un bloc par concept de A × concept de B (sa réponse la plus fréquente), puis les exceptions.
function reglesTable(labo, g, monde) {
  const L = labo.L, base = memo(labo, g).base, rep = new Map();
  situationsExplicateur(labo).forEach((c, i) => rep.set(c.m2 * L.nbJetons + c.m1, meilleure(base[i])));
  const t = (a, b) => rep.get(a * L.nbJetons + b);
  const concepts = conceptsCerveau(labo, g);
  const groupes = (role, ids) => {
    const gs = concepts.filter(c => c.role === role).map(c => c.membres), pris = new Set(gs.flat());
    return gs.concat(ids.filter(x => !pris.has(x)).map(x => [x]));
  };
  const nom = ids => ids.map(x => L.nomsEn('fr')[x]).join(' ');
  const lignes = [], exceptions = [];
  for (const ga of groupes('A', L.jetonsA)) for (const gb of groupes('B', L.jetonsB)) {
    const compte = new Map();
    for (const a of ga) for (const b of gb) compte.set(t(a, b), (compte.get(t(a, b)) || 0) + 1);
    const majorite = [...compte].sort((x, y) => y[1] - x[1])[0][0];
    if (majorite !== L.parDefaut) lignes.push(`${monde.motsBloc[majorite]}: ${nom(ga)} -> ${nom(gb)}`);
    for (const a of ga) for (const b of gb) if (t(a, b) !== majorite) exceptions.push(`${monde.motsBloc[t(a, b)]}: ${nom([a])} -> ${nom([b])}`);
  }
  return lignes.concat(exceptions).join('\n');
}

// Langue : ses familles (concepts), les mots de début, ce qui vient après chaque famille, et les combinaisons.
function reglesLangue(labo, g) {
  const L = labo.L, sit = situationsExplicateur(labo), base = memo(labo, g).base, DEBUT = L.DEBUT;
  const mot = w => L.mots[w];
  const probables = p => { const mx = Math.max(...p), r = []; p.forEach((v, w) => { if (v >= 0.4 * mx && v > 0.05) r.push(w); }); return r; };
  const familles = conceptsCerveau(labo, g).filter(c => c.role === 'B').map(c => c.membres);
  const famille = new Map();
  familles.forEach((f, i) => f.forEach(t => famille.set(t, i)));
  const lignes = familles.map(f => `FAMILLE: ${f.map(mot).join(' ')}`);
  const depart = sit.findIndex(c => c.m2 === DEBUT && c.m1 === DEBUT);
  if (depart >= 0) lignes.push(`DEBUT: ${probables(base[depart]).map(mot).join(' ')}`);
  // Deux mots de la même famille de suite → toujours le même mot ?
  const dejaDit = new Set();
  const memeFamille = [];
  sit.forEach((c, i) => { if (c.m1 !== DEBUT && c.m2 !== DEBUT && famille.has(c.m2) && famille.get(c.m2) === famille.get(c.m1)) memeFamille.push(i); });
  if (memeFamille.length >= 2) {
    const compte = new Map();
    for (const i of memeFamille) { const w = meilleure(base[i]); if (base[i][w] > 0.6) compte.set(w, (compte.get(w) || 0) + 1); }
    const top = [...compte].sort((x, y) => y[1] - x[1])[0];
    if (top && top[1] >= 0.8 * memeFamille.length) { lignes.push(`COMBO_FAMILLE: ${mot(top[0])}`); memeFamille.forEach(i => dejaDit.add(i)); }
  }
  // Après chaque famille (ou mot seul) : les mots qui viennent le plus souvent
  const derniers = [...new Set(sit.map(c => c.m1).filter(t => t !== DEBUT))];
  const groupes = familles.concat(derniers.filter(t => !famille.has(t)).map(t => [t]));
  for (const gr of groupes) {
    const ids = sit.map((c, i) => i).filter(i => gr.includes(sit[i].m1) && !dejaDit.has(i));
    if (!ids.length) continue;
    const frequence = new Map();
    for (const i of ids) for (const w of probables(base[i])) frequence.set(w, (frequence.get(w) || 0) + 1);
    const suite = [...frequence].filter(([, n]) => n >= ids.length / 2).map(([w]) => w);
    if (!suite.length) continue;
    lignes.push(suite.length === 1 && gr.length === 1 ? `PAIRE: ${mot(gr[0])} -> ${mot(suite[0])}` : `APRES: ${gr.map(mot).join(' ')} -> ${suite.map(mot).join(' ')}`);
    // Une situation qui fait autre chose que sa famille : une combinaison de deux mots
    for (const i of ids) {
      const p = probables(base[i]);
      if (sit[i].m2 !== DEBUT && p.length === 1 && base[i][p[0]] > 0.6 && !(suite.length === 1 && suite[0] === p[0]))
        lignes.push(`COMBO: ${mot(sit[i].m2)} ${mot(sit[i].m1)} -> ${mot(p[0])}`);
    }
  }
  return lignes.join('\n');
}

// « tout + triangle → poison (6 situations) »
function phraseCorrection(L, c) {
  if (c.experiences) return tr(`<b>${c.n} expériences</b> (essayées dans le monde)`, `<b>${c.n} experiences</b> (tried in the world)`);
  if (c.prof) return tr(`<b>toutes ses erreurs</b> avec la bonne réponse (${c.n} situations)`, `<b>all its mistakes</b> with the right answer (${c.n} situations)`);
  const nom = t => (t < 0 ? tr('tout', 'any') : L.nomsJetons[t]);
  return `${nom(c.a)} ${L.symboleCase || '+'} ${nom(c.b)} → <b>${L.sorties[c.s]}</b>${c.n > 1 ? tr(` (${c.n} situations)`, ` (${c.n} situations)`) : ''}`;
}

// =====================================================================
//  CE QU'IL REGARDE : on « cache » ce qu'il lit en A (on met la même position pour toutes les couleurs,
//  tous les mots…), puis en B, et on mesure de combien ses réponses bougent. C'est la question du loup :
//  regarde-t-il la neige ou l'animal ?
// =====================================================================
function regardCerveau(labo, g) {
  const m = memo(labo, g);
  if (m.regard) return m.regard;
  const L = labo.L, sit = situationsExplicateur(labo), prog = labo.compiler(g), v = new Float64Array(prog.taille);
  const moyenne = ids => {
    const p = new Float64Array(DIM), vrais = ids.filter(t => t !== L.jetonSpecial);
    for (const t of vrais) for (let k = 0; k < DIM; k++) p[k] += g.plong[t * DIM + k] / vrais.length;
    return p;
  };
  const effet = fixe => {
    let total = 0;
    sit.forEach((c, i) => {
      const p = new Float64Array(labo.nbSorties);
      labo.propager(g, prog, c.m2, c.m1, v, p, fixe);
      for (let s = 0; s < p.length; s++) total += Math.abs(p[s] - m.base[i][s]) / 2;
    });
    return total / sit.length;
  };
  const a = effet({ A: moyenne(L.jetonsA) }), b = effet({ B: moyenne(L.jetonsB) });
  m.regard = { A: a + b > 1e-9 ? a / (a + b) : 0.5, B: a + b > 1e-9 ? b / (a + b) : 0.5 };
  return m.regard;
}

// « couleur 85 % · forme 15 % »
function phraseRegard(L, r) {
  const pc = x => Math.round(x * 100) + ' %';
  return `${L.entree.courtA} <b>${pc(r.A)}</b> · ${L.entree.courtB} <b>${pc(r.B)}</b>`;
}
