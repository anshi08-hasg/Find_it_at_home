// Clue bank for "Find It at Home!", a family wellness game.
// Level 1: Word Hunt · Level 2: Riddle Hunt · Level 3: Learn and Find (a health fact + what to find)
// Every object is a safe, everyday thing that helps us stay well: no sharp, hot, fragile or dangerous objects.

const level1 = [
  'WATER BOTTLE', 'APPLE', 'BANANA', 'ORANGE', 'TOOTHBRUSH', 'TOOTHPASTE', 'SOAP', 'TOWEL', 'COMB',
  'PILLOW', 'BLANKET', 'SOCKS', 'SHOES', 'CAP OR HAT', 'BOOK', 'PENCIL', 'BALL', 'CUSHION',
  'SPOON', 'CUP', 'PLATE', 'LEAF', 'CLOCK', 'NOTEBOOK', 'TEDDY BEAR', 'ONION', 'POTATO',
  'LEMON', 'SPONGE', 'HAIRBRUSH',
].map(text => ({ level: 1, text, answer: text }));

const level2 = [
  ['I make bubbles and help you wash your hands clean.', 'Soap'],
  ['I have bristles and keep your smile healthy.', 'Toothbrush'],
  ['You fill me up and drink from me all day.', 'Water bottle or cup'],
  ['The more I dry, the wetter I get.', 'Towel'],
  ['I hold your head while you sleep and rest.', 'Pillow'],
  ['I keep you warm on a cold night.', 'Blanket'],
  ['I am yellow and curved, and you peel me before you eat me.', 'Banana'],
  ['I am round and crunchy, and one a day keeps the doctor away.', 'Apple'],
  ['You wear me on your feet before your shoes.', 'Sock'],
  ['I have teeth but I never eat. I tidy your hair.', 'Comb'],
  ['I am round. You bounce me, throw me and kick me to play.', 'Ball'],
  ['I have pages, and reading me rests your mind.', 'Book'],
  ['I have hands but I cannot clap. I tell you when to sleep.', 'Clock or watch'],
  ['I am full of holes but I still hold water.', 'Sponge'],
  ['I protect your head from the sun.', 'Cap or hat'],
  ['I am sour and yellow, and good in warm water.', 'Lemon'],
  ['You put me on your feet to go for a walk.', 'Shoes'],
  ['I am soft and you hug me when you feel sad.', 'Teddy bear or cushion'],
  ['I grow on a tree and turn the air fresh and clean.', 'Leaf or plant'],
  ['You hold me to eat your healthy soup.', 'Spoon'],
].map(([text, answer]) => ({ level: 2, text, answer }));

const level3 = [
  ['Water helps your brain think clearly. Find something you drink water from.', 'Cup, glass, bottle'],
  ['Fruit gives you vitamins for energy. Find a fruit.', 'Apple, banana, orange…'],
  ['Vegetables help your body grow strong. Find a vegetable.', 'Onion, potato, tomato…'],
  ['Washing hands stops germs spreading. Find something that helps you wash.', 'Soap, towel, sponge'],
  ['Brushing twice a day keeps teeth healthy. Find something for your teeth.', 'Toothbrush, toothpaste'],
  ['Good sleep helps you feel happy. Find something that helps you sleep.', 'Pillow, blanket'],
  ['Reading calms your mind. Find something you can read.', 'Book, newspaper, label'],
  ['Moving every day keeps your heart strong. Find something you play or exercise with.', 'Ball, skipping rope, shoes'],
  ['Plants make the air cleaner. Find something green from a plant.', 'Leaf, plant, vegetable'],
  ['A regular bedtime helps your body rest. Find something that tells the time.', 'Clock, watch'],
  ['Sun can hurt your skin. Find something that protects you from the sun.', 'Cap, hat, umbrella'],
  ['Laughing is good for you. Find something that makes you smile.', 'Toy, photo, teddy'],
  ['Clean clothes keep skin healthy. Find something made of soft fabric.', 'Towel, shirt, sock'],
  ['Drawing helps you relax. Find something to draw or write with.', 'Pencil, pen, crayon'],
  ['Breakfast gives you energy for the day. Find something you eat breakfast with.', 'Bowl, spoon, plate'],
  ['Stretching keeps your body flexible. Find something soft to sit or stretch on.', 'Cushion, mat, rug'],
  ['Music can lift your mood. Find something that makes a sound.', 'Bell, toy, phone'],
  ['Fresh air is good for you. Find something near a window.', 'Curtain, plant, sill'],
  ['Spending time together keeps us happy. Find a photo of someone you love.', 'Any family photo'],
  ['Warm feet help you sleep. Find something you wear on your feet.', 'Socks, slippers'],
].map(([text, answer]) => ({ level: 3, text, answer }));

const BANK = { 1: level1, 2: level2, 3: level3 };
const LEVEL_NAMES = { 1: 'Word Hunt', 2: 'Riddle Hunt', 3: 'Learn & Find' };

function pick(level, used) {
  const pool = BANK[level].filter(c => !used.has(c.level + ':' + c.text));
  const list = pool.length ? pool : BANK[level];
  const c = list[Math.floor(Math.random() * list.length)];
  used.add(c.level + ':' + c.text);
  return { ...c, levelName: LEVEL_NAMES[level] };
}

module.exports = { pick, LEVEL_NAMES };
