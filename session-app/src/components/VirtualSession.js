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
      const audioInputDevices = await session.audioVideo.listAudioInputDevices();
      const videoInputDevices = await session.audioVideo.listVideoInputDevices();
      
      if (audioInputDevices.length > 0) {
        await session.audioVideo.chooseAudioInputDevice(audioInputDevices[0].deviceId);
      }
      
      if (videoInputDevices.length > 0) {
        await session.audioVideo.chooseVideoInputDevice(videoInputDevices[0].deviceId);
      }
    } catch (err) {
      console.error('Error selecting media devices:', err);
      throw err;
    }
  };
  
  const joinWithAudioVideo = async (session) => {
    try {
      // Start local video
      await session.audioVideo.startLocalVideoTile();
      
      // Start audio
      session.audioVideo.realtimeSubscribeToAttendeeIdPresence((attendeeId, present) => {
        console.log(`Attendee ${attendeeId} presence: ${present}`);
      });
    } catch (err) {
      console.error('Error joining with audio/video:', err);
      setError('Failed to start audio/video. Please check your device permissions.');
    }
  };
  
  const toggleMute = () => {
    if (!meetingSession) return;
    
    try {
      if (isMuted) {
        // Unmute
        meetingSession.audioVideo.realtimeUnmuteLocalAudio();
      } else {
        // Mute
        meetingSession.audioVideo.realtimeMuteLocalAudio();
      }
      
      // Update state based on actual mute state
      const muted = meetingSession.audioVideo.realtimeIsLocalAudioMuted();
      setIsMuted(muted);
    } catch (err) {
      console.error("Error toggling mute:", err);
    }
  };
  
  const toggleVideo = async () => {
    if (!meetingSession) return;
    
    try {
      if (isVideoOff) {
        // Turn video on
        await meetingSession.audioVideo.startLocalVideoTile();
        setIsVideoOff(false);
      } else {
        // Turn video off
        meetingSession.audioVideo.stopLocalVideoTile();
        setIsVideoOff(true);
      }
    } catch (err) {
      console.error("Error toggling video:", err);
    }
  };
  
  const startScreenShare = async () => {
    if (!meetingSession) return;
    
    try {
      // Stop any existing screen share
      if (isScreenSharing) {
        await stopScreenShare();
      }
      
      // Start screen sharing
      await meetingSession.audioVideo.startContentShare();
      setIsScreenSharing(true);
      
      // Handle screen share events
      meetingSession.audioVideo.addContentShareObserver({
        contentShareDidStop: () => {
          console.log('Content share stopped');
          setIsScreenSharing(false);
        }
      });
    } catch (err) {
      console.error("Error starting screen share:", err);
      setError("Failed to start screen sharing. Please try again.");
    }
  };
  
  const stopScreenShare = async () => {
    if (!meetingSession) return;
    
    try {
      await meetingSession.audioVideo.stopContentShare();
      setIsScreenSharing(false);
    } catch (err) {
      console.error("Error stopping screen share:", err);
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
      
      <div className="video-container">
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
      
      <div className="session-sidebar">
        <div className="notes-section">
          <h3>Session Notes</h3>
          
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
        
        <div className="files-section">
          <h3>Shared Files</h3>
          
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
      </div>
    </div>
  );
};

export default VirtualSession;