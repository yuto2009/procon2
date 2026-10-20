const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const session = require("express-session");
const crypto = require("crypto");
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
  } while (io.sockets.adapter.rooms.has(id) || rooms.has(id));
  return id;
}
const rooms = new Map();
io.on("connection", (socket) => {
  const sess = socket.request.session;
  //user_idを登録
  if (!sess.user_id) {
    sess.user_id = crypto.randomUUID();
    sess.save();
  }
  socket.data.userId = sess.user_id;
  //セッションからルームIDを取り出し、roomsと比較しているなら参加させる
  if (sess.roomId && rooms.has(sess.roomId)) {
    const info = rooms.get(sess.roomId);
    socket.emit("savedRoom", {
      roomId: sess.roomId,
      members: Object.values(info.members)
    });
  } else {
    sess.roomId = null;
    sess.save();
  }
  console.log("クライアントが接続", sess.user_id);
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
        socket.data.roomId = roomId;
        rooms.set(roomId, { members: { [sess.user_id]: name } });
        sess.roomId = roomId;
        sess.save();
        console.log(`ルーム ${roomId} を作成しました(${name})`);
        socket.emit("writingscene", { name, roomId });
      });
    });
  });

  // ルームに入る(参加者)
  socket.on("joinroom", (data) => {
    const name = String(data.name).trim().slice(0, 12);
    const roomId = String(data.roomId).trim();
    const info = rooms.get(roomId);
    if (!name) return;
    if (!info) return socket.emit("errorMessage", "そのルームは存在しません");
    const isMenber = info.members[sess.user_id];
    if (!isMenber && Object.keys(info.members).length >= 2) {
      return socket.emit("errorMessage", "そのルームは満員です");
    }
    sess.reload((err) => {
      if (err) return console.error("セッションのリロード失敗", err);
      sess.name = name;
      sess.roomId = roomId;
      sess.save((err) => {
        if (err) return console.error("セッションの保存に失敗:", err);

        const hostName = Object.entries(info.members)
          .find(([uid]) => uid !== sess.user_id)?.[1];

        info.members[sess.user_id] = name;
        socket.data.name = name;
        socket.join(roomId);
        socket.data.roomId = roomId;
        sess.roomId = roomId;
        sess.save();
        socket.emit("joined", { roomId, hostName, name });   // 参加者へ
        socket.to(roomId).emit("joinroom", { name });        // ホストへ
      });
    });
  });

  //ルームから戻る
  socket.on("leaveRoom", (data) => {
    console.log("leaveRoom", data);
    const roomId = socket.data.roomId;
    if (!roomId) return;
    socket.to(roomId).emit("playerLeft");
    socket.leave(roomId);
    socket.data.roomId = null;

    const info = rooms.get(roomId);
    if (info) {
      delete info.members[sess.user_id];
      if (Object.keys(info.members).length === 0) rooms.delete(roomId);
    }
    sess.roomId = null;
    sess.save();
  });
  // 切断:同じルームの相手に知らせる
  socket.on("disconnecting", () => {
    for (const roomId of socket.rooms) {
      if (roomId !== socket.id) {
        socket.to(roomId).emit("playerLeft");
      }
    }
  });
  //ゲームをスタート
  socket.on("startGame", () => {
    const roomId = [...socket.rooms].find((r) => r !== socket.id);
    if (!roomId) {
      return;
    }
    const room = io.sockets.adapter.rooms.get(roomId);
    if (!room || room.size < 2) {
      return socket.emit("not member");
    }
    io.to(roomId).emit("startGame");
  });
  //プレイヤーの行動処理
  socket.on("gameaction", (gameaction) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    sess.LastPosition = gameaction.position;
    sess.save((err) => {
        if(err){console.log("位置を取得できない")
                return;
                }
    });
    socket.to(roomId).emit("playeraction", gameaction);
  });
  //本人が選んだ時だけ、復帰させる
  socket.on("rejoinSaved", () => {
    const roomId = sess.roomId;
    const info = rooms.get(roomId);
    if (!info || !info.members[sess.user_id]) return;

    const name = info.members[sess.user_id];
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.name = name;
    socket.data.name = sess.LastPosition;
    const LastPosition = sess.LastPosition;
    const opponentName = Object.entries(info.members)
      .find(([uid]) => uid !== sess.user_id)?.[1] ?? null;
    const online = (io.sockets.adapter.rooms.get(roomId)?.size ?? 0) >= 2;

    socket.emit("joined", { roomId, hostName: online ? opponentName : null, name , LastPosition});
    socket.to(roomId).emit("joinroom", { name });
  });
  //セッションがあるときもう一回入る
  socket.on("getSavedRoom", () => {
    const info = sess.roomId && rooms.get(sess.roomId);
    if (!info) {
      sess.roomId = null;
      sess.save();
      return socket.emit("savedRoom", null);
    }
    socket.emit("savedRoom", {
      roomId: sess.roomId,
      members: Object.values(info.members),
    });
  });
});

server.listen(3001, () => {
  console.log("起動");
});