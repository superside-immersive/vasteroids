/**
 * GridNode Class
 * Spatial partitioning node for collision detection optimization
 */

var GridNode = function () {
  this.north = null;
  this.south = null;
  this.east  = null;
  this.west  = null;

  this.nextSprite = null;

  this.dupe = {
    horizontal: null,
    vertical:   null
  };

  /**
   * Add a sprite to this grid node
   * @param {Sprite} sprite - Sprite to add
   */
  this.enter = function (sprite) {
    sprite.nextSprite = this.nextSprite;
    this.nextSprite = sprite;
  };

  /**
   * Remove a sprite from this grid node
   * @param {Sprite} sprite - Sprite to remove
   */
  this.leave = function (sprite) {
    var ref = this;
    while (ref && (ref.nextSprite != sprite)) {
      ref = ref.nextSprite;
    }
    if (ref) {
      ref.nextSprite = sprite.nextSprite;
      sprite.nextSprite = null;
    }
  };

  /**
   * Iterate over all sprites in this node
   * @param {Sprite} sprite - Context sprite
   * @param {Function} callback - Callback function
   */
  this.eachSprite = function(sprite, callback) {
    var ref = this;
    while (ref.nextSprite) {
      ref = ref.nextSprite;
      callback.call(sprite, ref);
    }
  };

  /**
   * Check if this node has no sprites that match collidables
   * @param {Array} collidables - Array of collidable sprite names
   * @returns {boolean} - True if empty of collidables
   */
  this.isEmpty = function (collidables) {
    var empty = true;
    var ref = this;
    while (ref.nextSprite) {
      ref = ref.nextSprite;
      empty = !ref.visible || collidables.indexOf(ref.name) == -1;
      if (!empty) break;
    }
    return empty;
  };
};
