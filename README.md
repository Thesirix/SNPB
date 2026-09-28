<div align="center">

# 🧠 SNPB · Semantic NeuroPlastic Brain

**A tiny neural network that grows its own neurons, and a lab that explains every single thing it does.**
Every neuron, every weight change, every concept, every mistake: measured, named and checked against the truth.

[![No dependencies](https://img.shields.io/badge/Dependencies-none-brightgreen?style=flat-square)](#requirements)
[![Offline](https://img.shields.io/badge/Runs-100%25_offline-blue?style=flat-square)](#quick-start)
[![Languages](https://img.shields.io/badge/UI-English_%7C_Français-purple?style=flat-square)](#quick-start)
[![Research](https://img.shields.io/badge/Topic-Mechanistic_interpretability-cyan?style=flat-square)](#where-this-lab-sits-in-real-research)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

![The lab: a creature world, a growing 3D brain, and the explanation of each neuron](docs/overview.gif)

</div>

## In one sentence

Deep learning works, but nobody can say _why_ a given network makes a given decision. CNPS is a small, fully transparent laboratory where a neural network learns hidden rules, **grows and destroys its own neurons** while it learns (neuroplasticity), and where every step of that learning is **translated into meaning** (semantics) and **verified against the truth**, which in this lab we always know.

It is a sandbox to try research ideas on interpretability, self-reflection and "meaningful" construction of networks, the kind of questions Anthropic, OpenAI and many academic labs work on, but at a scale where you can see everything, test everything, and understand everything.

> [!NOTE]
> Everything runs in your browser, offline, with no installation, no server, no paid API. Double-click and play.

---

## Table of contents

- [Quick start](#quick-start)
- [The problem: the black box](#the-problem-the-black-box)
- [Deep learning in five minutes](#deep-learning-in-five-minutes)
- [Why a brain that grows](#why-a-brain-that-grows)
- [Why nobody does this on large models](#why-nobody-does-this-on-large-models)
- [The idea of this lab](#the-idea-of-this-lab)
- [The worlds](#the-worlds)
- [Engine 1 · The Evolution](#engine-1--the-evolution)
- [The explainer](#the-explainer)
- [Concepts and "what it looks at"](#concepts-and-what-it-looks-at)
- [The growth film and the decision log](#the-growth-film-and-the-decision-log)
- [The brain rewrites the hidden rules](#the-brain-rewrites-the-hidden-rules)
- [The wolf in the snow: shortcuts and traps](#the-wolf-in-the-snow-shortcuts-and-traps)
- [Correcting a brain with meaning](#correcting-a-brain-with-meaning)
- [Engine 2 · The Researcher](#engine-2--the-researcher)
- [Engine 3 · The Architect](#engine-3--the-architect)
- [The AI challenge](#the-ai-challenge)
- [Where this lab sits in real research](#where-this-lab-sits-in-real-research)
- [Honest limits](#honest-limits)
- [Project structure](#project-structure)
- [How the code is organised](#how-the-code-is-organised)
- [Add your own world (module)](#add-your-own-world-module)
- [Ideas of small problems to add](#ideas-of-small-problems-to-add)
- [How it was tested](#how-it-was-tested)
- [Requirements](#requirements)
- [License](#license)

---

## Quick start

1. Download or clone this repository.
2. Open `static/index.html` in any modern browser (on Windows you can simply double-click `lancer.bat`).
3. Pick a **World**, a **Variant** and a **Size**, then click **▶ Train**.
4. Click a neuron in the 3D brain to see what it does, scroll the **growth film**, open the **Reflection** card and click **Let it think**.

The flags in the top-right corner switch the whole lab between English and French. Every "?" next to a title unfolds a short explanation.

---

## The problem: the black box

A modern neural network is a huge pile of numbers (weights). When it answers, billions of multiplications happen, and the answer comes out. We know **how** to train it, and we can measure **how well** it performs, but we usually cannot say:

- **what** it has actually learned (the real rule, or a shortcut that happens to work on the training data?);
- **which part** of the network is responsible for **which decision**;
- **why** a given weight moved during training;
- **whether** an explanation someone gives of the network is true or just sounds convincing.

This is called the **black box problem**. It matters for trust (medicine, justice, safety), for debugging (a network can be 99 % accurate for the wrong reason), and for research itself: if you do not understand what a network learned, you cannot improve the way it learns except by trial and error at massive cost.

The research field that tries to open the box is called **interpretability**, and its most ambitious branch, **mechanistic interpretability**, tries to reverse-engineer networks down to the level of individual neurons and circuits.

---

## Deep learning in five minutes

If you already know this, skip ahead. Otherwise, here is everything you need to follow the rest of the page.

**A neuron** takes numbers as input, multiplies each one by a **weight**, adds them up, and passes the sum through a small squashing function (here `tanh`, which outputs something between −1 and +1). A positive weight means "this input pushes me up", a negative weight means "this input pushes me down".

**A network** is neurons connected to each other. Inputs on one side (what the network reads), outputs on the other side (its answer), and **hidden neurons** in the middle. The outputs are turned into **probabilities** (softmax): "70 % food, 20 % nothing, 10 % poison".

**Embeddings.** A word, a color or a Pokémon type is not a number. So each one gets a position in a small space (here **3D**, x, y, z), and the network reads those coordinates. These positions are learned too: things the network considers similar end up close to each other. In the lab you can see this map live and rotate it.

**Learning** means adjusting weights so that the network makes fewer mistakes. The standard method is **gradient descent**: for each weight, compute in which direction a tiny change would reduce the error, and move it a little in that direction. Repeat thousands of times. This is what every modern AI does, from image classifiers to large language models.

**Why it becomes a black box.** Gradient descent only cares about the error. It never asks whether the solution makes sense to a human. Knowledge ends up spread across thousands (or billions) of weights, mixed together, with no labels. The network works, but no single weight "means" anything on its own.

---

## Why a brain that grows

A standard network has a **fixed shape**, chosen by a human before training: so many layers, so many neurons per layer. Training only changes the weights.

A biological brain does not work like that. It shows **neuroplasticity**: connections are created and removed all the time, unused synapses are pruned, new circuits form when you learn something new. The shape of the network _is_ part of what it learns.

In this lab the brain starts with **no hidden neuron at all**: just a few direct links from what it reads to its answer. Then it **grows** neurons when it needs them and **destroys** them when they are useless. This is done with **NEAT** (NeuroEvolution of Augmenting Topologies, Stanley and Miikkulainen, 2002), combined with gradient descent.

Why it matters for interpretability:

- **The brain stays as small as possible.** A neuron has a "rent" (a small penalty on the score). It survives only if it earns its rent. So every neuron that exists is there for a reason, and that reason can be measured.
- **Each birth and death is an event.** Instead of a silent shift of millions of numbers, you get a story: _"N7 was born at generation 40, it detects red + star → poison, keeping it gained 12 points"_.
- **The size of the brain tells you how hard the problem is.** A simple rule needs zero neurons; a rule that combines two things needs several. You literally watch the difficulty take shape.

---

## Why nobody does this on large models

Growing neurons one by one, as NEAT does, would be unthinkable on a model like GPT or Claude, for two reasons.

1. **Hardware.** GPUs are fast because they multiply huge, regular grids of numbers of a fixed size. A network that keeps changing shape breaks that regularity, and throughput collapses.
2. **Chance does not scale.** Evolution tries random changes and keeps the good ones. That works for 30 neurons. For billions of weights, random search is hopeless, while gradient descent computes the right direction for all the weights at once.

So large models keep a fixed shape and only learn their weights. Some milder forms of plasticity do exist at scale: **pruning** (removing useless weights, going back to _Optimal Brain Damage_, LeCun et al., 1990), **growing networks** progressively (_Cascade-Correlation_, Fahlman and Lebiere, 1990; _Net2Net_, Chen et al., 2015), **neural architecture search**, and **mixture-of-experts** models that only activate part of themselves for each input. None of them gives you a brain whose every neuron has a documented reason to exist.

**With a lot of computing power, could we?** In principle, parts of it, yes: architecture search already spends enormous compute exploring shapes, and nothing forbids growing modules instead of single neurons, or guiding growth by measured meaning instead of chance (which is exactly what engines 2 and 3 of this lab try). The real open question is not only compute, it is **whether the meaning stays readable when the network is huge**. That question is easier to explore on small, fully known problems first. That is the purpose of this lab.

---

## The idea of this lab

The whole lab is one loop:

```
  hidden rules (we know them, the brain does not)
          │
          ▼
  examples ──► the brain learns ──► it grows / destroys neurons
                                            │
                                            ▼
                     the explainer measures what every part does
                                            │
                                            ▼
                     meaning: roles, concepts, rules, reasons
                                            │
                                            ▼
                 verification against the hidden rules ✅ 🟡 ❌
```

The key difference with interpretability on real models: **here we always know the truth**. The rules are generated by the lab, hidden from the brain, and revealed only when you ask. So any explanation, whether produced by the lab itself or by an external AI, can be **scored**. In real research, nobody knows the "hidden rules" of a language model, so explanations can sound right and be wrong.

---

## The worlds

The brain always does the same thing: it **reads two things (A and B) and gives an answer**. A world decides what A, B and the answers are. Each world has several variants and sizes.

| World                               | A                   | B             | Answers                 | Variants                                                                  |
| ----------------------------------- | ------------------- | ------------- | ----------------------- | ------------------------------------------------------------------------- |
| 🗣️ **Secret language**              | second-to-last word | last word     | the next word           | made-up words · English with absurd rules · normal English · 🐺 trap      |
| ⚔️ **Type battles** (Pokémon-style) | attack type         | defender type | ×2 / ×1 / ×½ / ×0       | made-up types · real types, shuffled chart · real Pokémon chart · 🐺 trap |
| 🐛 **Hungry creature**              | object color        | object shape  | food / poison / nothing | crossed rules (color AND shape matter) · simple rules · random · 🐺 trap  |

Each world also has a **live view**:

- the **language** shows sentences and lets the brain invent new ones (mistakes are highlighted);
- the **arena** shows the whole type chart as the brain currently believes it, plus random battles;
- the **creature** walks on a 5×5 grid and decides what to eat **using the brain**. When the brain is wrong, it gets poisoned. When you switch off a neuron, you see it change its behavior.

Why these three: the language has rules with several allowed answers and combinations; the battles are a pure interaction table (the answer depends on both inputs at once, which forces neurons to grow); the creature makes the consequences of the brain's beliefs **visible**.

---

## Engine 1 · The Evolution

This is normal training, the ▶ **Train** button. It is the "intuition" of the brain: fast, effective, and without any idea of why it works.

- A **population of 100 brains**. Each generation, children are created from the best parents.
- **Chance proposes** shape changes: add a neuron in the middle of a link, add a link, remove a link, remove a neuron, move a word on the map.
- **Gradient descent tunes** the weights of each child.
- **Selection keeps** the brains that predict best, minus a small rent per neuron and per link.
- **Species** (brains with a similar shape) protect new ideas: a neuron that has just grown gets a few generations to mature instead of being eliminated at once by the champions.

The **temperament** sets the rent: _Thrifty_ (a neuron is expensive, the brain stays tiny), _Balanced_, _Explorer_ (neurons are free, the brain grows a lot).

**The score** is always compared with a brain that would know the rules perfectly (100 %). When several answers are allowed (four possible next words), the best possible is to spread the probability among them: 25 % each is the right answer, not hesitation.

---

## The explainer

This is the heart of the lab: an explainer **with no external AI**, based only on measurements. Every method below is exact, because the worlds are small enough to test every situation.

### Switching a neuron off (ablation)

For each hidden neuron, every situation is run twice: once normally, once with the neuron forced to 0. The difference is its role.

- **Its role**: towards which answer it pushes, and in which situations, compressed into readable groups: _"→ poison: green, pink + circle, triangle"_.
- **Its importance**: how many points of score the brain loses without it. _Essential_ (more than 10 points), _useful_, or _almost useless_.
- **What breaks without it**: the list of situations that become wrong: _"red + star: poison → nothing"_.

In the 3D view, **the size of each neuron shows its importance**, and under each neuron a short label says what it does.

### The 🔌 Switch off button

You can switch off any neuron yourself. The **whole lab** then uses the brain without it: the creature, the arena, the test panel, the invented sentences. A red banner shows the score with and without it. It is the most direct way to see that a neuron really means what the explainer says: switch off the "poison detector" and the creature starts eating poison.

### What changed between two brains

For any two moments of training, the explainer lists the situations that were **learned** (wrong → right), **forgotten** (right → wrong), the ones where the brain became **more or less confident**, and translates the biggest weight changes into sentences: _"N16 pushes harder towards ×1"_, _"N7 listens more to the shape"_.

---

## Concepts and "what it looks at"

### Concepts

A **concept** is a group of elements the brain **treats the same way**: it gives the same answers for one and for the other, whatever is next to them. It is measured on the brain's answers, not on the map geometry. On the map, members of a concept are linked with dashed lines of the same color.

This is where meaning appears on its own. In the secret language, the concepts the brain invents usually match **the hidden word families** exactly, although nobody told it about them. In the creature, it rediscovers the hidden groups of colors and shapes.

### 👁️ What it looks at

The explainer "hides" what the brain reads in A (every color gets the same average position), then in B, and measures how much its answers move. The result is a share: _"color 85 % · shape 15 %"_. It answers the question of the famous wolf-and-snow story: is the network looking at the animal, or at the snow?

---

## The growth film and the decision log

The **growth film** keeps a frame every time the best brain changes shape. For each frame, in plain words:

- 🌱 _"I try a new neuron, N8. It pushes towards poison for red + star. Without it, I would lose 12 points → I keep it."_
- ✂️ _"I remove N3. In the previous brain it pushed slightly towards nothing for green + diamond. Without it, I only lost 0.1 points → same result with a simpler brain."_
- 📚 what it learned, ⚠️ what it now gets wrong, 🔧 what the weight tuning strengthened, 💡 which concept was born, grew or broke up, 👁️ when what it looks at shifts.
- ❌ the **failed attempts** since the previous frame: shape changes that were tried and not kept, with what they would have broken.

The **log** below has four tabs: the history of the best brain, the detailed log of every weight change (with its meaning), the attempts per generation, and the failed attempts explained.

---

## The brain rewrites the hidden rules

In the card **🧠 What the brain understood**, the brain writes down, by itself, the rules it believes it has found, from its concepts and answers. It writes them in the same machine-readable format as the one asked to external AIs, so they are checked the same way:

- each of its rules gets ✔ true / ✘ false (tested on the real world);
- each real rule gets ✅ found / 🟡 half / ❌ missed;
- for the battles and the creature, the whole table is compared cell by cell.

On the crossed-rules creature and on the real Pokémon chart, a trained brain usually rewrites all the hidden rules with no false statement.

---

## The wolf in the snow: shortcuts and traps

A true story: a classifier was trained to tell wolves from huskies and looked excellent. It turned out it was mostly looking at **the snow** in the background, because in its training photos wolves were almost always in the snow (Ribeiro, Singh and Guestrin, _"Why Should I Trust You?"_, 2016). The score was high for the wrong reason.

Each world has a **🐺 trap** variant that reproduces this:

| World    | The trap                                                                                                                   |
| -------- | -------------------------------------------------------------------------------------------------------------------------- |
| Creature | the real rule combines color and shape, but training only shows some color + shape combinations                            |
| Battles  | the real Pokémon chart, but training only shows ×2 and ×½ battles: the brain concludes that a normal battle does not exist |
| Language | after each word, training only shows one family of words: the second-to-last word seems to decide everything               |

A yellow banner shows two numbers: situations **seen in training** judged right (often 100 %) and situations **never seen** judged right (often almost 0). The brain looks perfect, and it is wrong on everything it has not seen. The explainer shows why: its concepts, what it looks at, and the rules it rewrites.

---

## Correcting a brain with meaning

In **Test the brain** you can correct it:

- pick a situation (or **any** value on one side: _"any color + cross → nothing"_) and the right answer, then **Teach it**;
- or **🎓 Correct all its mistakes**, like a teacher who knows the real rules.

A correction becomes part of what the brain learns, forever. Two repairs are available:

- **🎲 Repair by the Evolution**: training resumes for 150 generations with the correction; at the end, a summary tells which neurons were born, which died, which changed role (🔁 _"N7: before, it pushed towards poison for…; now it pushes towards nothing for…"_).
- **🔬 Repair by the Researcher**: immediate and reasoned (see engine 2).

---

## Engine 2 · The Researcher

The Researcher is the "reflective" part of the brain, in the sense of Kahneman's two systems (_Thinking, Fast and Slow_, 2011): the network is the fast intuition (system 1), the Researcher is the slow reflection (system 2) that watches the intuition through the explainer and acts on it. It is not a consciousness; it is a brain that observes itself.

When you click **Let it think**:

1. **It observes itself**: what it looks at, what it has never seen, where it is too sure of itself, whether everything it saw could be explained by one side alone (a possible shortcut). It writes a conclusion, for example _"I may have fallen into a trap: I am perfect on what I saw, but I guess the rest too confidently."_
2. **It practises** on what it knows badly (mistakes and hesitations). First it only tunes its weights. If that is not enough, it **grows a neuron on purpose** for the situations it gets wrong, trains it, and **checks** that it really repaired something; if not, it removes it and says so. Then it removes neurons that became useless.
3. **It faces the unknown**, in one of two modes:
   - **🧪 Empirical**: it **tries** never-seen situations in the world (tastes the object, fights the battle, listens to how the sentence continues), compares with what it expected, and learns from its **surprises**. Round after round, until two rounds in a row bring no surprise, or nothing unknown is left. _"✗ I taste yellow + cross: I expected food (100 %) → result: poison. Surprise!"_
   - **🛡️ Cautious**: it stops guessing. Never-seen situations are marked "I don't know" (grey "?" cells in the tables), and the creature avoids unknown objects. It is never wrong about them anymore, but it learns nothing new.
4. **It writes its deductions**: its concepts and the rules it draws from them.

On the three traps, the empirical mode typically brings the brain from about half right to almost fully right in a few rounds, and you see, round after round, the surprises becoming rarer: it stops memorising and starts understanding.

---

## Engine 3 · The Architect

The Architect does the opposite of chance: **meaning first, neurons second**.

It is inspired by **KBANN** (_Knowledge-Based Artificial Neural Networks_, Towell and Shavlik, 1994). KBANN's idea: instead of letting training invent neurons, you first write rules, turn each rule into a neuron, and training only refines them. In CNPS, the rules do not come from a human: the Architect **draws them from its own cases**.

1. **It lists** everything it has seen (training, corrections, experiences).
2. **It draws the meaning**: concepts (elements that always give the same answers), rules (_concept of A + concept of B → answer_, or _any + concept of B → answer_ when A does not matter), a default answer, and exceptions.
3. **It builds one neuron per rule**, wired on purpose: it pushes towards the answer of its rule, and it is trained to switch on for the cases of its rule and only them (its meaning is part of its training objective).
4. **It checks each neuron**: _"✓ N10 switches on for the cases of its rule, and only them."_

The result is a brain where **every neuron is born with a documented meaning**: _"N12 = (blue, pink) + (triangle, diamond) → poison"_. The neuron panel shows _"📐 Built by the Architect for: …"_, and the explainer then independently measures whether the neuron does what its rule says.

On the crossed-rules creature, starting from zero, the Architect builds a perfect brain in a fraction of a second with every hidden rule recovered. On a trap it cannot guess what it never saw: the best combination is the empirical Researcher first (to explore), then the Architect (to build a clean brain from everything learned).

---

## The AI challenge

The last card, folded by default, is a challenge: can an external AI (Claude, Gemini, ChatGPT, used for free by copy-paste) explain the brain as well as the lab's own explainer?

1. Click **Copy the text for the AI**: it describes only the **inside** of the brain (map, links, activations), never the examples or the rules.
2. Paste it in a free AI, copy its whole answer back, click **Show the analysis**, then **Reveal**.
3. Its rules are scored exactly like the brain's own rules (✔ ✘, ✅ 🟡 ❌, table cell by cell).

> [!WARNING]
> If "Include the brain's predictions" is checked, the AI sees what the brain answers for every case and can guess the rules without understanding a single neuron. Uncheck it to really test whether it can read the inside of a brain.

---

## Where this lab sits in real research

| Research                                                                                                                                        | What they do                                                                                                                                                                                 | What CNPS does at small scale                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Anthropic**: _Toy Models of Superposition_ (2022), _Towards Monosemanticity_ (2023), _Scaling Monosemanticity_ (2024), circuit tracing (2025) | find the "features" (concepts) hidden in a model, show that a neuron often mixes several concepts (superposition), and steer a model by amplifying a feature (the "Golden Gate Claude" demo) | concepts measured on behavior, neuron roles by ablation, switching a neuron off and watching the behavior change |
| **OpenAI**: _Language models can explain neurons in language models_ (2023), sparse autoencoders on GPT-4 (2024)                                | a big model (GPT-4) writes explanations of the neurons of a smaller one (GPT-2), and the explanations are scored                                                                             | the AI challenge: an external AI explains the brain, and its explanation is scored against the known truth       |
| **Interpretability for trust**: LIME, _"Why Should I Trust You?"_ (2016)                                                                        | detect that a model is right for the wrong reason (wolf and snow)                                                                                                                            | the 🐺 traps, "what it looks at", and the brain's own rewritten rules                                            |
| **Neuro-symbolic AI**: KBANN (1994) and successors                                                                                              | turn rules into neurons, then refine them by learning                                                                                                                                        | engine 3, the Architect, with rules drawn from the cases themselves                                              |
| **Neuroevolution**: NEAT (2002)                                                                                                                 | evolve the shape of networks                                                                                                                                                                 | engine 1, with every birth and death narrated                                                                    |
| **Model editing / active learning**                                                                                                             | fix a model's behavior locally; choose the most informative examples                                                                                                                         | corrections with meaning, and the empirical Researcher choosing what to try                                      |

What this lab adds is not scale; it is **ground truth and total visibility**. Research on large models always faces the same wall: you can propose an explanation, but you cannot fully check it. Here you can. That makes it a good place to prototype ideas (new ways to explain, to correct, to build networks from meaning) and to see exactly where and why they fail, before anyone spends GPU-months on them.

---

## Honest limits

- **Scale.** The worlds have a few dozen to a few hundred situations. Exhaustive testing, which makes the explainer exact, is impossible on a real model.
- **Superposition.** In big models one neuron mixes many concepts; here neurons are few and mostly readable. The lab does not reproduce that difficulty yet.
- **Two inputs only.** The brain reads two things. Rules that need three (a rule that depends on the time of day, a rule that counts) are not possible yet.
- **3D embeddings.** Each element has only three coordinates. The Architect sometimes cannot separate groups on such a small map, and says so when a neuron fails its check.
- **The traps know the truth.** In empirical mode the world answers the brain's experiments; in real life, experiments cost something and the world does not always answer.
- **Not a consciousness.** "Reflection", "the brain thinks", "I" in the logs: this is a narrative of measurements and decisions, not an inner experience.

---

## Project structure

```
labo-cerveau/
├── lancer.bat          opens the lab in your browser (Windows)
├── README.md           this file
├── LICENSE             MIT license
├── docs/               screenshots used by this README
└── static/
    ├── index.html      the page
    ├── style.css       the look (dark theme)
    ├── i18n.js         English / French: tr(), data-en, flags, tab title (CNPS / SNPB)
    ├── mondes.js       what all worlds share: the "L" shape, table worlds, checks cell by cell, the trap banner
    ├── langue.js       world "Secret language": generates the language and its hidden rules
    ├── verif.js        checking of the language rules (families, AFTER, PAIR, COMBO…)
    ├── combats.js      world "Type battles": secret chart, real Pokémon chart, the arena
    ├── creature.js     world "Hungry creature": object rules, the creature simulation, the wolf trap
    ├── neat.js         engine 1: population, mutations, species, gradient descent, album of the film, corrections
    ├── explicateur.js  the explainer: ablation, roles, importance, concepts, what it looks at, rewritten rules
    ├── reflexion.js    engine 2, the Researcher: self-observation, practice, empirical and cautious modes, guided repair
    ├── architecte.js   engine 3, the Architect: meaning from cases, one neuron per rule (KBANN-style)
    ├── dessin.js       drawings: home-made 3D camera, word map, 3D layered brain, curves, neuron profile
    ├── film.js         the growth film and its decision log
    ├── analyse.js      the text sent to an external AI, and the display of its answer
    └── app.js          wires everything together: buttons, progress, panels, corrections, reflection
```

---

## How the code is organised

- **No build step, no framework, no dependency.** Plain JavaScript files loaded in order by `index.html`. The 3D is drawn by hand on a `<canvas>` to stay offline.
- **One brain format for everything.** A brain (genome) is a set of node ids, a list of links `{ de, vers, poids, actif }` and the 3D positions of every element (`plong`). Node ids 0 to 5 are the two 3D inputs, 6 is the bias, then one node per answer, then hidden neurons.
- **One world format for everything.** Every world builds an object `L` with the same fields, so the brain, the drawings, the film, the explainer, the three engines and the checks work on any world without knowing it.
- **Every text exists in both languages.** In code: `tr('français', 'English')`. In the page: a `data-en="…"` attribute. Texts stored for later (film, log) are computed in both languages at once.
- **Display never touches training.** Switched-off neurons, the cautious "?" and the explanations are computed on copies; training always runs on the real brain.

---

## Add your own world (module)

This is the best way to contribute: a new world is a new small problem with hidden rules, and the whole lab (training, explainer, film, three engines, traps, checks) works on it for free.

**1. Create `static/myworld.js`** and build an `L` object. The easiest path is a "table" world (one right answer for each pair A, B):

```js
function generateMyWorld(mode, seed, size) {
  const h = creerHasard(seed); // seeded random: same seed, same rules
  const n = 5,
    ids = [...Array(n).keys()];
  const L = {
    mode,
    graine: seed,
    nbJetons: 2 * n,
    jetonsA: ids,
    jetonsB: ids.map((i) => i + n),
    parDefaut: 0,
    testDepart: [0, n],
    symboleCase: "+",
  };
  nommer(L, {
    jetons: {
      fr: [
        /* French names of A then B */
      ],
      en: [
        /* English names */
      ],
    },
    sorties: { fr: ["non", "oui"], en: ["no", "yes"] },
    entree: {
      fr: {
        courtA: "a",
        courtB: "b",
        longA: "la chose A",
        longB: "la chose B",
        resumeA: "si A est :",
        resumeB: "si B est :",
      },
      en: {
        courtA: "a",
        courtB: "b",
        longA: "thing A",
        longB: "thing B",
        resumeA: "if A is:",
        resumeB: "if B is:",
      },
    },
  });
  const answer = (a, b) => /* your hidden rule */ 0;
  L.regles = [
    /* { cases: [[a, b], …], toutes: true, texte: l => 'the rule in language l' } */
  ];
  remplirTable(L, answer); // builds the examples, L.reponse, L.permis, L.descriptions
  L.couleurJeton = (t) => null;
  L.couleurSortie = (s) => null;
  L.symbole = (s) => L.sorties[s];
  return L;
}
```

**2. Describe the world** with an object like the existing ones (`MONDE_CREATURE` in `creature.js` is the most complete example):

```js
const MY_WORLD = {
  id: "myworld",
  nom: () => tr("Mon monde", "My world"),
  modes: () => ({ normal: tr("Normal", "Normal") }),
  tailles: () => ({ petite: tr("Petite", "Small") }),
  generer: generateMyWorld,
  titreCarte: () => tr("Carte", "Map"),
  aideCarte: () => tr("…", "…"),
  panneau: {
    titre: () => tr("Mon monde", "My world"),
    aide: () => tr("…", "…"),
    html: '<canvas id="myView"></canvas>',
    dessiner: (labo, g, L, voir, etat) => {
      /* optional live view */
    },
  },
  prompt: {
    tache: (L) => "…",
    vocabulaire: (L) => "…",
    indiceRegles: () => "…",
    consigne: () => "…",
  },
  lireBloc: (L, text) => lireBlocTable(L, text, { NO: 0, YES: 1 }),
  motsBloc: ["NO", "YES"], // lets the brain write its own rules
  evaluer: evaluerTable,
  affirmations: affirmationsTable,
  grille: grilleComparaison,
  phrase: (L, l) => "…", // one rule, as a sentence
  verbeEssai: () => tr("J'essaie", "I try"), // used by the empirical Researcher
};
```

**3. Register it**: add `<script src="myworld.js"></script>` in `index.html` (before `neat.js`) and add `myworld: MY_WORLD` to `MONDES` at the top of `app.js`.

**4. Optional: a trap.** Call `restreindreEntrainement(L, (a, b) => …)` to train only on part of the situations, and return `infosPiege(labo, g, L, story)` from `panneau.infos` to get the yellow banner.

Pull requests are very welcome. Keep it offline, dependency-free, bilingual, and explain your world's hidden rules in its `descriptions`.

---

## Ideas of small problems to add

Tiny, fully known problems are exactly what this lab needs. Some ideas, from easy to hard:

- **5×5 pixel images** classified by a hidden rule (symmetry, a cross, a diagonal).
- **Number sequences** from a secret formula (the brain reads two numbers, predicts the next).
- **Arithmetic modulo n**: `(a + b) mod 7`. A classic in interpretability research, where networks learn surprisingly elegant internal algorithms.
- **A tiny chemistry**: two elements, does the reaction explode, fizz or do nothing?
- **Traffic rules**: light color + direction → go / stop / yield.
- **A third input** (time of day, weather): "Fire beats Ice, except at night". This needs the core to read three things, a great contribution in itself.
- **Noisy worlds**: some examples are wrong on purpose. Does the brain learn the rule or the noise, and can the explainer tell?
- **Superposition on purpose**: more concepts than neurons allowed, to see how meaning gets mixed.
- **New engines**: other ways to build or repair a brain from meaning, compared with the three existing ones.

Open an issue with your idea, even without code.

---

## How it was tested

- Headless Chrome driven by `puppeteer-core` (from a temporary folder, not part of the project): every world and every variant, training, the film frame by frame, every neuron, switching neurons off, rewritten rules and their checks, corrections with both repairs, the teacher, the three engines, English and French, with real clicks and screenshots. No JavaScript error.
- Node scripts loading the same files to measure learning: generations needed, neurons grown, situations right on seen and never-seen cases, rules recovered.

Typical timings in Chrome on an ordinary PC: 300 generations take about 3 s (creature) to 20 s (language); the Researcher and the Architect answer in less than half a second.

---

## Requirements

- Any modern browser (Chrome, Edge, Firefox).
- Nothing else. No Python, no Node, no server, no account, no API key.

---

## License

[MIT](LICENSE), © 2026 thesirix. Open source: fork it, break it, add worlds, invent engines. A star is always appreciated ⭐, and new small problems are even more appreciated.
