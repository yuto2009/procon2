const express = require("express");//エクスプレスを読み込む
const http = require("http");///httpモジュールを読み込む
const { Server } = require("socket.io");//socket.ioを読み込む
const mysql = require("mysql2/promise");//mysql2を読み込む
const { randomUUID } = require("node:crypto");
console.log(" このターミナルに出る");//ターミナル確認
const app = express();//expressを初期化 appにロードする
app.use(express.json());//json形式のデータを受け取るためのミドルウェア
const server = http.createServer(app);//httpサーバーを作成
/*(async () => {
  let db;
  try {
    db = await mysql.createConnection({//データベース接続
      host: "127.0.0.1",
      user: "root",
      password: "",
      database: "purokon",
      port: 3306
    });
    console.log("データベース接続成功");
  } catch (error) {
    console.error("データベース接続失敗:", error);
    return;
  }
    */
  const io = new Server(server, {
    cors: { origin: "*" },
    connectionStateRecovery: {}
  });//socket.ioサーバーを作成し、CORSを許可する
  io .on("connection", (socket) => {
    console.log("クライアントが接続しました");
    
  });//接続処理
   server.listen(3000, () => {
    console.log("起動");
  });//サーバーを起動し、ポート3000で待機する
//})(); //即時関数を使って非同期処理を行う範囲