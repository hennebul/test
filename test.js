// Create our web server.
var http = require('http').createServer(handler);

// Create our chat server.
var server = require('socket.io').listen(http);

// Create a file system object.
var fs = require('fs');

// Serve up our one and only page.
function handler(req, res) {
	fs.readFile(__dirname + '/test.html', function(err, data) {
		// Make sure the page was read.
		if (err) {
			res.writeHead(500);
			return res.end('Error loading test.html');
		}

		// Send back the page.
		res.writeHead(200);
		res.end(data);
    });
}

// Make the web server listen on a different port.
http.listen(8080);

// For each connection join them to the chat.
server.sockets.on('connection', function(socket) {
	socket.join('chat');
	
	// Tell the other users that a new user has joined.
	socket.broadcast.to('chat').emit('message', 'new user joined');
	
	// Broadcast each message to all of the other users in the chat.
	socket.on('message', function(data) {
		socket.broadcast.to('chat').emit('message', data);
	});
	
	// Tell the other users that a user has left.
	socket.on('disconnect', function() {
		socket.broadcast.to('chat').emit('message', 'user has left the chat');
	});
});
