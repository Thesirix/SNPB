'use strict';
// =====================================================================
//  CERVEAU ÉVOLUTIF (NEAT)
//  Une population de petits cerveaux. Les enfants reçoivent des changements
//  tirés au hasard (nouveau neurone, lien coupé, poids modifié...). Ceux qui
//  prédisent mieux le mot suivant ont plus d'enfants. Tout est journalisé.
// =====================================================================

const REGLAGES = {
  population: 100,
  seuilEspece: 1.5,
  especesCibles: 6,
  probaPoids: 0.3,
  forcePoids: 0.4,
  probaRemplacerPoids: 0.08,
  probaPlongement: 0.7,
  forcePlongement: 0.1,
  probaAjoutConnexion: 0.15,
  probaAjoutNeurone: 0.1,
  probaSupprConnexion: 0.06,
  probaSupprNeurone: 0.02,
  probaCroisement: 0.4,
  penaliteConnexion: 0.0003,
  penaliteNeurone: 0.0005,
  stagnationMax: 30,
  survie: 0.3,
  etapesGradient: 4,
  pasGradient: 1.5,
  pasPlongement: 0.5,
};

// Chaque mot a une position en 3D (x, y, z) sur la carte des mots.
const DIM = 3;
// Un texte dans les deux langues de l'interface : f('fr') et f('en').
const deuxLangues = f => ({ fr: f('fr'), en: f('en') });
const BIAIS = 2 * DIM;
const PREMIERE_SORTIE = BIAIS + 1;

class Labo {
  constructor(langue, graine) {
    this.L = langue;
    this.h = creerHasard(graine);
    this.nbSorties = langue.sorties.length;
    this.prochainNoeud = PREMIERE_SORTIE + this.nbSorties;
    this.innovations = new Map();
    this.prochaineInnov = 0;
    this.coupures = new Map();
    this.prochainId = 0;
    this.generation = 0;
    this.especes = [];
    this.seuil = REGLAGES.seuilEspece;
    this.stats = [];
    this.journal = [];
    this.champion = null;
    this.album = [];        // une image du meilleur cerveau à chaque changement de forme (le film de la croissance)
    this.genChangement = 0;
    this.rejets = [];           // essais de forme ratés par les enfants du meilleur cerveau, avec ce qu'ils auraient cassé
    this.eteints = new Set();   // neurones éteints à la main pour voir ce qu'ils font (seulement à l'affichage, jamais pendant l'entraînement)
    // Une copie des exemples : les corrections faites à ce cerveau ne touchent pas le monde
    this.contextes = langue.contextes.map(c => ({ ...c, comptes: new Map(c.comptes), permis: new Set(c.permis) }));
    this.versionDonnees = 0;    // augmente à chaque correction (l'explicateur recalcule alors tout)
    this.corrections = [];
    for (const c of this.contextes) {
      c.vecteur = new Float64Array(this.nbSorties);
      for (const [m, n] of c.comptes) c.vecteur[m] = n;
    }
    this.nbExemples = this.contextes.reduce((s, c) => s + c.total, 0);
    this.scoreMax = this.calculerScoreMax();

    const base = this.genomeDeBase();
    this.population = [];
    for (let i = 0; i < REGLAGES.population; i++) {
      const g = this.cloner(base);
      g.conns.forEach(c => { c.poids = this.h.gauss() * 0.5; });
      for (let k = 0; k < g.plong.length; k++) g.plong[k] = this.h() * 2 - 1;
      this.population.push(g);
    }
    this.population.forEach(g => { this.apprendre(g); this.evaluer(g); });
    this.miseAJourChampion([]);
  }

  // Score d'un cerveau qui connaîtrait parfaitement les règles secrètes
  // (chaque mot permis a la même chance). On ne peut pas faire mieux sans apprendre le bruit.
  calculerScoreMax() {
    let ll = 0;
    for (const c of this.contextes) for (const n of c.comptes.values()) ll += n * Math.log(1 / c.permis.size);
    return Math.exp(ll / this.nbExemples);
  }

  nomNoeud(id, l = langueUI()) {
    if (id < BIAIS) { const e = this.L.entreeEn(l); return `${id < DIM ? e.courtA : e.courtB} · ${'xyz'[id % DIM]}`; }
    if (id === BIAIS) return 'biais';
    if (id < PREMIERE_SORTIE + this.nbSorties) return this.L.sortiesEn(l)[id - PREMIERE_SORTIE];
    return 'N' + id;
  }
  estSortie(id) { return id >= PREMIERE_SORTIE && id < PREMIERE_SORTIE + this.nbSorties; }
  estCache(id) { return id >= PREMIERE_SORTIE + this.nbSorties; }

  innovation(de, vers) {
    const cle = de + '>' + vers;
    if (!this.innovations.has(cle)) this.innovations.set(cle, this.prochaineInnov++);
    return this.innovations.get(cle);
  }

  // Au départ : aucun neurone caché, le biais relié à chaque mot, et quelques liens directs.
  genomeDeBase() {
    const g = { id: this.prochainId++, noeuds: new Set(), conns: [], plong: new Float64Array(this.L.nbJetons * DIM), histoire: [], nouveaux: [], ne: 0, lignee: [] };
    for (let i = 0; i < PREMIERE_SORTIE + this.nbSorties; i++) g.noeuds.add(i);
    for (let s = 0; s < this.nbSorties; s++) {
      const o = PREMIERE_SORTIE + s;
      g.conns.push({ innov: this.innovation(BIAIS, o), de: BIAIS, vers: o, poids: 0, actif: true });
      for (let e = 0; e < BIAIS; e++) if (this.h() < 0.3) g.conns.push({ innov: this.innovation(e, o), de: e, vers: o, poids: 0, actif: true });
    }
    g.conns.sort((a, b) => a.innov - b.innov);
    return g;
  }

  cloner(g) {
    return {
      id: this.prochainId++,
      noeuds: new Set(g.noeuds),
      conns: g.conns.map(c => ({ ...c })),
      plong: Float64Array.from(g.plong),
      histoire: g.histoire.slice(-250),
      nouveaux: [],
      parentScore: g.score,
      parentId: g.id,
      lignee: g.lignee.slice(-40).concat(g.id),   // ses ancêtres : sert à savoir si un nouveau champion descend de l'ancien
      ne: this.generation,
      sens: g.sens ? new Map(g.sens) : undefined,   // les neurones construits par l'Architecte gardent leur règle
    };
  }

  // ---------- Calcul ----------
  // eteints : neurones qu'on force à 0 (pour voir ce que fait le cerveau sans eux).
  compiler(g, eteints = null) {
    const entrants = new Map(), sortants = new Map(), degre = new Map();
    for (const id of g.noeuds) { entrants.set(id, []); sortants.set(id, []); degre.set(id, 0); }
    for (const c of g.conns) {
      if (!c.actif) continue;
      entrants.get(c.vers).push(c); sortants.get(c.de).push(c); degre.set(c.vers, degre.get(c.vers) + 1);
    }
    const ordre = [];
    const pile = [...g.noeuds].filter(id => degre.get(id) === 0);
    while (pile.length) {
      const id = pile.pop();
      if (id > BIAIS) ordre.push(id);
      for (const c of sortants.get(id)) {
        degre.set(c.vers, degre.get(c.vers) - 1);
        if (degre.get(c.vers) === 0) pile.push(c.vers);
      }
    }
    // Version « à plat » pour calculer vite : pour chaque neurone, la liste de ses liens entrants.
    // Chaque neurone reçoit une case numérotée de façon compacte (0 à BIAIS : entrées et biais).
    const idx = new Map();
    for (let i = 0; i <= BIAIS; i++) idx.set(i, i);
    for (const id of ordre) idx.set(id, idx.size);
    const debut = new Int32Array(ordre.length + 1), src = [], liens = [];
    ordre.forEach((id, i) => {
      debut[i] = liens.length;
      for (const c of entrants.get(id)) { src.push(idx.get(c.de)); liens.push(c); }
    });
    debut[ordre.length] = liens.length;
    return {
      ordre, entrants, debut, liens, idx, taille: idx.size,
      sorties: Array.from({ length: this.nbSorties }, (_, k) => idx.get(PREMIERE_SORTIE + k)),
      src: Int32Array.from(src),
      poids: Float64Array.from(liens.map(c => c.poids)),
      cache: ordre.map(id => this.estCache(id)),
      eteint: eteints && eteints.size ? Uint8Array.from(ordre.map(id => (eteints.has(id) ? 1 : 0))) : null,
    };
  }

  // Le cerveau tel qu'on l'affiche : avec les neurones éteints à la main.
  compilerVue(g) { return this.compiler(g, this.eteints); }

  // fixe : { A, B } positions imposées à la place de celles des deux choses lues (sert à mesurer ce qu'il regarde)
  propager(g, prog, m2, m1, v, probas, fixe = null) {
    v.fill(0);
    for (let k = 0; k < DIM; k++) {
      v[k] = fixe && fixe.A ? fixe.A[k] : g.plong[m2 * DIM + k];
      v[DIM + k] = fixe && fixe.B ? fixe.B[k] : g.plong[m1 * DIM + k];
    }
    v[BIAIS] = 1;
    const { ordre, debut, src, poids, cache, sorties, eteint } = prog;
    for (let i = 0; i < ordre.length; i++) {
      let s = 0;
      for (let k = debut[i]; k < debut[i + 1]; k++) s += v[src[k]] * poids[k];
      v[i + BIAIS + 1] = eteint && eteint[i] ? 0 : cache[i] ? Math.tanh(s) : s;
    }
    let mx = -Infinity, tot = 0;
    for (let s = 0; s < this.nbSorties; s++) mx = Math.max(mx, v[sorties[s]]);
    for (let s = 0; s < this.nbSorties; s++) { probas[s] = Math.exp(v[sorties[s]] - mx); tot += probas[s]; }
    for (let s = 0; s < this.nbSorties; s++) probas[s] /= tot;
  }

  // Pour l'affichage : la valeur de chaque neurone (par son vrai numéro) et les probabilités.
  activer(g, m2, m1, prog = this.compilerVue(g)) {
    const v = new Float64Array(prog.taille), probas = new Array(this.nbSorties);
    this.propager(g, prog, m2, m1, v, probas);
    const valeurs = new Map();
    for (const [id, i] of prog.idx) valeurs.set(id, v[i]);
    return { valeurs, probas };
  }

  // Descente de gradient : pour chaque poids, dans quel sens le bouger pour faire moins d'erreurs.
  apprendre(g, etapes = REGLAGES.etapesGradient) {
    const prog = this.compiler(g);
    const { ordre, debut, src, poids, cache, sorties } = prog;
    const v = new Float64Array(prog.taille), d = new Float64Array(prog.taille);
    const probas = new Float64Array(this.nbSorties);
    const gW = new Float64Array(poids.length), gE = new Float64Array(g.plong.length);
    for (let e = 0; e < etapes; e++) {
      gW.fill(0); gE.fill(0);
      for (const c of this.contextes) {
        this.propager(g, prog, c.m2, c.m1, v, probas);
        d.fill(0);
        for (let s = 0; s < this.nbSorties; s++) d[sorties[s]] = probas[s] * c.total - c.vecteur[s];
        for (let i = ordre.length - 1; i >= 0; i--) {
          const j = i + BIAIS + 1;
          let loc = d[j];
          if (cache[i]) loc *= 1 - v[j] * v[j];
          if (loc === 0) continue;
          for (let k = debut[i]; k < debut[i + 1]; k++) { gW[k] += loc * v[src[k]]; d[src[k]] += loc * poids[k]; }
        }
        for (let k = 0; k < DIM; k++) { gE[c.m2 * DIM + k] += d[k]; gE[c.m1 * DIM + k] += d[DIM + k]; }
      }
      const pas = REGLAGES.pasGradient / this.nbExemples;
      for (let k = 0; k < poids.length; k++) poids[k] = Math.max(-8, Math.min(8, poids[k] - pas * gW[k]));
      for (let k = 0; k < gE.length; k++) g.plong[k] = Math.max(-1, Math.min(1, g.plong[k] - pas * REGLAGES.pasPlongement * gE[k]));
    }
    prog.liens.forEach((c, k) => { c.poids = poids[k]; });
  }

  evaluer(g) {
    const prog = this.compiler(g);
    const v = new Float64Array(prog.taille), probas = new Float64Array(this.nbSorties);
    let ll = 0, justes = 0;
    for (const c of this.contextes) {
      this.propager(g, prog, c.m2, c.m1, v, probas);
      for (const [m, n] of c.comptes) ll += n * Math.log(probas[m] + 1e-9);
      let masse = 0;                     // part de la confiance posée sur des mots permis
      for (const m of c.permis) masse += probas[m];
      justes += masse * c.total;
    }
    g.score = Math.exp(ll / this.nbExemples);
    g.justesse = justes / this.nbExemples;
    g.nbCaches = [...g.noeuds].filter(id => this.estCache(id)).length;
    g.nbConns = g.conns.filter(c => c.actif).length;
    g.fitness = g.score - REGLAGES.penaliteConnexion * g.nbConns - REGLAGES.penaliteNeurone * g.nbCaches;
    for (const e of g.nouveaux) e.scoreApres = g.score;
  }

  // ---------- Mutations (tirées au hasard) ----------
  cheminExiste(g, depuis, vers) {
    const pile = [depuis], vus = new Set();
    while (pile.length) {
      const n = pile.pop();
      if (n === vers) return true;
      if (vus.has(n)) continue;
      vus.add(n);
      for (const c of g.conns) if (c.de === n) pile.push(c.vers);
    }
    return false;
  }

  lien(c, l) { return `${this.nomNoeud(c.de, l)} → ${this.nomNoeud(c.vers, l)}`; }

  ajouterConnexion(g, ev) {
    const sources = [...g.noeuds].filter(id => !this.estSortie(id));
    const cibles = [...g.noeuds].filter(id => this.estSortie(id) || this.estCache(id));
    for (let essai = 0; essai < 20; essai++) {
      const de = this.h.choisir(sources), vers = this.h.choisir(cibles);
      if (de === vers || g.conns.some(c => c.de === de && c.vers === vers)) continue;
      if (this.cheminExiste(g, vers, de)) continue;
      const c = { innov: this.innovation(de, vers), de, vers, poids: this.h.gauss() * 0.5, actif: true };
      g.conns.push(c);
      g.conns.sort((a, b) => a.innov - b.innov);
      ev.push({ type: 'lien+', texte: deuxLangues(l => l === 'en' ? `New link ${this.lien(c, l)} (weight ${c.poids.toFixed(2)})` : `Nouveau lien ${this.lien(c, l)} (poids ${c.poids.toFixed(2)})`) });
      return;
    }
  }

  ajouterNeurone(g, ev) {
    const actifs = g.conns.filter(c => c.actif);
    if (!actifs.length) return;
    const c = this.h.choisir(actifs);
    let id = this.coupures.get(c.innov);
    if (id === undefined || g.noeuds.has(id)) {
      id = this.prochainNoeud++;
      if (!this.coupures.has(c.innov)) this.coupures.set(c.innov, id);
    }
    c.actif = false;
    g.noeuds.add(id);
    g.conns.push({ innov: this.innovation(c.de, id), de: c.de, vers: id, poids: 1, actif: true });
    g.conns.push({ innov: this.innovation(id, c.vers), de: id, vers: c.vers, poids: c.poids, actif: true });
    g.conns.sort((a, b) => a.innov - b.innov);
    ev.push({ type: 'neurone+', noeud: id, de: c.de, vers: c.vers, texte: deuxLangues(l => l === 'en' ? `Neuron N${id} created in the middle of link ${this.lien(c, l)}` : `Neurone N${id} créé au milieu du lien ${this.lien(c, l)}`) });
  }

  supprimerConnexion(g, ev) {
    const actifs = g.conns.filter(c => c.actif && c.de !== BIAIS);
    if (!actifs.length) return;
    const c = this.h.choisir(actifs);
    g.conns = g.conns.filter(x => x !== c);
    ev.push({ type: 'lien-', texte: deuxLangues(l => l === 'en' ? `Link ${this.lien(c, l)} destroyed (weight ${c.poids.toFixed(2)})` : `Lien ${this.lien(c, l)} détruit (poids ${c.poids.toFixed(2)})`) });
  }

  supprimerNeurone(g, ev) {
    const caches = [...g.noeuds].filter(id => this.estCache(id));
    if (!caches.length) return;
    const id = this.h.choisir(caches);
    g.noeuds.delete(id);
    const n = g.conns.filter(c => c.de === id || c.vers === id).length;
    g.conns = g.conns.filter(c => c.de !== id && c.vers !== id);
    ev.push({ type: 'neurone-', noeud: id, texte: deuxLangues(l => l === 'en' ? `Neuron N${id} destroyed with its ${n} links` : `Neurone N${id} détruit avec ses ${n} liens`) });
  }

  // Un neurone qui ne reçoit rien ou n'envoie rien ne sert à rien : on l'enlève.
  nettoyer(g, ev) {
    let change = true;
    while (change) {
      change = false;
      for (const id of [...g.noeuds]) {
        if (!this.estCache(id)) continue;
        const entre = g.conns.some(c => c.actif && c.vers === id);
        const sort = g.conns.some(c => c.actif && c.de === id);
        if (!entre || !sort) {
          g.noeuds.delete(id);
          g.conns = g.conns.filter(c => c.de !== id && c.vers !== id);
          ev.push({ type: 'mort', noeud: id, texte: deuxLangues(l => l === 'en' ? `Neuron N${id} removed: it no longer ${entre ? 'sent' : 'received'} anything` : `Neurone N${id} retiré : il ne ${entre ? 'transmettait' : 'recevait'} plus rien`) });
          change = true;
        }
      }
    }
  }

  muter(g) {
    const R = REGLAGES, h = this.h, ev = [];
    if (h() < R.probaPoids) {
      for (const c of g.conns) {
        if (h() < R.probaRemplacerPoids) c.poids = h.gauss();
        else if (h() < 0.5) c.poids += h.gauss() * R.forcePoids;
        c.poids = Math.max(-8, Math.min(8, c.poids));
      }
    }
    if (h() < R.probaPlongement) {
      for (let k = 0; k < g.plong.length; k++) {
        if (h() < 0.25) g.plong[k] = Math.max(-1, Math.min(1, g.plong[k] + h.gauss() * R.forcePlongement));
      }
    }
    if (h() < R.probaAjoutNeurone) this.ajouterNeurone(g, ev);
    else if (h() < R.probaAjoutConnexion) this.ajouterConnexion(g, ev);
    if (h() < R.probaSupprConnexion) this.supprimerConnexion(g, ev);
    if (h() < R.probaSupprNeurone) this.supprimerNeurone(g, ev);
    this.nettoyer(g, ev);
    for (const e of ev) { e.gen = this.generation; e.scoreAvant = g.parentScore; }
    g.nouveaux = ev;
    g.histoire.push(...ev);
  }

  croiser(a, b) { // a est le meilleur parent
    const enfant = this.cloner(a);
    const deB = new Map(b.conns.map(c => [c.innov, c]));
    for (const c of enfant.conns) {
      const cb = deB.get(c.innov);
      if (cb && this.h() < 0.5) c.poids = cb.poids;
      if (cb && (!c.actif || !cb.actif)) c.actif = this.h() > 0.75;
    }
    for (let t = 0; t < this.L.nbJetons; t++) {
      if (this.h() < 0.5) for (let k = 0; k < DIM; k++) enfant.plong[t * DIM + k] = b.plong[t * DIM + k];
    }
    // réactiver un lien pourrait casser un neurone qui n'a plus d'entrée : on laisse nettoyer() décider
    return enfant;
  }

  // ---------- Espèces : protègent les idées nouvelles le temps qu'elles mûrissent ----------
  distance(a, b) {
    const mb = new Map(b.conns.map(c => [c.innov, c]));
    let communs = 0, dw = 0;
    for (const c of a.conns) {
      const x = mb.get(c.innov);
      if (x) { communs++; dw += Math.abs(c.poids - x.poids); }
    }
    const differents = a.conns.length + b.conns.length - 2 * communs;
    const n = Math.max(a.conns.length, b.conns.length, 1);
    return 2 * differents / n + 0.4 * (communs ? dw / communs : 0);
  }

  classerEspeces() {
    for (const e of this.especes) e.membres = [];
    for (const g of this.population) {
      let place = false;
      for (const e of this.especes) {
        if (this.distance(g, e.representant) < this.seuil) { e.membres.push(g); g.espece = e.id; place = true; break; }
      }
      if (!place) {
        const e = { id: this.especes.length ? Math.max(...this.especes.map(x => x.id)) + 1 : 0, representant: g, membres: [g], meilleur: -Infinity, depuis: this.generation };
        this.especes.push(e);
        g.espece = e.id;
      }
    }
    this.especes = this.especes.filter(e => e.membres.length);
    for (const e of this.especes) {
      e.representant = this.h.choisir(e.membres);
      const top = Math.max(...e.membres.map(g => g.fitness));
      if (top > e.meilleur + 1e-4) { e.meilleur = top; e.depuis = this.generation; }
    }
    if (this.especes.length < REGLAGES.especesCibles) this.seuil = Math.max(0.3, this.seuil - 0.05);
    else if (this.especes.length > REGLAGES.especesCibles) this.seuil += 0.05;
  }

  // ---------- Une génération ----------
  etape() {
    const R = REGLAGES, h = this.h;
    this.classerEspeces();
    const meilleurGlobal = this.champion;
    let especes = this.especes.filter(e => this.generation - e.depuis < R.stagnationMax || e.membres.includes(meilleurGlobal));
    if (!especes.length) especes = this.especes;

    const minF = Math.min(...this.population.map(g => g.fitness));
    const moyennes = especes.map(e => e.membres.reduce((s, g) => s + (g.fitness - minF + 1e-3), 0) / e.membres.length);
    const somme = moyennes.reduce((a, b) => a + b, 0);

    const nouvelle = [];
    especes.forEach((e, i) => {
      const part = Math.round(R.population * moyennes[i] / somme);
      if (part <= 0) return;
      const tries = e.membres.slice().sort((a, b) => b.fitness - a.fitness);
      const parents = tries.slice(0, Math.max(1, Math.ceil(tries.length * R.survie)));
      let n = 0;
      if (tries.length >= 3) { nouvelle.push(tries[0]); n++; } // le meilleur de l'espèce passe tel quel
      for (; n < part && nouvelle.length < R.population; n++) {
        const a = h.choisir(parents);
        let enfant;
        if (parents.length > 1 && h() < R.probaCroisement) {
          const b = h.choisir(parents);
          enfant = a.fitness >= b.fitness ? this.croiser(a, b) : this.croiser(b, a);
        } else enfant = this.cloner(a);
        enfant.ne = this.generation + 1;
        enfant.espece = e.id;
        this.muter(enfant);
        nouvelle.push(enfant);
      }
    });
    while (nouvelle.length < R.population) {
      const enfant = this.cloner(meilleurGlobal);
      enfant.ne = this.generation + 1;
      this.muter(enfant);
      nouvelle.push(enfant);
    }
    const enfants = nouvelle.filter(g => g.ne === this.generation + 1);
    this.generation++;
    // Un enfant qui a changé de forme reçoit plus d'entraînement : on laisse sa nouvelle idée mûrir.
    enfants.forEach(g => {
      const nouvelleForme = g.nouveaux.some(e => e.type === 'neurone+' || e.type === 'lien+');
      this.apprendre(g, REGLAGES.etapesGradient * (nouvelleForme ? 4 : 1));
      this.evaluer(g);
    });
    this.population = nouvelle.slice(0, R.population);
    this.noterRejets(enfants);
    this.miseAJourChampion(enfants);
  }

  // Les enfants du meilleur cerveau qui ont changé de forme et fait moins bien : l'explicateur mesure ce qu'ils auraient cassé.
  noterRejets(enfants) {
    const champ = this.champion;
    if (!champ || typeof expliquerEssai !== 'function') return;
    let n = 0;
    for (const g of enfants) {
      if (n >= 4) break;
      if (g.parentId !== champ.id || g.fitness >= champ.fitness) continue;
      const forme = g.nouveaux.filter(e => e.type !== undefined);
      if (!forme.length) continue;
      this.rejets.push({ gen: this.generation, evenements: forme, scoreAvant: champ.score, scoreApres: g.score, sens: expliquerEssai(this, champ, g) });
      n++;
    }
    if (this.rejets.length > 500) this.rejets.splice(0, this.rejets.length - 500);
  }

  miseAJourChampion(enfants) {
    const ancien = this.champion;
    let best = this.population[0];
    for (const g of this.population) if (g.fitness > best.fitness) best = g;
    this.champion = best;

    // Résumé de ce que la génération a essayé
    const essais = { 'neurone+': [0, 0], 'neurone-': [0, 0], 'lien+': [0, 0], 'lien-': [0, 0] };
    for (const g of enfants) {
      for (const e of g.nouveaux) if (essais[e.type]) {
        essais[e.type][0]++;
        if (g.score > (g.parentScore || 0) + 1e-6) essais[e.type][1]++;
      }
    }
    this.stats.push({ gen: this.generation, score: best.score, scoreRel: best.score / this.scoreMax, justesse: best.justesse, caches: best.nbCaches, conns: best.nbConns, especes: this.especes.length || 1, essais });

    if (!ancien) { this.photographier(best, null, true); return; }
    if (ancien.id === best.id) return;
    // Héritier = le nouveau champion descend de l'ancien (le cerveau a poussé). Sinon un autre cerveau prend la tête.
    const heritier = best.lignee.includes(ancien.id);
    this.photographier(best, ancien, heritier);
    // Journal détaillé : exactement ce qui a changé entre l'ancien et le nouveau champion
    const details = [];
    const avant = new Map(ancien.conns.map(c => [c.innov, c]));
    const apres = new Map(best.conns.map(c => [c.innov, c]));
    for (const [k, c] of apres) {
      const a = avant.get(k);
      if (!a) details.push(deuxLangues(l => `+ ${l === 'en' ? 'link' : 'lien'} ${this.lien(c, l)} : ${c.poids.toFixed(2)}`));
      else if (a.actif !== c.actif) details.push(deuxLangues(l => `${c.actif ? (l === 'en' ? 'switched on' : 'réactivé') : (l === 'en' ? 'switched off' : 'désactivé')} : ${this.lien(c, l)}`));
      else if (Math.abs(a.poids - c.poids) > 0.005) details.push(deuxLangues(l => `${this.lien(c, l)} : ${a.poids.toFixed(2)} → ${c.poids.toFixed(2)} (${c.poids > a.poids ? (l === 'en' ? 'I raise it' : 'je monte') : (l === 'en' ? 'I lower it' : 'je baisse')})`));
    }
    for (const [k, a] of avant) if (!apres.has(k)) details.push(deuxLangues(l => l === 'en' ? `− link ${this.lien(a, l)} (was ${a.poids.toFixed(2)})` : `− lien ${this.lien(a, l)} (était ${a.poids.toFixed(2)})`));
    for (let t = 0; t < this.L.nbJetons; t++) {
      const avantT = [...ancien.plong.subarray(t * DIM, t * DIM + DIM)], apresT = [...best.plong.subarray(t * DIM, t * DIM + DIM)];
      if (Math.hypot(...avantT.map((v, k) => apresT[k] - v)) > 0.02) details.push(deuxLangues(l => `« ${this.L.nomsEn(l)[t]} » ${l === 'en' ? 'moves on the map' : 'bouge sur la carte'} : (${avantT.map(v => v.toFixed(2)).join(', ')}) → (${apresT.map(v => v.toFixed(2)).join(', ')})`));
    }
    const sens = heritier && typeof expliquerReglages === 'function' ? expliquerReglages(this, ancien, best) : null;
    this.journal.push({ gen: this.generation, heritier, espece: best.espece, scoreAvant: ancien.score, scoreApres: best.score, structure: best.nouveaux.slice(), details, sens });
    if (this.journal.length > 400) this.journal.shift();
  }

  // ---------- Correction : on apprend au cerveau la bonne réponse dans une situation ----------
  // L'exemple est ajouté (ou remplacé) dans ce qu'il apprend, pour toujours. Le meilleur cerveau s'entraîne tout de suite dessus,
  // les autres l'apprendront en continuant l'entraînement. Deux images du film montrent l'avant et l'après.
  // cases : les situations [a, b] (ou [a, b, réponse]) concernées ; s : la réponse (sauf si chaque situation a la sienne) ;
  // quoi : { a, b } tels que choisis (-1 = « tous »), pour le raconter.
  corriger(cases, s, quoi, n = 36) {
    const avant = this.champion;
    this.photo(avant, { avantCorrection: true });
    for (const [a, b, propre] of cases) {
      // Une ou plusieurs bonnes réponses (dans la langue, plusieurs mots peuvent être permis) : elles se partagent les exemples
      const rs = [].concat(propre ?? s);
      let c = this.contextes.find(x => x.m2 === a && x.m1 === b);
      if (!c) { c = { m2: a, m1: b }; this.contextes.push(c); }
      Object.assign(c, { total: n, comptes: new Map(rs.map(r => [r, n / rs.length])), permis: new Set(rs), vecteur: new Float64Array(this.nbSorties), corrige: true });
      for (const r of rs) c.vecteur[r] = n / rs.length;
    }
    this.nbExemples = this.contextes.reduce((t, x) => t + x.total, 0);
    this.scoreMax = this.calculerScoreMax();
    this.versionDonnees++;
    const correction = { a: quoi.a, b: quoi.b, s, n: cases.length, gen: this.generation, prof: !!quoi.prof, experiences: !!quoi.experiences };
    this.corrections.push(correction);
    for (const g of this.population) this.evaluer(g);
    this.apprendre(avant, REGLAGES.etapesGradient * 10);
    this.evaluer(avant);
    let best = this.population[0];
    for (const g of this.population) if (g.fitness > best.fitness) best = g;
    if (avant.fitness >= best.fitness) best = avant;
    this.champion = best;
    this.photo(best, { correction, heritier: best === avant || best.lignee.includes(avant.id) });
  }

  // ---------- Pour la réflexion : des opérations choisies (et non tirées au hasard) ----------
  // Un neurone branché sur tout ce qu'il lit et sur toutes les réponses : la descente de gradient lui donnera un rôle.
  neuroneCible(g, texte) {
    const id = this.prochainNoeud++;
    g.noeuds.add(id);
    for (let e = 0; e <= BIAIS; e++) g.conns.push({ innov: this.innovation(e, id), de: e, vers: id, poids: this.h.gauss() * 0.8, actif: true });
    for (let s = 0; s < this.nbSorties; s++) {
      const o = PREMIERE_SORTIE + s;
      g.conns.push({ innov: this.innovation(id, o), de: id, vers: o, poids: this.h.gauss() * 0.3, actif: true });
    }
    g.conns.sort((a, b) => a.innov - b.innov);
    const ev = { type: 'neurone+', noeud: id, gen: this.generation, guide: true, texte, scoreAvant: g.score };
    g.histoire.push(ev);
    g.nouveaux = [ev];
    return id;
  }

  retirerNeuroneChoisi(g, id, texte) {
    g.noeuds.delete(id);
    g.conns = g.conns.filter(c => c.de !== id && c.vers !== id);
    const ev = { type: 'neurone-', noeud: id, gen: this.generation, guide: true, texte, scoreAvant: g.score };
    g.histoire.push(ev);
    g.nouveaux = [ev];
  }

  // Met ce cerveau dans la population, à la place du moins bon, et en fait le meilleur.
  installer(g) {
    let pire = 0;
    this.population.forEach((x, i) => { if (x.fitness < this.population[pire].fitness) pire = i; });
    this.population[pire] = g;
    this.champion = g;
  }

  // Une image du film prise à la main (pour les corrections).
  photo(g, extra = {}) {
    const dernier = this.album[this.album.length - 1];
    this.album.push({
      gen: this.generation, id: g.id, lignee: g.lignee.slice(), heritier: true, espece: g.espece,
      noeuds: new Set(g.noeuds), conns: g.conns.map(c => ({ ...c })), plong: Float64Array.from(g.plong),
      histoire: g.histoire.slice(-30), evenements: [], rejets: [], score: g.score, scoreAvant: dernier ? dernier.score : null,
      nbCaches: g.nbCaches, nbConns: g.nbConns, especeAvant: g.espece, sens: g.sens, ...extra,
    });
    this.genChangement = this.generation;
  }

  // Garde une image du nouveau champion si sa forme a changé (neurones ou liens), ou si c'est un autre cerveau.
  photographier(best, ancien, heritier) {
    const cles = g => g.conns.filter(c => c.actif).map(c => c.de + '>' + c.vers).sort().join(',');
    const memeForme = ancien && heritier && ancien.noeuds.size === best.noeuds.size &&
      [...best.noeuds].every(id => ancien.noeuds.has(id)) && cles(ancien) === cles(best);
    const depuis = this.genChangement;
    this.genChangement = this.generation;
    if (memeForme) return;
    this.album.push({
      gen: this.generation, id: best.id, lignee: best.lignee.slice(), heritier, espece: best.espece,
      noeuds: new Set(best.noeuds), conns: best.conns.map(c => ({ ...c })), plong: Float64Array.from(best.plong), sens: best.sens,
      histoire: best.histoire.slice(-30),
      evenements: best.histoire.filter(e => e.gen >= depuis),   // ce qui a été tenté dans sa lignée depuis l'image d'avant
      rejets: this.rejets.filter(r => r.gen > depuis).slice(-5),  // et ce qui a été essayé sans succès
      score: best.score, scoreAvant: ancien ? ancien.score : null, nbCaches: best.nbCaches, nbConns: best.nbConns,
      especeAvant: ancien ? ancien.espece : best.espece,
    });
    if (this.album.length > 3000) this.album.splice(1, 1);   // on garde toujours la première image
  }

  // Profondeur de chaque neurone, pour le dessin.
  couches(g) {
    const prof = new Map();
    const prog = this.compiler(g);
    for (let i = 0; i <= BIAIS; i++) prof.set(i, 0);
    for (const id of prog.ordre) {
      let p = 0;
      for (const c of prog.entrants.get(id)) p = Math.max(p, (prof.get(c.de) || 0) + 1);
      prof.set(id, p);
    }
    let max = 1;
    for (const id of g.noeuds) if (this.estCache(id)) max = Math.max(max, (prof.get(id) || 1) + 1);
    for (let s = 0; s < this.nbSorties; s++) prof.set(PREMIERE_SORTIE + s, max);
    for (const id of g.noeuds) if (!prof.has(id)) prof.set(id, 1);
    return { prof, max };
  }

  // Activation d'un neurone dans chaque situation rencontrée.
  profilNeurone(g, id) {
    const prog = this.compiler(g);
    return this.contextes.map(c => ({ m2: c.m2, m1: c.m1, total: c.total, valeur: this.activer(g, c.m2, c.m1, prog).valeurs.get(id) || 0 }));
  }
}

if (typeof module !== 'undefined') module.exports = { Labo, REGLAGES, DIM, BIAIS, PREMIERE_SORTIE };
