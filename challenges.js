// Challenge bank for "Find It at Home!"
// Level 1: Word Hunt · Level 2: Riddle Hunt · Level 3: Learn and Find
// Safety: no sharp, hot, fragile or dangerous objects.

const level1 = [
  ['SPOON', '🥄'], ['CUP', '☕'], ['PILLOW', '🛏️'], ['TOOTHBRUSH', '🪥'], ['BOOK', '📚'],
  ['SOCK', '🧦'], ['KEY', '🔑'], ['REMOTE CONTROL', '📺'], ['WATER BOTTLE', '🧴'], ['TOWEL', '🧺'],
  ['PENCIL', '✏️'], ['COMB', '💇'], ['SHOE', '👟'], ['PLATE', '🍽️'], ['CLOCK', '⏰'],
  ['LEAF', '🍃'], ['BALL', '⚽'], ['CAP OR HAT', '🧢'], ['COIN', '🪙'], ['APPLE', '🍎'],
  ['UMBRELLA', '☂️'], ['BUTTON', '🔘'], ['GLASSES', '👓'], ['TEDDY BEAR', '🧸'], ['SOAP', '🧼'],
  ['BLANKET', '🛋️'], ['SPONGE', '🧽'], ['ONION', '🧅'], ['NOTEBOOK', '📓'], ['BANANA', '🍌'],
].map(([text, icon]) => ({ level: 1, text, icon, answer: text }));

const level2 = [
  ['I have pages and you read me.', 'Book'],
  ['I have hands but I cannot clap.', 'Clock or watch'],
  ['I have teeth but I never eat.', 'Comb'],
  ['The more I dry, the wetter I get.', 'Towel'],
  ['I have a neck but no head.', 'Bottle'],
  ['I have keys but I open no doors.', 'Keyboard or remote'],
  ['I am full of holes but I still hold water.', 'Sponge'],
  ['You put me on your feet before your shoes.', 'Sock'],
  ['I have a head and a tail but no body.', 'Coin'],
  ['I change the channels without leaving the sofa.', 'Remote control'],
  ['I am round. You bounce me, throw me and kick me.', 'Ball'],
  ['I hold your head while you sleep.', 'Pillow'],
  ['I make bubbles and help you wash your hands.', 'Soap'],
  ['I have bristles and keep your smile clean.', 'Toothbrush'],
  ['I am yellow and curved, and you peel me before you eat me.', 'Banana'],
  ['I sit on your nose to help you see.', 'Glasses'],
  ['I keep you warm on a cold night.', 'Blanket'],
  ['I have a sole but no soul.', 'Shoe or slipper'],
  ['I am small, I jingle, and I open locks.', 'Key'],
  ['I have four legs and a back, but I never walk.', 'Chair'],
  ['I open up when it rains and close when it stops.', 'Umbrella'],
  ['I have a handle and a round belly, and I hold your tea.', 'Cup or mug'],
  ['I show you yourself but I never talk.', 'Mirror (photo only, do not move it)'],
  ['I write all day but I never learn to read.', 'Pen or pencil'],
].map(([text, answer]) => ({ level: 2, text, icon: '❓', answer }));

const level3 = [
  ['Find something used to tell time.', 'Clock, watch, timer, phone'],
  ['Find a fruit.', 'Apple, banana, orange…'],
  ['Find a vegetable.', 'Onion, potato, tomato…'],
  ['Find something made of wood.', 'Spoon, pencil, chair, box…'],
  ['Find something shaped like a circle.', 'Plate, coin, lid, clock…'],
  ['Find something made of metal.', 'Spoon, key, coin…'],
  ['Find something with numbers on it.', 'Calendar, clock, remote, book…'],
  ['Find something you use to measure.', 'Ruler, measuring cup, tape…'],
  ['Find something you can see through (transparent).', 'Glass, plastic bottle, window…'],
  ['Find something soft.', 'Pillow, towel, teddy, cushion…'],
  ['Find something the colour of the sky.', 'Anything blue'],
  ['Find something shaped like a rectangle.', 'Book, phone, box, door…'],
  ['Find something that helps keep you healthy.', 'Toothbrush, soap, fruit, water…'],
  ['Find something that holds liquid.', 'Cup, bottle, bowl, jug…'],
  ['Find something that uses a battery.', 'Remote, watch, toy, torch…'],
  ['Find something with letters of the alphabet on it.', 'Book, box, keyboard, label…'],
  ['Find something that can be recycled.', 'Paper, cardboard, can, plastic bottle…'],
  ['Find something that comes in a pair.', 'Socks, shoes, earrings, chopsticks…'],
  ['Find something smaller than your thumb.', 'Button, coin, bead, eraser…'],
  ['Find something made of fabric.', 'Shirt, towel, curtain, bag…'],
  ['Find something that makes a sound.', 'Bell, toy, clock, speaker…'],
  ['Find something used for writing or drawing.', 'Pen, pencil, crayon, chalk…'],
  ['Find something that comes from a plant.', 'Leaf, fruit, wood, cotton…'],
  ['Find something that floats in water.', 'Cork, plastic bottle, sponge, leaf…'],
].map(([text, answer]) => ({ level: 3, text, icon: '🔎', answer }));

const BANK = { 1: level1, 2: level2, 3: level3 };
const LEVEL_NAMES = { 1: 'Word Hunt', 2: 'Riddle Hunt', 3: 'Learn and Find' };

function pick(level, used) {
  const pool = BANK[level].filter(c => !used.has(c.level + ':' + c.text));
  const list = pool.length ? pool : BANK[level];
  const c = list[Math.floor(Math.random() * list.length)];
  used.add(c.level + ':' + c.text);
  return { ...c, levelName: LEVEL_NAMES[level] };
}

module.exports = { pick, LEVEL_NAMES };
