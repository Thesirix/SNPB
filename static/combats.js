'use strict';
// =====================================================================
//  MONDE « COMBATS DE TYPES » : une table secrète d'efficacité entre types.
//  Le cerveau lit le type de l'attaque et celui du défenseur, et prédit ×2, ×1, ×½ ou ×0.
// =====================================================================

const TYPES_VRAIS = [
  { fr: 'Feu', en: 'Fire', couleur: '#ff8a4c' }, { fr: 'Eau', en: 'Water', couleur: '#5aa9ff' },
  { fr: 'Plante', en: 'Grass', couleur: '#6fd36f' }, { fr: 'Électrik', en: 'Electric', couleur: '#ffd84a' },
  { fr: 'Sol', en: 'Ground', couleur: '#d4a86a' }, { fr: 'Vol', en: 'Flying', couleur: '#a9b8ff' },
  { fr: 'Glace', en: 'Ice', couleur: '#8fe6f0' }, { fr: 'Roche', en: 'Rock', couleur: '#bba36c' },
  { fr: 'Combat', en: 'Fighting', couleur: '#e0664f' }, { fr: 'Psy', en: 'Psychic', couleur: '#ff78b5' },
];
const TYPES_INVENTES = [
  { fr: 'Braise', en: 'Ember', couleur: '#ff8a4c' }, { fr: 'Givre', en: 'Frost', couleur: '#8fe6f0' },
  { fr: 'Sève', en: 'Sap', couleur: '#6fd36f' }, { fr: 'Foudre', en: 'Bolt', couleur: '#ffd84a' },
  { fr: 'Roc', en: 'Crag', couleur: '#bba36c' }, { fr: 'Brume', en: 'Mist', couleur: '#a9b8ff' },
  { fr: 'Ombre', en: 'Shade', couleur: '#9a7cff' }, { fr: 'Métal', en: 'Alloy', couleur: '#b8c2cc' },
  { fr: 'Onde', en: 'Wave', couleur: '#5aa9ff' }, { fr: 'Spore', en: 'Spore', couleur: '#ff78b5' },
];
// La vraie table Pokémon, limitée à ces 10 types (attaquant → défenseur).
const VRAIE_TABLE = {
  Feu: { super: ['Plante', 'Glace'], peu: ['Feu', 'Eau', 'Roche'] },
  Eau: { super: ['Feu', 'Sol', 'Roche'], peu: ['Eau', 'Plante'] },
  Plante: { super: ['Eau', 'Sol', 'Roche'], peu: ['Feu', 'Plante', 'Vol'] },
  Électrik: { super: ['Eau', 'Vol'], peu: ['Plante', 'Électrik'], aucun: ['Sol'] },
  Sol: { super: ['Feu', 'Électrik', 'Roche'], peu: ['Plante'], aucun: ['Vol'] },
  Vol: { super: ['Plante', 'Combat'], peu: ['Électrik', 'Roche'] },
  Glace: { super: ['Plante', 'Sol', 'Vol'], peu: ['Feu', 'Eau', 'Glace'] },
  Roche: { super: ['Feu', 'Vol', 'Glace'], peu: ['Sol', 'Combat'] },
  Combat: { super: ['Glace', 'Roche'], peu: ['Vol', 'Psy'] },
  Psy: { super: ['Combat'], peu: ['Psy'] },
};
const SUPER = 0, NORMAL = 1, PEU = 2, AUCUN = 3;
const COULEURS_EFFICACITE = ['#5fd08a', '#9aa1b5', '#ff9f5a', '#ff6b6b'];

function genererCombats(mode, graine, taille) {
  const h = creerHasard(graine);
  const vraie = mode === 'vrai' || mode === 'piege';
  const n = mode === 'piege' ? 10 : { petite: 6, moyenne: 8, grande: 10 }[taille] || 6;
  const types = vraie ? TYPES_VRAIS.slice(0, n) : h.melanger(mode === 'invente' ? TYPES_INVENTES : TYPES_VRAIS).slice(0, n);
  const ids = [...Array(n).keys()];
  const L = { mode, graine, types, nbJetons: n, jetonsA: ids, jetonsB: ids, parDefaut: NORMAL, testDepart: [0, 1], symboleCase: '→' };
  nommer(L, {
    jetons: { fr: types.map(t => t.fr), en: types.map(t => t.en) },
    sorties: { fr: ['×2', '×1', '×½', '×0'], en: ['×2', '×1', '×½', '×0'] },
    entree: {
      fr: { courtA: 'attaque', courtB: 'défenseur', longA: "type de l'attaque", longB: 'type du défenseur', resumeA: "quand l'attaque est :", resumeB: 'quand le défenseur est :' },
      en: { courtA: 'attack', courtB: 'defender', longA: 'attack type', longB: 'defender type', resumeA: 'when the attack is:', resumeB: 'when the defender is:' },
    },
  });

  const t = ids.map(() => ids.map(() => NORMAL));
  if (vraie) {
    const index = new Map(types.map((ty, i) => [ty.fr, i]));
    types.forEach((ty, a) => {
      const r = VRAIE_TABLE[ty.fr];
      for (const [cle, val] of [['super', SUPER], ['peu', PEU], ['aucun', AUCUN]])
        for (const nom of r[cle] || []) if (index.has(nom)) t[a][index.get(nom)] = val;
    });
  } else {
    // Une grande boucle « pierre-feuille-ciseaux », quelques forces en plus, des résistances et une ou deux immunités.
    const ordre = h.melanger(ids);
    for (let i = 0; i < n; i++) {
      const a = ordre[i], b = ordre[(i + 1) % n];
      t[a][b] = SUPER;
      if (h() < 0.5) t[b][a] = PEU;
    }
    for (let k = 0; k < Math.floor(n / 2); k++) {
      const a = h.entier(n), b = h.entier(n);
      if (a !== b && t[a][b] === NORMAL) { t[a][b] = SUPER; if (t[b][a] === NORMAL && h() < 0.5) t[b][a] = PEU; }
    }
    for (const a of ids) if (t[a][a] === NORMAL && h() < 0.4) t[a][a] = PEU;
    for (let k = 0, essais = 0; k < (n >= 10 ? 2 : 1) && essais < 100; essais++) {
      const a = h.entier(n), b = h.entier(n);
      if (a !== b && t[a][b] === NORMAL) { t[a][b] = AUCUN; k++; }
    }
  }
  L.table = t;

  // Les vraies règles : une ligne par type d'attaque qui a quelque chose de spécial, puis « tout le reste ».
  L.regles = [];
  const liste = (a, val, l) => ids.filter(b => t[a][b] === val).map(b => L.nomsEn(l)[b]).join(', ');
  for (const a of ids) {
    if (ids.every(b => t[a][b] === NORMAL)) continue;
    L.regles.push({
      cases: ids.map(b => [a, b]),
      texte: l => {
        const morceaux = [];
        const s = liste(a, SUPER, l), p = liste(a, PEU, l), z = liste(a, AUCUN, l);
        if (l === 'en') {
          if (s) morceaux.push(`super effective (×2) against ${s}`);
          if (p) morceaux.push(`not very effective (×½) against ${p}`);
          if (z) morceaux.push(`no effect (×0) on ${z}`);
        } else {
          if (s) morceaux.push(`super efficace (×2) contre ${s}`);
          if (p) morceaux.push(`peu efficace (×½) contre ${p}`);
          if (z) morceaux.push(`sans effet (×0) sur ${z}`);
        }
        return `<b>${L.nomsEn(l)[a]}</b>${l === 'en' ? ':' : ' :'} ${morceaux.join(' · ')}.`;
      },
    });
  }
  const neutres = [];
  for (const a of ids) for (const b of ids) if (t[a][b] === NORMAL) neutres.push([a, b]);
  L.regles.push({ cases: neutres, toutes: true, texte: l => (l === 'en' ? 'Everything else: normal effectiveness (×1).' : 'Tout le reste : efficacité normale (×1).') });

  remplirTable(L, (a, b) => t[a][b]);
  if (mode === 'piege') {
    // Le piège : pendant l'entraînement, il ne voit que des combats super efficaces (×2) ou peu efficaces (×½).
    // Pour les distinguer, il fait pousser des neurones… mais il croit qu'un combat normal (×1) n'existe pas.
    restreindreEntrainement(L, (a, b) => t[a][b] === SUPER || t[a][b] === PEU);
    const vraies = L.descriptions;
    L.descriptions = () => vraies().concat(tr("<i>Le piège : pendant l'entraînement, il n'a vu que des combats super efficaces (×2) ou peu efficaces (×½). Jamais un combat normal (×1) ni sans effet (×0).</i>",
      '<i>The trap: during training, it only saw super effective (×2) or not very effective (×½) battles. Never a normal (×1) or no-effect (×0) one.</i>'));
  }
  L.couleurJeton = tj => types[tj].couleur;
  L.couleurSortie = s => COULEURS_EFFICACITE[s];
  L.symbole = s => L.sorties[s];
  return L;
}

// ---------- L'arène : la table apprise par le cerveau, et des combats en direct ----------
function dessinerArene(canvas, labo, g, L, voir, etat) {
  const n = L.nbJetons;
  const w0 = canvas.clientWidth || 400;
  const gauche = 74, hautCombat = 74, hautEntete = 82;
  const cote = Math.max(18, Math.min(44, (w0 - gauche - 8) / n));
  canvas.dataset.h = Math.round(hautCombat + hautEntete + cote * n + 8);
  const { ctx, w } = preparer(canvas);
  const t = performance.now();

  // Ce que le cerveau prédit pour chaque couple (recalculé quand le cerveau change)
  const cle = g.id + ':' + (g.gen ?? labo.generation) + ':' + [...labo.eteints].join(',');
  if (etat.cle !== cle) {
    const prog = labo.compilerVue(g);
    etat.pred = L.jetonsA.map(a => L.jetonsB.map(b => labo.activer(g, a, b, prog).probas));
    etat.cle = cle;
  }
  const choix = p => p.indexOf(Math.max(...p));

  // Un combat toutes les 1,6 s
  if (!etat.combat || t - etat.combat.t > 1600) etat.combat = { a: Math.floor(Math.random() * n), b: Math.floor(Math.random() * n), t };
  const { a, b } = etat.combat;
  const q = Math.min(1, (t - etat.combat.t) / 500);
  const badge = (x, y, ty, alignDroite) => {
    ctx.font = '600 14px system-ui';
    const l = ctx.measureText(L.nomsJetons[ty]).width + 20;
    const x0 = alignDroite ? x - l : x;
    ctx.fillStyle = L.couleurJeton(ty); ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.roundRect(x0, y, l, 28, 14); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = '#10131a'; ctx.textAlign = 'center'; ctx.fillText(L.nomsJetons[ty], x0 + l / 2, y + 19);
    return { x0, l };
  };
  const ba = badge(12, 12, a, false), bb = badge(w - 12, 12, b, true);
  // l'attaque file de l'attaquant vers le défenseur
  const x1 = ba.x0 + ba.l + 6, x2 = bb.x0 - 6;
  ctx.strokeStyle = L.couleurJeton(a); ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x1, 26); ctx.lineTo(x1 + (x2 - x1) * q, 26); ctx.stroke();
  if (q < 1) { ctx.beginPath(); ctx.arc(x1 + (x2 - x1) * q, 26, 5, 0, 7); ctx.fillStyle = L.couleurJeton(a); ctx.fill(); }
  const p = etat.pred[a][b], s = choix(p);
  ctx.textAlign = 'center';
  if (q >= 1) {
    ctx.font = '700 16px system-ui'; ctx.fillStyle = L.couleurSortie(s);
    ctx.fillText(`${L.sorties[s]}  (${Math.round(p[s] * 100)} %)`, (x1 + x2) / 2, 21);
  }
  ctx.font = '12px system-ui'; ctx.fillStyle = COULEURS.doux;
  let legende = tr('le cerveau prédit', 'the brain predicts');
  if (voir && q >= 1) {
    const vrai = L.reponse(a, b);
    legende += ` · ${tr('vrai', 'true')} : ${L.sorties[vrai]} ${vrai === s ? '✓' : '✗'}`;
  }
  ctx.fillText(legende, (x1 + x2) / 2, 58);

  // La table
  const y0 = hautCombat + hautEntete;
  ctx.font = '11px system-ui';
  for (let j = 0; j < n; j++) {
    ctx.save();
    ctx.translate(gauche + (j + 0.5) * cote + 4, y0 - 6);
    ctx.rotate(-Math.PI / 3);
    ctx.textAlign = 'left'; ctx.fillStyle = L.couleurJeton(j);
    ctx.fillText(L.nomsJetons[j], 0, 0);
    ctx.restore();
  }
  ctx.textAlign = 'left';
  ctx.fillStyle = COULEURS.doux; ctx.fillText(tr('lignes : attaque · colonnes : défense', 'rows: attack · columns: defense'), 8, hautCombat + 28);
  let justes = 0;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = L.couleurJeton(i); ctx.textAlign = 'right';
    ctx.fillText(L.nomsJetons[i], gauche - 6, y0 + (i + 0.5) * cote + 4);
    for (let j = 0; j < n; j++) {
      const pr = etat.pred[i][j], c = choix(pr);
      const x = gauche + j * cote, y = y0 + i * cote, inconnu = estInconnu(labo, i, j);
      ctx.globalAlpha = inconnu ? 1 : 0.15 + 0.85 * pr[c];
      ctx.fillStyle = inconnu ? '#2b3040' : L.couleurSortie(c);
      ctx.fillRect(x + 1, y + 1, cote - 2, cote - 2);
      ctx.globalAlpha = 1;
      if (cote >= 24) {
        ctx.fillStyle = inconnu ? COULEURS.doux : '#10131a'; ctx.textAlign = 'center'; ctx.font = `600 ${Math.round(cote * 0.32)}px system-ui`;
        ctx.fillText(inconnu ? '?' : L.sorties[c], x + cote / 2, y + cote / 2 + 4);
        ctx.font = '11px system-ui';
      }
      const juste = L.reponse(i, j) === c;
      if (juste) justes++;
      if (voir && !juste) { ctx.strokeStyle = COULEURS.ko; ctx.lineWidth = 2; ctx.strokeRect(x + 2, y + 2, cote - 4, cote - 4); }
      if (i === a && j === b) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, cote - 2, cote - 2); }
    }
  }
  if (voir) {
    ctx.textAlign = 'left'; ctx.fillStyle = COULEURS.doux; ctx.font = '12px system-ui';
    ctx.fillText(tr(`${justes} / ${n * n} cases justes (encadré rouge = erreur)`, `${justes} / ${n * n} cells right (red frame = mistake)`), 8, hautCombat + 12);
  }
  ctx.textAlign = 'left';
}

const MONDE_COMBATS = {
  id: 'combats',
  nom: () => tr('Combats de types', 'Type battles'),
  modes: () => ({ invente: tr('Types inventés', 'Made-up types'), melange: tr('Vrais types, table mélangée', 'Real types, shuffled chart'), vrai: tr('Vraie table Pokémon', 'Real Pokémon chart'),
    piege: tr('🐺 Le loup dans la neige (combats trompeurs)', '🐺 The wolf in the snow (misleading fights)') }),
  sansTaille: mode => mode === 'piege',
  verbeEssai: () => tr("J'essaie le combat", 'I try the battle'),
  prudence: () => tr("(un « ? » dans l'arène)", '(a "?" in the arena)'),
  tailles: () => ({ petite: tr('Petite (6 types)', 'Small (6 types)'), moyenne: tr('Moyenne (8 types)', 'Medium (8 types)'), grande: tr('Grande (10 types)', 'Large (10 types)') }),
  generer: genererCombats,
  titreCarte: () => tr('Carte des types', 'Type map'),
  aideCarte: () => tr('Chaque type a une position en 3D (x, y, z) que le cerveau déplace lui-même. Le même point sert quand le type attaque et quand il défend.',
    'Each type has a 3D position (x, y, z) that the brain moves by itself. The same point is used when the type attacks and when it defends.'),
  panneau: {
    titre: () => tr("L'arène", 'The arena'),
    aide: () => tr("Chaque case = ce que le cerveau prédit quand un type (ligne) attaque un autre type (colonne). Vert = ×2, gris = ×1, orange = ×½, rouge = ×0. Plus la case est vive, plus il est sûr de lui. En haut, des combats tirés au hasard.",
      'Each cell = what the brain predicts when a type (row) attacks another type (column). Green = ×2, grey = ×1, orange = ×½, red = ×0. The brighter the cell, the surer it is. At the top, random battles.'),
    html: '<canvas id="arene" height="480"></canvas>',
    infos: (labo, g, L) => (L.mode !== 'piege' ? '' : infosPiege(labo, g, L, tr(
      "Ici : c'est la vraie table Pokémon, mais pendant l'entraînement il n'a vu que des combats super efficaces (×2) ou peu efficaces (×½). Il fait pousser des neurones pour les distinguer… et croit qu'un combat normal n'existe pas. Les combats de l'arène, eux, mélangent tout. Corrige-le : ses neurones vont changer de rôle, d'autres vont naître.",
      'Here: it is the real Pokémon chart, but during training it only saw super effective (×2) or not very effective (×½) battles. It grows neurons to tell them apart… and believes a normal battle does not exist. The arena battles mix everything. Correct it: its neurons will change roles, others will be born.'))),
    dessiner: (labo, g, L, voir, etat) => dessinerArene(document.getElementById('arene'), labo, g, L, voir, etat),
  },
  prompt: {
    tache: L => tr(`Sa tâche : prédire l'efficacité d'une attaque. Il lit le type de l'attaque et le type du défenseur, et répond ×2 (super efficace), ×1 (normal), ×½ (peu efficace) ou ×0 (aucun effet). Une table secrète entre ${L.nbJetons} types décide de la réponse.`,
      `Its task: predict how effective an attack is. It reads the attack type and the defender type, and answers ×2 (super effective), ×1 (normal), ×½ (not very effective) or ×0 (no effect). A secret chart between ${L.nbJetons} types decides the answer.`),
    vocabulaire: L => tr(`# Les types\n${L.nomsJetons.join(', ')}`, `# The types\n${L.nomsJetons.join(', ')}`),
    indiceRegles: () => tr('Une liste numérotée. Pour chaque type d\'attaque : contre quels types il est super efficace (×2), peu efficace (×½) ou sans effet (×0). Tout le reste est ×1.',
      'A numbered list. For each attack type: against which types it is super effective (×2), not very effective (×½) or has no effect (×0). Everything else is ×1.'),
    consigne: () => tr(`## 5. Bloc pour la vérification automatique
Recopie ta table dans ce format exact, entre une ligne DEBUT-REGLES et une ligne FIN-REGLES. Une ligne par type d'attaque et par efficacité, seulement des noms de types, sans guillemets :
SUPER: attaque -> défenseur défenseur   (super efficace, ×2)
PEU: attaque -> défenseur défenseur     (peu efficace, ×½)
AUCUN: attaque -> défenseur             (aucun effet, ×0)
Tout ce que tu n'écris pas sera compté comme ×1.`, `## 5. Block for automatic checking
Copy your chart in this exact format, between a line BEGIN-RULES and a line END-RULES. One line per attack type and per effectiveness, only type names, no quotes:
SUPER: attack -> defender defender   (super effective, ×2)
WEAK: attack -> defender defender    (not very effective, ×½)
NONE: attack -> defender             (no effect, ×0)
Anything you do not write will count as ×1.`),
  },
  lireBloc: (L, texte) => lireBlocTable(L, texte, { SUPER, NORMAL, PEU, WEAK: PEU, AUCUN, NONE: AUCUN }),
  motsBloc: ['SUPER', 'NORMAL', 'PEU', 'AUCUN'],   // pour que le cerveau écrive ses propres règles
  evaluer: evaluerTable,
  affirmations: affirmationsTable,
  grille: grilleComparaison,
  phrase: (L, l) => {
    const q = ids => ids.map(m => `<b style="color:${L.couleurJeton(m)}">${L.nomsJetons[m]}</b>`).join(', ');
    const effet = { [SUPER]: tr('super efficace (×2)', 'super effective (×2)'), [NORMAL]: tr('normal (×1)', 'normal (×1)'), [PEU]: tr('peu efficace (×½)', 'not very effective (×½)'), [AUCUN]: tr('sans effet (×0)', 'no effect (×0)') }[l.reponse];
    return `${q(l.gauche)} → ${q(l.droite)}${tr(' :', ':')} ${effet}`;
  },
};
