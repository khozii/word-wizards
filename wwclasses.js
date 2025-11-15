export class Player1 {
    constructor() {
        this.health = 100;
        this.shield = 0;
    }
}

export class Player2 {
    constructor() {
        this.health = 100;
        this.shield = 0;
    }
}

export class Spell {
    constructor(name, damage, tier) {
        this.name = name;
        this.damage = damage;
        this.tier = tier;
    }
}
