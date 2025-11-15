function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const LOW = 1;
const MEDIUM = 2;
const HIGH = 3;

class Spell {
  constructor(power, level) {
    this.power = power;
    this.level = level;
  }
}

const foodSpells = {
  "Nacho nuke": new Spell(getRandomInt(5, 8), LOW),
  "Sugarshock": new Spell(getRandomInt(5, 8), LOW),
  "Spicebomb": new Spell(getRandomInt(5, 8), LOW),
  "Frosting fix": new Spell(getRandomInt(5, 8), LOW),  // heal
  "Gumdrop glow": new Spell(getRandomInt(5, 8), LOW),  // heal
  "Wasabi whiplash": new Spell(getRandomInt(5, 8), MEDIUM),
  "Gravy grenade": new Spell(getRandomInt(5, 8), MEDIUM),
  "Fries of fury": new Spell(getRandomInt(5, 8), MEDIUM),
  "Rhubarb remedy": new Spell(getRandomInt(5, 8), MEDIUM), // heal
  "Casserole cure": new Spell(getRandomInt(5, 8), MEDIUM), // heal
  "Beetroot boost": new Spell(getRandomInt(5, 8), MEDIUM), // heal
  "Exploding cabbage curse": new Spell(getRandomInt(5, 8), HIGH),
  "Banana peel barrage": new Spell(getRandomInt(5, 8), HIGH),
  "Molten marshmallow mayhem": new Spell(getRandomInt(5, 8), HIGH),
  "Ghost pepper blast": new Spell(getRandomInt(5, 8), HIGH),
  "Vanilla vibe check": new Spell(getRandomInt(5, 8), HIGH),       // heal
  "Gravy fueled recovery": new Spell(getRandomInt(5, 8), HIGH),    // heal
  "Avocado aura boost": new Spell(getRandomInt(5, 8), HIGH)        // heal
};