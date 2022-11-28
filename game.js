
const map = Array.from(new Array(20), () => new Array(100));
let characters = [];
let timer = 0;

const SFX = new Proxy({}, {
  get(_, key) {
    const a = document.querySelector(`audio[data-key=${key}]`);
    a.pause();
    a.currentTime = 0;
    return a;
  }
});

class GameSprite extends HTMLElement {
  get static() {
    return false;
  }
  get sprite() {
    return 0, 0;
  }
  get z() {
    return 1;
  }
  x = 0;
  y = 0;
  direction = 1;

  updatePosition() {
    this.style.setProperty('--x', this.x);
    this.style.setProperty('--y', this.y);
    this.style.setProperty('--direction', this.direction);
  }

  updateSprite() {
    this.style.setProperty('--sprite-x', this.sprite[0]);
    this.style.setProperty('--sprite-y', this.sprite[1]);
  }

  pushable = false;
  push_t = 0;
  push() {
    if (this.pushable)
      this.push_t = 1;
  }

  update(dt) {
    if (this.push_t > 0) {
      this.push_t = Math.max(this.push_t - dt * 5, 0);
      this.style.setProperty('--y', this.y - 0.4 * Math.sin(this.push_t * Math.PI));
    }
  }

  constructor() {
    super();
    this.classList.add('sprite');
    this.x = parseFloat(this.getAttribute('x'));
    this.y = parseFloat(this.getAttribute('y'));
    this.updatePosition();

    this.style.setProperty('--w', this.w = this.sprite[2] || 1);
    this.style.setProperty('--h', this.h = this.sprite[3] || 1);

    this.style.setProperty('--z', this.z);
    this.updateSprite();

    if (this.static)
      for (let i = this.x; i < this.x + this.w; i++)
        for (let j = this.y; j < this.y + this.h; j++)
          map[j][i] = this;
  }
};

class AnimatedSprite extends GameSprite {
  animationSpeed = 1;
  state = 'idle';

  get sprite() {
    const v = this.animations[this.state || 'idle'];
    return v[Math.floor((this.animationSpeed || 1) * (timer / 100)) % v.length];
  }

  get animations() {
    return {};
  }

  update(dt) {
    super.update(dt);
    this.updateSprite();
  }
};

class Character extends AnimatedSprite {
  get z() {
    return 3;
  }
  get static() {
    return false;
  }

  dead = false;

  // fall acceleration
  acc = 0;
  falling = true;

  constructor() {
    super();
    characters.push(this);
  }

  update(dt) {
    super.update(dt);
    if (!this.dead) {
      // Fall
      const e = this.move(0, (this.acc + 1) * dt);
      if (!e) {
        this.acc+= 65 * dt;
        this.falling = true;
        this.state = 'falling';
      } else if (this.acc < 0) {
        SFX.bump.play();
        this.acc = 0;
        if (e instanceof GameSprite)
          e.push();
      } else {
        this.acc = 0;
        this.falling = false;
        this.state = 'idle';
        if (e instanceof Character)
          e.die();
      }
    } else {
      this.state = 'die';
      this.updateSprite();
      this.die_timer+= dt;
      if (this.die_timer > 2) {
        characters = characters.filter((t) => t != this);
        this.remove();
      }
    }
    this.updatePosition();
    this.updateSprite();
  }

  die() {
    this.die_timer = 0;
    this.state = 'die';
    this.dead = true;
    this.updateSprite();
    SFX[this instanceof Hero ? 'die' : 'stomp'].play();
  }

  move(dx, dy) {
    while (Math.abs(dx) > 0.25) {
      const e = this.move(Math.sign(dx) * 0.25, dy);
      if (e)
        return e;
      dx-= Math.sign(dx) * 0.25;
    }
    while (Math.abs(dy) > 0.25) {
      const e = this.move(dx, Math.sign(dy) * 0.25);
      if (e)
        return e;
      dy-= Math.sign(dy) * 0.25;
    }
    if (this.dead)
      return false;
    const nx = this.x + dx, ny = this.y + dy;
    if (nx < 0)
      return true;
    if (ny >= 19)
      return this.die() && false;
    // Static objects
    for (let x = Math.floor(nx); x < Math.ceil(nx) + this.w; x++) {
      for (let y = Math.floor(ny); y < Math.ceil(ny) + this.h; y++) {
        if (map[y][x]) {
          if (dx)
            this.x = Math.round(this.x + dx);
          if (dy)
            this.y = Math.round(this.y + dy);
          return map[y][x];
        }
      }
    }
    // Check other characters
    for (const c of characters) {
      if (
        c != this
        && !c.dead
        && ((nx >= c.x && nx < c.x + c.w) || (nx + this.w >= c.x && nx + this.w < c.x + c.w))
        && ((ny >= c.y && ny < c.y + c.h) || (ny + this.h >= c.y && ny + this.h < c.y + c.h))
      ) {
        if (dx != 0) {
          if (c instanceof Hero)
            c.die();
          else if (c instanceof Character && this instanceof Hero)
            this.die();
        }
        return c;
      }
    }
    this.x = nx;
    this.y = ny;
    return false;
  }
};

class Hero extends Character {
  keys = {};

  get z() {
    return 4;
  }
  get animations() {
    return {
      idle: [[9, 4]],
      run: [[12, 4], [13, 4], [14, 4]],
      falling: [[15, 4]],
      die: [[10, 4]]
    };
  }

  keyEvent(e) {
    let k = null;
    switch (e.key.toLowerCase()) {
      case 'h':
      case 'arrowleft':
        k = 'left';
        break;
      case 'l':
      case 'arrowright':
        k = 'right';
        break;
      case ' ':
        k = 'jump';
        break;
      case 'shift':
        k = 'shift';
        break;
    }
    if (k)
      this.keys[k] = e.type == 'keydown';
  }

  constructor() {
    super();
    for (const t of ['up', 'down'])
      document.addEventListener(`key${t}`, (e) => this.keyEvent(e));
    window.addEventListener('blur', () => this.keys = {});
  }

  die() {
    SFX.music.pause();
    super.die();
    this.acc = -25;
  }

  update(dt) {
    super.update(dt);
    if (this.dead) {
      if (this.die_timer > 0.5) {
        this.y+= this.acc * dt;
        this.acc+= 65 * dt;
        this.updatePosition();
      }
      return;
    }

    // Jump
    if (this.keys.jump && !this.falling) {
      this.acc = -25;
      SFX.jump.play();
    }

    this.animationSpeed = this.keys.shift ? 2 : 1;

    if (this.keys.left) {
      this.direction = -1;
      this.state = this.move(-6 * this.animationSpeed * dt, 0) ? 'idle' : 'run';
    } else if (this.keys.right) {
      this.direction = 1;
      this.state = this.move(6 * this.animationSpeed * dt, 0) ? 'idle' : 'run';
    } else {
      this.state = 'idle';
    }
    if (this.falling)
      this.state = 'falling';
    this.updateSprite();
  }
}

customElements.define('game-hero', Hero);

class Goomba extends Character {
  get animations() {
    return {
      idle: [[10, 12]],
      run: [[10, 12], [11, 12]],
      falling: [[10, 12], [11, 12]],
      die: [[12, 12]]
    };
  }

  constructor() {
    super();
    this.animationSpeed = 0.3;
    this.walk_dir = 1;
  }

  update(dt) {
    super.update(dt);
    if (!this.dead) {
      this.state = 'run';
      if (!this.falling) {
        if (this.move(this.walk_dir * dt, 0))
          this.walk_dir = -this.walk_dir;
      }
      this.updateSprite();
    }
  }
};
customElements.define('game-goomba', Goomba);


// Static objects
for (const [k, v] of Object.entries({
  bricks: { x: 0, y: 0 },
  block: { x: 1, y: 0 },
  stone: { x: 2, y: 0 },
  pipe: { x: 18, y: 3, w: 2, h: 2 }
})) {
  customElements.define('game-' + k, class extends GameSprite {
    get sprite() { return [v.x, v.y, v.w, v.h ] };
    get static() { return true; }
    pushable = k == 'bricks';
  });
}

customElements.define('game-coinsblock', class extends AnimatedSprite {
  animationSpeed = 0.3;
  get static() { return true; }
  pushable = true;
  get animations() {
    return {
      idle: [ [4, 0], [4, 1], [4, 2] ]
    }
  }
});

// Non static objects
for (const [k, v] of Object.entries({
  clouds1: { x: 7, y: 7, w: 2, h: 2 },
  clouds2: { x: 0, y: 7, w: 3, h: 2 },
  clouds3: { x: 3, y: 7, w: 4, h: 2 },
  bush1: { x: 0, y: 11, w: 2, h: 1 },
  bush2: { x: 2, y: 11, w: 4, h: 1 },
  bush3: { x: 6, y: 11, w: 3, h: 1 },
  hill: { x: 0, y: 6, w: 3, h: 1 },
  bighill: { x: 3, y: 5, w: 5, h: 2 },
})) {
  customElements.define('game-' + k, class extends GameSprite {
    get sprite() { return [v.x, v.y, v.w, v.h ] };
    get static() { return false; }
    get z() { return 2; }
  });
}

customElements.define('side-scrolling', class extends HTMLElement {
  constructor() {
    super();
    this.left = 0;
  }

  update() {
    let hero = characters.find((c) => c instanceof Hero);
    if (hero) {
      const x = hero.x - this.left;
      if (x > 10)
        this.left = hero.x - 10;
      if (x < 8)
        this.left = Math.max(hero.x - 8, 0);
      this.style.setProperty('--scroll', `calc(-5vh * ${this.left})`);
    }
  }
});

customElements.define('game-world', class extends HTMLElement {
  constructor() {
    super();
    this.sideScrolling  = this.getElementsByTagName('side-scrolling');
    this.playing = false;
    this.update(0);
    for (const e of ['click', 'keypress'])
      document.addEventListener(e, () => this.start());
  }

  start() {
    if (!this.playing) {
      this.playing = true;
      this.classList.add('playing');
      SFX.music.play();
    }
  }

  update(time) {
    let deltaTime = this.playing * Math.min((time - timer) / 1000, 0.1);
    timer = time;

    for (let i of this.sideScrolling) {
      i.update();
      for (let t of i.children) {
        if (t instanceof GameSprite)
          t.update(deltaTime);
      }
    }

    window.requestAnimationFrame((t) => this.update(t));
  }
});

