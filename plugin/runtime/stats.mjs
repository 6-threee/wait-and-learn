// Agora - show your spaced-repetition stats per deck. Run in a separate terminal
// (or via the agora launcher: `agora stats`). Reads the persistent ~/.agora state.
//
// Counts come from per-card attempts/correct, which the graders started recording
// from when this landed - older grades only have a box level, so totals build up
// from here. Box level is the long-running signal; accuracy is the recent signal.
import { decks, loadSrs } from "./store.mjs";

const bold = "\x1b[1m", cyan = "\x1b[36m", dim = "\x1b[2m",
      green = "\x1b[32m", yellow = "\x1b[33m", reset = "\x1b[0m";

if (!decks || !decks.length) {
  console.log("Agora: no decks loaded. Run /agora:setup first.");
  process.exit(0);
}

for (const deck of decks) {
  const srs = loadSrs(deck.id || "deck");
  let studied = 0, attempts = 0, correct = 0;
  const boxes = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const perCard = [];
  for (const c of deck.cards) {
    const s = srs[c.id] || {};
    const box = s.box || 1;
    boxes[box] = (boxes[box] || 0) + 1;
    if (s.attempts) {
      studied++;
      attempts += s.attempts;
      correct += (s.correct || 0);
      perCard.push({ front: c.front, back: c.back, a: s.attempts, c: s.correct || 0, box: box });
    }
  }

  const acc = attempts > 0 ? Math.round((correct / attempts) * 100) : 0;
  const mastered = boxes[4] + boxes[5];
  console.log(`\n${bold}${cyan}${deck.name}${reset}  ${dim}(${deck.cards.length} cards)${reset}`);
  if (attempts === 0) {
    const promoted = boxes[2] + boxes[3] + boxes[4] + boxes[5];
    if (promoted > 0) {
      console.log(`  ${dim}no per-answer accuracy yet (counters just started) - here's your box progress:${reset}`);
      console.log(`  promoted out of box 1: ${green}${promoted}${reset} / ${deck.cards.length}   ${dim}(mastered, box 4-5: ${mastered})${reset}`);
    } else {
      console.log(`  ${dim}not studied yet - run a review to start tracking.${reset}`);
    }
    console.log(`  box spread:      1:${boxes[1]} 2:${boxes[2]} 3:${boxes[3]} 4:${boxes[4]} 5:${boxes[5]}`);
    continue;
  }
  console.log(`  graded answers:  ${attempts}   ${green}${correct} correct${reset} / ${yellow}${attempts - correct} missed${reset}   ${bold}${acc}% accuracy${reset}`);
  console.log(`  cards practiced: ${studied} / ${deck.cards.length}   ${dim}(mastered, box 4-5: ${mastered})${reset}`);
  console.log(`  box spread:      1:${boxes[1]} 2:${boxes[2]} 3:${boxes[3]} 4:${boxes[4]} 5:${boxes[5]}`);

  // Toughest: lowest per-card accuracy, then most attempts.
  const tough = perCard
    .filter(function (p) { return p.c < p.a; }) // missed at least once
    .sort(function (x, y) { return (x.c / x.a) - (y.c / y.a) || y.a - x.a; })
    .slice(0, 5);
  if (tough.length) {
    console.log(`  ${dim}toughest:${reset}`);
    tough.forEach(function (p) {
      console.log(`    ${cyan}${p.front}${reset} → ${p.back}   ${dim}${p.c}/${p.a} right, box ${p.box}${reset}`);
    });
  }
}
console.log("");
