'use strict';

const { isSupported } = require('twilio-video');

const { isMobile } = require('./browser');
const joinRoom = require('./joinroom');
const micLevel = require('./miclevel');
const selectMedia = require('./selectmedia');
const selectRoom = require('./selectroom');
const showError = require('./showerror');

const $modals = $('#modals');
const $selectMicModal = $('#select-mic', $modals);
const $selectCameraModal = $('#select-camera', $modals);
const $showErrorModal = $('#show-error', $modals);
const $joinRoomModal = $('#join-room', $modals);

// ConnectOptions settings for a video web application.
const connectOptions = {
  // Available only in Small Group or Group Rooms only. Please set "Room Type"
  // to "Group" or "Small Group" in your Twilio Console:
  // https://www.twilio.com/console/video/configure
  bandwidthProfile: {
    video: {
      dominantSpeakerPriority: 'high',
      mode: 'collaboration',
      clientTrackSwitchOffControl: 'auto',
      contentPreferencesMode: 'auto'
    }
  },

  // Available only in Small Group or Group Rooms only. Please set "Room Type"
  // to "Group" or "Small Group" in your Twilio Console:
  // https://www.twilio.com/console/video/configure
  dominantSpeaker: true,

  // Comment this line if you are playing music.
  maxAudioBitrate: 16000,

  // VP8 simulcast enables the media server in a Small Group or Group Room
  // to adapt your encoded video quality for each RemoteParticipant based on
  // their individual bandwidth constraints. This has no utility if you are
  // using Peer-to-Peer Rooms, so you can comment this line.
  preferredVideoCodecs: [{ codec: 'VP8', simulcast: true }],

  // Capture 720p video @ 24 fps.
  video: { height: 720, frameRate: 24, width: 1280 }
};

// For mobile browsers, limit the maximum incoming video bitrate to 2.5 Mbps.
if (isMobile) {
  connectOptions
    .bandwidthProfile
    .video
    .maxSubscriptionBitrate = 2500000;
}

// On mobile browsers, there is the possibility of not getting any media even
// after the user has given permission, most likely due to some other app reserving
// the media device. So, we make sure users always test their media devices before
// joining the Room. For more best practices, please refer to the following guide:
// https://www.twilio.com/docs/video/build-js-video-application-recommendations-and-best-practices
const deviceIds = {
  audio: isMobile ? null : localStorage.getItem('audioDeviceId'),
  video: isMobile ? null : localStorage.getItem('videoDeviceId')
};

/**
 * Select your Room name, your screen name and join.
 * @param [error=null] - Error from the previous Room session, if any
 */
async function selectAndJoinRoom(error = null) {
  const formData = await selectRoom($joinRoomModal, error);
  if (!formData) {
    // User wants to change the camera and microphone.
    // So, show them the microphone selection modal.
    deviceIds.audio = null;
    deviceIds.video = null;
    return selectMicrophone();
  }
  const { identity, roomName } = formData;

  try {
    // Fetch an AccessToken to join the Room.
    const response = await fetch(`/token?identity=${identity}`);

    // Extract the AccessToken from the Response.
    const token = await response.text();

    // Add the specified audio device ID to ConnectOptions.
    connectOptions.audio = { deviceId: { exact: deviceIds.audio } };

    // Add the specified Room name to ConnectOptions.
    connectOptions.name = roomName;

    // Add the specified video device ID to ConnectOptions.
    connectOptions.video.deviceId = { exact: deviceIds.video };

    // Join the Room.
    await joinRoom(token, connectOptions);

    // After the video session, display the room selection modal.
    return selectAndJoinRoom();
  } catch (error) {
    return selectAndJoinRoom(error);
  }
}

/**
 * Select your camera.
 */
async function selectCamera() {
  if (deviceIds.video === null) {
    try {
      deviceIds.video = await selectMedia('video', $selectCameraModal, videoTrack => {
        const $video = $('video', $selectCameraModal);
        videoTrack.attach($video.get(0))
      });
    } catch (error) {
      showError($showErrorModal, error);
      return;
    }
  }
  return selectAndJoinRoom();
}

/**
 * Select your microphone.
 */
async function selectMicrophone() {
  if (deviceIds.audio === null) {
    try {
      deviceIds.audio = await selectMedia('audio', $selectMicModal, audioTrack => {
        const $levelIndicator = $('svg rect', $selectMicModal);
        const maxLevel = Number($levelIndicator.attr('height'));
        micLevel(audioTrack, maxLevel, level => $levelIndicator.attr('y', maxLevel - level));
      });
    } catch (error) {
      showError($showErrorModal, error);
      return;
    }
  }
  return selectCamera();
}

// If the current browser is not supported by twilio-video.js, show an error
// message. Otherwise, start the application.
window.addEventListener('load', isSupported ? selectMicrophone : () => {
  showError($showErrorModal, new Error('This browser is not supported.'));
});

/*This code section is the code for screensharing - it uses the screenshare_helper file. The code here is taken from from the src index.js of example screensharing */
const Prism = require('prismjs');
const Video = require('twilio-video');

//const getSnippet = require('../../util/getsnippet');
const getSnippet = require('../util/getsnippet');

//const getRoomCredentials = require('../../util/getroomcredentials');
const getRoomCredentials = require('../util/getroomcredentials');

const screensh_helpers = require('./screenshare_helpers');
const createScreenTrack = screensh_helpers.createScreenTrack;

const captureScreen = document.querySelector('button#capturescreen');
const screenPreview = document.querySelector('video#screenpreview');
const stopScreenCapture = document.querySelector('button#stopscreencapture');
const remoteScreenPreview = document.querySelector('video.remote-screenpreview');

(async function() {
  // Load the code snippet.
  
  const snippet = await getSnippet('./helpers.js');
  const pre = document.querySelector('pre.language-javascript');
  
  //pre.innerHTML = Prism.highlight(snippet, Prism.languages.javascript);


  const logger = Video.Logger.getLogger('twilio-video');
  logger.setLevel('silent');
 
  // Connect Local Participant (screen-sharer) to a room
  const localCreds = await getRoomCredentials();
  alert("Hello getting credentials");
  const roomLocal = await Video.connect(localCreds.token, {
    tracks: []
  });

  // Connect Remote Participant (screen-viewer) to the room
  const remoteCreds = await getRoomCredentials();
  const roomRemote = await Video.connect(remoteCreds.token, {
    name: roomLocal.name,
    tracks: []
  });

  // Hide the "Stop Capture Screen" button.
  stopScreenCapture.style.display = 'none';

  // The LocalVideoTrack for your screen.
  let screenTrack;

  captureScreen.onclick = async function() {
    try {

      alert('YOU HAVE CLICKED ME!!');
      // Create and preview your local screen.
      screenTrack = await createScreenTrack(720, 1280);
      screenTrack.attach(screenPreview);

      // Publish screen track to room
      await roomLocal.localParticipant.publishTrack(screenTrack);

      // When screen sharing is stopped, unpublish the screen track.
      screenTrack.on('stopped', () => {
        if (roomLocal) {
          roomLocal.localParticipant.unpublishTrack(screenTrack);
        }
        toggleButtons();
      });

      // Show the "Stop Capture Screen" button.
      toggleButtons();
    } catch (e) {
      alert(e.message);
    }
  };

  // Stop capturing your screen.
  const stopScreenSharing = () => screenTrack.stop();

  stopScreenCapture.onclick = stopScreenSharing;

  // Remote Participant handles screen share track
  if(roomRemote) {
    roomRemote.on('trackPublished', publication => {
      onTrackPublished('publish', publication, remoteScreenPreview);
    });

    roomRemote.on('trackUnpublished', publication => {
      onTrackPublished('unpublish', publication, remoteScreenPreview);
    });
  }

  // Disconnect from the Room on page unload.
  window.onbeforeunload = function() {
    if (roomLocal) {
      roomLocal.disconnect();
      roomLocal = null;
    }
    if (roomRemote) {
      roomRemote.disconnect();
      roomRemote = null;
    }
  };
  alter('Where do I show?');
}());

function toggleButtons() {
  captureScreen.style.display = captureScreen.style.display === 'none' ? '' : 'none';
  stopScreenCapture.style.display = stopScreenCapture.style.display === 'none' ? '' : 'none';
}

function onTrackPublished(publishType, publication, view) {
  if (publishType === 'publish') {
    if (publication.track) {
      publication.track.attach(view);
    }

    publication.on('subscribed', track => {
      track.attach(view);
    });
  } else if (publishType === 'unpublish') {
    if (publication.track) {
      publication.track.detach(view);
      view.srcObject = null;
    }

    publication.on('subscribed', track => {
      track.detach(view);
      view.srcObject = null;
    });
  }
}
/* end of the section which handles screensharing */

/* the code below handles local video snapshot which is from the example local video snapshot src index.js - it calling helper file localvideoshapshot_helpers.js */ 
var helpers_capt = require('./localvideoshapshot_helpers');


var displayLocalVideo = helpers_capt.displayLocalVideo;
var takeLocalVideoSnapshot = helpers_capt.takeLocalVideoSnapshot;

var canvas = document.querySelector('.snapshot-canvas');
alert('initializing local capture helper!!' + canvas);
var img = document.querySelector('.snapshot-img');
var takeSnapshot = document.querySelector('button#takesnapshot');
var video = document.querySelector('video#videoinputpreview');

let videoTrack;
let el;

// Show image or canvas
window.onload = function() {
  el = window.ImageCapture ? img : canvas;
  el.classList.remove('hidden');
  if(videoTrack) {
    setSnapshotSizeToVideo(el, videoTrack);
  }
}

// Set the canvas size to the video size.
function setSnapshotSizeToVideo(snapshot, video) {
  snapshot.width = video.dimensions.width;
  snapshot.height = video.dimensions.height;
}

// Load the code snippet.
//getSnippet('./helpers.js').then(function(snippet) {
getSnippet('./localvideo_capture_helper.js').then(function(snippet) {
  var pre = document.querySelector('pre.language-javascript');
  //pre.innerHTML = Prism.highlight(snippet, Prism.languages.javascript);
});

// Request the default LocalVideoTrack and display it.
displayLocalVideo(video).then(function(localVideoTrack) {
  // Display a snapshot of the LocalVideoTrack on the canvas.
  videoTrack = localVideoTrack;
  takeSnapshot.onclick = function() {

    alert('YOU HAVE CLICKED SCREEN CAPTURE!!');
    setSnapshotSizeToVideo(el, localVideoTrack);
    takeLocalVideoSnapshot(video, localVideoTrack, el);
  };
});

// Resize the canvas to the video size whenever window is resized.
window.onresize = function() {
  setSnapshotSizeToVideo(el, videoTrack);
};
/*End of the above section on local video snapshot */


