//-----------------------------------------------------------------------------
// :: Variables

// Redis client.
const redis = require('redis').createClient();

// The name of the key for the set of chat rooms stored in redis.
cpnst chatRooms = 'rooms';

// Web server.
const http = require('http').createServer(handleRequest);

// Chat server.
const chat = require('socket.io').listen(http);

// File system object.
const fs = require('fs');

// The chat page to be returned for all HTTP GET requests.
const chatPage = fs.readFileSync('chat.html');

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

// Log any errors from the redis server.
redis.on('error', function (error) {
    console.error('Redis error: ' + error);
});

// Handle incoming client connections.
chat.sockets.on('connection', function (socket) {
    // Login the user.
    socket.on('login', function (message) {
        // Save their user name.
        socket.user = message.user;
        console.log(socket.user + ' has logged in');

        // Get the set of chat rooms from redis.
        redis.smembers(chatRooms, function (error, rooms) {
            if (error) {
                console.error('Error retrieving chat rooms from redis: '
                              + error);
                return;
            }

            // Send the set of chat rooms to the user.
            rooms.forEach(function (room) {
                socket.emit('room', {room: room});
            });
        });
    });

    // Create a chat room.
    socket.on('create', function (message) {
        // Check if the chat room already exists.
        redis.sismember(chatRooms, message.room, function (error, isMember) {
            if (error) {
                console.error('Error determining if ' + message.room
                              + ' is an existing chat room in redis: ' + error);
                return;
            }

            // Stop if the chat room already exists.
            if (isMember) {
                console.log('Chat room ' + message.room + ' already exists');
                return;
            }

            // Otherwise, add it to redis.
            redis.sadd(chatRooms, message.room, function (error, added) {
                if (error) {
                    console.error('Error adding chat room ' + message.room
                                  + ' in redis: ' + error);
                    return;
                }

                console.log(socket.user + ' has created chat room '
                            + message.room);

                // Tell all logged in users about the chat room.
                chat.sockets.clients().forEach(function (client) {
                    if (client.isLoggedIn()) {
                        client.emit('room', {room: message.room});
                    }
                });
            });
        });
    });

    // Remove a chat room.
    socket.on('remove', function (message) {
        // Remove the chat room from the set in redis.
        redis.srem(chatRooms, message.room, function (error, result) {
            if (error) {
                console.error('Error removing chat room ' + message.room
                              + ' in redis: ' + error);
                return;
            }

            console.log(socket.user + ' has removed chat room '
                        + message.room);

            // Leave all sockets that are in that room.
            chat.sockets.clients(message.room).forEach(function (client) {
                client.leave(message.room);
                console.log(client.user + ' has been removed from chat room '
                            + message.room);
            });

            // Tell all logged in users that the chat room was removed.
            chat.sockets.clients().forEach(function (client) {
                if (client.isLoggedIn()) {
                    client.emit('remove', {room: message.room});
                }
            });
        });
    });

    // Join a chat room.
    socket.on('join', function (message) {
        socket.join(message.room);
        console.log(socket.user + ' has joined chat room ' + message.room);

        // Send the list of other users in the chat room to the user.
        let users = [];
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

        // Tell each room that the socket joined that the user has left.
        for (let room in socket.manager.roomClients[socket.id]) {
            if (room) {
                // GOTCHA: Strip out the '/' in the room name.
                room = room.substr(1);
                console.log(socket.user + ' has left chat room ' + room);
                socket.broadcast.to(room)
                    .emit('leave', {room: room, user: socket.user});
            }
        }
        console.log(socket.user + ' has disconnected');
    });
});
