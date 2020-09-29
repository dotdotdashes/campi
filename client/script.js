// Client ID and API key from the Developer Console
var CLIENT_ID = '153952219009-ellvdqq4cj7esdlm4a7qv6uo8phogkbs.apps.googleusercontent.com';

// Array of API discovery doc URLs for APIs used by the quickstart
var DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"];

// Authorization scopes required by the API; multiple scopes can be
// included, separated by spaces.
var SCOPES = "https://www.googleapis.com/auth/calendar.readonly";

var authorizeButton = document.getElementById('authorize_button');
var signoutButton = document.getElementById('signout_button');
var readyToCallButton = document.getElementById('readyToCall_button');

// Stores the state of the user, After making changes to myUserData, call updateMyUserData() to save to localStorage and propogate the changes to the other clients
var myUserData = {};

const EMOJIS = [
  {
    id: -1,
    emoji: '◯',
    status: ""
  },
  {
    id: 0,
    emoji: '🎒',
    status: "doing school"
  },
  {
    id: 1,
    emoji: '🍔 ',
    status: "eating"
  },
  {
    id: 2,
    emoji: '💤',
    status: "taking a break"
  },
];

const USERS = [
  "Derrek Chow",
  "Gracie Xia",
  "Jasmine Ou"
];

/**
 *  On load, called to load the auth2 library and API client library.
 */
function handleClientLoad() {
  gapi.load('client:auth2', initClient);
}

/**
 *  Initializes the API client library and sets up sign-in state
 *  listeners.
 */
function initClient() {
  gapi.client.init({
    clientId: CLIENT_ID,
    discoveryDocs: DISCOVERY_DOCS,
    scope: SCOPES
  }).then(function () {
    // Listen for sign-in state changes.
    gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);

    // Handle the initial sign-in state.
    updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
    authorizeButton.onclick = handleAuthClick;
    signoutButton.onclick = handleSignoutClick;
  }, function(error) {
    appendPre('content', JSON.stringify(error, null, 2));
  });
}

function parseCalData(events) {
  return events.map(event => {
    return {
      start: event.start,
      end: event.end,
      title: event.summary,
      stats: event.status,
      url: event.htmlLink
    };
  })
}

/**
* Sets up the user data of the new user upon signing in.
* 
* Documentation: 
* https://developers.google.com/identity/sign-in/web/reference#googleusergetid
*/
function initMyUserData() {
  // if (localStorage.getItem('myUserData') != null) return;

  const googleAuth = gapi.auth2.getAuthInstance();
  const googleUser = googleAuth.currentUser.get();
  const profile = googleUser.getBasicProfile();
  const isSignedIn = googleAuth.isSignedIn.get();

  gapi.client.calendar.events.list({
    'calendarId': 'primary',
    'timeMin': (new Date()).toISOString(),
    'showDeleted': false,
    'singleEvents': true,
    'maxResults': 10,
    'orderBy': 'startTime'
  }).then(function(response) {
    var _myUserData = {
      'id': profile.getId(),
      'user': profile.getName(),
      'status': null,
      'requested': null,
      'active': true,
      'location': 0,
      'state': 0,
      'timezone': JSON.stringify(response.result.timeZone),
      'calendar': parseCalData(response.result.items),
      'isSignedIn': googleAuth.isSignedIn.get(),
    };

    myUserData = _myUserData;
    _myUserData = JSON.stringify(_myUserData);
    localStorage.setItem('myUserData', _myUserData);
    updateAllUserData(_myUserData, /*isNewEntry=*/true);
    
    // broadcast to other users that a new user joined
    socket.emit('newUserJoined', _myUserData);
  });
}

/**
 * Updates an existing user with modified data.
 * 
 * @param {string} userData to update.
 */
function updateAllUserData(userData, isNewEntry) {
  if (userData == null) return;
  userData = JSON.parse(userData);

  var allUserData = JSON.parse(localStorage.getItem('allUserData')) || [];

  // Find the existing user to update.
  var index = allUserData.findIndex(x => x.id == userData.id);

  // Check if the user data already exists in the array.
  if (index === -1) {
    if (isNewEntry) {
      allUserData.push(userData);
      localStorage.setItem('allUserData', JSON.stringify(allUserData));
    } else {
      return;
    }
  }

  allUserData[index] = userData;
  localStorage.setItem('allUserData', JSON.stringify(allUserData));
  
  renderView();
}

function makeUserInactive(userId) {
  var allUserData = JSON.parse(localStorage.getItem('allUserData')) || [];

  // Find the existing user to update.
  var index = allUserData.findIndex(x => x.id == userId);

  // Check if the user data already exists in the array.
  if (index === -1) return;

  allUserData[index].active = false;
  localStorage.setItem('allUserData', JSON.stringify(allUserData));
  
  renderView();
}

/**
 * Update my user data with new user's data.
 * Then emit my user data to the new user.
 * 
 * @param {string} newUserData from new user to update with.
 */
function greetNewUser(newUserData) {
  if (newUserData == myUserData) return;

  updateAllUserData(newUserData, /*isNewEntry=*/true);
  socket.emit('greetNewUser', newUserData);
}

/**
* Update my user data (as a new user) with an existing user's data.
* This function is called once for each user that greets me, as a
* new user.
* 
* @param {string} existingUserData from an existing user to update with.
*/
function updateNewUserData(existingUserData) {
  if (existingUserData == myUserData) return;

  updateAllUserData(existingUserData, /*isNewEntry=*/true);
}

/**
 * Update my user data and emit these changes to all other users.
 * 
 * @param {string} myUpdatedUserData to update with.
 */
function updateMyUserData() {
  var data = JSON.stringify(myUserData);
  localStorage.setItem('myUserData', data);
  updateAllUserData(data, /*isNewEntry=*/false);
  socket.emit('updateAllUsers', data);
}

/**
 *  Called when the signed in status changes, to update the UI
 *  appropriately. After a sign-in, the API is called.
 *  Notifies all other clients of a new user sign in.
 *  Updates sign-in field in Userdata and propagates to other users.
 */
 function updateSigninStatus(isSignedIn) {
  if (isSignedIn) {
    authorizeButton.style.display = 'none';
    signoutButton.style.display = 'block';
    initMyUserData(); // initialize user data
    return;
  }

  authorizeButton.style.display = 'block';
  signoutButton.style.display = 'none';
  localStorage.clear();
}

/**
 *  Sign in the user upon button click.
 */
function handleAuthClick(event) {
  gapi.auth2.getAuthInstance().signIn();
}

/**
 *  Sign out the user upon button click.
 */
function handleSignoutClick(event) {
  gapi.auth2.getAuthInstance().signOut();
}

/**
 * Determines if a user has an event currently.
 * 
 * @param {json} userData is the user's data from local storage
 */
function hasEvent(userData) {
  var events = userData.calendar;
  var cur = (new Date()).toISOString();

  if (events.length > 0) {
    for (i = 0; i < events.length; i++) {
      var event = events[i];
      var start = new Date(event.start.dateTime);
      if (!start) {
        start = new Date(event.start.date);
      }
      var end = new Date(event.end.dateTime);
      if (!end) {
        end = new Date(event.end.date);
      }
      if(cur >= start && cur <= end ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Calculates user state logic based on user data.
 * 
 * @param {json} userData is the user's data from local storage
 */
function calcRules(userData) {
  const isBusy = hasEvent(userData);
  return {
    fireOn:     userData.active,
    tentOpen:   !(userData.status && isBusy),
    isPresent:  userData.active && userData.location == 0 && !isBusy,
    atLake:     userData.active && userData.location == 1,
    isUser:     userData.user == myUserData.user
  }
}

/**
 * Renders and updates the graphics.
 */
function renderView() {
  const allUserData = JSON.parse(localStorage.getItem('allUserData')) || [];
  var template = document.getElementById('template').innerHTML;
  var campers = [];

  if (allUserData == []) return;
  allUserData.forEach(userData => {
    var userRules = calcRules(userData);
    var events = userData.calendar;
    var schedule = [];
    var emojis = JSON.parse(JSON.stringify(EMOJIS));
    var event = `<b>${userData.user}</b> has nothing coming up.`;

    if (events.length) {
      var event = events[0];
      var when = event.start.dateTime;
      if (!when) {
        when = event.start.date;
      }
      event = `<b>${userData.user}</b> has <b>${event.title}</b> @ ${when}`;
    }

    emojis.forEach(emoji => {
      emoji.selected = (emoji.id == userData.status)
    });

    campers.push({
      'camper': userRules.isPresent ? 'user_present.png' : 'bunny.png',
      'fire': userRules.fireOn ? 'fire_on.png' : 'fire_off.png',
      'tent': userRules.tentOpen ? 'tent_open.png' : 'tent_closed.png',
      'schedule': schedule,
      'lake': userRules.atLake ? 'user_present.png' : 'bunny.png',
      'user': userRules.isUser,
      'emojis': emojis,
      'event': event,
      'timezone': 'timezone is ' + userData.timezone
    });
  });

  var rendered = Mustache.render(template, { 'campers': campers });
  document.getElementById('main').innerHTML = rendered;
}


// Interface Methods

function goToLake() {
  if (myUserData.location == 1) return;
  myUserData.location = 1;
  updateMyUserData();
}

function goToCamp() {
  if (myUserData.location == 0) return;
  myUserData.location = 0;
  updateMyUserData();
}

function setEmoji(emoji) {
  if (myUserData.status == emoji.value) return;
  myUserData.status = parseInt(emoji.value);
  updateMyUserData();
}