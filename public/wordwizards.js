//ignored for now

// import { Player1, Player2, Spell } from "./wwclasses.js";

// document.addEventListener('DOMContentLoaded', function () {
//   console.log('wordwizards.js: DOMContentLoaded');

//   // Get references to buttons and screens
//   const startBtn = document.getElementById('start-button');
//   const optionsBtn = document.getElementById('options-button');
//   const startScreen = document.getElementById('start-screen');
//   const gameContainer = document.getElementById('game-container');
//   const optionsScreen = document.getElementById('options-screen');
//   const endTurnBtn = document.getElementById('end-turn-button');
//   const players = [
//     document.getElementById('player-1'),
//     document.getElementById('player-2')
//   ];
//   const currentPlayerLabel = document.getElementById('current-player');

//   // NEW: overlay elements
//   const overlay = document.getElementById('turn-overlay');
//   const overlayImg = document.getElementById('turn-overlay-img');

//   let currentPlayerIndex = 0; // 0 = player-1, 1 = player-2

//   // Log warnings if elements are not found
//   if (!startBtn || !optionsBtn) {
//     console.warn('wordwizards.js: start or options button not found', { startBtn, optionsBtn });
//   }

//   function showOverlayForPlayerTurn(idx) {
//     if (!overlay || !overlayImg) return;
//     // when it's Player 1's turn show Player2 avatar, when Player 2's turn show Player1 avatar
//     const src = idx === 0 ? './images/Player2.png' : './images/Player1.png';
//     overlayImg.src = src;
//     overlayImg.alt = idx === 0 ? 'Player 2' : 'Player 1';
//     overlay.style.display = 'flex';
//     // fade in
//     overlay.style.opacity = '0';
//     overlay.setAttribute('aria-hidden', 'false');
//     requestAnimationFrame(() => { overlay.style.opacity = '1'; });
//   }
//   function hideOverlay() {
//     if (!overlay) return;
//     // fade out then remove from layout after transition
//     overlay.style.opacity = '0';
//     overlay.setAttribute('aria-hidden', 'true');
//     setTimeout(() => {
//       overlay.style.display = 'none';
//       if (overlayImg) overlayImg.src = '';
//     }, 220);
//   }

//   function setActivePlayer(idx) {
//     currentPlayerIndex = idx;
//     players.forEach((el, i) => {
//       if (!el) return;
//       if (i === idx) {
//         el.classList.add('active');
//         el.classList.remove('inactive');
//         // enable action buttons
//         el.querySelectorAll('.action-btn, .selection-btn').forEach(b => b.disabled = false);
//       } else {
//         el.classList.add('inactive');
//         el.classList.remove('active');
//         // disable action buttons
//         el.querySelectorAll('.action-btn, .selection-btn').forEach(b => b.disabled = true);
//       }
//     });
//     if (currentPlayerLabel) {
//       const name = idx === 0 ? 'Player 1' : 'Player 2';
//       currentPlayerLabel.textContent = name;
//     }

//     // show the appropriate overlay avatar for the active turn
//     showOverlayForPlayerTurn(idx);
//   }

//   // Initialize UI (start screen visible, player 1 active)
//   setActivePlayer(0);

//   // hide overlay when game is not visible (e.g., on options screen)
//   if (startBtn) {
//     startBtn.addEventListener('click', function () {
//       if (startScreen) startScreen.style.display = 'none';
//       if (optionsScreen) optionsScreen.style.display = 'none';
//       if (gameContainer) gameContainer.style.display = 'block';
//       setActivePlayer(0);
//     });
//   }
//   if (optionsBtn) {
//     optionsBtn.addEventListener('click', function () {
//       if (startScreen) startScreen.style.display = 'none';
//       if (gameContainer) gameContainer.style.display = 'none';
//       if (optionsScreen) optionsScreen.style.display = 'block';
//       hideOverlay();
//     });
//   }

//   // End turn listener
//   if (endTurnBtn) {
//     endTurnBtn.addEventListener('click', () => {
//       setActivePlayer((currentPlayerIndex + 1) % 2);
//     });
//   }

//   // Prevent inactive players from acting if their buttons are clicked
//   document.getElementById('players')?.addEventListener('click', (e) => {
//     const btn = e.target.closest('button');
//     if (!btn) return;
//     const panel = btn.closest('.player');
//     if (!panel) return;
//     const panelIdx = panel.id === 'player-1' ? 0 : 1;
//     if (panelIdx !== currentPlayerIndex) {
//       e.preventDefault();
//       console.log('Not your turn.');
//     }
//   });
// });
