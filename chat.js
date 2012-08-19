//-----------------------------------------------------------------------------
// :: Variables

// Web server.
var http = require('http').createServer(handleRequest);

// Chat server.
var chat = require('socket.io').listen(http);

// File system object.
var fs = require('fs');

// The chat page to be returned for all HTTP GET requests.
var chatPage = fs.readFileSync('chat.html');

// The chat rooms that have been created.
var chatRooms = [];

//-----------------------------------------------------------------------------
// :: Functions

/**
 * Handle all HTTP requests.
 * 
 * @param {http.ServerRequest} request The HTTP request to handle.
 * @param {http.ServerResponse} response The HTTP response to the request.
 */
function handleRequest(request, response) {
    switch (request.method) {
    case 'GET':
        // Send back the chat page.
        response.writeHead(200);
        response.end(chatPage);
        break;
    default:
        console.log('Received unsupported HTTP request: ' + request.method);
    }
}

/**
 * Check if the socket is logged in.
 * 
 * @this {socket.io.Socket}
 * @returns True if the socket is logged in.
 */
require('socket.io').Socket.prototype.isLoggedIn = function () {
    return typeof this.user !== 'undefined';
};

//-----------------------------------------------------------------------------
// :: Main

// Start the web server.
http.listen(8080);

// Handle incoming client connections.
chat.sockets.on('connection', function (socket) {
    // Login the user.
    socket.on('login', function (message) {
        // Save their user name.
        socket.user = message.user;
        console.log(socket.user + ' has logged in');

        // Send the list of all chat rooms to the user.
        chatRooms.forEach(function (room) {
            socket.emit('room', {room: room});
        });
    });

    // Create a chat room.
    socket.on('create', function (message) {
        chatRooms.push(message.room);
        console.log(socket.user + ' has created chat room ' + message.room);

        // Tell all logged in users about the chat room.
        chat.sockets.clients().forEach(function (client) {
            if (client.isLoggedIn()) {
                client.emit('room', {room: message.room});
            }
        });
    });

    // Join a chat room.
    socket.on('join', function (message) {
        socket.join(message.room);
        console.log(socket.user + ' has joined chat room ' + message.room);

        // Send the list of other users in the chat room to the user.
        var users = [];
        chat.sockets.clients(message.room).forEach(function (client) {
            if (client.user !== socket.user) {
                users.push(client.user);
            }
        });
        socket.emit('users', {room: message.room, users: users});

        // Tell the other users that the user has joined.
        socket.broadcast.to(message.room)
            .emit('join', {room: message.room, user: socket.user});
    });

    // Leave a chat room.
    socket.on('leave', function (message) {
        socket.leave(message.room);
        console.log(socket.user + ' has left chat room ' + message.room);

        // Tell the other users that the user has left.
        socket.broadcast.to(message.room)
           .emit('leave', {room: message.room, user: socket.user});
    });

    // Chat with users in a chat room.
    socket.on('chat', function (message) {
        socket.broadcast.to(message.room)
            .emit('chat',
                  {room: message.room, user: socket.user, text: message.text});
    });

    // Disconnect from the chat server.
    socket.on('disconnect', function () {
        if (!socket.isLoggedIn()) {
            return;
        }

        // Tell each room that the socket joined that they have left.
        for (var room in socket.manager.roomClients[socket.id]) {
            if (room) {
                // GOTCHA: Strip out the '/' in the room name.
                room = room.substr(1)
                console.log(socket.user + ' has left chat room ' + room);
                socket.broadcast.to(room)
                    .emit('leave', {room: room, user: socket.user});
            }
        }
        console.log(socket.user + ' has disconnected');
    });
});
