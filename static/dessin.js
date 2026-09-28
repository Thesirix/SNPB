'use strict';
// =====================================================================
//  DESSIN : carte des mots et réseau en 3D, courbes, profil d'un neurone.
// =====================================================================

const COULEURS = {};
function lireCouleurs() {
  const s = getComputedStyle(document.documentElement);
  for (const n of ['texte', 'doux', 'bord', 'accent', 'positif', 'negatif', 'ok', 'ko', 'famA', 'famB', 'famC', 'famD', 'famE']) {
    COULEURS[n] = s.getPropertyValue('--' + n).trim();
  }
}
const couleurFamille = g => COULEURS[['famA', 'famB', 'famC', 'famD', 'famE'][g]];

function preparer(canvas) {
  const dpr = window.devicePixelRatio || 1;
  if (!canvas.dataset.h) canvas.dataset.h = canvas.getAttribute('height');
  const h = Number(canvas.dataset.h);
  const w = canvas.clientWidth || 300;
  canvas.style.height = h + 'px';
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

// Valeur d'un neurone (-1..1) -> couleur : bleu si positif, orange si négatif.
function couleurValeur(v, alphaMin = 0.08) {
  const a = Math.min(1, Math.abs(v));
  const rgb = v >= 0 ? '92,200,255' : '255,159,90';
  return `rgba(${rgb},${alphaMin + (1 - alphaMin) * a})`;
}

// ---------- Petite caméra 3D (sans bibliothèque) ----------
// On fait tourner la scène en la faisant glisser à la souris. Tant qu'on n'y a pas touché,
// elle se balance doucement pour qu'on sente la profondeur.
class Camera3D {
  constructor(canvas, { yaw = -0.5, pitch = 0.3, distance = 5, balance = 0.3 } = {}) {
    Object.assign(this, { yaw, pitch, distance, balance, yaw0: yaw, pitch0: pitch, touche: false, surClic: null });
    canvas.classList.add('tournable');
    let depart = null;
    canvas.addEventListener('pointerdown', e => {
      depart = { x: e.clientX, y: e.clientY, yaw: this.yaw, pitch: this.pitch, bouge: false };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', e => {
      if (!depart) return;
      const dx = e.clientX - depart.x, dy = e.clientY - depart.y;
      if (!depart.bouge && Math.hypot(dx, dy) < 4) return;
      depart.bouge = true;
      this.touche = true;
      this.yaw = depart.yaw + dx * 0.01;
      this.pitch = Math.max(-1.45, Math.min(1.45, depart.pitch + dy * 0.01));
    });
    canvas.addEventListener('pointerup', e => {
      if (depart && !depart.bouge && this.surClic) {
        const r = canvas.getBoundingClientRect();
        this.surClic(e.clientX - r.left, e.clientY - r.top);
      }
      depart = null;
    });
  }

  reinitialiser() { this.touche = false; this.yaw = this.yaw0; this.pitch = this.pitch0; }

  cadrer(echelle, cx, cy) {
    if (!this.touche && this.balance) this.yaw = this.yaw0 + this.balance * Math.sin(performance.now() / 3500);
    Object.assign(this, { S: echelle, cx, cy, cyaw: Math.cos(this.yaw), syaw: Math.sin(this.yaw), cp: Math.cos(this.pitch), sp: Math.sin(this.pitch) });
  }

  // Point 3D -> point à l'écran. k = grossissement dû à la perspective, p = profondeur (grand = loin).
  projeter(x, y, z) {
    const x1 = x * this.cyaw + z * this.syaw, z1 = -x * this.syaw + z * this.cyaw;
    const y2 = y * this.cp - z1 * this.sp, z2 = y * this.sp + z1 * this.cp;
    const k = this.distance / (this.distance + z2);
    return { x: this.cx + x1 * this.S * k, y: this.cy - y2 * this.S * k, k, p: z2 };
  }
}

const trait = (ctx, a, b) => { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); };

// ---------- Carte des mots (3D) ----------
function dessinerCarte(canvas, cam, L, positions, voirFamilles, surbrillance, concepts = []) {
  const { ctx, w, h } = preparer(canvas);
  cam.cadrer(Math.min(w, h) / 3.3, w / 2, h / 2 + 6);
  const P = (x, y, z) => cam.projeter(x, y, z);

  // La boîte (-1..1 sur chaque axe) et le sol quadrillé
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(154,161,181,.10)';
  for (let i = -1; i <= 1; i += 0.5) { trait(ctx, P(i, -1, -1), P(i, -1, 1)); trait(ctx, P(-1, -1, i), P(1, -1, i)); }
  ctx.strokeStyle = COULEURS.bord;
  for (const u of [-1, 1]) for (const v of [-1, 1]) {
    trait(ctx, P(-1, u, v), P(1, u, v)); trait(ctx, P(u, -1, v), P(u, 1, v)); trait(ctx, P(u, v, -1), P(u, v, 1));
  }
  // Les trois axes
  ctx.setLineDash([3, 4]);
  ctx.font = '12px system-ui'; ctx.textAlign = 'center';
  for (const [ax, nom] of [[[1, 0, 0], 'x'], [[0, 1, 0], 'y'], [[0, 0, 1], 'z']]) {
    trait(ctx, P(-ax[0], -ax[1], -ax[2]), P(ax[0], ax[1], ax[2]));
    const e = P(ax[0] * 1.2, ax[1] * 1.2, ax[2] * 1.2);
    ctx.fillStyle = COULEURS.doux; ctx.fillText(nom, e.x, e.y + 4);
  }
  ctx.setLineDash([]);

  // Les mots, du plus loin au plus proche
  const pts = [];
  for (let t = 0; t < L.nbJetons; t++) {
    const x = positions[t * DIM], y = positions[t * DIM + 1], z = positions[t * DIM + 2];
    pts.push({ t, ...P(x, y, z), sol: P(x, -1, z) });
  }
  pts.sort((a, b) => b.p - a.p);
  for (const q of pts) {
    ctx.strokeStyle = 'rgba(154,161,181,.25)';
    trait(ctx, q, q.sol);
    ctx.fillStyle = 'rgba(154,161,181,.35)';
    ctx.beginPath(); ctx.arc(q.sol.x, q.sol.y, 1.8, 0, 7); ctx.fill();
  }
  // Les concepts : les éléments que le cerveau traite pareil sont reliés, dans la couleur du concept
  const ou = new Map(pts.map(q => [q.t, q]));
  ctx.setLineDash([4, 3]); ctx.lineWidth = 1.5;
  for (const c of concepts) {
    ctx.strokeStyle = c.couleur;
    const qs = c.membres.map(t => ou.get(t)).filter(Boolean);
    for (let i = 0; i < qs.length; i++) for (let j = i + 1; j < qs.length; j++) trait(ctx, qs[i], qs[j]);
  }
  ctx.setLineDash([]);
  ctx.textAlign = 'left';
  // Les noms : les mots les plus proches choisissent leur place d'abord, les autres se décalent s'ils se chevauchent
  const occupe = [];
  for (const q of pts.slice().reverse()) {
    ctx.font = `${Math.round(12 * q.k)}px system-ui`;
    const l = ctx.measureText(L.nomsJetons[q.t]).width, r = 5 * q.k;
    q.ex = q.x + r + 3; q.ey = q.y + 4;
    for (let essai = 0; essai < 8 && occupe.some(o => q.ex < o.x + o.l && o.x < q.ex + l && Math.abs(q.ey - o.y) < 12); essai++)
      q.ey += (essai % 2 ? -1 : 1) * 12 * (essai + 1);
    occupe.push({ x: q.ex, y: q.ey, l });
  }
  for (const q of pts) {
    const debut = q.t === L.jetonSpecial, r = 5 * q.k;
    ctx.globalAlpha = Math.max(0.45, Math.min(1, 1.1 - q.p * 0.25));
    if (surbrillance && surbrillance.includes(q.t)) {
      ctx.beginPath(); ctx.arc(q.x, q.y, 12 * q.k, 0, 7); ctx.fillStyle = 'rgba(124,156,255,.3)'; ctx.fill();
    }
    ctx.fillStyle = L.couleurJeton(q.t, voirFamilles) || COULEURS.texte;
    ctx.beginPath();
    if (debut) { ctx.moveTo(q.x, q.y - r - 1); ctx.lineTo(q.x + r + 1, q.y); ctx.lineTo(q.x, q.y + r + 1); ctx.lineTo(q.x - r - 1, q.y); ctx.closePath(); }
    else ctx.arc(q.x, q.y, r, 0, 7);
    ctx.fill();
    ctx.font = `${Math.round(12 * q.k)}px system-ui`;
    if (Math.abs(q.ey - q.y - 4) > 1) { ctx.strokeStyle = 'rgba(154,161,181,.3)'; trait(ctx, q, { x: q.ex, y: q.ey - 4 }); }
    ctx.fillText(L.nomsJetons[q.t], q.ex, q.ey);
  }
  ctx.globalAlpha = 1;
  ctx.font = '11px system-ui'; ctx.fillStyle = COULEURS.doux;
  ctx.fillText(tr('glisse pour faire tourner', 'drag to rotate'), 8, h - 8);
}

// ---------- Réseau (3D, en couches) ----------
// Le signal va de gauche (ce qu'il lit) à droite (sa réponse). Chaque couche de neurones est un plan.
// Les neurones cachés se placent tout seuls dans leur plan, attirés par ceux avec qui ils sont reliés.
const DUREE_ANIM = 900;
const Y_ENTREES = [1.15, 0.95, 0.75, 0.25, 0.05, -0.15];

function creerVueReseau() {
  return { pos: new Map(), liens: new Map(), fantomes: [], liensMourants: [], idCerveau: null, message: null, pret: false };
}

// Renvoie la position à l'écran des neurones cachés pour pouvoir cliquer dessus.
function dessinerReseau(canvas, cam, labo, g, vue, activation, selection, voirFamilles, options) {
  const { ctx, w, h } = preparer(canvas);
  const L = labo.L;
  const { tousLiens, resumes, mots, gen, banniere, eteints, importances } = options;
  const eteint = id => !!(eteints && eteints.has(id));
  const t = performance.now();
  const { prof, max } = labo.couches(g);
  const X = p => -1.2 + 2.4 * p / max;
  const caches = [...g.noeuds].filter(id => labo.estCache(id));
  const n = labo.nbSorties;

  // Un cerveau d'une autre espèce prend la tête : on le signale, ce n'est pas une croissance.
  if (vue.idCerveau !== null && g.id !== vue.idCerveau && !(g.lignee || []).includes(vue.idCerveau) && g.espece !== vue.espece && banniere)
    vue.message = { texte: tr(`⇄ Un cerveau d'une autre espèce (${g.espece}) prend la tête`, `⇄ A brain from another species (${g.espece}) takes the lead`), t };
  vue.idCerveau = g.id;
  vue.espece = g.espece;
  const debut = vue.pret ? t : -Infinity;   // à la toute première image, pas d'animation

  // Places fixes : les entrées à gauche, les réponses à droite
  const fixes = new Map();
  for (let i = 0; i < BIAIS; i++) fixes.set(i, { x: X(0), y: Y_ENTREES[i], z: 0 });
  fixes.set(BIAIS, { x: X(0), y: -1.05, z: 0 });
  for (let s = 0; s < n; s++) fixes.set(PREMIERE_SORTIE + s, { x: X(max), y: 1.25 - 2.5 * s / Math.max(1, n - 1), z: 0 });

  // Naissances et morts de neurones
  for (const id of g.noeuds) {
    if (vue.pos.has(id)) continue;
    if (fixes.has(id)) { vue.pos.set(id, { ...fixes.get(id), ne: -Infinity }); continue; }
    // Un neurone naît au milieu du lien qu'il coupe
    const naissance = (g.histoire || []).slice().reverse().find(e => e.type === 'neurone+' && e.noeud === id);
    let a = naissance && (vue.pos.get(naissance.de) || fixes.get(naissance.de));
    let b = naissance && (vue.pos.get(naissance.vers) || fixes.get(naissance.vers));
    if (!a || !b) {
      const cin = g.conns.find(c => c.actif && c.vers === id), cout = g.conns.find(c => c.actif && c.de === id);
      a = cin && (vue.pos.get(cin.de) || fixes.get(cin.de));
      b = cout && (vue.pos.get(cout.vers) || fixes.get(cout.vers));
    }
    const m = a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 } : { x: X(prof.get(id) || 1), y: 0, z: 0 };
    vue.pos.set(id, { ...m, z: m.z + (Math.random() - 0.5) * 0.3, ne: debut });
  }
  for (const [id, p] of vue.pos) if (!g.noeuds.has(id)) { vue.fantomes.push({ ...p, id, mort: t }); vue.pos.delete(id); }

  // Déplacement : les fixes glissent vers leur place, les cachés vers leur couche et leurs voisins
  for (const [id, p] of vue.pos) {
    const f = fixes.get(id);
    if (f) { p.x += (f.x - p.x) * 0.2; p.y += (f.y - p.y) * 0.2; p.z += (f.z - p.z) * 0.2; continue; }
    p.x += (X(prof.get(id) || 1) - p.x) * 0.1;
    let sy = 0, sz = 0, sw = 0;
    for (const c of g.conns) {
      if (!c.actif || (c.de !== id && c.vers !== id)) continue;
      const o = vue.pos.get(c.de === id ? c.vers : c.de);
      if (!o) continue;
      const poids = Math.min(1, Math.abs(c.poids) / 2) + 0.2;
      sy += o.y * poids; sz += o.z * poids; sw += poids;
    }
    if (sw) { p.y += (sy / sw - p.y) * 0.02; p.z += (0.5 * sz / sw - p.z) * 0.02; }
    for (const [id2, q] of vue.pos) {
      if (id2 === id || fixes.has(id2) || Math.abs(q.x - p.x) > 0.4) continue;
      const dy = p.y - q.y, dz = p.z - q.z, d2 = dy * dy + dz * dz + 0.01;
      p.y += dy * 0.01 / d2; p.z += dz * 0.006 / d2;
    }
    p.y = Math.max(-1.25, Math.min(1.25, p.y)); p.z = Math.max(-0.9, Math.min(0.9, p.z));
  }

  // Liens : naissances et morts
  const actuels = new Map();
  for (const c of g.conns) if (c.actif) actuels.set(c.de + '>' + c.vers, c);
  for (const [cle, c] of actuels) if (!vue.liens.has(cle)) vue.liens.set(cle, { ne: debut });
  for (const [cle] of vue.liens) {
    if (actuels.has(cle)) continue;
    const [de, vers] = cle.split('>').map(Number);
    const a = vue.pos.get(de) || vue.fantomes.find(f => f.id === de), b = vue.pos.get(vers) || vue.fantomes.find(f => f.id === vers);
    if (a && b) vue.liensMourants.push({ a: { ...a }, b: { ...b }, poids: vue.liens.get(cle).poids || 0, mort: t });
    vue.liens.delete(cle);
  }
  for (const [cle, c] of actuels) vue.liens.get(cle).poids = c.poids;
  vue.fantomes = vue.fantomes.filter(f => t - f.mort < DUREE_ANIM);
  vue.liensMourants = vue.liensMourants.filter(l => t - l.mort < DUREE_ANIM);
  vue.pret = true;

  // Projection
  cam.cadrer(Math.min((w - 290) / 2.5, (h - 80) / 2.9), w / 2 + 5, h / 2 + 8);
  const E = new Map();
  for (const [id, p] of vue.pos) E.set(id, cam.projeter(p.x, p.y, p.z));

  // Les plans des couches
  const couchesPleines = new Set(caches.map(id => prof.get(id)));
  ctx.font = '12px system-ui'; ctx.textAlign = 'center';
  let xEtiquette = -Infinity;   // on saute l'étiquette d'une couche trop proche de la précédente
  for (const p of [...couchesPleines].sort((a, b) => a - b)) {
    const c = [[1.33, 0.95], [1.33, -0.95], [-1.33, -0.95], [-1.33, 0.95]].map(([y, z]) => cam.projeter(X(p), y, z));
    ctx.beginPath(); c.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.closePath();
    ctx.fillStyle = 'rgba(124,156,255,.04)'; ctx.fill();
    ctx.strokeStyle = 'rgba(124,156,255,.18)'; ctx.lineWidth = 1; ctx.stroke();
    const e = cam.projeter(X(p), 1.42, 0), texte = `${tr('couche', 'layer')} ${p}`;
    if (Math.abs(e.x - xEtiquette) < ctx.measureText(texte).width + 8) continue;
    xEtiquette = e.x;
    ctx.fillStyle = 'rgba(124,156,255,.7)'; ctx.fillText(texte, e.x, e.y);
  }

  // Titres
  ctx.font = '600 12px system-ui'; ctx.fillStyle = COULEURS.doux;
  ctx.fillText(tr('CE QU\'IL LIT', 'WHAT IT READS'), cam.projeter(X(0), 0, 0).x - 30, 16);
  ctx.fillText(tr('SA RÉPONSE', 'ITS ANSWER'), cam.projeter(X(max), 0, 0).x + 40, 16);
  if (caches.length) ctx.fillText(tr(`SES ${caches.length} NEURONE${caches.length > 1 ? 'S' : ''}`, `ITS ${caches.length} NEURON${caches.length > 1 ? 'S' : ''}`), w / 2, 16);

  // Liens qui meurent : ils se rétractent vers leur départ
  for (const l of vue.liensMourants) {
    const q = (t - l.mort) / DUREE_ANIM;
    const a = cam.projeter(l.a.x, l.a.y, l.a.z);
    const b = cam.projeter(l.a.x + (l.b.x - l.a.x) * (1 - q), l.a.y + (l.b.y - l.a.y) * (1 - q), l.a.z + (l.b.z - l.a.z) * (1 - q));
    ctx.strokeStyle = `rgba(255,107,107,${0.6 * (1 - q)})`; ctx.lineWidth = 1.5;
    trait(ctx, a, b);
  }

  // Liens vivants (les faibles sont masqués sauf demande ; les liens directs entrée → réponse restent discrets)
  for (const c of actuels.values()) {
    const a = E.get(c.de), b = E.get(c.vers);
    if (!a || !b) continue;
    const touche = selection !== null && (c.de === selection || c.vers === selection);
    if (!tousLiens && !touche && Math.abs(c.poids) < 0.6) continue;
    const direct = c.de <= BIAIS && labo.estSortie(c.vers);
    const force = Math.min(1, Math.abs(c.poids) / 3);
    const rgb = c.poids >= 0 ? '92,200,255' : '255,159,90';
    const discret = selection !== null && !touche;
    let alpha = touche ? 0.95 : discret ? 0.05 : 0.12 + 0.5 * force;
    if (direct && !touche) alpha *= 0.25;
    if (eteint(c.de)) alpha *= 0.15;   // un neurone éteint n'envoie plus rien
    const q = Math.min(1, (t - vue.liens.get(c.de + '>' + c.vers).ne) / DUREE_ANIM);
    const bout = { x: a.x + (b.x - a.x) * q, y: a.y + (b.y - a.y) * q };
    ctx.strokeStyle = `rgba(${rgb},${q < 1 ? 0.9 : alpha})`;
    ctx.lineWidth = (direct && !touche ? 0.5 : 0.6 + 3 * force) * (a.k + b.k) / 2;
    trait(ctx, a, bout);
    if (q < 1) { ctx.beginPath(); ctx.arc(bout.x, bout.y, 3, 0, 7); ctx.fillStyle = COULEURS.ok; ctx.fill(); }
  }

  // Neurones créés récemment (dans les 25 dernières générations)
  const genActuelle = gen ?? labo.generation;
  const recents = new Set();
  for (const e of g.histoire || []) if (e.type === 'neurone+' && genActuelle - e.gen < 25) recents.add(e.noeud);

  // Neurones, du plus loin au plus proche (les fantômes rétrécissent et pâlissent)
  const dessin = [...E].map(([id, e]) => ({ id, e })).concat(vue.fantomes.map(f => ({ id: f.id, e: cam.projeter(f.x, f.y, f.z), mort: f.mort })));
  dessin.sort((a, b) => b.e.p - a.e.p);
  const positions = [], etiquettes = [];
  for (const { id, e, mort } of dessin) {
    const cache = labo.estCache(id), sortie = labo.estSortie(id);
    // Un neurone du milieu est d'autant plus gros qu'il est important (points perdus sans lui), avec une taille minimum
    const importance = cache && importances && importances.has(id) ? Math.min(1, Math.max(0, importances.get(id)) / 40) : 0.3;
    let r = (cache ? 6 + 12 * Math.sqrt(importance) : 6) * e.k;
    if (mort !== undefined) {
      const q = (t - mort) / DUREE_ANIM;
      ctx.beginPath(); ctx.arc(e.x, e.y, r * (1 - q) + 0.5, 0, 7);
      ctx.fillStyle = `rgba(255,107,107,${0.5 * (1 - q)})`; ctx.fill();
      ctx.strokeStyle = `rgba(255,107,107,${1 - q})`; ctx.lineWidth = 1.5; ctx.stroke();
      continue;
    }
    const q = Math.min(1, (t - vue.pos.get(id).ne) / DUREE_ANIM);
    if (q < 1) {
      r *= 0.2 + 0.8 * (1 + 0.6 * Math.sin(q * Math.PI)) * q;          // il gonfle en naissant
      ctx.beginPath(); ctx.arc(e.x, e.y, r + 18 * (1 - q), 0, 7);
      ctx.strokeStyle = `rgba(95,208,138,${1 - q})`; ctx.lineWidth = 2; ctx.stroke();
    }
    let fond = cache ? '#3a4260' : '#2a3042';
    if (activation) {
      if (sortie) fond = `rgba(124,156,255,${0.1 + 0.9 * activation.probas[id - PREMIERE_SORTIE]})`;
      else fond = couleurValeur(activation.valeurs.get(id) || 0, 0.15);
    }
    if (recents.has(id)) { ctx.beginPath(); ctx.arc(e.x, e.y, r + 8, 0, 7); ctx.fillStyle = 'rgba(95,208,138,.2)'; ctx.fill(); }
    ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, 7);
    ctx.fillStyle = eteint(id) ? '#15171e' : fond; ctx.fill();
    ctx.lineWidth = id === selection ? 3 : 1;
    ctx.strokeStyle = id === selection ? COULEURS.ok : '#6b7390';
    ctx.stroke();
    if (eteint(id)) {   // une croix rouge : ce neurone est éteint
      const d = r * 0.55;
      ctx.strokeStyle = COULEURS.ko; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(e.x - d, e.y - d); ctx.lineTo(e.x + d, e.y + d); ctx.moveTo(e.x + d, e.y - d); ctx.lineTo(e.x - d, e.y + d); ctx.stroke();
    }

    ctx.font = '11px system-ui';
    if (id < BIAIS) {
      ctx.fillStyle = COULEURS.doux; ctx.textAlign = 'right';
      ctx.fillText('xyz'[id % DIM], e.x - 9, e.y + 4);
    } else if (id === BIAIS) {
      ctx.fillStyle = COULEURS.doux; ctx.textAlign = 'right';
      ctx.fillText(tr('toujours 1', 'always 1'), e.x - 10, e.y + 4);
    } else if (sortie) {
      const pr = activation ? activation.probas[id - PREMIERE_SORTIE] : 0;
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(124,156,255,.85)';
      ctx.fillRect(e.x + 10, e.y - 4, 40 * pr, 8);
      ctx.strokeStyle = COULEURS.bord; ctx.lineWidth = 1; ctx.strokeRect(e.x + 10, e.y - 4, 40, 8);
      ctx.font = pr > 0.15 ? '600 12px system-ui' : '12px system-ui';
      ctx.fillStyle = L.couleurSortie(id - PREMIERE_SORTIE, voirFamilles) || (pr > 0.15 ? COULEURS.texte : COULEURS.doux);
      ctx.fillText(`${labo.nomNoeud(id)} ${Math.round(pr * 100)}%`, e.x + 56, e.y + 4);
    } else {
      etiquettes.push({ id, e, r, v: activation ? activation.valeurs.get(id) || 0 : 0 });
      positions.push({ id, x: e.x, y: e.y });
    }
    ctx.textAlign = 'left';
  }

  // Étiquettes des deux mots lus
  const blocMot = (ids, titre, mot) => {
    const es = ids.map(id => E.get(id)).filter(Boolean);
    if (!es.length) return;
    const y1 = Math.min(...es.map(e => e.y)) - 10, y2 = Math.max(...es.map(e => e.y)) + 10, x = Math.min(...es.map(e => e.x)) - 24;
    ctx.strokeStyle = COULEURS.bord; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + 6, y1); ctx.lineTo(x, y1); ctx.lineTo(x, y2); ctx.lineTo(x + 6, y2); ctx.stroke();
    ctx.textAlign = 'right';
    ctx.fillStyle = COULEURS.doux; ctx.font = '12px system-ui';
    ctx.fillText(titre, x - 8, (y1 + y2) / 2 - 3);
    ctx.fillStyle = L.couleurJeton(mot, voirFamilles) || COULEURS.texte;
    ctx.font = '600 13px system-ui';
    ctx.fillText(`« ${L.nomsJetons[mot]} »`, x - 8, (y1 + y2) / 2 + 13);
    ctx.textAlign = 'left';
  };
  blocMot([0, 1, 2], L.entree.longA, mots[0]);
  blocMot([3, 4, 5], L.entree.longB, mots[1]);

  // Étiquettes des neurones cachés, dessinées en dernier pour rester lisibles.
  // Le sélectionné et les plus proches passent d'abord ; une étiquette qui en chevaucherait une autre est sautée.
  const occupe = [];
  const libre = (x, y, l, h) => !occupe.some(o => x < o.x + o.l && o.x < x + l && y < o.y + o.h && o.y < y + h);
  const ordre = etiquettes.slice().sort((a, b) => (b.id === selection) - (a.id === selection) || a.e.p - b.e.p);
  ctx.textAlign = 'center';
  for (const { id, e, r, v } of ordre) {
    ctx.font = '600 13px system-ui';
    const titre = `N${id}  ${v >= 0 ? '+' : ''}${v.toFixed(2)}`;
    const lt = ctx.measureText(titre).width + 8;
    const lignes = resumes && resumes.get(id) ? resumes.get(id).map(l => l.length > 26 ? l.slice(0, 25) + '…' : l) : [];
    ctx.font = '12px system-ui';
    const lr = lignes.length ? Math.max(...lignes.map(l => ctx.measureText(l).width)) + 10 : 0;
    const yt = e.y - r - 19, yr = e.y + r + 3;   // au-dessus et au-dessous du neurone, selon sa taille
    const titreLibre = id === selection || libre(e.x - lt / 2, yt, lt, 17);
    const resumeLibre = lignes.length && (id === selection || libre(e.x - lr / 2, yr, lr, lignes.length * 14 + 5));
    if (titreLibre) {
      occupe.push({ x: e.x - lt / 2, y: yt, l: lt, h: 17 });
      ctx.font = '600 13px system-ui';
      ctx.fillStyle = 'rgba(15,17,23,.9)';
      ctx.fillRect(e.x - lt / 2, yt, lt, 17);
      ctx.fillStyle = id === selection ? COULEURS.ok : COULEURS.texte;
      ctx.fillText(titre, e.x, yt + 13);
    }
    if (titreLibre && resumeLibre) {
      occupe.push({ x: e.x - lr / 2, y: yr, l: lr, h: lignes.length * 14 + 5 });
      ctx.font = '12px system-ui';
      ctx.fillStyle = 'rgba(15,17,23,.85)';
      ctx.fillRect(e.x - lr / 2, yr, lr, lignes.length * 14 + 5);
      ctx.fillStyle = COULEURS.doux;
      lignes.forEach((l, k) => ctx.fillText(l, e.x, yr + 12 + k * 14));
    }
  }

  // Message quand un autre cerveau prend la tête
  if (vue.message && t - vue.message.t < 2500) {
    const a = Math.min(1, 3 * (1 - (t - vue.message.t) / 2500));
    ctx.font = '600 13px system-ui';
    const larg = ctx.measureText(vue.message.texte).width + 20;
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(255,209,102,.15)'; ctx.fillRect(w / 2 - larg / 2, 26, larg, 24);
    ctx.strokeStyle = COULEURS.famC; ctx.lineWidth = 1; ctx.strokeRect(w / 2 - larg / 2, 26, larg, 24);
    ctx.fillStyle = COULEURS.famC; ctx.fillText(vue.message.texte, w / 2, 43);
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = 'left';

  // Légende
  ctx.font = '11px system-ui'; ctx.fillStyle = COULEURS.doux;
  ctx.fillText(tr('● bleu = allumé, orange = négatif · ◌ vert = neurone qui naît · rouge = neurone ou lien qui meurt · glisse pour faire tourner', '● blue = on, orange = negative · ◌ green = neuron being born · red = neuron or link dying · drag to rotate'), 8, h - 10);
  return positions;
}

// ---------- Courbes ----------
function dessinerCourbe(canvas, stats) {
  const { ctx, w, h } = preparer(canvas);
  if (stats.length < 2) return;
  const pad = 22;
  const n = stats.length;
  const X = i => pad + i / (n - 1) * (w - 2 * pad);
  const maxC = Math.max(4, ...stats.map(s => s.caches));
  ctx.strokeStyle = COULEURS.bord;
  ctx.strokeRect(pad, pad / 2, w - 2 * pad, h - pad * 1.5);
  const trace = (val, couleur) => {
    ctx.strokeStyle = couleur; ctx.lineWidth = 2; ctx.beginPath();
    stats.forEach((s, i) => { const y = h - pad - val(s) * (h - pad * 1.5); i ? ctx.lineTo(X(i), y) : ctx.moveTo(X(i), y); });
    ctx.stroke();
  };
  trace(s => Math.min(1, s.scoreRel), COULEURS.accent);
  trace(s => s.caches / maxC, COULEURS.ok);
  ctx.fillStyle = COULEURS.doux; ctx.font = '11px system-ui';
  ctx.fillText('100 %', 2, pad / 2 + 8);
  ctx.fillText(tr('gén. ', 'gen. ') + stats[n - 1].gen, w - pad - 50, h - 5);
  ctx.fillStyle = COULEURS.ok;
  ctx.fillText(maxC + tr(' neur.', ' neur.'), w - pad - 40, pad / 2 + 12);
}

// ---------- Profil d'un neurone : sa valeur dans chaque situation (A en ligne, B en colonne) ----------
function dessinerProfil(canvas, L, profil, voirFamilles) {
  const { ctx, w, h } = preparer(canvas);
  const lignes = L.jetonsA, colonnes = L.jetonsB;
  const gauche = 64, haut = 58;
  const cw = (w - gauche - 4) / colonnes.length, ch = (h - haut - 4) / lignes.length;
  const vals = new Map(profil.map(p => [p.m2 * L.nbJetons + p.m1, p.valeur]));
  ctx.font = '11px system-ui';
  const couleur = t => L.couleurJeton(t, voirFamilles) || COULEURS.doux;
  lignes.forEach((t, i) => {
    ctx.fillStyle = couleur(t); ctx.textAlign = 'right';
    ctx.fillText(L.nomsJetons[t].slice(0, 9), gauche - 4, haut + (i + 0.5) * ch + 4);
  });
  colonnes.forEach((t, j) => {
    ctx.save();
    ctx.translate(gauche + (j + 0.5) * cw + 4, haut - 4);
    ctx.rotate(-Math.PI / 3);
    ctx.textAlign = 'left'; ctx.fillStyle = couleur(t);
    ctx.fillText(L.nomsJetons[t].slice(0, 9), 0, 0);
    ctx.restore();
  });
  ctx.textAlign = 'left';
  lignes.forEach((a, i) => colonnes.forEach((b, j) => {
    const v = vals.get(a * L.nbJetons + b);
    ctx.fillStyle = v === undefined ? '#161922' : couleurValeur(v, 0.12);
    ctx.fillRect(gauche + j * cw + 1, haut + i * ch + 1, cw - 2, ch - 2);
  }));
  ctx.fillStyle = COULEURS.doux;
  ctx.fillText(tr(`lignes : ${L.entree.courtA}   colonnes : ${L.entree.courtB}`, `rows: ${L.entree.courtA}   columns: ${L.entree.courtB}`), 4, 12);
}
