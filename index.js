var express = require("express");
var app = express();
var server = require("http").createServer(app);
var io = require("socket.io")(server);
var port = process.env.PORT || 3000;

var players = {};
var online = 0;

var games = {};

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generate_question() {
    var choice = getRandomInt(0, 3);

    var question = "";
    if (choice === 0) {
        // +
        var num1 = getRandomInt(2, 100);
        var num2 = getRandomInt(2, 100);
        question = num1 + " + " + num2;
    } else if (choice === 1) {
        // -
        var num1 = getRandomInt(2, 100);
        var num2 = getRandomInt(2, 100);
        question = (num1 + num2) + " - " + num1;
    } else if (choice === 2) {
        // *
        var num1 = getRandomInt(2, 12);
        var num2 = getRandomInt(2, 100);
        question = num1 + " * " + num1;
    } else if (choice === 3) {
        // /
        var num1 = getRandomInt(2, 12);
        var num2 = getRandomInt(2, 100);
        question = (num1 * num2) + " / " + num1;
    }
    return question;
}

function generate_questions(count) {
    var questions = [];
    for (var i = 0; i < count; i++) {
        var question = generate_question();
        questions.push(question);
    }
    // console.log(questions);
    return questions;
}

function update_players() {
    io.emit("new player", {
        numPlayers: Object.keys(players).length,
        numOnline: online
    });
}

function update_games() {
    io.emit("update games", {
        games: games
    });
}

server.listen(port, function() {
    console.log("Server listening at port %d", port);
});

app.use(express.static(__dirname + "/public"));

io.on("connection", function(socket) {
    ++online;

    socket.on("enter", function() {
        update_players();
    });

    socket.on("add player", function(name) {
        players[socket.id] = {
            id: socket.id,
            name: name,
            text: "",
            question: "",
            score: "",
            opponent: "-1",
        };
        update_players();
        socket.emit("login", {
            playerId: socket.id,
            player: players[socket.id],
        });

        var done = false;
        Object.keys(players).forEach((key) => {
            if (!done && key !== socket.id && players[key].opponent === "-1") {
                players[socket.id].opponent = key;
                players[key].opponent = socket.id;
                questions = generate_questions(100);

                games[key] = {
                    name1: name,
                    name2: players[key].name
                };

                update_games();

                socket.broadcast.to(key).emit("match found", {
                    player: players[socket.id],
                    opponent: socket.id,
                    questions: questions
                });

                socket.emit("match found", {
                    player: players[key],
                    opponent: key,
                    questions: questions
                });

                done = true;
            }
        });
    });

    function disconnect() {
        delete games[socket.id];
        if (players[socket.id])
            delete games[players[socket.id].opponent];
        update_games();

        delete players[socket.id];
        update_players();
    }

    socket.on("disconnect", function() {
        disconnect();
        --online;
    });

    socket.on("game end", function() {
        disconnect();
    });

    socket.on("update keyboard", function(keyboard) {
        if (!(socket.id in players)) return;
        players[socket.id].text = keyboard["text"];
        players[socket.id].question = keyboard["question"];
        players[socket.id].score = keyboard["score"];

        socket.emit("update positions", {
            players: players,
        });

        socket.broadcast.to(players[socket.id].opponent).emit("update positions", {
            players: players,
        });
    });
});
