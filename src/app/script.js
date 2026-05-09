const game = new Game("gameCanvas");
game.start();
window.game = game;

if (typeof CacheManager !== "undefined" && CacheManager.printStorageUsage) {
  CacheManager.printStorageUsage();
}
