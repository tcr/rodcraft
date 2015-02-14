
// camera resize: view-source:http://mrdoob.github.com/three.js/examples/webgl_interactive_cubes.html

function augment (o, i) {
  var k, v;
  for (k in i) {
    v = i[k];
    o[k] = v;
  }
  return o;
}

/**
 * Game globals
 */

var game = {
  camera: null,
  scene: null,
  projector: null,
  renderer: null,
  controls: null
};

var RODS = [], GRIPS = [], POINTED, SELECTED, TOPOINTS, POINTEDCUBE;
var construction, straightGrid, diagonalGrid;

var GRIP_OPACITY = 0.2, GRIP_OPACITY_HIGHLIGHT = 0.45;
var CUBE_OPACITY = 0.2, CUBE_OPACITY_HIGHLIGHT = 0.45;

var MouseEvent = {
  isLeftButton: function(event) {
    return event.which === 1;
  },
  isRightButton: function(event) {
    return event.which === 3;
  },
  isLeftButtonDown: function(event) {
    return event.button === 0 && this.isLeftButton(event);
  }
};

var Controls = (function() {

  function Controls(object, domElement) {
    this.object = object;
    this.target = new THREE.Vector3(0, 0, 0);
    this.domElement = domElement || document;
    this.lookSpeed = 0.20;
    this.movementX = 0;
    this.movementY = 0;
    this.lat = 0;
    this.lon = -50;
    this.defineBindings();
  }

  Controls.prototype.defineBindings = function() {
    $(this.domElement).on('mousemove', this.onMouseMove.bind(this));
    $(this.domElement).on('mousedown', this.onMouseDown.bind(this));
    $(this.domElement).on('mouseup', this.onMouseUp.bind(this));
    $(this.domElement).on('mouseenter', this.onMouseEnter.bind(this));
  };

  Controls.prototype.onMouseEnter = function(event) {
    if (!MouseEvent.isLeftButtonDown(event)) {
      return this.onMouseUp(event);
    }
  };

  Controls.prototype.onMouseDown = function(event) {
    if (!MouseEvent.isLeftButton(event)) {
      return;
    }
    if (this.domElement !== document) {
      this.domElement.focus();
    }
    this.mouseDragOn = true;
    return false;
  };

  Controls.prototype.onMouseUp = function(event) {
    this.mouseDragOn = false;
    return false;
  };

  Controls.prototype.onMouseMove = function(event) {
    event = event.originalEvent;
    if (event.webkitMovementX || event.webkitMovementY) {
      this.movementX = event.webkitMovementX;
      this.movementY = event.webkitMovementY;
    }
  };

  Controls.prototype.halfCircle = Math.PI / 180;

  Controls.prototype.viewDirection = function() {
    return this.target.clone().subSelf(this.object.position);
  };

  Controls.prototype.move = function(newPosition) {
    this.object.position = newPosition;
    return this.updateLook();
  };

  Controls.prototype.updateLook = function() {
    var cos, p, phi, sin, theta;
    sin = Math.sin, cos = Math.cos;
    phi = (90 - this.lat) * this.halfCircle;
    theta = this.lon * this.halfCircle * 2;
    p = this.object.position;
    augment(this.target, {
      x: p.x + 100 * sin(phi) * cos(theta),
      y: p.y + 100 * cos(phi),
      z: p.z + 100 * sin(phi) * sin(theta)
    });
    this.object.lookAt(this.target);
  };

  Controls.prototype.update = function() {
    var max, min;
    if (!this.movementX && !this.movementY) {
      return;
    }
    max = Math.max, min = Math.min;
    this.lon += (this.movementX) * this.lookSpeed;
    this.lat -= (this.movementY) * this.lookSpeed;
    this.movementX = 0;
    this.movementY = 0;
    this.lat = max(-85, min(85, this.lat));
    this.updateLook();
  };

  return Controls;

})();

window.MouseEvent = MouseEvent;

window.Controls = Controls;
  
function createCube (group, x, y, z, type) {
  var mesh = new THREE.Mesh(
    new THREE.CubeGeometry(
    GRIP_RADIUS*2,
    GRIP_RADIUS*2,
    GRIP_RADIUS*2),

    new THREE.MeshLambertMaterial({
      color: type ? 0x33FF99 : 0xFFFF00,
      ambient: type ? 0x33FF99 : 0xFFFF00,
      transparent: true,
      opacity: CUBE_OPACITY
    }));
  mesh.position.x = x;
  mesh.position.y = y;
  mesh.position.z = z;

  mesh.type = type;

  group.add(mesh);
}

var ROD_LENGTH = 2.00, ROD_RADIUS = 0.05;
var GRIP_RADIUS = 0.30;

function createStraightGridControl () {
  var group = new THREE.Object3D();
  createCube(group, 0, 0, -ROD_LENGTH, 0);
  createCube(group, 0, 0, ROD_LENGTH, 0);
  createCube(group, 0, -ROD_LENGTH, 0, 0);
  createCube(group, 0, ROD_LENGTH, 0, 0);
  createCube(group, -ROD_LENGTH, 0, 0, 0);
  createCube(group, ROD_LENGTH, 0, 0, 0);
  return group;
}

function createDiagonalGridControl () {
  var group = new THREE.Object3D();
  createCube(group, 0, -ROD_LENGTH, -ROD_LENGTH, 1);
  createCube(group, 0, -ROD_LENGTH, +ROD_LENGTH, 1);
  createCube(group, 0, +ROD_LENGTH, -ROD_LENGTH, 1);
  createCube(group, 0, +ROD_LENGTH, +ROD_LENGTH, 1);
  createCube(group, -ROD_LENGTH, 0, -ROD_LENGTH, 1);
  createCube(group, -ROD_LENGTH, 0, +ROD_LENGTH, 1);
  createCube(group, +ROD_LENGTH, 0, -ROD_LENGTH, 1);
  createCube(group, +ROD_LENGTH, 0, +ROD_LENGTH, 1);
  createCube(group, -ROD_LENGTH, -ROD_LENGTH, 0, 1);
  createCube(group, +ROD_LENGTH, -ROD_LENGTH, 0, 1);
  createCube(group, -ROD_LENGTH, +ROD_LENGTH, 0, 1);
  createCube(group, +ROD_LENGTH, +ROD_LENGTH, 0, 1);
  return group;
}

function createConstruction (grip1, grip2) {

  var group = new THREE.Object3D();

  group.createGrip = function (x, y, z) {
    var existing = GRIPS.filter(function (g) {
      return g.position.x == x && g.position.y == y && g.position.z == z;
    });
    if (existing.length) {
      return existing[0];
    }

    // set up the sphere vars
    var radius = GRIP_RADIUS,
    segments = 16,
    rings = 16;

    // create a new mesh with
    // sphere geometry - we will cover
    // the sphereMaterial next!
    var mesh = new THREE.Mesh(
      new THREE.SphereGeometry(
      radius,
      segments,
      rings),

      new THREE.MeshLambertMaterial({
        color: 0x3399FF,
        ambient: 0x3399FF,
        transparent: true,
        opacity: 0
      }));

    mesh.position.x = x;
    mesh.position.y = y;
    mesh.position.z = z;

    group.add(mesh);
    GRIPS.push(mesh);

    return mesh;
  }

  group.createRod = function (from, to, type) {
    var ROD_LENGTH = from.position.distanceTo(to.position);

    var geometry = new THREE.CubeGeometry(ROD_LENGTH + ROD_RADIUS*2, ROD_RADIUS*2, ROD_RADIUS*2 );
    var material = new THREE.MeshLambertMaterial({
      color: type ? 0xFFFF00 : 0x0000FF,
      ambient: type ? 0xFFFF00 : 0x0000FF
    });
    var rod = new THREE.Mesh( geometry, material );
    rod.position.x = (from.position.x + to.position.x) / 2;
    rod.position.y = (from.position.y + to.position.y) / 2;
    rod.position.z = (from.position.z + to.position.z) / 2;

    var doX = 0, doY = 0, doZ = 0;
    if ((from.position.x|0) != (to.position.x|0)) {
      doX = from.position.x < to.position.x ? -1 : 1;
    }
    if ((from.position.y|0) != (to.position.y|0)) {
      doY = from.position.y < to.position.y ? -1 :1;
    }
    if ((from.position.z|0) != (to.position.z|0)) {
      doZ = from.position.z < to.position.z ? -1 : 1;
    }

    var vec = new THREE.Vector3(doX, doY, doZ);
    rod.rotation.y = -Math.atan2(vec.z, vec.x);
    rod.rotation.z = Math.atan2(vec.y, Math.sqrt(vec.x*vec.x + vec.z*vec.z));

    RODS.push(rod);
    group.add(rod);
    return rod;
  }

  group.destroyRod = function (rod) {
    RODS = RODS.filter(function (a) {
      return a != rod;
    });
    group.remove(rod);
  };

  group.destroyGrip = function (grip) {
    GRIPS = GRIPS.filter(function (a) {
      return a != grip;
    });
    group.remove(grip);
  }

  return group;
}

function init () {
  // Camera
  game.camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    1, 10000
  );
  game.camera.position.z = 8;
  game.camera.position.y = 1;

  // Build game scene.
  game.scene = new THREE.Scene();

  var plane = new THREE.Mesh(new THREE.PlaneGeometry(10000, 10000),
    new THREE.MeshLambertMaterial({
        color: 0x00aa00,
        ambient: 0x00aa00
    }));
  plane.overdraw = true;
  plane.rotation.x = -Math.PI/2;
  plane.position.y -= ROD_RADIUS;
  game.scene.add(plane);

  // Add rod
  construction = createConstruction();
  construction.position.y = 0;
  game.scene.add(construction);

  // Create the massive floor
  var grips = [];
  var RRR = 10;
  for (var i = 0; i < RRR; i++) {
    var griprow = [];
    for (var j = 0; j < RRR; j++) {
      var g = construction.createGrip(i*2 - RRR, 0, j*2 - RRR);
      griprow.push(g);
      if (griprow[j - 1]) construction.createRod(g, griprow[j-1], 0);
      if (grips[i - 1] && grips[i - 1][j]) construction.createRod(g, grips[i - 1][j], 0);
      if (grips[i - 1] && grips[i - 1][j - 1] && griprow[j - 1]) construction.createRod(griprow[j - 1], grips[i - 1][j - 1], 0);
    }
    grips.push(griprow);
  }

  straightGrid = createStraightGridControl();
  diagonalGrid = createDiagonalGridControl();

  // add subtle ambient lighting
  var ambientLight = new THREE.AmbientLight(0x888888);
  game.scene.add(ambientLight);
  // Add point light
  var directionalLight = new THREE.PointLight(0xffffff, 1);
  directionalLight.position.set( 0, 50, 0);
  game.scene.add(directionalLight);

  // Projector
  game.projector = new THREE.Projector();

  // Controls
  game.controls = new Controls(game.camera);

  // Render
  game.renderer = new THREE.WebGLRenderer({ antialias: true });
  game.renderer.setSize( window.innerWidth, window.innerHeight );

  // Insert element.
  document.body.appendChild( game.renderer.domElement );

}

function animate() {
  requestAnimationFrame(animate);
  render();
}

var KEY_DOWN = 40;
var KEY_UP = 38;
var KEY_LEFT = 37;
var KEY_RIGHT = 39;
var KEY_W = 87;
var KEY_S = 83;
var KEY_A = 65;
var KEY_D = 68;
var KEY_R = 82;
var KEY_F = 70;
var KEY_SPACE = 32;
var KEY_SHIFT = 16;

var ACCEL_GRAV = -0.004, accel_y = 0, PLAYER_HEIGHT = 1;

function render() {

  if (document.pointerLockElement == document.body) {
    if (keysdown[KEY_DOWN])   construction.rotation.x += 0.02;
    if (keysdown[KEY_UP])     construction.rotation.x -= 0.02;
    if (keysdown[KEY_LEFT])   construction.rotation.y -= 0.02;
    if (keysdown[KEY_RIGHT])  construction.rotation.y += 0.02;

    if (keysdown[KEY_W])      game.camera.position.z -= 0.05;
    if (keysdown[KEY_S])      game.camera.position.z += 0.05;
    if (keysdown[KEY_A])      game.camera.position.x -= 0.02;
    if (keysdown[KEY_D])      game.camera.position.x += 0.02;

    if (keysdown[KEY_SPACE] && accel_y == 0)  accel_y = 0.170;

    game.controls.update();

    game.camera.position.y += accel_y;
    accel_y += ACCEL_GRAV;
    if (game.camera.position.y < PLAYER_HEIGHT) {
      game.camera.position.y = PLAYER_HEIGHT;
      accel_y = 0;
    }

    // Intersections.
    if (game.controls.target) {
      var vector = game.controls.target.clone();
      var raycaster = new THREE.Raycaster( game.camera.position, vector.subSelf(game.camera.position).normalize() );


      var intersects = raycaster.intersectObjects( GRIPS );
      if (intersects.length) {
        if (POINTED != intersects[0].object) {
          if (POINTED) {
            POINTED.material.opacity = POINTED == SELECTED ? GRIP_OPACITY_HIGHLIGHT : 0;
          }

          POINTED = intersects[ 0 ].object;
          POINTED.material.opacity = POINTED == SELECTED ? GRIP_OPACITY_HIGHLIGHT : GRIP_OPACITY;
        }
      } else {
        if (POINTED) {
          POINTED.material.opacity = POINTED == SELECTED ? GRIP_OPACITY_HIGHLIGHT : 0;
        }
        POINTED = null;
      }

      if (tmpgridcontrol) {
        var intersects = raycaster.intersectObjects( tmpgridcontrol.children );
        if (intersects.length) {
          if (POINTEDCUBE != intersects[0].object) {
            if (POINTEDCUBE) {
              POINTEDCUBE.material.opacity = CUBE_OPACITY;
            }

            POINTEDCUBE = intersects[ 0 ].object;
            POINTEDCUBE.material.opacity = CUBE_OPACITY_HIGHLIGHT;
          }
        } else {
          if (POINTEDCUBE) {
            POINTEDCUBE.material.opacity = CUBE_OPACITY;
          }
          POINTEDCUBE = null;
        }
      }
    }
  }

  game.renderer.render(game.scene, game.camera);
}


var isMouseDown = false;


var tmprod, tmpgrip, tmppointed, tmpgridcontrol;
$(document).on('mousemove', function ( event ) {

  if (tmppointed != POINTEDCUBE && tmppointed) {
    construction.destroyRod(tmprod);
    construction.destroyGrip(tmpgrip);
    tmprod = tmpgrip = tmppointed = null;
  }
  if (POINTEDCUBE && !tmppointed) {
    tmppointed = POINTEDCUBE;
    tmpgrip = construction.createGrip(
      SELECTED.position.x + POINTEDCUBE.position.x,
      SELECTED.position.y + POINTEDCUBE.position.y,
      SELECTED.position.z + POINTEDCUBE.position.z);
    tmprod = construction.createRod(SELECTED, tmpgrip, tmppointed.type);
    console.log('connect', tmprod);
  } 
  
  return false;
});


$(document).on('mouseup', function () {
  isMouseDown = false;
  if (SELECTED) {
    SELECTED.material.opacity = 0;
    SELECTED = null;
  }
  if (tmpgridcontrol) {
    console.log('remove');
    construction.remove(tmpgridcontrol);
  }
  tmprod = tmpgrip = tmpgridcontrol = null;
});

$(document).on('mousedown', function () {
  isMouseDown = true;

  if (POINTED) {
    if (SELECTED) {
      SELECTED.material.opacity = 0;
    }
    SELECTED = POINTED;
    SELECTED.material.opacity = 0.5;

    tmpgridcontrol = keysdown[KEY_SHIFT] ? diagonalGrid : straightGrid;
    construction.add(tmpgridcontrol);
    tmpgridcontrol.position.copy(SELECTED.position);
  }
});

var keysdown = {};
$(document).on('keydown', function (e) {
  keysdown[e.which] = true;
  if (e.which == KEY_SHIFT && tmpgridcontrol) {
    diagonalGrid.position.copy(tmpgridcontrol.position);
    construction.remove(tmpgridcontrol);
    construction.add(diagonalGrid);
    tmpgridcontrol = diagonalGrid;
    console.log(diagonalGrid.position);
  }
});
$(document).on('keyup', function (e) {
  delete keysdown[e.which];
  if (e.which == KEY_SHIFT && tmpgridcontrol) {
    straightGrid.position.copy(tmpgridcontrol.position);
    construction.remove(tmpgridcontrol);
    construction.add(straightGrid);
    tmpgridcontrol = straightGrid;
  }
});
$(document).on('focus', function (e) {
  keysdown = {};
});

$(document).on('click', function () {
  document.body.requestPointerLock();
});

// Start.
init();
animate();