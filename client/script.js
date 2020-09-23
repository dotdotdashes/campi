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

var DEBUG_MODE = false; // toggle for debug logs

/**
 *  On load, called to load the auth2 library and API client library.
 */
function handleClientLoad() {
  gapi.load('client:auth2', initClient);
  renderView();
  if (DEBUG_MODE == true) updateDebugLogs();
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
    readyToCallButton.onclick = handleReadyToCallClick;
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
    var myUserData = JSON.stringify({
      'id': profile.getId(),
      'user': profile.getName(),
      'status': {
        'text': "Eating lunch",
        'due': (new Date()).toISOString(),
		    'emoji': '\01F354',
      },
      'message': {
        'text': 'Today I am doing nothing',
        'due': (new Date()).toISOString(),
        'emoji': '\01F354',
      },
      'requested': [
        {
          'user': 'Gracie',
          'request': 0,
          'text': "Let's talk today about the design.",
        },
      ],
      'active': false,
      'last_updated': '2 hours ago',
      'location': 0,
      'state': 0,
      'time_zone': "",
      'calendar': parseCalData(response.result.items),
      'isSignedIn': googleAuth.isSignedIn.get(),
    });

    localStorage.setItem('myUserData', myUserData);
    updateAllUserData(myUserData, /*isNewEntry=*/true);

    // broadcast to other users that a new user joined
    socket.emit('newUserJoined', localStorage.getItem('myUserData'));
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
  if (DEBUG_MODE) updateDebugLogs();
}

/**
 * Update my user data with new user's data.
 * Then emit my user data to the new user.
 * 
 * @param {string} newUserData from new user to update with.
 */
function greetNewUser(newUserData) {
  if (newUserData == localStorage.getItem('myUserData')) return;

  updateAllUserData(newUserData, /*isNewEntry=*/true);
  socket.emit('greetNewUser', localStorage.getItem('myUserData'));
}

/**
* Update my user data (as a new user) with an existing user's data.
* This function is called once for each user that greets me, as a
* new user.
* 
* @param {string} existingUserData from an existing user to update with.
*/
function updateNewUserData(existingUserData) {
  if (existingUserData == localStorage.getItem('myUserData')) return;

  updateAllUserData(existingUserData, /*isNewEntry=*/true);
}

/**
 * Update my user data and emit these changes to all other users.
 * 
 * @param {string} myUpdatedUserData to update with.
 */
function updateMyUserData(myUpdatedUserData) {
  if (myUpdatedUserData == localStorage.getItem('myUserData')) return;

  localStorage.setItem('myUserData', myUpdatedUserData);
  updateAllUserData(myUpdatedUserData, /*isNewEntry=*/false);

  socket.emit('updateAllUsers', localStorage.getItem('myUserData'));
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
  } else {
    authorizeButton.style.display = 'block';
    signoutButton.style.display = 'none';
  }

  // Get user json file
  var myUserData = JSON.parse(localStorage.getItem('myUserData'));
  if (myUserData == null) return;

  // update isSignedIn field
  myUserData.isSignedIn = isSignedIn;
  updateMyUserData(JSON.stringify(myUserData));
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
  localStorage.clear();
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
    tentOpen:   userData.status && isBusy,
    isPresent:  userData.active && (userData.location == 0 || !isBusy),
    atLake:     userData.active && userData.location == 1,
  }
}

/**
 * Renders and updates the graphics.
 */
function renderView() {
  const allUserData = JSON.parse(localStorage.getItem('allUserData')) || [];
  if (allUserData == []) return;
  allUserData.forEach(userData => {
    var userRules = calcRules(userData);
    renderUser(userData.id, userRules);
  });
}

/**
 * Uses the calculated user rules to render and update each user's graphics.
 * 
 * @param {string} id of the user to re-render
 * @param {map} userRules of the logical states of the user
 */
function renderUser(id, userRules) {
  // TODO: Render the user campsite.
}

/**
* Append a pre element to the body containing the given message
* as its text node. Used to display debug logs.
*
* @param {string} id of the pre to append
* @param {string} message Text to be placed in pre element.
*/
function appendPre(id, message) {
  var pre = document.getElementById(id);
  var textContent = document.createTextNode(message + '\n');
  pre.appendChild(textContent);
}

/**
* Replace a pre element to the body containing the given message
* as its text node. Used to display debug logs.
*
* @param {string} id of the pre to replace
* @param {string} message Text to be placed in pre element.
*/
function replacePre(id, message) {
  document.getElementById(id).innerHTML = "";
  appendPre(id, message);
}

/**
 * Displays the information of each user for debugging purposes.
 * Function called on data update to re-render the logs.
 */
function updateDebugLogs() {
  const allUserData = JSON.parse(localStorage.getItem('allUserData')) || [];

  replacePre('users', 'List of users: ');
  allUserData.forEach(userData => {
    appendPre('users', 'User: ' + userData.name + 'with id: ' + userData.id);
  });

  replacePre('signed-out', 'Sign In Status: ');
  allUserData.forEach(userData => {
    // appendPre("hi");
    appendPre('signed-out', 'Signed Out: ' + userData.name + 'with id: ' + userData.id + " is signed in? " + userData.isSignedIn);
  });

  replacePre('calendars', 'Calendars: ');
  allUserData.forEach(userData => {
    var events = userData.calendar;

    appendPre('calendars', 'Upcoming events for id:' + userData.id);

    if (events.length > 0) {
      for (i = 0; i < events.length; i++) {
        var event = events[i];
        var when = event.start.dateTime;
        if (!when) {
          when = event.start.date;
        }
        appendPre('calendars', event.title + ' (' + when + ')')
      }
    } else {
      appendPre('calendars', 'No upcoming events found.');
    }
    
    appendPre('calendars', '\n');
  });
}