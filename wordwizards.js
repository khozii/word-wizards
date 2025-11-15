import { Player1, Player2, Spell } from './wwclasses.js';

function counterSpellEffectivness(spell, counter_spell_attempt) {
    const spellName = spell.toLowerCase();
    const spellLength = spellName.length;
    let correctChars = 0;
    
    for (let i = 0; i < spellLength; i++) {
        if (counter_spell_attempt[i] && spellName[i] === counter_spell_attempt[i].toLowerCase()) {
            correctChars++;
        }
    }
    return correctChars;
}

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

function coinFlip() {
    return Math.random() < 0.5 ? 1 : 2;
}

function gameLoop(player1, player2) {
    // Determine who goes first
    let currentPlayer = coinFlip();
    
    // Continue game until one player is dead
    while (player1.health > 0 && player2.health > 0) {
        if (currentPlayer === 1) {
            // Player 1's turn
            // TODO: Handle Player 1's spell selection and typing
            currentPlayer = 2;
        } else {
            // Player 2's turn
            // TODO: Handle Player 2's spell selection and typing
            currentPlayer = 1;
        }
    }
    
    // Determine winner
    if (player1.health > 0) {
        return player1;
    } else {
        return player2;
    }
}
