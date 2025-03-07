import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "react-oidc-context";
import axios from "axios";
import { API_BASE_URL } from "../config";
import "../styles.css";

// Amazon Chime SDK imports
import {
  MeetingSessionStatusCode,
  ConsoleLogger,
  DefaultDeviceController,
  DefaultMeetingSession,
  LogLevel,
  MeetingSessionConfiguration,
  VideoTileState,
} from 'amazon-chime-sdk-js';

const VirtualSession = ({ sessionId, onEndSession }) => {
  const auth = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [session, setSession] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [notes, setNotes] = useState("");
  const [sharedFiles, setSharedFiles] = useState([]);
  const [newNote, setNewNote] = useState("");
  const [fileUpload, setFileUpload] = useState(null);
  
  // UI visibility states
  const [showNotes, setShowNotes] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  
  // Audio settings
  const [audioOutputDevices, setAudioOutputDevices] = useState([]);
  const [selectedAudioOutputDevice, setSelectedAudioOutputDevice] = useState('');
  const [audioTestInProgress, setAudioTestInProgress] = useState(false);
  
  // Amazon Chime SDK related state
  const [meetingSession, setMeetingSession] = useState(null);
  const [meetingId, setMeetingId] = useState(null);
  const [attendeeId, setAttendeeId] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [activeSpeakerId, setActiveSpeakerId] = useState(null);
  const [meetingStatus, setMeetingStatus] = useState('initializing');
  const [localTileId, setLocalTileId] = useState(null);
  const [remoteTileId, setRemoteTileId] = useState(null);
  
  // Amazon Chime SDK configuration
  const logger = useRef(new ConsoleLogger('ChimeMeetingLogs', LogLevel.INFO));
  const deviceController = useRef(null);
  
  // Refs for video elements
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const screenShareStreamRef = useRef(null);
  
  // Effect to ensure remote video element has audio enabled
  useEffect(() => {
    if (remoteVideoRef.current) {
      // Set up event listeners for the remote video element
      const remoteVideo = remoteVideoRef.current;
      
      // Log when video is loaded
      remoteVideo.onloadedmetadata = () => {
        console.log('Remote video metadata loaded');
        // Ensure it's not muted
        remoteVideo.muted = false;
        // Try to set volume to 100%
        remoteVideo.volume = 1.0;
        console.log('Remote video unmuted, volume set to:', remoteVideo.volume);
      };
      
      // Setup canplaythrough event listener
      remoteVideo.oncanplaythrough = () => {
        console.log('Remote video can play through');
        // Try to play automatically if not already playing
        if (remoteVideo.paused) {
          remoteVideo.play().catch(err => {
            console.error('Error auto-playing remote video:', err);
          });
        }
      };
    }
  }, [remoteVideoRef.current]);
  
  useEffect(() => {
    // Fetch session details and set up the meeting
    const initializeSession = async () => {
      try {
        setLoading(true);
        
        // 1. Fetch the session details
        const sessionResponse = await axios.get(
          `${API_BASE_URL}/sessions/${sessionId}`,
          {
            headers: {
              Authorization: `Bearer ${auth.user.access_token}`,
            },
          }
        );
        
        setSession(sessionResponse.data);
        
        // Extract notes and shared files from session data
        if (sessionResponse.data.notes && Array.isArray(sessionResponse.data.notes)) {
          setNotes(sessionResponse.data.notes);
        }
        
        if (sessionResponse.data.shared_documents && Array.isArray(sessionResponse.data.shared_documents)) {
          setSharedFiles(sessionResponse.data.shared_documents);
        }
        
        // 2. Create or get a Chime meeting for this session
        console.log('Creating/getting Chime meeting for session:', sessionId);
        const meetingResponse = await axios.post(
          `${API_BASE_URL}/meetings`,
          { session_id: sessionId },
          {
            headers: {
              Authorization: `Bearer ${auth.user.access_token}`,
              "Content-Type": "application/json",
            },
          }
        );
        
        console.log('Meeting response:', meetingResponse.data);
        
        // Store the meeting details
        const meetingData = meetingResponse.data.meeting;
        console.log('Meeting data:', meetingData);
        setMeetingId(meetingData.MeetingId);
        
        // 3. Join the meeting as an attendee
        console.log('Joining meeting as attendee, user ID:', auth.user.profile.sub);
        const attendeeResponse = await axios.post(
          `${API_BASE_URL}/attendees`,
          { 
            session_id: sessionId,
            user_id: auth.user.profile.sub 
          },
          {
            headers: {
              Authorization: `Bearer ${auth.user.access_token}`,
              "Content-Type": "application/json",
            },
          }
        );
        
        console.log('Attendee response:', attendeeResponse.data);
        const attendeeData = attendeeResponse.data.attendee;
        console.log('Attendee data:', attendeeData);
        setAttendeeId(attendeeData.AttendeeId);
        
        // 4. Set up the Chime meeting session
        await setupChimeMeeting(meetingData, attendeeData);
        
      } catch (err) {
        console.error("Error initializing session:", err);
        setError("Failed to initialize virtual session. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    
    initializeSession();
    
    // Cleanup on component unmount
    return () => {
      // Leave the meeting if it exists
      if (meetingSession) {
        try {
          meetingSession.audioVideo.stop();
          console.log("Successfully left the meeting");
        } catch (err) {
          console.error("Error leaving meeting:", err);
        }
      }
    };
  }, [sessionId, auth.user.access_token, auth.user.profile.sub]);
  
  const setupChimeMeeting = async (meetingData, attendeeData) => {
    try {
      console.log('Setting up Chime meeting with:', { meetingData, attendeeData });
      
      // Create configuration objects
      // Adding a try-catch block to handle potential format differences
      let configuration;
      try {
        configuration = new MeetingSessionConfiguration(
          meetingData,
          attendeeData
        );
      } catch (configError) {
        console.error('Error creating meeting configuration with provided data:', configError);
        console.log('Attempting alternative configuration format...');
        
        // Fallback in case the data structure doesn't match expectations
        const formattedMeetingData = {
          MeetingId: meetingData.MeetingId,
          MediaPlacement: {
            AudioHostUrl: meetingData.MediaPlacement?.AudioHostUrl,
            AudioFallbackUrl: meetingData.MediaPlacement?.AudioFallbackUrl,
            ScreenDataUrl: meetingData.MediaPlacement?.ScreenDataUrl,
            ScreenSharingUrl: meetingData.MediaPlacement?.ScreenSharingUrl,
            ScreenViewingUrl: meetingData.MediaPlacement?.ScreenViewingUrl,
            SignalingUrl: meetingData.MediaPlacement?.SignalingUrl,
            TurnControlUrl: meetingData.MediaPlacement?.TurnControlUrl
          }
        };
        
        const formattedAttendeeData = {
          AttendeeId: attendeeData.AttendeeId,
          ExternalUserId: attendeeData.ExternalUserId,
          JoinToken: attendeeData.JoinToken
        };
        
        configuration = new MeetingSessionConfiguration(
          formattedMeetingData,
          formattedAttendeeData
        );
      }
      
      // Create device controller if not already created
      if (!deviceController.current) {
        deviceController.current = new DefaultDeviceController(logger.current);
      }
      
      // Create meeting session
      const session = new DefaultMeetingSession(
        configuration,
        logger.current,
        deviceController.current
      );
      setMeetingSession(session);
      
      // Setup audio/video observers
      setupAudioVideoObservers(session);
      
      // Select audio/video devices
      await selectMediaDevices(session);
      
      // Start the meeting session
      session.audioVideo.start();
      setMeetingStatus('started');
      
      // Join with audio/video
      await joinWithAudioVideo(session);
      
    } catch (err) {
      console.error("Error setting up Chime meeting:", err);
      setError("Failed to setup video meeting. Please check your device permissions.");
    }
  };
  
  const setupAudioVideoObservers = (session) => {
    // Handle video tiles
    session.audioVideo.addObserver({
      // Video tile events
      videoTileDidUpdate: (tileState) => {
        if (!tileState.boundAttendeeId) {
          return;
        }
        
        const isLocalTile = tileState.localTile;
        
        if (isLocalTile) {
          // Local video tile
          setLocalTileId(tileState.tileId);
          session.audioVideo.bindVideoElement(
            tileState.tileId,
            localVideoRef.current
          );
        } else if (!tileState.isContent) {
          // Remote participant camera
          setRemoteTileId(tileState.tileId);
          session.audioVideo.bindVideoElement(
            tileState.tileId,
            remoteVideoRef.current
          );
        } else {
          // This is a screen share tile
          console.log('Screen share tile added:', tileState.tileId);
          // Handle screen share if needed
        }
      },
      
      videoTileWasRemoved: (tileId) => {
        if (tileId === localTileId) {
          setLocalTileId(null);
        } else if (tileId === remoteTileId) {
          setRemoteTileId(null);
        }
        console.log(`Video tile removed: ${tileId}`);
      },
      
      // Meeting status events
      audioVideoDidStop: (sessionStatus) => {
        const sessionStatusCode = sessionStatus.statusCode();
        setMeetingStatus('stopped');
        
        if (sessionStatusCode === MeetingSessionStatusCode.MeetingEnded) {
          console.log('Meeting ended');
          if (onEndSession) onEndSession();
        } else {
          console.log(`Meeting stopped with code: ${sessionStatusCode}`);
        }
      },
      
      // Active speaker events
      activeSpeakerDidDetect: (activeSpeakers) => {
        if (activeSpeakers.length) {
          setActiveSpeakerId(activeSpeakers[0]);
        }
      }
    });
  };
  
  const selectMediaDevices = async (session) => {
    try {
      console.log('Starting media device selection');
      
      // First check for available device controllers
      const audioVideo = session.audioVideo;
      
      try {
        // List audio input devices (microphones)
        const audioInputDevices = await audioVideo.listAudioInputDevices();
        console.log('Available audio input devices:', audioInputDevices);
        
        if (audioInputDevices.length > 0) {
          // Try various potential method names for microphone selection
          if (typeof audioVideo.chooseAudioInputDevice === 'function') {
            console.log('Using chooseAudioInputDevice method');
            await audioVideo.chooseAudioInputDevice(audioInputDevices[0].deviceId);
          } else if (typeof audioVideo.setAudioInputDevice === 'function') {
            console.log('Using setAudioInputDevice method');
            await audioVideo.setAudioInputDevice(audioInputDevices[0].deviceId);
          } else if (typeof audioVideo.startAudioInput === 'function') {
            console.log('Using startAudioInput method');
            await audioVideo.startAudioInput(audioInputDevices[0].deviceId);
          } else {
            console.warn('No compatible audio input selection method found');
          }
        }
        
        // List video input devices (cameras)
        const videoInputDevices = await audioVideo.listVideoInputDevices();
        console.log('Available video input devices:', videoInputDevices);
        
        if (videoInputDevices.length > 0) {
          // Try various potential method names for camera selection
          if (typeof audioVideo.chooseVideoInputDevice === 'function') {
            console.log('Using chooseVideoInputDevice method');
            await audioVideo.chooseVideoInputDevice(videoInputDevices[0].deviceId);
          } else if (typeof audioVideo.setVideoInputDevice === 'function') {
            console.log('Using setVideoInputDevice method');
            await audioVideo.setVideoInputDevice(videoInputDevices[0].deviceId);
          } else if (typeof audioVideo.startVideoInput === 'function') {
            console.log('Using startVideoInput method');
            await audioVideo.startVideoInput(videoInputDevices[0].deviceId);
          } else {
            console.warn('No compatible video input selection method found');
          }
        }
        
        // List audio output devices (speakers)
        try {
          const audioOutputDevices = await audioVideo.listAudioOutputDevices();
          console.log('Available audio output devices:', audioOutputDevices);
          setAudioOutputDevices(audioOutputDevices);
          
          // Select default audio output device
          if (audioOutputDevices.length > 0) {
            const defaultDevice = audioOutputDevices[0].deviceId;
            setSelectedAudioOutputDevice(defaultDevice);
            
            // Try various potential method names for speaker selection
            if (typeof audioVideo.chooseAudioOutputDevice === 'function') {
              console.log('Using chooseAudioOutputDevice method');
              await audioVideo.chooseAudioOutputDevice(defaultDevice);
            } else if (typeof audioVideo.setAudioOutputDevice === 'function') {
              console.log('Using setAudioOutputDevice method');
              await audioVideo.setAudioOutputDevice(defaultDevice);
            } else {
              console.warn('No compatible audio output selection method found');
              
              // Try browser's built-in audio output selection if available
              try {
                if (typeof HTMLMediaElement.prototype.setSinkId === 'function') {
                  console.log('Using browser setSinkId API');
                  if (remoteVideoRef.current) {
                    await remoteVideoRef.current.setSinkId(defaultDevice);
                    console.log('Set sink ID for remote video');
                  }
                }
              } catch (sinkIdError) {
                console.error('Error setting sink ID:', sinkIdError);
              }
            }
          }
        } catch (audioOutputError) {
          console.error('Error listing audio output devices:', audioOutputError);
          // This may happen in browsers that don't support audio output device selection
        }
      } catch (deviceError) {
        console.error('Error accessing media devices:', deviceError);
        console.log('Continuing without selecting specific devices');
        // Continue without device selection
      }
    } catch (err) {
      console.error('Error in device selection process:', err);
      console.log('Continuing without media device selection');
      // Don't throw the error, just continue without device selection
    }
  };
  
  // Function to change audio output device
  const changeAudioOutputDevice = async (deviceId) => {
    if (!meetingSession) return;
    
    try {
      console.log(`Changing audio output device to: ${deviceId}`);
      setSelectedAudioOutputDevice(deviceId);
      
      // Try various methods to set the audio output device
      const audioVideo = meetingSession.audioVideo;
      
      if (typeof audioVideo.chooseAudioOutputDevice === 'function') {
        await audioVideo.chooseAudioOutputDevice(deviceId);
        console.log('Successfully changed audio output using chooseAudioOutputDevice');
      } else if (typeof audioVideo.setAudioOutputDevice === 'function') {
        await audioVideo.setAudioOutputDevice(deviceId);
        console.log('Successfully changed audio output using setAudioOutputDevice');
      } else if (typeof HTMLMediaElement.prototype.setSinkId === 'function') {
        // Use browser's built-in audio output selection
        if (remoteVideoRef.current) {
          await remoteVideoRef.current.setSinkId(deviceId);
          console.log('Successfully changed audio output using setSinkId');
        }
      } else {
        console.warn('No method available to change audio output device');
      }
    } catch (err) {
      console.error('Error changing audio output device:', err);
      setError('Failed to change audio output device. Please check browser permissions.');
    }
  };
  
  // Function to test audio output
  const testAudioOutput = async () => {
    setAudioTestInProgress(true);
    
    try {
      // Create and play a test sound
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // 440 Hz (A4)
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime); // Reduce volume
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Play for 1 second
      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
        audioContext.close();
        setAudioTestInProgress(false);
      }, 1000);
      
      console.log('Audio test started');
    } catch (err) {
      console.error('Error testing audio output:', err);
      setAudioTestInProgress(false);
    }
  };
  
  const joinWithAudioVideo = async (session) => {
    try {
      console.log('Starting to join with audio/video');
      
      // Start local video with error handling
      try {
        console.log('Attempting to start local video');
        await session.audioVideo.startLocalVideoTile();
        console.log('Local video started successfully');
      } catch (videoErr) {
        console.error('Error starting local video:', videoErr);
        console.log('Continuing without local video');
        // Continue without video if there's an error
      }
      
      // Handle presence events with error handling
      try {
        console.log('Setting up attendee presence subscription');
        session.audioVideo.realtimeSubscribeToAttendeeIdPresence((attendeeId, present) => {
          console.log(`Attendee ${attendeeId} presence: ${present}`);
        });
        console.log('Attendee presence subscription established');
      } catch (presenceErr) {
        console.error('Error setting up presence subscription:', presenceErr);
        // Continue without presence subscription
      }
      
      console.log('Successfully joined meeting with available audio/video capabilities');
    } catch (err) {
      console.error('General error joining with audio/video:', err);
      // Don't set the error state here, which would show an error to the user
      // Instead, let the meeting continue with limited functionality
      console.log('Continuing meeting with limited functionality');
    }
  };
  
  const toggleMute = () => {
    if (!meetingSession) {
      console.log('Cannot toggle mute: No active meeting session');
      return;
    }
    
    try {
      console.log(`Attempting to toggle mute state from ${isMuted ? 'muted' : 'unmuted'}`);
      
      // Check if the methods exist before calling them
      if (isMuted) {
        // Unmute
        if (typeof meetingSession.audioVideo.realtimeUnmuteLocalAudio === 'function') {
          meetingSession.audioVideo.realtimeUnmuteLocalAudio();
          console.log('Unmuted audio');
        } else {
          console.warn('realtimeUnmuteLocalAudio method not available');
        }
      } else {
        // Mute
        if (typeof meetingSession.audioVideo.realtimeMuteLocalAudio === 'function') {
          meetingSession.audioVideo.realtimeMuteLocalAudio();
          console.log('Muted audio');
        } else {
          console.warn('realtimeMuteLocalAudio method not available');
        }
      }
      
      // Update state based on actual mute state if method exists
      if (typeof meetingSession.audioVideo.realtimeIsLocalAudioMuted === 'function') {
        const muted = meetingSession.audioVideo.realtimeIsLocalAudioMuted();
        console.log(`Audio is now ${muted ? 'muted' : 'unmuted'}`);
        setIsMuted(muted);
      } else {
        // If method doesn't exist, just toggle the state
        console.warn('realtimeIsLocalAudioMuted method not available, toggling state manually');
        setIsMuted(!isMuted);
      }
    } catch (err) {
      console.error("Error toggling mute:", err);
      // Toggle the state anyway to provide feedback to the user
      setIsMuted(!isMuted);
    }
  };
  
  const toggleVideo = async () => {
    if (!meetingSession) {
      console.log('Cannot toggle video: No active meeting session');
      return;
    }
    
    try {
      console.log(`Attempting to toggle video from ${isVideoOff ? 'off' : 'on'}`);
      
      if (isVideoOff) {
        // Turn video on
        if (typeof meetingSession.audioVideo.startLocalVideoTile === 'function') {
          try {
            await meetingSession.audioVideo.startLocalVideoTile();
            console.log('Started local video successfully');
            setIsVideoOff(false);
          } catch (videoStartError) {
            console.error('Error starting local video:', videoStartError);
            // Keep state as is
          }
        } else {
          console.warn('startLocalVideoTile method not available');
          // Toggle state anyway for user feedback
          setIsVideoOff(false);
        }
      } else {
        // Turn video off
        if (typeof meetingSession.audioVideo.stopLocalVideoTile === 'function') {
          try {
            meetingSession.audioVideo.stopLocalVideoTile();
            console.log('Stopped local video successfully');
            setIsVideoOff(true);
          } catch (videoStopError) {
            console.error('Error stopping local video:', videoStopError);
            // Keep state as is
          }
        } else {
          console.warn('stopLocalVideoTile method not available');
          // Toggle state anyway for user feedback
          setIsVideoOff(true);
        }
      }
    } catch (err) {
      console.error("General error toggling video:", err);
      // Don't change state if there was an error
    }
  };
  
  const startScreenShare = async () => {
    if (!meetingSession) {
      console.log('Cannot start screen share: No active meeting session');
      return;
    }
    
    try {
      console.log('Attempting to start screen sharing');
      
      // Stop any existing screen share
      if (isScreenSharing) {
        console.log('Screen share already active, stopping first');
        await stopScreenShare();
      }
      
      // Check if the method exists
      if (typeof meetingSession.audioVideo.startContentShare === 'function') {
        try {
          // Start screen sharing
          await meetingSession.audioVideo.startContentShare();
          console.log('Started screen sharing successfully');
          setIsScreenSharing(true);
          
          // Add observer if method exists
          if (typeof meetingSession.audioVideo.addContentShareObserver === 'function') {
            meetingSession.audioVideo.addContentShareObserver({
              contentShareDidStop: () => {
                console.log('Content share stopped by system or browser');
                setIsScreenSharing(false);
              }
            });
          } else {
            console.warn('addContentShareObserver method not available');
          }
        } catch (contentError) {
          console.error('Error in content sharing:', contentError);
          // User might have cancelled the screen share picker
          console.log('Screen sharing failed or was cancelled');
        }
      } else {
        console.warn('startContentShare method not available');
        // Show a more user-friendly message
        setError("Screen sharing is not supported in this meeting mode.");
      }
    } catch (err) {
      console.error("General error with screen sharing:", err);
      setError("Failed to start screen sharing. Please check browser permissions.");
    }
  };
  
  const stopScreenShare = async () => {
    if (!meetingSession) {
      console.log('Cannot stop screen share: No active meeting session');
      return;
    }
    
    try {
      console.log('Attempting to stop screen sharing');
      
      // Check if the method exists
      if (typeof meetingSession.audioVideo.stopContentShare === 'function') {
        await meetingSession.audioVideo.stopContentShare();
        console.log('Stopped screen sharing successfully');
      } else {
        console.warn('stopContentShare method not available');
      }
      
      // Always update the state even if the method call failed
      setIsScreenSharing(false);
    } catch (err) {
      console.error("Error stopping screen share:", err);
      // Update state anyway
      setIsScreenSharing(false);
    }
  };
  
  const toggleRecording = async () => {
    if (isRecording) {
      // Stop recording logic here
      setIsRecording(false);
    } else {
      // Start recording logic here
      setIsRecording(true);
    }
  };
  
  const addNote = async () => {
    if (!newNote.trim()) return;
    
    try {
      await axios.put(
        `${API_BASE_URL}/sessions/${sessionId}`,
        {
          note: newNote,
          author_id: auth.user.profile.sub,
        },
        {
          headers: {
            Authorization: `Bearer ${auth.user.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );
      
      // Add note to local state
      const newNoteObj = {
        text: newNote,
        timestamp: new Date().toISOString(),
        author_id: auth.user.profile.sub,
      };
      
      setNotes([...notes, newNoteObj]);
      setNewNote("");
    } catch (err) {
      console.error("Error adding note:", err);
      setError("Failed to add note. Please try again.");
    }
  };
  
  const uploadFile = async () => {
    if (!fileUpload) return;
    
    try {
      // In a real implementation, you would upload the file to S3 first
      // and then save the S3 URL in the session
      const fileUrl = "https://example.com/sample-file.pdf"; // placeholder
      
      await axios.put(
        `${API_BASE_URL}/sessions/${sessionId}`,
        {
          document: fileUrl,
          document_name: fileUpload.name,
          author_id: auth.user.profile.sub,
        },
        {
          headers: {
            Authorization: `Bearer ${auth.user.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );
      
      // Add file to local state
      const newFileObj = {
        url: fileUrl,
        name: fileUpload.name,
        timestamp: new Date().toISOString(),
        author_id: auth.user.profile.sub,
      };
      
      setSharedFiles([...sharedFiles, newFileObj]);
      setFileUpload(null);
    } catch (err) {
      console.error("Error uploading file:", err);
      setError("Failed to upload file. Please try again.");
    }
  };
  
  const endSession = async () => {
    try {
      // 1. Update session status to ended in our backend
      await axios.put(
        `${API_BASE_URL}/sessions/${sessionId}`,
        {
          status: "ended",
        },
        {
          headers: {
            Authorization: `Bearer ${auth.user.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );
      
      // 2. End the Chime meeting
      if (meetingSession) {
        meetingSession.audioVideo.stop();
      }
      
      // 3. Delete the meeting on the backend
      await axios.delete(
        `${API_BASE_URL}/meetings`,
        {
          headers: {
            Authorization: `Bearer ${auth.user.access_token}`,
            "Content-Type": "application/json",
          },
          data: { session_id: sessionId }
        }
      );
      
      // 4. Call the parent component's callback
      if (onEndSession) {
        onEndSession();
      }
    } catch (err) {
      console.error("Error ending session:", err);
      setError("Failed to end session. Please try again.");
    }
  };
  
  if (loading) {
    return <div className="loading">Loading session...</div>;
  }
  
  if (error) {
    return <div className="error-message">{error}</div>;
  }
  
  return (
    <div className="virtual-session">
      <div className="session-header">
        <h2>Virtual Session: {session?.topic || "Class Session"}</h2>
        <div className="session-controls">
          <button 
            className={`control-btn ${isMuted ? 'active' : ''}`} 
            onClick={toggleMute}
          >
            {isMuted ? 'Unmute' : 'Mute'}
          </button>
          
          <button 
            className={`control-btn ${isVideoOff ? 'active' : ''}`} 
            onClick={toggleVideo}
          >
            {isVideoOff ? 'Turn Video On' : 'Turn Video Off'}
          </button>
          
          <button 
            className={`control-btn ${isScreenSharing ? 'active' : ''}`} 
            onClick={isScreenSharing ? stopScreenShare : startScreenShare}
          >
            {isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
          </button>
          
          <button 
            className={`control-btn recording ${isRecording ? 'active' : ''}`} 
            onClick={toggleRecording}
          >
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </button>
          
          <button 
            className="control-btn end-session" 
            onClick={endSession}
          >
            End Session
          </button>
        </div>
      </div>
      
      <div className="main-session-content">
        {/* Main Video Container - Takes full width */}
        <div className="video-container fullscreen">
          <div className="video-box remote">
            <video 
              ref={remoteVideoRef} 
              autoPlay 
              playsInline
              className="remote-video"
            />
            <div className="video-label">Remote</div>
          </div>
          
          <div className="video-box local">
            <video 
              ref={localVideoRef} 
              autoPlay 
              playsInline 
              muted 
              className="local-video"
            />
            <div className="video-label">You</div>
          </div>
        </div>
        
        {/* Bottom Control Bar */}
        <div className="session-bottom-controls">
          <div className="bottom-control-buttons">
            <button 
              className={`bottom-control-btn ${showNotes ? 'active' : ''}`}
              onClick={() => {
                setShowNotes(!showNotes);
                setShowFiles(false);
                setShowAudioSettings(false);
              }}
            >
              Notes
            </button>
            
            <button 
              className={`bottom-control-btn ${showFiles ? 'active' : ''}`}
              onClick={() => {
                setShowFiles(!showFiles);
                setShowNotes(false);
                setShowAudioSettings(false);
              }}
            >
              Files
            </button>
            
            <button 
              className={`bottom-control-btn ${showAudioSettings ? 'active' : ''}`}
              onClick={() => {
                setShowAudioSettings(!showAudioSettings);
                setShowNotes(false);
                setShowFiles(false);
              }}
            >
              Audio Settings
            </button>
          </div>
        </div>
        
        {/* Collapsible Sidebar Panels */}
        {showNotes && (
          <div className="session-panel notes-panel">
            <div className="panel-header">
              <h3>Session Notes</h3>
              <button 
                className="panel-close-btn"
                onClick={() => setShowNotes(false)}
              >
                ✕
              </button>
            </div>
            
            <div className="notes-list">
              {notes.length > 0 ? (
                notes.map((note, index) => (
                  <div key={index} className="note-item">
                    <p className="note-text">{note.text}</p>
                    <p className="note-timestamp">
                      {new Date(note.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                ))
              ) : (
                <p className="no-notes">No notes yet</p>
              )}
            </div>
            
            <div className="add-note">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note..."
                rows="3"
              />
              <button onClick={addNote}>Add Note</button>
            </div>
          </div>
        )}
        
        {showFiles && (
          <div className="session-panel files-panel">
            <div className="panel-header">
              <h3>Shared Files</h3>
              <button 
                className="panel-close-btn"
                onClick={() => setShowFiles(false)}
              >
                ✕
              </button>
            </div>
            
            <div className="files-list">
              {sharedFiles.length > 0 ? (
                sharedFiles.map((file, index) => (
                  <div key={index} className="file-item">
                    <a href={file.url} target="_blank" rel="noopener noreferrer">
                      {file.name}
                    </a>
                    <span className="file-timestamp">
                      {new Date(file.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))
              ) : (
                <p className="no-files">No shared files</p>
              )}
            </div>
            
            <div className="upload-file">
              <input
                type="file"
                onChange={(e) => setFileUpload(e.target.files[0])}
              />
              <button 
                onClick={uploadFile}
                disabled={!fileUpload}
              >
                Upload File
              </button>
            </div>
          </div>
        )}
        
        {/* Audio Settings Panel */}
        {showAudioSettings && (
          <div className="session-panel audio-settings-panel">
            <div className="panel-header">
              <h3>Audio Settings</h3>
              <button 
                className="panel-close-btn"
                onClick={() => setShowAudioSettings(false)}
              >
                ✕
              </button>
            </div>
            
            <div className="audio-settings-content">
              <div className="settings-section">
                <h4>Speaker/Headphone Selection</h4>
                <p className="settings-description">
                  If you can't hear others, try selecting a different speaker or headphone.
                </p>
                
                <select 
                  value={selectedAudioOutputDevice}
                  onChange={(e) => changeAudioOutputDevice(e.target.value)}
                  className="device-select"
                >
                  {audioOutputDevices.map((device, index) => (
                    <option key={index} value={device.deviceId}>
                      {device.label || `Speaker ${index + 1}`}
                    </option>
                  ))}
                </select>
                
                <button 
                  className="audio-test-btn"
                  onClick={testAudioOutput}
                  disabled={audioTestInProgress}
                >
                  {audioTestInProgress ? 'Testing...' : 'Test Speaker'}
                </button>
              </div>
              
              <div className="troubleshooting-section">
                <h4>Audio Troubleshooting</h4>
                <ul className="troubleshooting-tips">
                  <li>Make sure your speakers/headphones are connected and turned on.</li>
                  <li>Check that your device is not muted or volume is not too low.</li>
                  <li>Try refreshing the page if audio issues persist.</li>
                  <li>Some browsers require explicit permission for audio output selection.</li>
                  <li>If using headphones, try unplugging and reconnecting them.</li>
                </ul>
              </div>
              
              <div className="browser-support-note">
                <p>
                  <strong>Note:</strong> Audio output device selection is not supported in all browsers. 
                  If you can't select a different speaker, try using Chrome or Edge for better compatibility.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VirtualSession;