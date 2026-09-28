'use strict';
// =====================================================================
//  MONDE « CRÉATURE » : une petite bête sur une grille 5×5 mange des objets.
//  Le cerveau lit la couleur et la forme d'un objet, et prédit : nourrit, empoisonne ou rien.
//  La créature utilise ce cerveau pour choisir quoi manger.
// =====================================================================

const COULEURS_OBJETS = [
  { fr: 'rouge', en: 'red', couleur: '#ff5a5a' }, { fr: 'bleu', en: 'blue', couleur: '#4aa3ff' },
  { fr: 'vert', en: 'green', couleur: '#5fd08a' }, { fr: 'jaune', en: 'yellow', couleur: '#ffd84a' },
  { fr: 'violet', en: 'purple', couleur: '#b69cff' }, { fr: 'orange', en: 'orange', couleur: '#ff9f43' },
  { fr: 'rose', en: 'pink', couleur: '#ff7ac6' },
];
const FORMES_OBJETS = [
  { fr: 'rond', en: 'circle', forme: 'rond' }, { fr: 'carré', en: 'square', forme: 'carre' },
  { fr: 'triangle', en: 'triangle', forme: 'triangle' }, { fr: 'étoile', en: 'star', forme: 'etoile' },
  { fr: 'losange', en: 'diamond', forme: 'losange' }, { fr: 'hexagone', en: 'hexagon', forme: 'hexagone' },
  { fr: 'croix', en: 'cross', forme: 'croix' },
];
const NOURRIT = 0, POISON = 1, RIEN = 2;
const COULEURS_EFFET = ['#5fd08a', '#ff6b6b', '#9aa1b5'];
const SYMBOLES_EFFET = ['🍏', '☠', '·'];

function genererCreature(mode, graine, taille) {
  const h = creerHasard(graine);
  const n = mode === 'loup' ? 6 : { petite: 4, moyenne: 6, grande: 7 }[taille] || 4;
  const couleurs = h.melanger(COULEURS_OBJETS).slice(0, n), formes = h.melanger(FORMES_OBJETS).slice(0, n);
  const jetonsA = [...Array(n).keys()], jetonsB = jetonsA.map(i => i + n);
  const L = { mode, graine, couleurs, formes, nbJetons: 2 * n, jetonsA, jetonsB, parDefaut: RIEN, testDepart: [0, n], symboleCase: '' };
  nommer(L, {
    jetons: { fr: couleurs.map(c => c.fr).concat(formes.map(f => f.fr)), en: couleurs.map(c => c.en).concat(formes.map(f => f.en)) },
    sorties: { fr: ['nourrit', 'empoisonne', 'rien'], en: ['food', 'poison', 'nothing'] },
    entree: {
      fr: { courtA: 'couleur', courtB: 'forme', longA: "couleur de l'objet", longB: "forme de l'objet", resumeA: 'si la couleur est :', resumeB: 'si la forme est :' },
      en: { courtA: 'color', courtB: 'shape', longA: 'object color', longB: 'object shape', resumeA: 'if the color is:', resumeB: 'if the shape is:' },
    },
  });

  const effet = new Map();
  const cle = (a, b) => a * L.nbJetons + b;
  const nomEffet = (s, l) => L.sortiesEn(l)[s];
  L.regles = [];
  if (mode === 'loup') piegeLoup(L, h, n);
  else if (mode === 'hasard') {
    // Chaque objet a son effet, tiré au hasard : il n'y a pas de logique à trouver, il faut tout retenir.
    for (const a of jetonsA) for (const b of jetonsB) {
      const r = h();
      effet.set(cle(a, b), r < 0.35 ? NOURRIT : r < 0.65 ? POISON : RIEN);
    }
    for (const a of jetonsA) L.regles.push({
      cases: jetonsB.map(b => [a, b]), toutes: true,
      texte: l => `<b>${L.nomsEn(l)[a]}</b>${l === 'en' ? ':' : ' :'} ` + jetonsB.map(b => `${L.nomsEn(l)[b]} → ${nomEffet(effet.get(cle(a, b)), l)}`).join(', ') + '.',
    });
  } else {
    // Des groupes de couleurs × des groupes de formes : chaque bloc a son effet, plus quelques exceptions.
    //  - logique : 2 × 2 groupes, effets tirés au hasard (souvent, la couleur seule ou la forme seule suffit à décider) ;
    //  - croise  : les effets tournent en damier (2 × 2) ou en carré latin (3 × 3). Ni la couleur seule ni la forme
    //    seule ne dit rien : il faut les combiner, et pour ça le cerveau doit faire pousser des neurones au milieu.
    const k = mode === 'croise' && n >= 6 ? 3 : 2;
    const decouper = ids => [...Array(k)].map((_, i) => ids.slice(Math.round(i * n / k), Math.round((i + 1) * n / k)));
    const groupesC = decouper(h.melanger(jetonsA)), groupesF = decouper(h.melanger(jetonsB));
    let base;
    if (mode === 'croise') {
      const tour = h.melanger([NOURRIT, POISON, RIEN]);
      base = (i, j) => tour[(i + j) % k];
    } else {
      const bases = h.melanger([NOURRIT, POISON, RIEN, h.choisir([NOURRIT, POISON, RIEN])]);
      base = (i, j) => bases[i * 2 + j];
    }
    const exceptions = [];
    const nbExceptions = { petite: 1, moyenne: 2, grande: 4 }[taille] || 1;
    for (let k = 0, essais = 0; k < nbExceptions && essais < 50; essais++) {
      const a = h.choisir(jetonsA), b = h.choisir(jetonsB);
      if (exceptions.some(e => e.a === a && e.b === b)) continue;
      const normal = base(groupesC.findIndex(g => g.includes(a)), groupesF.findIndex(g => g.includes(b)));
      exceptions.push({ a, b, s: h.choisir([NOURRIT, POISON, RIEN].filter(s => s !== normal)) });
      k++;
    }
    groupesC.forEach((gC, i) => groupesF.forEach((gF, j) => {
      const s = base(i, j);
      const cases = [];
      for (const a of gC) for (const b of gF) {
        const ex = exceptions.find(e => e.a === a && e.b === b);
        effet.set(cle(a, b), ex ? ex.s : s);
        if (!ex) cases.push([a, b]);
      }
      const liste = (ids, l) => ids.map(t => L.nomsEn(l)[t]).join(', ');
      L.regles.push({
        cases, toutes: true,
        texte: l => l === 'en'
          ? `Colors <b>${liste(gC, l)}</b> with shapes <b>${liste(gF, l)}</b> → ${nomEffet(s, l)}.`
          : `Couleurs <b>${liste(gC, l)}</b> avec les formes <b>${liste(gF, l)}</b> → ${nomEffet(s, l)}.`,
      });
    }));
    for (const e of exceptions) L.regles.push({
      cases: [[e.a, e.b]], toutes: true,
      texte: l => `Exception${l === 'en' ? ':' : ' :'} ${L.nomsEn(l)[e.a]} ${L.nomsEn(l)[e.b]} → ${nomEffet(e.s, l)}.`,
    });
  }
  if (mode !== 'loup') remplirTable(L, (a, b) => effet.get(cle(a, b)));
  L.couleurJeton = t => (t < n ? couleurs[t].couleur : null);
  L.couleurSortie = s => COULEURS_EFFET[s];
  L.symbole = s => SYMBOLES_EFFET[s];
  return L;
}

// ---------- Le loup dans la neige ----------
// La vraie règle combine la couleur ET la forme (en carré latin : il faut des neurones pour la suivre).
// Mais pendant l'entraînement, il ne voit que 5 cases du damier sur 9 : il fait pousser quelques neurones
// pour ce qu'il voit, et en déduit une règle fausse pour les 4 cases qu'il n'a jamais vues.
// Le monde de la créature, lui, contient tous les objets, y compris ceux jamais vus pendant l'entraînement.
function piegeLoup(L, h, n) {
  const decouper = ids => [0, 1, 2].map(i => ids.slice(Math.round(i * n / 3), Math.round((i + 1) * n / 3)));
  const gc = decouper(h.melanger(L.jetonsA)), gf = decouper(h.melanger(L.jetonsB));
  const groupe = (gs, t) => gs.findIndex(x => x.includes(t));
  const tour = h.melanger([NOURRIT, POISON, RIEN]);
  const effet = (a, b) => tour[(groupe(gc, a) + groupe(gf, b)) % 3];
  L.reponse = effet;
  L.permis = (a, b) => new Set([effet(a, b)]);
  const montres = [[0, 0], [1, 1], [2, 2], [0, 1], [1, 0]];   // les cases (groupe de couleurs, groupe de formes) montrées
  const vu = (a, b) => montres.some(([i, j]) => groupe(gc, a) === i && groupe(gf, b) === j);
  const vus = [];
  for (const a of L.jetonsA) for (const b of L.jetonsB) if (vu(a, b)) vus.push([a, b]);
  L.contextes = vus.map(([a, b]) => ({ m2: a, m1: b, total: 12, comptes: new Map([[effet(a, b), 12]]), permis: new Set([effet(a, b)]) }));
  const noms = (ids, l) => ids.map(t => L.nomsEn(l)[t]).join(', ');
  L.regles = [];
  gc.forEach((cs, i) => gf.forEach((fs, j) => {
    const s = tour[(i + j) % 3];
    L.regles.push({
      cases: cs.flatMap(a => fs.map(b => [a, b])), toutes: true,
      texte: l => l === 'en' ? `Colors <b>${noms(cs, l)}</b> with shapes <b>${noms(fs, l)}</b> → ${L.sortiesEn(l)[s]}.` : `Couleurs <b>${noms(cs, l)}</b> avec les formes <b>${noms(fs, l)}</b> → ${L.sortiesEn(l)[s]}.`,
    });
  }));
  L.piege = { gc, gf };
  const jamais = l => gc.flatMap((cs, i) => gf.map((fs, j) => montres.some(([x, y]) => x === i && y === j) ? null : `${noms(cs, l)} + ${noms(fs, l)}`)).filter(Boolean).join(l === 'en' ? '; ' : ' ; ');
  L.descriptions = () => L.regles.map(r => r.texte(langueUI())).concat(tr(
    `<i>Le piège : pendant l'entraînement, il n'a jamais vu ces combinaisons : ${jamais('fr')}. Il a dû deviner leur effet à partir du reste.</i>`,
    `<i>The trap: during training, it never saw these combinations: ${jamais('en')}. It had to guess their effect from the rest.</i>`));
}

// ---------- Dessin d'un objet ----------
function dessinerForme(ctx, forme, x, y, r, couleur) {
  ctx.fillStyle = couleur;
  ctx.beginPath();
  if (forme === 'rond') ctx.arc(x, y, r, 0, 7);
  else if (forme === 'carre') ctx.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7);
  else if (forme === 'triangle') { ctx.moveTo(x, y - r); ctx.lineTo(x + r, y + r * 0.8); ctx.lineTo(x - r, y + r * 0.8); ctx.closePath(); }
  else if (forme === 'losange') { ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.8, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.8, y); ctx.closePath(); }
  else if (forme === 'hexagone') {
    for (let i = 0; i < 6; i++) { const ang = i * Math.PI / 3; i ? ctx.lineTo(x + r * Math.cos(ang), y + r * Math.sin(ang)) : ctx.moveTo(x + r, y); }
    ctx.closePath();
  } else if (forme === 'croix') {
    const e = r * 0.36;
    ctx.rect(x - r, y - e, 2 * r, 2 * e); ctx.rect(x - e, y - r, 2 * e, 2 * r);
  } else if (forme === 'etoile') {
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
      i ? ctx.lineTo(x + rr * Math.cos(ang), y + rr * Math.sin(ang)) : ctx.moveTo(x + rr * Math.cos(ang), y + rr * Math.sin(ang));
    }
    ctx.closePath();
  }
  ctx.fill();
}

// ---------- La simulation : la créature choisit avec le cerveau, la vraie règle décide de l'effet ----------
const TAILLE_MONDE = 5;

function nouvelObjet(L, etat) {
  const libres = [];
  for (let x = 0; x < TAILLE_MONDE; x++) for (let y = 0; y < TAILLE_MONDE; y++)
    if (!etat.objets.some(o => o.x === x && o.y === y) && !(etat.bete.x === x && etat.bete.y === y)) libres.push([x, y]);
  const [x, y] = libres[Math.floor(Math.random() * libres.length)];
  const a = L.jetonsA[Math.floor(Math.random() * L.jetonsA.length)], b = L.jetonsB[Math.floor(Math.random() * L.jetonsB.length)];
  return { x, y, a, b, age: 0, vie: 14 + Math.floor(Math.random() * 12) };   // un objet finit par disparaître s'il n'est pas mangé
}

function avancerCreature(labo, g, L, etat) {
  const b = etat.bete;
  const prog = labo.compilerVue(g);
  // En mode prudent, un objet jamais vu ni goûté ne fait pas envie : elle l'évite
  const valeur = o => { if (estInconnu(labo, o.a, o.b)) return -1; const p = labo.activer(g, o.a, o.b, prog).probas; return p[NOURRIT] - 1.5 * p[POISON]; };
  // Choisir la cible : l'objet qu'elle croit le plus nourrissant
  let cible = null, meilleure = 0.05;
  for (const o of etat.objets) {
    const v = valeur(o) - 0.03 * (Math.abs(o.x - b.x) + Math.abs(o.y - b.y));
    if (v > meilleure) { meilleure = v; cible = o; }
  }
  etat.cible = cible;
  b.px = b.x; b.py = b.y; b.depuis = performance.now();
  // Une case est sûre si elle est libre, ou si l'objet qui s'y trouve lui fait envie
  const sure = (x, y) => x >= 0 && y >= 0 && x < TAILLE_MONDE && y < TAILLE_MONDE &&
    etat.objets.every(o => o.x !== x || o.y !== y || o === cible || valeur(o) > 0.05);
  if (cible) {
    // Vers la cible, en contournant ce qu'elle ne veut pas manger
    const vers = [[Math.sign(cible.x - b.x), 0], [0, Math.sign(cible.y - b.y)]].filter(([dx, dy]) => dx || dy);
    const cotes = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(d => !vers.some(v => v[0] === d[0] && v[1] === d[1]));
    const pas = vers.find(([dx, dy]) => sure(b.x + dx, b.y + dy)) || cotes.find(([dx, dy]) => sure(b.x + dx, b.y + dy));
    if (pas) { b.x += pas[0]; b.y += pas[1]; }
  } else {
    // Rien ne lui fait envie : elle se promène en évitant les objets
    const pas = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [b.x + dx, b.y + dy])
      .filter(([x, y]) => x >= 0 && y >= 0 && x < TAILLE_MONDE && y < TAILLE_MONDE && !etat.objets.some(o => o.x === x && o.y === y));
    if (pas.length) [b.x, b.y] = pas[Math.floor(Math.random() * pas.length)];
  }
  etat.energie -= 1;
  // Les objets trop vieux disparaissent et d'autres apparaissent : il y a toujours de quoi manger quelque part
  for (const o of etat.objets) o.age++;
  const vieux = etat.objets.filter(o => o.age > o.vie);
  etat.objets = etat.objets.filter(o => o.age <= o.vie);
  for (let i = 0; i < vieux.length; i++) etat.objets.push(nouvelObjet(L, etat));
  const mange = etat.objets.find(o => o.x === b.x && o.y === b.y);
  if (mange) {
    const effet = L.reponse(mange.a, mange.b);
    etat.energie += [18, -25, 0][effet];
    etat.compte[effet]++;
    etat.derniers.push(effet); if (etat.derniers.length > 20) etat.derniers.shift();
    etat.bulles.push({ x: b.x, y: b.y, texte: [tr('miam !', 'yum!'), tr('beurk !', 'yuck!'), '…'][effet], couleur: COULEURS_EFFET[effet], t: performance.now() });
    etat.flash = { couleur: COULEURS_EFFET[effet], t: performance.now() };
    etat.objets = etat.objets.filter(o => o !== mange);
    etat.objets.push(nouvelObjet(L, etat));
  }
  etat.energie = Math.min(100, etat.energie);
  if (etat.energie <= 0) {
    etat.malaises++;
    etat.energie = 60;
    etat.bulles.push({ x: b.x, y: b.y, texte: tr('malaise…', 'fainted…'), couleur: COULEURS.ko, t: performance.now() });
  }
}

function dessinerCreature(canvas, labo, g, L, voir, etat) {
  const w0 = canvas.clientWidth || 400;
  const cote = Math.min(56, (w0 - 20) / TAILLE_MONDE), grille = cote * TAILLE_MONDE;
  const nA = L.jetonsA.length, nB = L.jetonsB.length, caseT = 34;
  const hautTable = 40 + caseT * nA + 30;
  canvas.dataset.h = Math.round(grille + 86 + hautTable);
  const { ctx, w } = preparer(canvas);
  const t = performance.now();

  if (!etat.objets) {
    Object.assign(etat, { objets: [], bete: { x: 2, y: 2, px: 2, py: 2, depuis: t }, energie: 70, compte: [0, 0, 0], derniers: [], bulles: [], malaises: 0, dernierPas: t });
    for (let i = 0; i < 6; i++) etat.objets.push(nouvelObjet(L, etat));
  }
  if (t - etat.dernierPas > 380) { etat.dernierPas = t; avancerCreature(labo, g, L, etat); }

  const x0 = (w - grille) / 2, y0 = 60;
  // Énergie et compteurs
  ctx.font = '12px system-ui'; ctx.fillStyle = COULEURS.doux; ctx.textAlign = 'left';
  ctx.fillText(tr('énergie', 'energy'), 8, 16);
  ctx.fillStyle = '#12151d'; ctx.fillRect(62, 7, w - 70, 12);
  ctx.fillStyle = etat.energie > 30 ? COULEURS.ok : COULEURS.ko; ctx.fillRect(62, 7, (w - 70) * etat.energie / 100, 12);
  const bons = etat.derniers.filter(e => e === NOURRIT).length, mauvais = etat.derniers.filter(e => e === POISON).length;
  ctx.fillStyle = COULEURS.doux;
  ctx.fillText(tr(`mangé : ${etat.compte[0]} 🍏 · ${etat.compte[1]} ☠ · ${etat.compte[2]} sans effet · ${etat.malaises} malaise${etat.malaises > 1 ? 's' : ''}`,
    `eaten: ${etat.compte[0]} 🍏 · ${etat.compte[1]} ☠ · ${etat.compte[2]} no effect · ${etat.malaises} faint${etat.malaises > 1 ? 's' : ''}`), 8, 36);
  if (etat.derniers.length)
    ctx.fillText(tr(`20 derniers repas : ${bons} bons, ${mauvais} poisons`, `last 20 meals: ${bons} good, ${mauvais} poison`), 8, 52);

  // Le monde
  for (let x = 0; x < TAILLE_MONDE; x++) for (let y = 0; y < TAILLE_MONDE; y++) {
    ctx.fillStyle = (x + y) % 2 ? '#161a24' : '#1b2030';
    ctx.fillRect(x0 + x * cote, y0 + y * cote, cote, cote);
  }
  if (etat.flash && t - etat.flash.t < 400) {
    ctx.globalAlpha = 0.25 * (1 - (t - etat.flash.t) / 400);
    ctx.fillStyle = etat.flash.couleur; ctx.fillRect(x0, y0, grille, grille);
    ctx.globalAlpha = 1;
  }
  const prog = labo.compilerVue(g);
  for (const o of etat.objets) {
    const cx = x0 + (o.x + 0.5) * cote, cy = y0 + (o.y + 0.5) * cote;
    if (o === etat.cible) { ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.setLineDash([3, 3]); ctx.strokeRect(x0 + o.x * cote + 3, y0 + o.y * cote + 3, cote - 6, cote - 6); ctx.setLineDash([]); }
    ctx.globalAlpha = Math.max(0.25, Math.min(1, (o.vie - o.age + 1) / 4, (o.age + 1) / 2));   // apparaît et s'efface doucement
    dessinerForme(ctx, L.formes[o.b - nA].forme, cx, cy, cote * 0.26, L.couleurs[o.a].couleur);
    ctx.globalAlpha = 1;
    if (voir) {
      ctx.font = '11px system-ui'; ctx.textAlign = 'right'; ctx.fillStyle = COULEURS_EFFET[L.reponse(o.a, o.b)];
      ctx.fillText(SYMBOLES_EFFET[L.reponse(o.a, o.b)], x0 + (o.x + 1) * cote - 3, y0 + o.y * cote + 12);
    }
  }
  // La créature, qui glisse d'une case à l'autre
  const b = etat.bete, q = Math.min(1, (t - b.depuis) / 300);
  const bx = x0 + (b.px + (b.x - b.px) * q + 0.5) * cote, by = y0 + (b.py + (b.y - b.py) * q + 0.5) * cote;
  const saut = Math.sin(q * Math.PI) * cote * 0.08;
  ctx.fillStyle = '#7c9cff';
  ctx.beginPath(); ctx.ellipse(bx, by - saut, cote * 0.3, cote * 0.26, 0, 0, 7); ctx.fill();
  const regard = etat.cible ? Math.atan2(etat.cible.y - b.y, etat.cible.x - b.x) : 0;
  for (const dx of [-0.11, 0.11]) {
    const ex = bx + dx * cote, ey = by - saut - cote * 0.06;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, cote * 0.075, 0, 7); ctx.fill();
    ctx.fillStyle = '#10131a'; ctx.beginPath(); ctx.arc(ex + Math.cos(regard) * cote * 0.03, ey + Math.sin(regard) * cote * 0.03, cote * 0.035, 0, 7); ctx.fill();
  }
  // Bulles « miam ! » / « beurk ! »
  etat.bulles = etat.bulles.filter(u => t - u.t < 1200);
  ctx.textAlign = 'center'; ctx.font = '600 13px system-ui';
  for (const u of etat.bulles) {
    const a = 1 - (t - u.t) / 1200;
    ctx.globalAlpha = a; ctx.fillStyle = u.couleur;
    ctx.fillText(u.texte, x0 + (u.x + 0.5) * cote, y0 + u.y * cote - 4 - (1 - a) * 18);
  }
  ctx.globalAlpha = 1;

  // Ce que le cerveau pense de chaque objet
  const yt = y0 + grille + 26;
  ctx.textAlign = 'left'; ctx.font = '600 12px system-ui'; ctx.fillStyle = COULEURS.texte;
  ctx.fillText(tr('Ce que le cerveau pense de chaque objet', 'What the brain thinks of each object'), 8, yt);
  const xt = Math.max(8, (w - (70 + caseT * nB)) / 2) + 70;
  L.jetonsB.forEach((tb, j) => dessinerForme(ctx, L.formes[tb - nA].forme, xt + (j + 0.5) * caseT, yt + 20, 8, '#9aa1b5'));
  let justes = 0;
  L.jetonsA.forEach((ta, i) => {
    const y = yt + 34 + i * caseT;
    ctx.fillStyle = L.couleurs[ta].couleur; ctx.font = '12px system-ui'; ctx.textAlign = 'right';
    ctx.fillText(L.nomsJetons[ta], xt - 8, y + caseT / 2 + 4);
    L.jetonsB.forEach((tb, j) => {
      const p = labo.activer(g, ta, tb, prog).probas, c = p.indexOf(Math.max(...p));
      const x = xt + j * caseT, inconnu = estInconnu(labo, ta, tb);
      ctx.globalAlpha = inconnu ? 1 : 0.15 + 0.75 * p[c]; ctx.fillStyle = inconnu ? '#2b3040' : COULEURS_EFFET[c];
      ctx.fillRect(x + 1, y + 1, caseT - 2, caseT - 2); ctx.globalAlpha = 1;
      ctx.textAlign = 'center'; ctx.font = '15px system-ui'; ctx.fillStyle = inconnu ? COULEURS.doux : '#10131a';
      ctx.fillText(inconnu ? '?' : SYMBOLES_EFFET[c], x + caseT / 2, y + caseT / 2 + 5);
      const juste = L.reponse(ta, tb) === c;
      if (juste) justes++;
      if (voir && !juste) { ctx.strokeStyle = COULEURS.ko; ctx.lineWidth = 2; ctx.strokeRect(x + 2, y + 2, caseT - 4, caseT - 4); }
    });
  });
  if (voir) {
    ctx.textAlign = 'left'; ctx.font = '12px system-ui'; ctx.fillStyle = COULEURS.doux;
    ctx.fillText(tr(`${justes} / ${nA * nB} objets bien jugés (encadré rouge = erreur)`, `${justes} / ${nA * nB} objects judged right (red frame = mistake)`), 8, yt + 34 + nA * caseT + 18);
  }
  ctx.textAlign = 'left';
}

const MONDE_CREATURE = {
  id: 'creature',
  nom: () => tr('Créature qui mange', 'Hungry creature'),
  modes: () => ({
    croise: tr('Règles croisées (couleur ET forme comptent)', 'Crossed rules (color AND shape matter)'),
    logique: tr('Règles simples (groupes + exceptions)', 'Simple rules (groups + exceptions)'),
    loup: tr('🐺 Le loup dans la neige (piège)', '🐺 The wolf in the snow (trap)'),
    hasard: tr('Chaque objet au hasard', 'Every object random'),
  }),
  tailles: () => ({ petite: tr('Petite (4 couleurs × 4 formes)', 'Small (4 colors × 4 shapes)'), moyenne: tr('Moyenne (6 × 6)', 'Medium (6 × 6)'), grande: tr('Grande (7 × 7)', 'Large (7 × 7)') }),
  generer: genererCreature,
  sansTaille: mode => mode === 'loup',
  verbeEssai: () => tr('Je goûte', 'I taste'),
  prudence: () => tr('et la créature ne mangera plus ces objets inconnus', 'and the creature will no longer eat these unknown objects'),
  titreCarte: () => tr('Carte des couleurs et des formes', 'Color and shape map'),
  aideCarte: () => tr('Chaque couleur et chaque forme a une position en 3D que le cerveau déplace lui-même. Les couleurs sont dessinées dans leur couleur, les formes en gris.',
    'Each color and each shape has a 3D position that the brain moves by itself. Colors are drawn in their own color, shapes in grey.'),
  panneau: {
    titre: () => tr('Le monde de la créature', "The creature's world"),
    aide: () => tr("La créature (en bleu) va vers l'objet que son cerveau croit le plus nourrissant, et évite ce qu'il croit toxique. L'effet réel dépend des règles secrètes. Au début elle mange n'importe quoi ; plus le cerveau apprend, moins elle s'empoisonne.",
      'The creature (in blue) goes to the object its brain thinks is most nourishing, and avoids what it thinks is toxic. The real effect depends on the secret rules. At first it eats anything; the more the brain learns, the less it gets poisoned.'),
    html: '<canvas id="mondeCreature" height="520"></canvas>',
    // Pour le loup dans la neige : combien il juge bien ce qu'il a vu, et ce qu'il n'a jamais vu
    infos: (labo, g, L) => (L.mode !== 'loup' ? '' : infosPiege(labo, g, L, tr(
      "Ici : la vraie règle combine la couleur ET la forme. Mais pendant l'entraînement, certaines combinaisons couleur + forme ne lui ont jamais été montrées. Il fait pousser des neurones pour ce qu'il voit… et en déduit une règle fausse pour le reste. Corrige-le sur des objets jamais vus : ses neurones vont changer de rôle, d'autres vont naître, et le film te dira lesquels et pourquoi.",
      'Here: the real rule combines color AND shape. But during training, some color + shape combinations were never shown to it. It grows neurons for what it sees… and deduces a wrong rule for the rest. Correct it on never-seen objects: its neurons will change roles, others will be born, and the film will tell you which ones and why.'))),
    dessiner: (labo, g, L, voir, etat) => dessinerCreature(document.getElementById('mondeCreature'), labo, g, L, voir, etat),
  },
  prompt: {
    tache: L => tr(`Sa tâche : dire ce que fait un objet quand une petite créature le mange. Il lit la couleur et la forme de l'objet (${L.jetonsA.length} couleurs, ${L.jetonsB.length} formes), et répond « nourrit », « empoisonne » ou « rien ». Des règles secrètes décident de l'effet.`,
      `Its task: tell what an object does when a small creature eats it. It reads the object's color and shape (${L.jetonsA.length} colors, ${L.jetonsB.length} shapes), and answers "food", "poison" or "nothing". Secret rules decide the effect.`),
    vocabulaire: L => tr(`# Couleurs\n${L.jetonsA.map(t => L.nomsJetons[t]).join(', ')}\n# Formes\n${L.jetonsB.map(t => L.nomsJetons[t]).join(', ')}`,
      `# Colors\n${L.jetonsA.map(t => L.nomsJetons[t]).join(', ')}\n# Shapes\n${L.jetonsB.map(t => L.nomsJetons[t]).join(', ')}`),
    indiceRegles: () => tr("Une liste numérotée. Quels objets nourrissent, lesquels empoisonnent, lesquels ne font rien. Cherche des groupes (de couleurs, de formes) et des exceptions.",
      'A numbered list. Which objects are food, which are poison, which do nothing. Look for groups (of colors, of shapes) and exceptions.'),
    consigne: () => tr(`## 5. Bloc pour la vérification automatique
Recopie tes règles dans ce format exact, entre une ligne DEBUT-REGLES et une ligne FIN-REGLES. Chaque ligne donne une liste de couleurs et une liste de formes : la règle vaut pour toutes les combinaisons. * veut dire « toutes ». Seulement des noms de couleurs et de formes, sans guillemets :
NOURRIT: couleur couleur -> forme forme
POISON: couleur -> forme forme
RIEN: couleur -> *
Tout objet que tu ne cites pas sera compté comme « rien ». Si une exception contredit une ligne plus haut, écris-la plus bas : la dernière ligne gagne.`, `## 5. Block for automatic checking
Copy your rules in this exact format, between a line BEGIN-RULES and a line END-RULES. Each line gives a list of colors and a list of shapes: the rule holds for every combination. * means "all". Only color and shape names, no quotes:
FOOD: color color -> shape shape
POISON: color -> shape shape
NOTHING: color -> *
Any object you do not mention will count as "nothing". If an exception contradicts an earlier line, write it lower: the last line wins.`),
  },
  lireBloc: (L, texte) => lireBlocTable(L, texte, { NOURRIT, FOOD: NOURRIT, POISON, RIEN, NOTHING: RIEN }),
  motsBloc: ['NOURRIT', 'POISON', 'RIEN'],   // pour que le cerveau écrive ses propres règles
  evaluer: evaluerTable,
  affirmations: affirmationsTable,
  grille: grilleComparaison,
  phrase: (L, l) => {
    const q = ids => ids.map(m => `<b style="color:${L.couleurJeton(m) || 'inherit'}">${L.nomsJetons[m]}</b>`).join(', ');
    return `${q(l.gauche)} + ${q(l.droite)} → ${SYMBOLES_EFFET[l.reponse]} ${L.sorties[l.reponse]}`;
  },
};
