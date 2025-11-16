import { Spell } from "./wwclasses.js"

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const LOW = 1;
const MEDIUM = 2;
const HIGH = 3;

const MANA_LOW = 10 * LOW;
const MANA_MEDIUM = 10 * MEDIUM;
const MANA_HIGH = 10 * HIGH;

const foodSpells = {
  "Nacho nuke": new Spell("Nacho nuke", getRandomInt(5, 8) * LOW, LOW, MANA_LOW, "attack"),
  "Sugarshock": new Spell("Sugarshock", getRandomInt(5, 8) * LOW, LOW, MANA_LOW, "attack"),
  "Spicebomb": new Spell("Spicebomb", getRandomInt(5, 8) * LOW, LOW, MANA_LOW, "attack"),
  "Frosting fix": new Spell("Frosting fix", getRandomInt(5, 8) * LOW, LOW, MANA_LOW, "heal"),
  "Gumdrop glow": new Spell("Gumdrop glow", getRandomInt(5, 8) * LOW, LOW, MANA_LOW, "heal"),
  "Wasabi whiplash": new Spell("Wasabi whiplash", getRandomInt(5, 8) * MEDIUM, MEDIUM, MANA_MEDIUM, "attack"),
  "Gravy grenade": new Spell("Gravy grenade", getRandomInt(5, 8) * MEDIUM, MEDIUM, MANA_MEDIUM, "attack"),
  "Fries of fury": new Spell("Fries of fury", getRandomInt(5, 8) * MEDIUM, MEDIUM, MANA_MEDIUM, "attack"),
  "Rhubarb remedy": new Spell("Rhubarb remedy", getRandomInt(5, 8) * MEDIUM, MEDIUM, MANA_MEDIUM, "heal"),
  "Casserole cure": new Spell("Casserole cure", getRandomInt(5, 8) * MEDIUM, MEDIUM, MANA_MEDIUM, "heal"),
  "Beetroot boost": new Spell("Beetroot boost", getRandomInt(5, 8) * MEDIUM, MEDIUM, MANA_MEDIUM, "heal"),
  "Exploding cabbage curse": new Spell("Exploding cabbage curse", getRandomInt(5, 8) * HIGH, HIGH, MANA_HIGH, "attack"),
  "Banana peel barrage": new Spell("Banana peel barrage", getRandomInt(5, 8) * HIGH, HIGH, MANA_HIGH, "attack"),
  "Molten marshmallow mayhem": new Spell("Molten marshmallow mayhem", getRandomInt(5, 8) * HIGH, HIGH, MANA_HIGH, "attack"),
  "Ghost pepper blast": new Spell("Ghost pepper blast", getRandomInt(5, 8) * HIGH, HIGH, MANA_HIGH, "attack"),
  "Vanilla vibe check": new Spell("Vanilla vibe check", getRandomInt(5, 8) * HIGH, HIGH, MANA_HIGH, "heal"),
  "Gravy fueled recovery": new Spell("Gravy fueled recovery", getRandomInt(5, 8) * HIGH, HIGH, MANA_HIGH, "heal"),
  "Avocado aura boost": new Spell("Avocado aura boost", getRandomInt(5, 8) * HIGH, HIGH, MANA_HIGH, "heal")
};

export { foodSpells };