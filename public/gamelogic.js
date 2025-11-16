/**
 * =====================================================
 * WORD WIZARDS - GAME LOGIC MODULE
 * =====================================================
 * 
 * This module contains all the core game logic.
 * This includes spell casting, countering, damage calculation, shield mechanics, and game state management.
 * 
 * GAME FLOW:
 * 1. Frontend initializes game with initializeGame()
 * 2. Attacker's turn: playerCastSpell() validates spell typing
 * 3. Defender's turn: opponentCounter() handles counter attempt and applies damage
 * 4. Turn ends: endPlayerTurn() switches players and regenerates mana
 * 5. Repeat until winner is determined (health <= 0)
 * 
 * KEY MECHANICS:
 * - Mana: Required to cast spells, regenerates 15 per turn, capped at 50
 * - Shield: Absorbs damage first, then overflow goes to health. Heals go to shields, not health. Capped at 100.
 * - Counter System: Defenders get reduced time to type spell names and reduce incoming damage by % of chars matched
 * - Spell Types: "attack" and "heal"
 */

import { Player1, Player2, Spell } from './wwclasses.js';


// ===== GAME CONSTANTS =====
// Base timing constants - will be modified by spell tier
const BASE_ATTACK_TIME = 4000; // Base time for attack spells
const BASE_COUNTER_TIME = 3500; // Base time for counter attempts
const MANA_REGEN_PER_TURN = 15; // Mana regenerated each turn
const MANA_CAP = 50; // Maximum mana a player can have

// Tier-based timing multipliers
const TIER_TIME_MULTIPLIERS = {
  1: 0.8,  // Low tier: 20% faster (shorter time)
  2: 1.0,  // Medium tier: normal time
  3: 1.3   // High tier: 30% longer
};

/**
 * Get attack time limit based on spell tier
 * @param {number} spellTier - The tier of the spell (1=LOW, 2=MEDIUM, 3=HIGH)
 * @returns {number} Time limit in milliseconds
 */
function getAttackTimeLimit(spellTier) {
  const multiplier = TIER_TIME_MULTIPLIERS[spellTier] || 1.0;
  return Math.round(BASE_ATTACK_TIME * multiplier);
}

/**
 * Get counter time limit based on spell tier
 * @param {number} spellTier - The tier of the spell being countered (1=LOW, 2=MEDIUM, 3=HIGH)
 * @returns {number} Time limit in milliseconds
 */
function getCounterTimeLimit(spellTier) {
  const multiplier = TIER_TIME_MULTIPLIERS[spellTier] || 1.0;
  return Math.round(BASE_COUNTER_TIME * multiplier);
}

// Legacy constants for backward compatibility
const ATTACK_TIME_LIMIT = BASE_ATTACK_TIME;
const COUNTER_TIME_LIMIT = BASE_COUNTER_TIME;




// ===== HELPER FUNCTIONS =====



/**
 * Counts how many characters the defending player got correct in their counter attempt.
 * Compares character-by-character against the spell name (case-insensitive).
 * 
 * @param {string} spell - The spell name to match against
 * @param {string} counter_spell_attempt - What the defender typed
 * @returns {number} Number of characters that matched in correct positions
 * 
 * Example: counterSpellEffectivness("fireball", "fire") returns 4
 */
function counterSpellEffectivness(spell, counter_spell_attempt) {
    const spellName = spell.toLowerCase();
    const spellLength = spellName.length;
    let correctChars = 0;
    
    for (let i = 0; i < spellLength; i++) {
        console.log("Comparing:", spellName[i], "to", counter_spell_attempt[i]);
        if (counter_spell_attempt[i] && spellName[i] === counter_spell_attempt[i].toLowerCase()) {
            correctChars++;
        }
    }
    return correctChars;
}


/**
 * Checks if the attacker typed the spell name correctly (exact match, case-insensitive).
 * 
 * @param {Object} spell - Spell object with a 'name' property
 * @param {string} spellAttempt - What the attacker typed
 * @returns {boolean} True if spell was typed correctly, false otherwise
 */
function castSpell(spell, spellAttempt) {
    const spellName = spell.name.toLowerCase();
    const playerAttempt = spellAttempt.toLowerCase();
    
    // Check if spell name matches exactly
    if (spellName === playerAttempt) {
        return true;
    } 
    else {
        return false;
    }
}

/**
 * Randomly determines which player goes first.
 * 
 * @returns {number} 1 or 2 (representing Player1 or Player2)
 */
function coinFlip() {
    return Math.random() < 0.5 ? 1 : 2;
}


// ===== SPELL CASTING FUNCTIONS =====

/**
 * Handles an attack spell cast by a player.
 * Validates mana cost, consumes mana (even on failure), and checks spell typing.
 * 
 * @param {Object} attacker - Player object attempting to cast
 * @param {Object} spell - Spell object with properties: name, damage, mana
 * @param {string} spellAttempt - What the player typed
 * @returns {Object} {success: boolean, spellName: string, baseDamage: number, spell: Object} or {success: false, reason: string}
 * 
 * FLOW:
 * 1. Check if player has enough mana (if not, return failure)
 * 2. Consume mana from player
 * 3. Check if typed spell name exactly matches
 * 4. Return success or failure result
 */
function attemptCastSpell(attacker, spell, spellAttempt) {
    // Check if attacker has enough mana
    if (attacker.mana < spell.mana) {
        return {
            success: false,
            reason: "Not enough mana"
        };
    }
    
    // Consume mana regardless of cast success
    attacker.mana -= spell.mana;
    
    // Check if spell was cast correctly
    const spellCastSuccess = castSpell(spell, spellAttempt);
    
    if (!spellCastSuccess) {
        return {
            success: false,
            reason: "Spell mispelled"
        };
    }
    
    // Spell was cast successfully
    return {
        success: true,
        spellName: spell.name,
        baseDamage: spell.damage,
        spell: spell
    };
}


/**
 * Processes a defender's counter attempt to reduce incoming damage.
 * Each character correctly typed reduces damage by a percentage.
 * Damage is applied to shield first, then overflows to health.
 * 
 * @param {Object} defender - Player object being attacked
 * @param {Object} spell - The spell being countered (need name and damage)
 * @param {string} counterAttempt - What the defender typed
 * @returns {Object} Detailed counter result including damage breakdown
 * 
 * DAMAGE CALCULATION:
 * - correctChars = number of chars defender typed correctly
 * - damageReduction = (correctChars / spellLength) * 100 percent
 * - finalDamage = baseDamage * (1 - damageReduction/100)
 * 
 * EXAMPLE: Fireball (8 chars, 25 damage)
 * - Defender types "fire" (4 chars correct)
 * - Reduction = 50%, finalDamage = 12.5
 */
function processCounterSpell(defender, spell, counterAttempt) {
    // Calculate counter damage reduction
    const correctCounterChars = counterSpellEffectivness(spell.name, counterAttempt);
    const damageReductionPercent = (correctCounterChars / spell.name.length) * 100;
    const finalDamage = Math.round(spell.damage * (1 - (damageReductionPercent / 100)));
    
    // Apply damage to shield first, then overflow to health
    const shieldBefore = defender.shield;
    let damageToHealth = 0;
    if (finalDamage > defender.shield) {
        damageToHealth = finalDamage - defender.shield;
        defender.shield = 0;
    } else {
        defender.shield -= finalDamage;
    }
    
    // Round health to whole numbers to avoid floating point precision issues
    defender.health = Math.round(defender.health - damageToHealth);
    
    const damageToShield = Math.min(finalDamage, shieldBefore);
    
    return {
        correctChars: correctCounterChars,
        spellLength: spell.name.length,
        damageReductionPercent: Math.round(damageReductionPercent * 10) / 10, // Keep one decimal for percentage display
        baseDamage: spell.damage,
        finalDamage: finalDamage,
        damageToShield: damageToShield,
        damageToHealth: damageToHealth,
        defenderShieldRemaining: Math.round(Math.max(0, defender.shield)),
        defenderHealthRemaining: Math.round(Math.max(0, defender.health))
    };
}


/**
 * Handles a heal spell cast by a player.
 * Heals don't restore health, they increase the shield instead.
 * Shield is capped at 100. Mana is consumed even on failure.
 * 
 * @param {Object} healer - Player object attempting to heal
 * @param {Object} healSpell - Spell object with properties: name, damage (healing amount), mana
 * @param {string} spellAttempt - What the player typed
 * @returns {Object} {success: boolean, shieldGained: number, shieldRemaining: number} or {success: false, reason: string}
 * 
 * MECHANICS:
 * - Healing amount = spell.damage (property reused)
 * - Shield increases by healing amount, capped at 100
 */
function castHealSpell(healer, healSpell, spellAttempt) {
    const MAX_SHIELD = 100;
    // Check if healer has enough mana
    if (healer.mana < healSpell.mana) {
        return {
            success: false,
            reason: "Not enough mana"
        };
    }
    
    healer.mana -= healSpell.mana;
    
    // Check if spell was cast correctly
    const spellCastSuccess = castSpell(healSpell, spellAttempt);
    
    if (!spellCastSuccess) {
        return {
            success: false,
            reason: "Spell mispelled"
        };
    }
    
    // Spell was cast successfully - add healing to shield
    const shieldBefore = healer.shield;
    healer.shield = Math.min(healer.shield + healSpell.damage, MAX_SHIELD);
    const shieldGained = healer.shield - shieldBefore;
    
    return {
        success: true,
        spellName: healSpell.name,
        healAmount: healSpell.damage,
        shieldGained: shieldGained,
        shieldRemaining: healer.shield,
        spell: healSpell
    };
}


// ===== SPELL ROUTER =====

/**
 * Calls the appropriate spell casting function based on spell type.
 * 
 * @param {Object} player - Player attempting to cast spell
 * @param {Object} opponent - The other player (unused, kept for future features)
 * @param {Object} spell - Spell object with properties: name, damage, mana, type
 * @param {string} spellAttempt - What the player typed
 * @returns {Object} Result from attemptCastSpell() or castHealSpell()
 * 
 * SPELL TYPES:
 * - "attack": Calls attemptCastSpell(), deals damage
 * - "heal": Calls castHealSpell(), increases shield
 */
function castPlayerSpell(player, opponent, spell, spellAttempt) {
    if (spell.type === "attack") {
        return attemptCastSpell(player, spell, spellAttempt);
    } else if (spell.type === "heal") {
        return castHealSpell(player, spell, spellAttempt);
    } else {
        return {
            success: false,
            reason: "Unknown spell type"
        };
    }
}



// ===== GAME STATE MANAGEMENT =====

/**
 * Creates and initializes a new game state object.
 * Call this at the start of every game.
 * 
 * @param {Object} player1 - Player1 instance
 * @param {Object} player2 - Player2 instance
 * @returns {Object} Game state object tracking both players, current turn, and game status
 * 
 * RETURNED STATE:
 * - player1, player2: Player objects
 * - currentPlayer: 1 or 2 (who is attacking this turn)
 * - gameOver: boolean (true when someone reaches 0 health)
 * - winner: Player object or null
 */
function initializeGame(player1, player2) {
    return {
        player1: player1,
        player2: player2,
        currentPlayer: coinFlip(),
        gameOver: false,
        winner: null
    };
}

/**
 * Gets the player whose turn it is to attack.
 * 
 * @param {Object} gameState - Current game state
 * @returns {Object} Player object of current attacker
 */
function getCurrentPlayer(gameState) {
    return gameState.currentPlayer === 1 ? gameState.player1 : gameState.player2;
}

/**
 * Gets the player who is defending (opponent of current player).
 * 
 * @param {Object} gameState - Current game state
 * @returns {Object} Player object of current defender
 */
function getOpponent(gameState) {
    return gameState.currentPlayer === 1 ? gameState.player2 : gameState.player1;
}

/**
 * Handles the attacking player's spell cast during the game.
 * Wraps castPlayerSpell() to integrate with game state.
 * 
 * @param {Object} gameState - Current game state
 * @param {Object} spell - Spell to cast
 * @param {string} spellAttempt - What the attacker typed
 * @returns {Object} {castResult: {...}, spell: {...}}
 * 
 * FRONTEND USAGE:
 * 1. Show attacker 3 second timer
 * 2. Collect typed input
 * 3. Call this function when timer expires
 * 4. Check castResult.success to determine next phase
 */
function playerCastSpell(gameState, spell, spellAttempt) {
    const attacker = getCurrentPlayer(gameState);
    const result = castPlayerSpell(attacker, null, spell, spellAttempt);
    
    return {
        castResult: result,
        spell: spell
    };
}

/**
 * Handles the defending player's counter attempt.
 * Processes damage and checks if game is over.
 * 
 * @param {Object} gameState - Current game state
 * @param {Object} spell - The spell being countered
 * @param {string} counterAttempt - What the defender typed
 * @returns {Object} Counter result with damage breakdown
 * 
 * SIDE EFFECTS:
 * - Modifies defender's health and shield
 * - Sets gameState.gameOver and gameState.winner if defender dies
 * 
 * FRONTEND USAGE:
 * 1. Show defender 1 second timer
 * 2. Collect typed input
 * 3. Call this function when timer expires
 * 4. Display damage taken
 * 5. Check isGameOver() to see if game ends
 */
function opponentCounter(gameState, spell, counterAttempt) {
    const defender = getOpponent(gameState);
    const counterResult = processCounterSpell(defender, spell, counterAttempt);
    
    // Check if defender is dead
    if (defender.health <= 0) {
        gameState.gameOver = true;
        gameState.winner = gameState.currentPlayer === 1 ? gameState.player1 : gameState.player2;
    }
    
    return counterResult;
}

/**
 * Ends the current player's turn and switches to the opponent.
 * Regenerates mana for the new current player.
 * 
 * @param {Object} gameState - Current game state
 * @returns {Object} Updated game state
 * 
 * SIDE EFFECTS:
 * - Switches currentPlayer between 1 and 2
 * - Adds MANA_REGEN_PER_TURN to new current player's mana
 * - Caps mana at MANA_CAP (50)
 * 
 * FRONTEND USAGE:
 * Call when attacker clicks "End Turn" button
 */
function endPlayerTurn(gameState) {
    // Switch to other player
    gameState.currentPlayer = gameState.currentPlayer === 1 ? 2 : 1;
    
    // Regenerate mana for the new current player
    const currentPlayer = getCurrentPlayer(gameState);
    currentPlayer.mana += MANA_REGEN_PER_TURN;
    if (currentPlayer.mana > MANA_CAP) {
        currentPlayer.mana = MANA_CAP;
    }
    
    return gameState;
}


function isGameOver(gameState) {
    return gameState.gameOver;
}


function getWinner(gameState) {
    return gameState.winner;
}




// ===== EXPORTS =====
export {
    initializeGame,
    getCurrentPlayer,
    getOpponent,
    playerCastSpell,
    opponentCounter,
    endPlayerTurn,
    isGameOver,
    getWinner,
    castPlayerSpell,
    processCounterSpell,
    attemptCastSpell,
    castHealSpell,
    counterSpellEffectivness,
    castSpell,
    coinFlip,
    getAttackTimeLimit,
    getCounterTimeLimit,
    ATTACK_TIME_LIMIT,
    COUNTER_TIME_LIMIT,
    MANA_REGEN_PER_TURN,
    MANA_CAP
};
