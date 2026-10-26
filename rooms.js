const rooms = new Map();

function getOpponentName(info, userId) {
    return (
        Object.entries(info.members).find(([uid]) => uid !== userId)?.[1] ?? null
    );
}

module.exports = { rooms, getOpponentName };