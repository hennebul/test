//*****************************************************************************

//-----------------------------------------------------------------------------
// :: Variables

// Web server.
var http = require('http').createServer(handleReq);

// Chat server.
var server = require('socket.io').listen(http);

// File system object.
var fs = require('fs');

// The page to return for all http requests.
var page;

//-----------------------------------------------------------------------------
// :: Functions

/**
 * Handle all http requests by returning our one and only page.
 */
function handleReq(req, res) {
    // Load the page from the file system, if needed.
    if (typeof page === 'undefined') {
        fs.readFile(__dirname + '/test.html', function(err, data) {
            // Make sure the page was read.
            if (err) {
                res.writeHead(500);
                return res.end('Error loading test.html');
            }
            
            // Save the page contents so they aren't loaded for each request.
            page = data;
    
            // Send back the page.
            res.writeHead(200);
            res.end(page);
        });
    } else {
        // Send back the page.
        res.writeHead(200);
        res.end(page);
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
server.sockets.on('connection', function(client) {
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
