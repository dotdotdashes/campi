var static = require('node-static');
var file = new static.Server('./client');
var users = new Map();
 
const httpServer = require('http').createServer(function (request, response) {
    request.addListener('end', function () {
        file.serve(request, response);
    }).resume();
})

httpServer.listen(3000, () => {
  console.log('go to http://localhost:3000');
});

// Documentation: https://socket.io/docs/
const io = require('socket.io')(httpServer);

io.on('connect', socket => {
  // Receive a signal that a new user joined.
  socket.on('newUserJoined', data => {
      var userData = JSON.parse(data);

      // record how many windows a single users has open
      var id = userData.user;
      if (users.has(id)) {
        users.set(id, users.get(id)+1);
      }
      else {
        users.set(id, 1);
      }

      console.log(`${id} joined`);
      // Notify all other users that a new user joined.
      socket.broadcast.emit('newUserJoined', data);

      socket.on('greetNewUser', data => {
          // Notify the new user of an existing user that wants to greet it.
          socket.emit('greetNewUser', data);
      }); 

      socket.on('disconnect', () => {
        console.log(`${id} left`);
        var userCount = users.get(id);
        // remove user only if they have closed the last window they had open
        if (userCount > 1) {
          users.set(id, userCount-1);
        }
        else {
          userData.active = false;
          socket.broadcast.emit('updateUser', JSON.stringify(userData));
          users.delete(id);
        }
      });
  });

  // Receive signal that a user wants to update all users on a change.
  socket.on('updateAllUsers', data => {
    console.log('Updating users');
    // Notify all other users that an existing user made a change.
    socket.broadcast.emit('updateUser', data);
  });
 
});