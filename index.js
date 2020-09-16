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

  // Notify all other connected clients that a new user joined.
  socket.on('newUserJoined', data => {
      socket.broadcast.emit('newUserJoined', data);

      // Notify the new user of an existing user that wants to greet it.
      socket.on('greetNewUser', data => {
          socket.emit('greetNewUser', data);
      }); 
  });
 
});

httpServer.listen(3000, () => {
  console.log('go to http://localhost:3000');
});