//*****************************************************************************

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
    switch(request.method) {
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
 * Check if the client socket is logged in.
 * 
 * @param {socket.io.Socket} client The client socket to check.
 * @returns True if the client is logged in.
 */
function isLoggedIn(client) {
    return typeof client.user !== 'undefined';
}

//-----------------------------------------------------------------------------
// :: Main

// Start the web server.
http.listen(8080);

// Handle incoming client connections.
chat.sockets.on('connection', function(client) {
    // Login the user.
    client.on('login', function(message) {
        // Save their user name.
        client.user = message.user;
        console.log(client.user + ' has logged in');

        // Send the list of all chat rooms to the user.
        chatRooms.forEach(function(room) {
            client.emit('room', {room: room});
        });
    });

    // Create a chat room.
    client.on('create', function(message) {
        chatRooms.push(message.room);
        console.log(client.user + ' has created chat room ' + message.room);
        
        // Tell all logged in users about the chat room.
        chat.sockets.clients().forEach(function(client) {
            if (isLoggedIn(client)) {
                client.emit('room', {room: message.room});
            }
        });
    });

    // Join a chat room.
    client.on('join', function(message) {
        client.join(message.room);
        console.log(client.user + ' has joined chat room ' + message.room);
        
        // Tell the other users that the user has joined.
        client.broadcast.to(message.room)
            .emit('join', {room: message.room, user: client.user});
    });

    // Leave a chat room.
    client.on('leave', function(message) {
        client.leave(message.room);
        console.log(client.user + ' has left chat room ' + message.room);

        // Tell the other users that the user has left.
        client.broadcast.to(message.room)
           .emit('leave', {room: message.room, user: client.user});
    });

    // Chat with users in a chat room.
    client.on('chat', function(message) {
        client.broadcast.to(message.room)
            .emit('chat',
                  {room: message.room, user: client.user, text: message.text});
    });

    // Disconnect from the chat server.
    client.on('disconnect', function() {
        if (!isLoggedIn(client)) {
            return;
        }
        
        // Tell each room that the client joined that they have left.
        for (var room in client.manager.roomClients[client.id]) {
            if (room) {
                // GOTCHA: Strip out the '/' in the room name.
                room = room.substr(1)
                console.log(client.user + ' has left chat room ' + room);
                client.broadcast.to(room)
                    .emit('leave', {room: room, user: client.user});
            }
        }
        console.log(client.user + ' has disconnected');
    });
});

//*****************************************************************************
