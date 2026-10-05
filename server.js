const express = require("express");//エクスプレスを読み込む
const http = require("http");///httpモジュールを読み込む
const { Server } = require("socket.io");//socket.ioを読み込む
const mysql = require("mysql2/promise");//mysql2を読み込む
const { randomUUID } = require("node:crypto");
console.log(" このターミナルに出る");//ターミナル確認
const app = express();//expressを初期化 appにロードする
app.use(express.json());//json形式のデータを受け取るためのミドルウェア
const server = http.createServer(app);//httpサーバーを作成
const sesseion = require("express-session");//セッション管理のためのモジュールを読み込む
const sessionMiddleware = sesseion({
  secret: "secret-key",//セッションの署名に使用する秘密鍵
  resave: false,//セッションが変更されていない場合に再保存しない
  saveUninitialized: true,//初期化されていないセッションを保存する
  cookie: { secure: false },//クッキーのセキュリティ設定
})
app.use(sessionMiddleware);
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
    cors: {
      origin: "http://localhost:5173",//CORSの許可
      credentials: true,
    },
    connectionStateRecovery: {}
  });//socket.ioサーバーを作成し、CORSを許可する
  io.engine.use(sessionMiddleware);//socket.ioでセッションを使用するための設定
  io .on("connection", (socket) => {
    const sess = socket.request.session;
    console.log("クライアントが接続しました");
    socket.on("setName", (name) => {
      sess.reload((err) => {
        if (err) {
          console.error("セッションのリロードに失敗しました:", err);
          return;
        }
      sess.name = name;
      sess.save(() => {
        console.log("セッションに名前を保存しました:", sess.name, sess.id);
      });
      }); 
        socket.emit("startGame", { name: sess.name, sessionId: sess.id });
    });
  });//接続処理
   server.listen(3001, () => {
    console.log("起動");
  });//サーバーを起動し、ポート3001で待機する
//})(); //即時関数を使って非同期処理を行う範囲