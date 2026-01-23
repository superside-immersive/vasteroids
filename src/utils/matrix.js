/**
 * Matrix Utility Class
 * Handles 2D transformation matrix operations
 */

var Matrix = function (rows, columns) {
  var i, j;
  this.data = new Array(rows);
  
  for (i = 0; i < rows; i++) {
    this.data[i] = new Array(columns);
  }

  /**
   * Configure matrix for rotation, scale, and translation
   * @param {number} rot - Rotation in degrees
   * @param {number} scale - Scale factor
   * @param {number} transx - X translation
   * @param {number} transy - Y translation
   */
  this.configure = function (rot, scale, transx, transy) {
    var rad = (rot * Math.PI) / 180;
    var sin = Math.sin(rad) * scale;
    var cos = Math.cos(rad) * scale;
    this.set(cos, -sin, transx,
             sin,  cos, transy);
  };

  /**
   * Set matrix values from arguments
   */
  this.set = function () {
    var k = 0;
    for (i = 0; i < rows; i++) {
      for (j = 0; j < columns; j++) {
        this.data[i][j] = arguments[k];
        k++;
      }
    }
  };

  /**
   * Multiply matrix by vector
   * @returns {Array} - Resulting vector
   */
  this.multiply = function () {
    var vector = new Array(rows);
    for (i = 0; i < rows; i++) {
      vector[i] = 0;
      for (j = 0; j < columns; j++) {
        vector[i] += this.data[i][j] * arguments[j];
      }
    }
    return vector;
  };
};
