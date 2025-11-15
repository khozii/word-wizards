import { Player1, Player2, Spell } from "./wwclasses.js";


// Button Event Listeners
document.addEventListener('DOMContentLoaded', function () {
  console.log('wordwizards.js: DOMContentLoaded');
// Get references to buttons and screens
  const startBtn = document.getElementById('start-button');
  const optionsBtn = document.getElementById('options-button');
  const startScreen = document.getElementById('start-screen');
  const gameContainer = document.getElementById('game-container');
  const optionsScreen = document.getElementById('options-screen');
// Log warnings if elements are not found
  if (!startBtn || !optionsBtn) {
    console.warn('wordwizards.js: start or options button not found', { startBtn, optionsBtn });
  }
// Event listener for Options button
  if (optionsBtn) {
    optionsBtn.addEventListener('click', function () {
      if (startScreen) startScreen.style.display = 'none';
      if (gameContainer) gameContainer.style.display = 'none';
      if (optionsScreen) optionsScreen.style.display = 'block';
    });
  }
// Event listener for Start Game button
  if (startBtn) {
    startBtn.addEventListener('click', function () {
      if (startScreen) startScreen.style.display = 'none';
      if (optionsScreen) optionsScreen.style.display = 'none';
      if (gameContainer) gameContainer.style.display = 'block';
    });
  }
});
