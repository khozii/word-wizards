import { Spell } from "./wwclasses"

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const LOW = 1;
const MEDIUM = 2;
const HIGH = 3;

const MANA_LOW = 10 * LOW;
const MANA_MEDIUM = 10 * MEDIUM;
const MANA_HIGH = 10 * HIGH;

export const foodSpells = {
  "Nacho nuke": new Spell(getRandomInt(5, 8), LOW, MANA_LOW, "attack"),
  "Sugarshock": new Spell(getRandomInt(5, 8), LOW, MANA_LOW, "attack"),
  "Spicebomb": new Spell(getRandomInt(5, 8), LOW, MANA_LOW, "attack"),
  "Frosting fix": new Spell(getRandomInt(5, 8), LOW, MANA_LOW, "heal"),  
  "Gumdrop glow": new Spell(getRandomInt(5, 8), LOW, MANA_LOW, "heal"),  
  "Wasabi whiplash": new Spell(getRandomInt(5, 8), MEDIUM, MANA_MEDIUM, "attack"),
  "Gravy grenade": new Spell(getRandomInt(5, 8), MEDIUM, MANA_MEDIUM, "attack"),
  "Fries of fury": new Spell(getRandomInt(5, 8), MEDIUM, MANA_MEDIUM, "attack"),
  "Rhubarb remedy": new Spell(getRandomInt(5, 8), MEDIUM, MANA_MEDIUM, "heal"), 
  "Casserole cure": new Spell(getRandomInt(5, 8), MEDIUM, MANA_MEDIUM, "heal"), 
  "Beetroot boost": new Spell(getRandomInt(5, 8), MEDIUM, MANA_MEDIUM, "heal"), 
  "Exploding cabbage curse": new Spell(getRandomInt(5, 8), HIGH, MANA_HIGH, "attack"),
  "Banana peel barrage": new Spell(getRandomInt(5, 8), HIGH, MANA_HIGH, "attack"),
  "Molten marshmallow mayhem": new Spell(getRandomInt(5, 8), HIGH, MANA_HIGH, "attack"),
  "Ghost pepper blast": new Spell(getRandomInt(5, 8), HIGH, MANA_HIGH, "attack"),
  "Vanilla vibe check": new Spell(getRandomInt(5, 8), HIGH, MANA_HIGH, "heal"),       
  "Gravy fueled recovery": new Spell(getRandomInt(5, 8), HIGH, MANA_HIGH, "heal"),    
  "Avocado aura boost": new Spell(getRandomInt(5, 8), HIGH, MANA_HIGH, "heal")        
};

export { foodSpells}