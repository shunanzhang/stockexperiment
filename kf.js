// http://jsfiddle.net/Cnj8s/68/
var sylvester = require('sylvester');

var Matrix = sylvester.Matrix;

// Settings //////////////////////////////////////

// The decay errodes the assumption that velocity
// never changes.  This is the only unique addition
// I made to the proceedure.  If you set it to zero,
// the filter will act just like the one we designed
// in class which means it strives to find a consitent
// velocitiy.  Over time this will cause it to assume
// the mouse is moving very slowly with lots of noise.
// Set too high and the predicted fit will mirror the
// noisy data it recieves.  When at a nice setting,
// the fit will be resposive and will do a nice job
// of smoothing out the function noise.

var decay = 0.003;

// I use the uncertainty matrix, R to add random noise
// to the known position of the mouse.  The higher the
// values, the more noise, which can be seen by the
// spread of the orange points on the canvas.
//
// If you adjust this number you will often need to
// compensate by changing the decay so that the prediction
// function remains smooth and reasonable.  However, as
// these measurements get noisier we are left with a
// choice between slower tracking (due to uncertainty)
// and unrealistic tracking because the data is too noisy.

var R = Matrix.Diagonal([0.02, 0.02]);

// initial state (location and velocity)
// I haven't found much reason to play with these
// in general the model will update pretty quickly
// to any entry point.

var KF = module.exports = function() {
  this.x = $M([
      [0],
      [0],
      [0],
      [0]
  ]);

  // external motion
  // I have not played with this at all, just
  // added like a udacity zombie.

  this.u = $M([
      [0],
      [0],
      [0],
      [0]
  ]);

  // initial uncertainty
  // I don't see any reason to play with this
  // like the entry point it quickly adjusts
  // itself to the behavior of the mouse
  this.P = Matrix.Random(4, 4);

  // measurement function (4D -> 2D)
  // This one has to be this way to make things run
  this.H = $M([
      [1, 0, 0, 0],
      [0, 1, 0, 0]
  ]);

  // identity matrix
  this.I = Matrix.I(4);
};

KF.prototype.update = function(xMeasure, yMeasure) {

    // Derive the next state
    var F = $M([[1, 0, 1, 0],
            [0, 1, 0, 1],
            [0, 0, 1, 0],
            [0, 0, 0, 1]
           ]);

    // decay confidence
    // to account for change in velocity
    this.P = this.P.map(function(x) {
        return x * (1 + decay);
    });

    // prediction
    this.x = F.x(this.x).add(this.u);
    this.P = F.x(this.P).x(F.transpose());

    // measurement update
    var Z = $M([[xMeasure, yMeasure]]);
    var y = Z.transpose().subtract(this.H.x(this.x));
    var S = this.H.x(this.P).x(this.H.transpose()).add(R);

    var K = this.P.x(this.H.transpose()).x(S.inverse());
    this.x = this.x.add(K.x(y));
    this.P = this.I.subtract(K.x(this.H)).x(this.P);

    return [this.x.e(1, 1), this.x.e(2, 1)];
};
