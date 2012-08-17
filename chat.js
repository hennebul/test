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
        for (var i = 0; i < chatRooms.length; i++) {
            client.emit('room', {room: chatRooms[i]});
        }
    });

    // Create a chat room.
    client.on('create', function(message) {
        chatRooms.push(message.room);
        console.log(client.user + ' has created chat room ' + message.room);
        
        // Tell all users about the chat room.
        client.emit('room', {room: message.room});
        client.broadcast.emit('room', {room: message.room});
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
	
	// TODO: Handle disconnects: Tell the other users that a user has left.
	client.on('disconnect', function() {
		client.broadcast.to('chat').emit('message', 'user has left the chat');
	});
});

//*****************************************************************************
