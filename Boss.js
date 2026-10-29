const { rooms } = require("./rooms");

module.exports = function Boss(io, socket, sess) {
    // ボスの部屋に入るときに、ホストとゲストをサーバーが決めて、2人に別々に伝える
    socket.on("Boss1Room", () => {
        const roomId = socket.data.roomId;
        if (!roomId) return;
        const info = rooms.get(roomId);
        if (!info) return;

        const myRole = info.hostId === sess.user_id ? "host" : "guest";
        const otherRole = myRole === "host" ? "guest" : "host";
        socket.emit("Boss1Room", { role: myRole });
        socket.to(roomId).emit("Boss1Room", { role: otherRole });
    });

    // ボスの状態を作っているホストが、ゲストに送る
    socket.on("boss1host", (data) => {
        const roomId = socket.data.roomId;
        if (!roomId || !data) return;

        // ホストだけがボスの状態を送れる
        const info = rooms.get(roomId);
        if (!info || info.hostId !== sess.user_id) return;

        // 位置の更新は多少落ちてもよいので volatile で送る
        socket.to(roomId).volatile.emit("boss1togest", data);
    });

    // 自分のキャラの動きを、相手に送る(ホスト・ゲストどちらからでも)
    socket.on("boss1player", (data) => {
        const roomId = socket.data.roomId;
        if (!roomId || !data) return;
        socket.to(roomId).volatile.emit("boss1player", data);
    });

    // 当たった・パリィした知らせ(落ちると困るので、普通に送る)
    for (const ev of ["boss1hit", "boss1damage", "boss1parry"]) {
        socket.on(ev, (data) => {
            const roomId = socket.data.roomId;
            if (!roomId) return;
            socket.to(roomId).emit(ev, data ?? {});
        });
    }
};