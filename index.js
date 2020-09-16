const content = require('fs').readFileSync(__dirname + '/index.html', 'utf8');

const httpServer = require('http').createServer((req, res) => {
  // serve the index.html file
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Content-Length', Buffer.byteLength(content));
  res.end(content);
});

// Documentation: https://socket.io/docs/
const io = require('socket.io')(httpServer);

io.on('connect', socket => {
  console.log('connect');

  // Receive a signal that a new user joined.
  socket.on('newUserJoined', data => {
      // Notify all other users that a new user joined.
      socket.broadcast.emit('newUserJoined', data);

      socket.on('greetNewUser', data => {
          // Notify the new user of an existing user that wants to greet it.
          socket.emit('greetNewUser', data);
      }); 
  });

  // Receive signal that a user wants to update all users on a change.
  socket.on('updateAllUsers', data => {
    // Notify all other users that an existing user made a change.
    socket.broadcast.emit('updateUser', data);
  })
 
});

httpServer.listen(3000, () => {
  console.log('go to http://localhost:3000');
});