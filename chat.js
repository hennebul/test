//*****************************************************************************

//-----------------------------------------------------------------------------
// :: Variables

// Web server.
var http = require('http').createServer(handleRequest);

// Chat server.
var chat = require('socket.io').listen(http);

// File system object.
var fs = require('fs');

// The login page to be returned for all HTTP GET requests.
var loginPage = fs.readFileSync('index.html');

// The chat page to be returned when a user has logged in.
var chatPage = fs.readFileSync('chat.html');

//-----------------------------------------------------------------------------
// :: Functions

/**
 * Handle all HTTP requests.
 * 
 * @param {http.ServerRequest} The HTTP request to handle.
 * @param {http.ServerResponse} The HTTP response to the request.
 */
function handleRequest(request, response) {
	switch(request.method) {
	case 'GET':
    	// Send back the login page.
        response.writeHead(200);
        response.end(loginPage);
	    break;
	case 'POST':
    	// Send back the chat page.
        response.writeHead(200);
        response.end(chatPage);
		break;
	default:
		console.log('Received unsupported HTTP request: ' + request.method);
	}
}

/**
 * Handle a message from the client.
 */
function handleMessage(message, client) {
    switch(message.type) {
    // Create a chat room.
    case 'create':
        break;
    // Join a chat room.
    case 'join':
        client.join(message.room);
        
        // Tell the other users that the user has joined.
        client.broadcast.to(message.room)
            .emit('message', message.user + ' has joined');
        break;
    // Leave a chat room.
    case 'leave':
        // Tell the other users that the user has left, then leave.
        client.broadcast.to(message.room)
            .emit('message', message.user + ' has left');
        //client.leave(message.room);
        break;
    // Chat with users in a chat room.
    case 'chat':
        client.broadcast.to(message.room)
            .emit('message', message.user + ': ' + message.text);
        break;
    default:
        console.log('Received unrecognized message: '
                    + JSON.stringify(message));
    }
}

//-----------------------------------------------------------------------------
// :: Main

// Start the web server.
http.listen(8080);

// Handle incoming client connections.
chat.sockets.on('connection', function(client) {
    // TODO: Send back the list of chat rooms.
    
	// Dispatch all received messages to handleMessage().
	client.on('message', function(message) {
		handleMessage(message, client);
	});
	
	// Tell the other users that a user has left.
	client.on('disconnect', function() {
		client.broadcast.to('chat').emit('message', 'user has left the chat');
	});
});

//*****************************************************************************
