const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const session = require("express-session");

const app = express();
app.use(express.json());
const server = http.createServer(app);

const sessionMiddleware = session({
  secret: "secret-key",        // 本番では長い文字列を環境変数から読む
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false },   // HTTPS で公開するなら true
});
app.use(sessionMiddleware);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    credentials: true,
  },
});
io.engine.use(sessionMiddleware);

// 1〜9の数字を4つ並べたルームID
function createRoomId() {
  let id;
  do {
    id = "";
    for (let i = 0; i < 4; i++) {
      id += Math.floor(Math.random() * 9) + 1;
    }
  } while (io.sockets.adapter.rooms.has(id));
  return id;
}

io.on("connection", (socket) => {
  const sess = socket.request.session;
  console.log("クライアントが接続しました");

  // ルームを作る(ホスト)
  socket.on("setName", (name) => {
    name = String(name).trim().slice(0, 12);
    if (!name) return;

    sess.reload((err) => {
      if (err) return console.error("セッションのリロードに失敗:", err);

      sess.name = name;
      sess.save((err) => {
        if (err) return console.error("セッションの保存に失敗:", err);

        // 保存が終わってから実行される
        const roomId = createRoomId();
        socket.data.name = name;
        socket.join(roomId);
        console.log(`ルーム ${roomId} を作成しました(${name})`);
        socket.emit("writingscene", { name, roomId });
      });
    });
  });

  // ルームに入る(参加者)
  socket.on("joinroom", (data) => {
    const name = String(data.name).trim().slice(0, 12);
    const roomId = String(data.roomId).trim();
    const room = io.sockets.adapter.rooms.get(roomId);

    if (!name) return;
    if (!room) return socket.emit("errorMessage", "そのルームは存在しません");
    if (room.size >= 2) return socket.emit("errorMessage", "そのルームは満員です");

    sess.reload((err) => {
      if (err) return console.error("セッションのリロードに失敗:", err);

      sess.name = name;
      sess.save((err) => {
        if (err) return console.error("セッションの保存に失敗:", err);

        // join する前にホストの名前を取る
        const hostId = [...room][0];
        const hostName = io.sockets.sockets.get(hostId)?.data.name;

        socket.data.name = name;
        socket.join(roomId);
        console.log(`${name} がルーム ${roomId} に参加しました`);

        socket.emit("joined", { roomId, hostName, name });   // 参加者へ
        socket.to(roomId).emit("joinroom", { name });        // ホストへ
      });
    });
  });

  // 切断:同じルームの相手に知らせる
  socket.on("disconnecting", () => {
    for (const roomId of socket.rooms) {
      if (roomId !== socket.id) {
        socket.to(roomId).emit("playerLeft");
      }
    }
  });
});

server.listen(3001, () => {
  console.log("起動");
});