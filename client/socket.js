const $serverConnection = document.getElementById('server-connection');

const newItem = (content) => {
    const item = document.createElement('li');
    item.innerText = content;
    return item;
};

const socket = io();

// Show server connection status on label.
socket.on('connect', () => {
    $serverConnection.appendChild(newItem('connect'));
});

// Update current new user with data from existing user.
socket.on('greetNewUser', (userData) => {
    updateAllUserData(userData, /*isNewEntry=*/true);
});

// Notified of a new user joining to greet.
socket.on('newUserJoined', (newUserData) => {
    greetNewUser(newUserData);
});

// Update current user on any changes made by another existing user.
socket.on('updateUser', (userData) => {
    console.log(userData);
    updateAllUserData(userData, /*isNewEntry=*/false);
});

socket.on('userInactive', (id) => {
    makeUserInactive(id);
});