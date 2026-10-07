import Phaser from "phaser";
const socket = window.socket;
export default class GameScene extends Phaser.Scene{
    constructor() {
        super("GameScene");
    }
    create() {
        this.cameras.main.setBackgroundColor("#222222");
        const myName = this.registry.get("playerName"); 
        const opponentName = this.registry.get("opponentName");
}
}
