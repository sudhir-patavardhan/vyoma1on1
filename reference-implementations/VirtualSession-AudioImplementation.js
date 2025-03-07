/**
 * REFERENCE IMPLEMENTATION - Amazon Chime SDK Audio Handling
 * 
 * This file serves as a reference implementation for handling audio in a virtual session
 * using the Amazon Chime SDK. It demonstrates robust patterns for:
 * 
 * 1. Audio device selection and management
 * 2. Ensuring audio playback works across different browsers
 * 3. Recovering from common audio failure scenarios
 * 4. Managing srcObject and MediaStream connections
 * 5. Multiple fallback mechanisms for audio output
 * 6. Browser compatibility handling
 * 
 * IMPORTANT PATTERNS:
 * - Multiple approaches to ensure audio works (SDK methods + browser APIs)
 * - Periodic checking for missing audio streams
 * - Explicit handling of browser differences
 * - Comprehensive error handling and recovery
 * - Detailed logging for debugging audio issues
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "react-oidc-context";
import axios from "axios";
import { API_BASE_URL } from "../config";
import "../styles.css";

/* KEY AUDIO IMPLEMENTATION COMPONENTS:
 * 
 * 1. checkAudioOutputSupport(): Detects browser's audio output capabilities
 * 2. detectBrowser(): Identifies browser for compatibility-specific handling
 * 3. applyAudioDeviceWhenReady(): Applies audio device selection with fallbacks
 * 4. checkAndFixMissingSrcObject(): Monitors and fixes missing audio streams
 * 5. setupAudioForVideo(): Comprehensive audio initialization
 * 6. Enhanced videoTileDidUpdate observer: Ensures proper stream binding
 * 7. joinWithAudioVideo(): Multiple audio initialization points
 * 8. testAudioOutput(): Diagnostic tool with detailed feedback
 */

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
  const [audioInputDevices, setAudioInputDevices] = useState([]);
  const [selectedAudioOutputDevice, setSelectedAudioOutputDevice] = useState('');
  const [selectedAudioInputDevice, setSelectedAudioInputDevice] = useState('');
  const [audioTestInProgress, setAudioTestInProgress] = useState(false);
  const [micTestInProgress, setMicTestInProgress] = useState(false);
  const [micAudioLevel, setMicAudioLevel] = useState(0);
  
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
  
  // Helper function to detect audio output selection capability with enhanced browser compatibility detection
  const checkAudioOutputSupport = () => {
    // Check browser support for audio output selection
    const hasSetSinkId = typeof HTMLMediaElement.prototype.setSinkId === 'function';
    
    // Check if we have Chime SDK methods for audio output
    const hasChimeMethods = meetingSession && 
      meetingSession.audioVideo && 
      (typeof meetingSession.audioVideo.chooseAudioOutputDevice === 'function' || 
       typeof meetingSession.audioVideo.setAudioOutputDevice === 'function');
    
    // Get browser info for better compatibility detection
    const browser = detectBrowser();
    
    return {
      supported: hasSetSinkId || hasChimeMethods,
      hasSetSinkId,
      hasChimeMethods,
      browser
    };
  };
  
  // Helper function to detect browser type and version
  const detectBrowser = () => {
    const userAgent = navigator.userAgent;
    let browserName = "Unknown";
    let browserVersion = "Unknown";
    
    // Detect Chrome
    if (userAgent.match(/chrome|chromium|crios/i)) {
      browserName = "Chrome";
      const match = userAgent.match(/(?:chrome|chromium|crios)\/(\d+)/i);
      if (match) browserVersion = match[1];
    } 
    // Detect Firefox
    else if (userAgent.match(/firefox|fxios/i)) {
      browserName = "Firefox";
      const match = userAgent.match(/(?:firefox|fxios)\/(\d+)/i);
      if (match) browserVersion = match[1];
    } 
    // Detect Safari
    else if (userAgent.match(/safari/i) && !userAgent.match(/chrome|chromium|crios/i)) {
      browserName = "Safari";
      const match = userAgent.match(/version\/(\d+)/i);
      if (match) browserVersion = match[1];
    } 
    // Detect Edge
    else if (userAgent.match(/edg/i)) {
      browserName = "Edge";
      const match = userAgent.match(/edg\/(\d+)/i);
      if (match) browserVersion = match[1];
    }
    
    // Detect iOS
    const isIOS = /iPad|iPhone|iPod/.test(userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    return { 
      name: browserName, 
      version: browserVersion,
      isIOS,
      isChrome: browserName === "Chrome",
      isSafari: browserName === "Safari",
      isFirefox: browserName === "Firefox",
      isEdge: browserName === "Edge"
    };
  };

  // Function to apply audio output device when meeting session becomes available
  // This is defined early to avoid circular dependencies
  const applyAudioDeviceWhenReady = (deviceId) => {
    if (!meetingSession || !deviceId) return;
    
    console.log('Attempting to apply audio device:', deviceId);
    
    // First try to force audio to play with a user gesture simulation
    const tryForcingAudioPlay = () => {
      if (remoteVideoRef.current) {
        const videoElem = remoteVideoRef.current;
        
        // Ensure it's not muted and volume is up
        videoElem.muted = false;
        videoElem.volume = 1.0;
        
        // Force a play attempt to overcome browser autoplay restrictions
        videoElem.play()
          .then(() => console.log('Successfully played video element to enable audio'))
          .catch(playErr => console.warn('Could not autoplay video element:', playErr));
        
        // Create a temporary audio context - this can help "wake up" the audio system
        try {
          const audioContext = new (window.AudioContext || window.webkitAudioContext)();
          // Create a silent oscillator
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          gainNode.gain.value = 0; // Silent
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.001); // Very brief
          
          // Resume the audio context
          if (audioContext.state !== 'running') {
            audioContext.resume()
              .then(() => console.log('Audio context resumed'))
              .catch(err => console.warn('Could not resume audio context:', err));
          }
        } catch (audioErr) {
          console.warn('Audio context initialization error:', audioErr);
        }
      }
    };
    
    // Small delay to ensure everything is properly initialized
    setTimeout(() => {
      // Try to force audio playback first
      tryForcingAudioPlay();
      
      try {
        // Log available audio devices for debugging
        if (meetingSession && meetingSession.audioVideo) {
          meetingSession.audioVideo.listAudioOutputDevices()
            .then(devices => {
              console.log('Available audio output devices:', devices);
              // Find the device that matches our deviceId
              const matchingDevice = devices.find(device => device.deviceId === deviceId);
              console.log('Matching device:', matchingDevice || 'None found');
            })
            .catch(err => console.warn('Could not list audio devices:', err));
        }
        
        // Try to directly use the Chime SDK methods first
        if (meetingSession.audioVideo) {
          if (typeof meetingSession.audioVideo.chooseAudioOutputDevice === 'function') {
            meetingSession.audioVideo.chooseAudioOutputDevice(deviceId)
              .then(() => {
                console.log('Applied audio output device via chooseAudioOutputDevice');
                // Try to play audio after setting the device
                tryForcingAudioPlay();
              })
              .catch(err => console.warn('Error applying audio output device:', err));
            
            // Also try to bind the audio element specifically
            if (typeof meetingSession.audioVideo.bindAudioElement === 'function' && remoteVideoRef.current) {
              meetingSession.audioVideo.bindAudioElement(remoteVideoRef.current)
                .then(() => console.log('Successfully bound audio element'))
                .catch(err => console.warn('Error binding audio element:', err));
            }
            
            return;
          } else if (typeof meetingSession.audioVideo.setAudioOutputDevice === 'function') {
            meetingSession.audioVideo.setAudioOutputDevice(deviceId)
              .then(() => {
                console.log('Applied audio output device via setAudioOutputDevice');
                // Try to play audio after setting the device
                tryForcingAudioPlay();
              })
              .catch(err => console.warn('Error applying audio output device:', err));
            return;
          }
        }
        
        // If Chime SDK methods aren't available, try browser API directly
        if (typeof HTMLMediaElement.prototype.setSinkId === 'function') {
          // Apply to ALL audio and video elements in the document
          const mediaElements = document.querySelectorAll('audio, video');
          console.log(`Applying setSinkId to ${mediaElements.length} media elements`);
          
          mediaElements.forEach((elem, index) => {
            // Skip the local video element (should remain on default)
            if (elem === localVideoRef.current) return;
            
            try {
              elem.setSinkId(deviceId)
                .then(() => {
                  console.log(`Applied audio output device via setSinkId to element ${index}`);
                  if (elem.paused && elem.readyState >= 2) {
                    elem.play()
                      .then(() => console.log(`Successfully played element ${index}`))
                      .catch(err => console.warn(`Could not play element ${index}:`, err));
                  }
                })
                .catch(err => console.warn(`Error setting sink ID for element ${index}:`, err));
            } catch (elemErr) {
              console.warn(`Exception setting sink ID for element ${index}:`, elemErr);
            }
          });
          
          // Explicitly try the remote video ref
          if (remoteVideoRef.current) {
            remoteVideoRef.current.setSinkId(deviceId)
              .then(() => {
                console.log('Applied audio output device via setSinkId to remote video');
                tryForcingAudioPlay();
              })
              .catch(err => console.warn('Error applying audio output device to remote video:', err));
          }
        }
      } catch (err) {
        console.error('Error in applyAudioDeviceWhenReady:', err);
      }
    }, 1000);
  };
  
  // Effect to apply audio output device selection when meeting session becomes available
  // Add a function to check and fix missing srcObject
  const checkAndFixMissingSrcObject = useCallback(() => {
    console.log('Checking for missing srcObject on remote video element');
    
    if (remoteVideoRef.current && !remoteVideoRef.current.srcObject && meetingSession) {
      console.log('Remote video has no srcObject, attempting to fix');
      
      try {
        // Method 1: Try to get the active video tile
        if (remoteTileId && typeof meetingSession.audioVideo.bindVideoElement === 'function') {
          console.log('Attempting to rebind video element for tile:', remoteTileId);
          meetingSession.audioVideo.bindVideoElement(remoteTileId, remoteVideoRef.current);
        }
        
        // Method 2: Try to extract an audio stream from the meeting and create a media stream
        if (typeof meetingSession.audioVideo.getCurrentMeetingAudioStream === 'function') {
          console.log('Attempting to get meeting audio stream');
          meetingSession.audioVideo.getCurrentMeetingAudioStream()
            .then(audioStream => {
              if (audioStream && (!remoteVideoRef.current.srcObject || !remoteVideoRef.current.srcObject.getAudioTracks().length)) {
                console.log('Got audio stream from meeting, attaching to video element');
                
                // Create a new MediaStream if needed
                if (!remoteVideoRef.current.srcObject) {
                  remoteVideoRef.current.srcObject = new MediaStream();
                }
                
                // Add audio tracks to the stream
                audioStream.getAudioTracks().forEach(track => {
                  if (!remoteVideoRef.current.srcObject.getTrackById(track.id)) {
                    remoteVideoRef.current.srcObject.addTrack(track);
                    console.log('Added audio track to remote video srcObject:', track.id);
                  }
                });
                
                // Try to play the video with the new stream
                remoteVideoRef.current.play()
                  .then(() => console.log('Playing remote video with new audio stream'))
                  .catch(err => console.warn('Failed to play remote video with new audio stream:', err));
              }
            })
            .catch(err => console.warn('Error getting meeting audio stream:', err));
        } else {
          console.warn('getCurrentMeetingAudioStream method not available');
        }
        
        // Method 3: Try calling bindAudioElement directly
        if (!remoteVideoRef.current.srcObject && typeof meetingSession.audioVideo.bindAudioElement === 'function') {
          console.log('Attempting to bind audio element directly');
          meetingSession.audioVideo.bindAudioElement(remoteVideoRef.current)
            .then(() => console.log('Successfully bound audio element'))
            .catch(err => console.warn('Error binding audio element:', err));
        }
      } catch (err) {
        console.warn('Error trying to fix missing srcObject:', err);
      }
    } else if (remoteVideoRef.current && remoteVideoRef.current.srcObject) {
      // Check if there are any audio tracks
      const audioTracks = remoteVideoRef.current.srcObject.getAudioTracks();
      console.log(`Remote video has srcObject with ${audioTracks.length} audio tracks`);
      
      if (audioTracks.length === 0 && meetingSession) {
        console.log('srcObject exists but has no audio tracks, attempting to add audio');
        // Try to get and add audio tracks
        if (typeof meetingSession.audioVideo.getCurrentMeetingAudioStream === 'function') {
          meetingSession.audioVideo.getCurrentMeetingAudioStream()
            .then(audioStream => {
              if (audioStream) {
                const newAudioTracks = audioStream.getAudioTracks();
                console.log(`Found ${newAudioTracks.length} audio tracks in meeting stream`);
                
                newAudioTracks.forEach(track => {
                  remoteVideoRef.current.srcObject.addTrack(track);
                  console.log('Added audio track to existing srcObject:', track.id);
                });
              }
            })
            .catch(err => console.warn('Error getting audio stream for existing srcObject:', err));
        }
      }
    }
  }, [meetingSession, remoteTileId]);
  
  // Effect to periodically check for missing srcObject
  useEffect(() => {
    if (meetingSession) {
      // Check immediately
      checkAndFixMissingSrcObject();
      
      // Then check periodically
      const intervalId = setInterval(checkAndFixMissingSrcObject, 5000);
      
      return () => clearInterval(intervalId);
    }
  }, [meetingSession, checkAndFixMissingSrcObject]);

  useEffect(() => {
    if (meetingSession && selectedAudioOutputDevice) {
      console.log('Meeting session now available, applying saved audio output device selection');
      applyAudioDeviceWhenReady(selectedAudioOutputDevice);
      
      // Also check if we need to fix the srcObject
      setTimeout(checkAndFixMissingSrcObject, 2000);
    }
  }, [meetingSession, selectedAudioOutputDevice, checkAndFixMissingSrcObject]);

  // Effect to ensure remote video element has audio enabled
  useEffect(() => {
    if (remoteVideoRef.current) {
      // Set up event listeners for the remote video element
      const remoteVideo = remoteVideoRef.current;
      
      // Enhanced audio setup function
      const setupAudioForVideo = () => {
        console.log('Setting up audio for remote video');
        
        // Ensure it's not muted
        remoteVideo.muted = false;
        
        // Force unmute at the browser level
        document.querySelectorAll('audio, video').forEach(elem => {
          elem.muted = false;
        });
        
        // Try to set volume to 100%
        remoteVideo.volume = 1.0;
        console.log('Remote video unmuted, volume set to:', remoteVideo.volume);
        
        // Check audio tracks
        if (remoteVideo.srcObject) {
          const audioTracks = remoteVideo.srcObject.getAudioTracks();
          console.log(`Video has ${audioTracks.length} audio tracks:`, 
            audioTracks.map(track => ({ 
              enabled: track.enabled, 
              muted: track.muted, 
              id: track.id 
            }))
          );
          
          // Ensure all audio tracks are enabled
          audioTracks.forEach(track => {
            track.enabled = true;
          });
        } else {
          console.warn('Remote video has no srcObject yet');
        }
        
        // Try to make the audio system "wake up"
        const wakeAudioSystem = () => {
          try {
            // Create a temporary audio context
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            // Make it very quiet
            gainNode.gain.value = 0.01;
            
            // Connect and start/stop
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.1);
            
            // Resume the audio context if needed
            if (audioContext.state !== 'running') {
              audioContext.resume()
                .then(() => console.log('Audio context resumed'))
                .catch(err => console.warn('Could not resume audio context:', err));
            }
          } catch (err) {
            console.warn('Error trying to wake audio system:', err);
          }
        };
        
        // Run the audio wake-up
        wakeAudioSystem();
        
        // Try to play the video
        const attemptPlay = () => {
          if (remoteVideo.paused) {
            console.log('Attempting to play remote video');
            remoteVideo.play()
              .then(() => console.log('Successfully started remote video playback'))
              .catch(playErr => {
                console.warn('Error auto-playing remote video, will retry:', playErr);
                
                // If autoplay was prevented, we'll try again after user interaction
                const anyUserInteraction = () => {
                  console.log('User interaction detected, trying playback again');
                  remoteVideo.play()
                    .then(() => console.log('Play succeeded after user interaction'))
                    .catch(err => console.warn('Play still failed after user interaction:', err));
                  
                  // Remove the interaction listeners once we've tried
                  document.removeEventListener('click', anyUserInteraction);
                  document.removeEventListener('keydown', anyUserInteraction);
                };
                
                // Listen for any user interaction
                document.addEventListener('click', anyUserInteraction, { once: true });
                document.addEventListener('keydown', anyUserInteraction, { once: true });
              });
          }
        };
        
        // Try to play now and again shortly (for reliability)
        attemptPlay();
        setTimeout(attemptPlay, 1000);
        setTimeout(attemptPlay, 3000);
      };
      
      // Log when video is loaded
      remoteVideo.onloadedmetadata = () => {
        console.log('Remote video metadata loaded');
        setupAudioForVideo();
      };
      
      // Setup canplaythrough event listener
      remoteVideo.oncanplaythrough = () => {
        console.log('Remote video can play through');
        setupAudioForVideo();
        
        // Apply audio output device after the video can play through
        // This ensures the browser is ready to accept the setSinkId operation
        setTimeout(() => {
          if (selectedAudioOutputDevice && typeof remoteVideo.setSinkId === 'function') {
            try {
              // We wrap this in another try-catch to prevent AbortError from bubbling up
              remoteVideo.setSinkId(selectedAudioOutputDevice)
                .then(() => {
                  console.log('Successfully applied setSinkId to remote video after it can play through');
                  // Try to play again after changing output device
                  if (remoteVideo.paused) {
                    remoteVideo.play()
                      .then(() => console.log('Successfully played video after setSinkId'))
                      .catch(err => console.warn('Error playing video after setSinkId:', err));
                  }
                })
                .catch(err => {
                  console.warn('Error applying audio output device to video after canplaythrough:', err);
                });
            } catch (err) {
              console.warn('Exception when trying to set sink ID:', err);
            }
          }
        }, 1000); // Delay by 1 second to ensure browser is ready
      };
      
      // Add additional event listeners for troubleshooting
      remoteVideo.onerror = (err) => {
        console.error('Remote video error:', err);
      };
      
      remoteVideo.onplaying = () => {
        console.log('Remote video is now playing');
      };
      
      remoteVideo.onpause = () => {
        console.log('Remote video was paused');
      };
      
      remoteVideo.onstalled = () => {
        console.warn('Remote video playback stalled');
      };
      
      // Setup initial audio state
      setupAudioForVideo();
    }
  }, [remoteVideoRef.current, selectedAudioOutputDevice]);
  
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
      
      // Cleanup the audio output observer if it exists
      if (window.audioOutputObserver) {
        window.audioOutputObserver.disconnect();
        window.audioOutputObserver = null;
        console.log("Cleaned up audio output observer");
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
      
      // Explicitly bind the audio element to ensure proper audio routing
      try {
        if (typeof session.audioVideo.bindAudioElement === 'function' && remoteVideoRef.current) {
          await session.audioVideo.bindAudioElement(remoteVideoRef.current);
          console.log('Successfully bound audio element during session setup');
        } else {
          console.warn('No bindAudioElement method available during session setup');
        }
      } catch (bindErr) {
        console.warn('Error binding audio element during session setup:', bindErr);
      }
      
      // Start the meeting session
      session.audioVideo.start();
      setMeetingStatus('started');
      
      // Join with audio/video
      await joinWithAudioVideo(session);
      
      // Attempt to apply any saved audio device selection right after joining
      if (selectedAudioOutputDevice) {
        // Small delay to ensure everything is initialized
        setTimeout(() => {
          applyAudioDeviceWhenReady(selectedAudioOutputDevice);
        }, 2000);
      }
      
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
        console.log('Video tile update:', tileState);
        if (!tileState.boundAttendeeId) {
          console.log('Ignoring tile update with no boundAttendeeId');
          return;
        }
        
        const isLocalTile = tileState.localTile;
        console.log(`Processing ${isLocalTile ? 'local' : 'remote'} video tile:`, tileState.tileId);
        
        if (isLocalTile) {
          // Local video tile
          setLocalTileId(tileState.tileId);
          console.log('Binding local video element to tile:', tileState.tileId);
          session.audioVideo.bindVideoElement(
            tileState.tileId,
            localVideoRef.current
          ).then(() => {
            console.log('Successfully bound local video element');
            
            // Check if local video has srcObject
            if (localVideoRef.current && !localVideoRef.current.srcObject) {
              console.warn('Local video element bound but no srcObject present');
            } else if (localVideoRef.current) {
              console.log('Local video element has srcObject with tracks:', 
                localVideoRef.current.srcObject.getTracks().length);
            }
          }).catch(err => {
            console.error('Error binding local video element:', err);
          });
        } else if (!tileState.isContent) {
          // Remote participant camera
          setRemoteTileId(tileState.tileId);
          console.log('Binding remote video element to tile:', tileState.tileId);
          session.audioVideo.bindVideoElement(
            tileState.tileId,
            remoteVideoRef.current
          ).then(() => {
            console.log('Successfully bound remote video element');
            
            // Force unmute and volume up
            if (remoteVideoRef.current) {
              remoteVideoRef.current.muted = false;
              remoteVideoRef.current.volume = 1.0;
              
              // Explicitly try to play the video
              if (remoteVideoRef.current.paused) {
                remoteVideoRef.current.play()
                  .then(() => console.log('Remote video playback started after binding'))
                  .catch(err => console.warn('Could not auto-play remote video after binding:', err));
              }
              
              // Check if remote video has srcObject
              if (!remoteVideoRef.current.srcObject) {
                console.warn('Remote video element bound but no srcObject present');
                
                // Attempt to create a stream from the meeting audio
                if (typeof session.audioVideo.getCurrentMeetingAudioStream === 'function') {
                  session.audioVideo.getCurrentMeetingAudioStream()
                    .then(audioStream => {
                      if (audioStream && !remoteVideoRef.current.srcObject) {
                        remoteVideoRef.current.srcObject = audioStream;
                        console.log('Set meeting audio stream as srcObject for remote video');
                      }
                    })
                    .catch(err => console.warn('Error getting meeting audio stream:', err));
                }
              } else {
                console.log('Remote video element has srcObject with tracks:', 
                  remoteVideoRef.current.srcObject.getTracks().map(t => 
                    ({ kind: t.kind, id: t.id, enabled: t.enabled, muted: t.muted })));
              }
            }
          }).catch(err => {
            console.error('Error binding remote video element:', err);
          });
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
        setAudioInputDevices(audioInputDevices);
        
        if (audioInputDevices.length > 0) {
          // Set default audio input device
          const defaultDevice = audioInputDevices[0].deviceId;
          setSelectedAudioInputDevice(defaultDevice);
          
          // Try various potential method names for microphone selection
          if (typeof audioVideo.chooseAudioInputDevice === 'function') {
            console.log('Using chooseAudioInputDevice method');
            await audioVideo.chooseAudioInputDevice(defaultDevice);
          } else if (typeof audioVideo.setAudioInputDevice === 'function') {
            console.log('Using setAudioInputDevice method');
            await audioVideo.setAudioInputDevice(defaultDevice);
          } else if (typeof audioVideo.startAudioInput === 'function') {
            console.log('Using startAudioInput method');
            await audioVideo.startAudioInput(defaultDevice);
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
            
            // Store the default device for later use
            setSelectedAudioOutputDevice(defaultDevice);
            
            // Only try to change device if meeting session is ready
            if (meetingSession) {
              // Use the direct method to avoid circular references
              applyAudioDeviceWhenReady(defaultDevice);
            } else {
              console.log('Meeting session not ready yet, audio device selection will be applied when session is ready');
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
  
  // Function to change audio output device - enhanced with fallbacks and error handling
  // Wrap in useCallback to memoize and prevent recreation on each render
  const changeAudioOutputDevice = useCallback(async (deviceId) => {
    if (!meetingSession) {
      console.log('No active meeting session available for audio output selection');
      return;
    }
    
    try {
      console.log(`Attempting to change audio output device to: ${deviceId}`);
      setSelectedAudioOutputDevice(deviceId);
      
      let methodUsed = false;
      let lastError = null;
      const supportInfo = checkAudioOutputSupport();
      const { browser } = supportInfo;
      
      // Try various methods to set the audio output device
      const audioVideo = meetingSession.audioVideo;
      
      // Method 1: Amazon Chime SDK's chooseAudioOutputDevice
      if (typeof audioVideo.chooseAudioOutputDevice === 'function') {
        try {
          await audioVideo.chooseAudioOutputDevice(deviceId);
          console.log('Successfully changed audio output using chooseAudioOutputDevice');
          methodUsed = true;
        } catch (err) {
          console.warn('Error using chooseAudioOutputDevice:', err);
          lastError = err;
        }
      }
      
      // Method 2: Amazon Chime SDK's setAudioOutputDevice (if method 1 failed)
      if (!methodUsed && typeof audioVideo.setAudioOutputDevice === 'function') {
        try {
          await audioVideo.setAudioOutputDevice(deviceId);
          console.log('Successfully changed audio output using setAudioOutputDevice');
          methodUsed = true;
        } catch (err) {
          console.warn('Error using setAudioOutputDevice:', err);
          lastError = err;
        }
      }
      
      // Method 3: Browser's built-in audio output selection (if methods 1 and 2 failed)
      if (!methodUsed && typeof HTMLMediaElement.prototype.setSinkId === 'function') {
        try {
          // Apply to remote video element with more robust error handling
          if (remoteVideoRef.current) {
            try {
              // Check if video is in a state where setSinkId may fail
              const readyState = remoteVideoRef.current.readyState;
              if (readyState >= 1) { // HAVE_METADATA or higher
                await remoteVideoRef.current.setSinkId(deviceId);
                console.log('Applied setSinkId to remote video element');
                methodUsed = true;
              } else {
                console.log('Video not ready for setSinkId, state:', readyState);
                // Schedule setSinkId to run when video is ready
                methodUsed = true; // Still mark as handled
                
                // Register a one-time event handler
                const handleVideoReady = () => {
                  // Delay to give browser time to fully initialize
                  setTimeout(async () => {
                    try {
                      await remoteVideoRef.current.setSinkId(deviceId);
                      console.log('Applied delayed setSinkId to remote video element');
                    } catch (delayedErr) {
                      console.warn('Error with delayed setSinkId:', delayedErr);
                    }
                  }, 1000);
                };
                
                // Use loadeddata as a trigger point
                remoteVideoRef.current.addEventListener('loadeddata', handleVideoReady, { once: true });
              }
            } catch (videoErr) {
              console.warn('Error applying setSinkId to video:', videoErr);
              // Continue with other elements even if video fails
            }
          }
          
          // Find and update all audio and video elements
          const mediaElements = document.querySelectorAll('audio, video');
          for (const elem of mediaElements) {
            try {
              // Skip the local video element since it should be muted
              if (elem === localVideoRef.current || elem === remoteVideoRef.current) continue;
              
              // Check if element is ready for setSinkId
              if (elem.readyState >= 1) {
                await elem.setSinkId(deviceId)
                  .then(() => console.log('Applied setSinkId to media element'))
                  .catch(err => console.warn('Failed to set sink ID on media element:', err));
              } else {
                // Set up event listener for when the element is ready
                const handleElementReady = () => {
                  setTimeout(async () => {
                    try {
                      await elem.setSinkId(deviceId);
                      console.log('Applied delayed setSinkId to media element');
                    } catch (delayedErr) {
                      console.warn('Error with delayed setSinkId on media element:', delayedErr);
                    }
                  }, 1000);
                };
                
                elem.addEventListener('loadeddata', handleElementReady, { once: true });
                console.log('Set up delayed setSinkId for media element');
              }
            } catch (mediaElemErr) {
              console.warn('Could not set sink ID for media element:', mediaElemErr);
            }
          }
          
          // For Chrome-based browsers that might create dynamic audio elements, ensure we keep track
          // of new audio elements created by the Chime SDK
          if (browser.isChrome || browser.isEdge) {
            // Create a MutationObserver to detect new audio elements
            const observer = new MutationObserver((mutations) => {
              mutations.forEach((mutation) => {
                if (mutation.addedNodes) {
                  mutation.addedNodes.forEach((node) => {
                    // Check if the added node is an audio element or contains audio elements
                    if (node.nodeType === 1) { // ELEMENT_NODE
                      if (node.tagName === 'AUDIO' || node.tagName === 'VIDEO') {
                        try {
                          // Check if element is ready for setSinkId
                          if (node.readyState >= 1) {
                            node.setSinkId(deviceId)
                              .then(() => console.log('Applied setSinkId to dynamically added media element'))
                              .catch(err => console.warn('Failed to set sink ID on dynamically added media element:', err));
                          } else {
                            // Set up event listener for when the element is ready
                            const handleMediaReady = () => {
                              setTimeout(() => {
                                try {
                                  node.setSinkId(deviceId)
                                    .then(() => console.log('Applied delayed setSinkId to dynamically added media element'))
                                    .catch(delayedErr => console.warn('Failed delayed sink ID set:', delayedErr));
                                } catch (setupErr) {
                                  console.warn('Exception in delayed setSinkId setup:', setupErr);
                                }
                              }, 1000);
                            };
                            
                            node.addEventListener('loadeddata', handleMediaReady, { once: true });
                            console.log('Set up delayed setSinkId for dynamically added media element');
                          }
                        } catch (err) {
                          console.warn('Failed to set sink ID on dynamically added media element:', err);
                        }
                      } else {
                        // Check for audio/video elements inside the added node
                        const childMediaElements = node.querySelectorAll('audio, video');
                        childMediaElements.forEach((mediaElem) => {
                          try {
                            // Skip the local video element
                            if (mediaElem === localVideoRef.current) return;
                            
                            // Check if element is ready for setSinkId
                            if (mediaElem.readyState >= 1) {
                              mediaElem.setSinkId(deviceId)
                                .then(() => console.log('Applied setSinkId to nested media element'))
                                .catch(err => console.warn('Failed to set sink ID on nested media element:', err));
                            } else {
                              // Set up event listener for when the element is ready
                              const handleNestedMediaReady = () => {
                                setTimeout(() => {
                                  try {
                                    mediaElem.setSinkId(deviceId)
                                      .then(() => console.log('Applied delayed setSinkId to nested media element'))
                                      .catch(delayedErr => console.warn('Failed delayed sink ID set for nested element:', delayedErr));
                                  } catch (setupErr) {
                                    console.warn('Exception in delayed setSinkId setup for nested element:', setupErr);
                                  }
                                }, 1000);
                              };
                              
                              mediaElem.addEventListener('loadeddata', handleNestedMediaReady, { once: true });
                              console.log('Set up delayed setSinkId for nested media element');
                            }
                          } catch (err) {
                            console.warn('Failed to set sink ID on nested media element:', err);
                          }
                        });
                      }
                    }
                  });
                }
              });
            });
            
            // Start observing the document with the configured parameters
            observer.observe(document.body, { childList: true, subtree: true });
            
            // Store the observer in a ref for cleanup
            // This will be defined at the component level
            if (window.audioOutputObserver) {
              window.audioOutputObserver.disconnect();
            }
            window.audioOutputObserver = observer;
          }
        } catch (sinkIdErr) {
          console.warn('Error using setSinkId API:', sinkIdErr);
          lastError = sinkIdErr;
        }
      }
      
      // Method 4: Special handling for Safari (which doesn't support setSinkId)
      if (!methodUsed && browser.isSafari) {
        // For Safari, we can't change the output device via API, but we can guide the user
        setError('Safari does not support changing audio output devices through the browser API. Please use system settings to select your preferred output device.');
        methodUsed = true; // Mark as handled to avoid generic error
      }
      
      // Method 5: Special handling for iOS devices
      if (!methodUsed && browser.isIOS) {
        setError('iOS devices do not support changing audio output devices through the browser. Audio will play through the currently active output.');
        methodUsed = true; // Mark as handled to avoid generic error
      }
      
      // If no method worked, create a fallback notification
      if (!methodUsed) {
        console.warn('No compatible audio output selection method found:', lastError);
        setError(`Unable to change audio output device. Your browser (${browser.name} ${browser.version}) may not support this feature. Try using Chrome, Edge, or Firefox instead.`);
      }
    } catch (err) {
      console.error('Error in audio output device change process:', err);
      setError('Failed to change audio output device. Please check browser permissions or try a different browser.');
    }
  }, [meetingSession]);
  
  // Function to test audio output
  const testAudioOutput = async () => {
    setAudioTestInProgress(true);
    
    try {
      // Try to get and play the meeting audio for a true test
      if (meetingSession && remoteVideoRef.current) {
        try {
          // Ensure video is unmuted
          remoteVideoRef.current.muted = false;
          remoteVideoRef.current.volume = 1.0;
          
          console.log('Testing with meeting audio...');
          
          // Apply output device if one is selected
          if (selectedAudioOutputDevice && typeof remoteVideoRef.current.setSinkId === 'function') {
            await remoteVideoRef.current.setSinkId(selectedAudioOutputDevice);
            console.log('Applied audio output device for test');
          }
          
          // Try to explicitly bind audio element using Chime SDK
          if (typeof meetingSession.audioVideo.bindAudioElement === 'function') {
            await meetingSession.audioVideo.bindAudioElement(remoteVideoRef.current);
            console.log('Explicitly bound audio element for test');
            
            // Try to get the current audio stream
            if (typeof meetingSession.audioVideo.getCurrentAudioStream === 'function') {
              const audioStream = await meetingSession.audioVideo.getCurrentAudioStream();
              if (audioStream) {
                console.log('Retrieved current audio stream for test');
                
                // Create a temporary audio element to play the stream
                const tempAudio = document.createElement('audio');
                tempAudio.srcObject = audioStream;
                tempAudio.muted = false;
                tempAudio.volume = 1.0;
                
                if (selectedAudioOutputDevice && typeof tempAudio.setSinkId === 'function') {
                  await tempAudio.setSinkId(selectedAudioOutputDevice);
                }
                
                document.body.appendChild(tempAudio);
                
                await tempAudio.play();
                console.log('Playing test with meeting audio stream');
                
                setTimeout(() => {
                  tempAudio.pause();
                  tempAudio.srcObject = null;
                  document.body.removeChild(tempAudio);
                  console.log('Removed temporary audio element');
                }, 3000);
              }
            }
          }
          
          // Make sure video is playing
          if (remoteVideoRef.current.paused) {
            await remoteVideoRef.current.play();
            console.log('Started video playback for audio test');
          }
        } catch (meetingAudioErr) {
          console.warn('Could not test with meeting audio:', meetingAudioErr);
          // Fall back to oscillator test
        }
      }
      
      // Create and play a test sound as fallback
      console.log('Creating test sound with oscillator...');
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // 440 Hz (A4)
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime); // Reduce volume
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Play for 2 seconds
      oscillator.start();
      
      // Display additional troubleshooting info
      console.log('Audio test active with current settings:');
      console.log('- Selected output device:', selectedAudioOutputDevice);
      console.log('- Audio context state:', audioContext.state);
      if (remoteVideoRef.current) {
        console.log('- Video element muted:', remoteVideoRef.current.muted);
        console.log('- Video element volume:', remoteVideoRef.current.volume);
        console.log('- Video element paused:', remoteVideoRef.current.paused);
      }
      
      // Create a notification to make sure user knows test is running
      setError('Audio test in progress - you should hear a tone. If not, check system volume and selected device.');
      
      setTimeout(() => {
        oscillator.stop();
        audioContext.close();
        setAudioTestInProgress(false);
        setError(''); // Clear the message
      }, 2000);
      
      console.log('Audio test started');
    } catch (err) {
      console.error('Error testing audio output:', err);
      setAudioTestInProgress(false);
    }
  };
  
  // Function to change audio input device
  const changeAudioInputDevice = async (deviceId) => {
    if (!meetingSession) return;
    
    try {
      console.log(`Changing audio input device to: ${deviceId}`);
      setSelectedAudioInputDevice(deviceId);
      
      // Try various methods to set the audio input device
      const audioVideo = meetingSession.audioVideo;
      
      if (typeof audioVideo.chooseAudioInputDevice === 'function') {
        await audioVideo.chooseAudioInputDevice(deviceId);
        console.log('Successfully changed audio input using chooseAudioInputDevice');
      } else {
        console.warn('No method available to change audio input device');
      }
    } catch (err) {
      console.error('Error changing audio input device:', err);
      setError('Failed to change audio input device. Please check browser permissions.');
    }
  };
  
  // Function to test microphone input
  const testMicrophoneInput = async () => {
    setMicTestInProgress(true);
    setMicAudioLevel(0);
    
    let micStream = null;
    let audioContext = null;
    let analyzer = null;
    let dataArray = null;
    let updateInterval = null;
    
    try {
      // Request access to the microphone
      const constraints = { audio: true };
      if (selectedAudioInputDevice) {
        constraints.audio = { deviceId: { exact: selectedAudioInputDevice } };
      }
      
      micStream = await navigator.mediaDevices.getUserMedia(constraints);
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(micStream);
      analyzer = audioContext.createAnalyser();
      analyzer.fftSize = 256;
      source.connect(analyzer);
      
      // Create an array to store audio data
      const bufferLength = analyzer.frequencyBinCount;
      dataArray = new Uint8Array(bufferLength);
      
      // Update the audio level visualization every 100ms
      updateInterval = setInterval(() => {
        if (analyzer) {
          analyzer.getByteFrequencyData(dataArray);
          // Calculate average volume level
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          // Scale from 0-255 to 0-100
          const level = Math.min(100, Math.round((avg / 255) * 100));
          setMicAudioLevel(level);
        }
      }, 100);
      
      // Continue mic test for 5 seconds
      setTimeout(() => {
        // Clean up
        clearInterval(updateInterval);
        if (micStream) {
          micStream.getTracks().forEach(track => track.stop());
        }
        if (audioContext) {
          audioContext.close();
        }
        setMicTestInProgress(false);
        setMicAudioLevel(0);
      }, 5000);
      
      console.log('Microphone test started');
    } catch (err) {
      console.error('Error testing microphone input:', err);
      // Clean up
      if (updateInterval) {
        clearInterval(updateInterval);
      }
      if (micStream) {
        micStream.getTracks().forEach(track => track.stop());
      }
      if (audioContext) {
        audioContext.close();
      }
      setMicTestInProgress(false);
      setMicAudioLevel(0);
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
      
      // Explicitly handle audio
      try {
        console.log('Ensuring audio is properly configured');
        
        // Make sure audio is not muted at the source
        if (typeof session.audioVideo.realtimeUnmuteLocalAudio === 'function') {
          await session.audioVideo.realtimeUnmuteLocalAudio();
          console.log('Explicitly unmuted local audio');
        }
        
        // Try to bind audio to the remote video element
        if (remoteVideoRef.current && typeof session.audioVideo.bindAudioElement === 'function') {
          await session.audioVideo.bindAudioElement(remoteVideoRef.current);
          console.log('Explicitly bound audio element during join');
          
          // Force unmute and set volume
          remoteVideoRef.current.muted = false;
          remoteVideoRef.current.volume = 1.0;
        }
        
        // Check if we can get the meeting audio stream
        if (typeof session.audioVideo.getCurrentMeetingAudioStream === 'function') {
          try {
            const audioStream = await session.audioVideo.getCurrentMeetingAudioStream();
            if (audioStream) {
              console.log('Got meeting audio stream during join');
              
              // Check if we already have a srcObject on the remote video
              if (remoteVideoRef.current && !remoteVideoRef.current.srcObject) {
                remoteVideoRef.current.srcObject = audioStream;
                console.log('Set meeting audio stream as srcObject for remote video during join');
                
                // Try to play
                remoteVideoRef.current.play()
                  .then(() => console.log('Started playback with audio stream during join'))
                  .catch(playErr => console.warn('Could not auto-play with audio stream during join:', playErr));
              }
            } else {
              console.log('No audio stream available during join');
            }
          } catch (audioStreamErr) {
            console.warn('Error getting audio stream during join:', audioStreamErr);
          }
        }
      } catch (audioErr) {
        console.error('Error setting up audio during join:', audioErr);
        console.log('Continuing with limited audio functionality');
      }
      
      // Handle presence events with error handling
      try {
        console.log('Setting up attendee presence subscription');
        session.audioVideo.realtimeSubscribeToAttendeeIdPresence((attendeeId, present) => {
          console.log(`Attendee ${attendeeId} presence: ${present}`);
          
          // When a new attendee joins, check and refresh audio
          if (present) {
            console.log('New attendee joined, checking audio setup');
            setTimeout(() => {
              // This is a trigger to check audio setup when someone joins
              if (typeof checkAndFixMissingSrcObject === 'function') {
                checkAndFixMissingSrcObject();
              }
            }, 1000);
          }
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
          
          <div 
            className="video-box local"
            onMouseDown={(e) => {
              // Make video draggable when holding mouse button
              const videoBox = e.currentTarget;
              
              // Track initial position
              const initialX = e.clientX;
              const initialY = e.clientY;
              const initialStyle = window.getComputedStyle(videoBox);
              const initialRight = parseInt(initialStyle.right);
              const initialBottom = parseInt(initialStyle.bottom);
              
              // Function to handle mouse movement
              const handleMouseMove = (moveEvent) => {
                // Calculate new position
                const deltaX = initialX - moveEvent.clientX;
                const deltaY = moveEvent.clientY - initialY;
                
                // Update position
                videoBox.style.right = `${initialRight + deltaX}px`;
                videoBox.style.bottom = `${initialBottom + deltaY}px`;
              };
              
              // Function to cleanup drag operations
              const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
              };
              
              // Add event listeners
              document.addEventListener('mousemove', handleMouseMove);
              document.addEventListener('mouseup', handleMouseUp);
            }}
          >
            <video 
              ref={localVideoRef} 
              autoPlay 
              playsInline 
              muted 
              className="local-video"
            />
            <div className="video-label">You</div>
            <div className="drag-handle" title="Drag to reposition">⋮⋮</div>
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
              {/* Speaker Settings */}
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
              
              {/* Microphone Settings */}
              <div className="settings-section">
                <h4>Microphone Selection</h4>
                <p className="settings-description">
                  If others can't hear you, try selecting a different microphone.
                </p>
                
                <select 
                  value={selectedAudioInputDevice}
                  onChange={(e) => changeAudioInputDevice(e.target.value)}
                  className="device-select"
                >
                  {audioInputDevices.map((device, index) => (
                    <option key={index} value={device.deviceId}>
                      {device.label || `Microphone ${index + 1}`}
                    </option>
                  ))}
                </select>
                
                <button 
                  className="audio-test-btn"
                  onClick={testMicrophoneInput}
                  disabled={micTestInProgress}
                >
                  {micTestInProgress ? 'Testing...' : 'Test Microphone'}
                </button>
                
                {/* Microphone level visualization */}
                {micTestInProgress && (
                  <div className="mic-level-container">
                    <div className="mic-level-label">Microphone Level:</div>
                    <div className="mic-level-bar-container">
                      <div 
                        className="mic-level-bar" 
                        style={{width: `${micAudioLevel}%`}}
                      ></div>
                    </div>
                    <div className="mic-level-text">Speak into your microphone...</div>
                  </div>
                )}
              </div>
              
              <div className="troubleshooting-section">
                <h4>Audio Troubleshooting</h4>
                <ul className="troubleshooting-tips">
                  <li>Make sure your speakers/headphones and microphone are connected.</li>
                  <li>Check that your devices are not muted or volumes are not too low.</li>
                  <li>Try refreshing the page if audio issues persist.</li>
                  <li>Check your browser permissions for microphone access.</li>
                  <li>If using headphones or external mic, try unplugging and reconnecting them.</li>
                </ul>
              </div>
              
              <div className="browser-support-note">
                {(() => {
                  const support = checkAudioOutputSupport();
                  const { browser } = support;
                  
                  // Browser-specific guidance
                  if (browser.isSafari) {
                    return (
                      <>
                        <p>
                          <strong>Safari Browser Detected:</strong> Safari does not currently support changing audio output devices through browser APIs.
                        </p>
                        <p className="browser-fallback-tip">
                          To change your audio output, please use your macOS system settings or select a different browser.
                        </p>
                      </>
                    );
                  } else if (browser.isIOS) {
                    return (
                      <>
                        <p>
                          <strong>iOS Device Detected:</strong> iOS does not allow changing audio output devices through the browser.
                        </p>
                        <p className="browser-fallback-tip">
                          Audio will play through your currently active system output (e.g., speaker, AirPods, or other connected device).
                        </p>
                      </>
                    );
                  } else if (!support.supported) {
                    return (
                      <>
                        <p>
                          <strong>Limited Support Detected:</strong> Your browser ({browser.name} {browser.version}) may not fully support changing audio output devices.
                        </p>
                        <p className="browser-fallback-tip">
                          For best results, we recommend using the latest version of Chrome, Edge, or Firefox. If you need to use your current browser,
                          you can manually change your audio output in your system settings.
                        </p>
                      </>
                    );
                  } else if (browser.isChrome || browser.isEdge) {
                    return (
                      <p>
                        <strong>Compatible Browser Detected:</strong> Your browser fully supports audio device selection. If you encounter issues, please ensure your browser permissions are set correctly.
                      </p>
                    );
                  } else if (browser.isFirefox) {
                    return (
                      <>
                        <p>
                          <strong>Firefox Browser Detected:</strong> Firefox has limited support for changing audio output devices.
                        </p>
                        <p className="browser-fallback-tip">
                          If you encounter issues, try setting your preferred audio output device in your system settings before joining the session.
                        </p>
                      </>
                    );
                  } else {
                    return (
                      <p>
                        <strong>Note:</strong> Audio device selection compatibility varies by browser. For best results, we recommend using Chrome or Edge.
                      </p>
                    );
                  }
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VirtualSession;