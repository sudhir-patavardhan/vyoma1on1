import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "react-oidc-context";
import axios from "axios";
import "../styles.css";

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
  
  // WebRTC related state
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [peerConnection, setPeerConnection] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  
  // WebRTC configuration
  const configuration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  };
  
  // Refs for video elements
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const screenShareStreamRef = useRef(null);
  
  useEffect(() => {
    // Fetch session details
    const fetchSession = async () => {
      try {
        setLoading(true);
        const response = await axios.get(
          `https://15fvg1d1mg.execute-api.us-east-1.amazonaws.com/prod/sessions/${sessionId}`,
          {
            headers: {
              Authorization: `Bearer ${auth.user.access_token}`,
            },
          }
        );
        
        setSession(response.data);
        
        // Extract notes and shared files from session data
        if (response.data.notes && Array.isArray(response.data.notes)) {
          setNotes(response.data.notes);
        }
        
        if (response.data.shared_documents && Array.isArray(response.data.shared_documents)) {
          setSharedFiles(response.data.shared_documents);
        }
      } catch (err) {
        console.error("Error fetching session details:", err);
        setError("Failed to load session details. Please refresh the page.");
      } finally {
        setLoading(false);
      }
    };
    
    fetchSession();
    
    // Initialize WebRTC
    setupWebRTC();
    
    // Cleanup on component unmount
    return () => {
      // Close peer connection and release media streams
      if (peerConnection) {
        peerConnection.close();
      }
      
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      
      if (screenShareStreamRef.current) {
        screenShareStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [sessionId, auth.user.access_token]);
  
  const setupWebRTC = async () => {
    try {
      // Create a new RTCPeerConnection
      const pc = new RTCPeerConnection(configuration);
      setPeerConnection(pc);
      
      // Request media stream from user's camera and microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      
      setLocalStream(stream);
      
      // Display local stream in video element
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      // Add local stream tracks to peer connection
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });
      
      // Create a new MediaStream for remote tracks
      const newRemoteStream = new MediaStream();
      setRemoteStream(newRemoteStream);
      
      // Display remote stream in video element
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = newRemoteStream;
      }
      
      // Handle incoming tracks from remote peer
      pc.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
          newRemoteStream.addTrack(track);
        });
      };
      
      // Handle ICE candidates
      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          // In a real implementation, you would send this candidate to the signaling server
          // which would relay it to the other peer
          console.log("New ICE candidate:", event.candidate);
        }
      };
      
      // Log state changes
      pc.oniceconnectionstatechange = () => {
        console.log("ICE connection state:", pc.iceConnectionState);
      };
      
      pc.onsignalingstatechange = () => {
        console.log("Signaling state:", pc.signalingState);
      };
      
      // In a real implementation, you would establish the connection with the remote peer
      // by exchanging SDP offers and answers through a signaling server
    } catch (err) {
      console.error("Error setting up WebRTC:", err);
      setError("Failed to access camera or microphone. Please check your device permissions.");
    }
  };
  
  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };
  
  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };
  
  const startScreenShare = async () => {
    try {
      // Request screen sharing stream
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      
      screenShareStreamRef.current = screenStream;
      
      // Replace video track with screen sharing track
      if (peerConnection) {
        const videoTrack = screenStream.getVideoTracks()[0];
        
        // Find the sender that's currently sending video
        const senders = peerConnection.getSenders();
        const videoSender = senders.find((sender) => 
          sender.track && sender.track.kind === 'video'
        );
        
        if (videoSender) {
          videoSender.replaceTrack(videoTrack);
        }
        
        // Show screen share in local video
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }
        
        setIsScreenSharing(true);
        
        // Listen for end of screen sharing
        videoTrack.onended = () => {
          stopScreenShare();
        };
      }
    } catch (err) {
      console.error("Error starting screen share:", err);
      setError("Failed to start screen sharing. Please try again.");
    }
  };
  
  const stopScreenShare = () => {
    try {
      // Stop screen share tracks
      if (screenShareStreamRef.current) {
        screenShareStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      
      // Replace with original video track
      if (peerConnection && localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        
        // Find the video sender
        const senders = peerConnection.getSenders();
        const videoSender = senders.find((sender) => 
          sender.track && sender.track.kind === 'video'
        );
        
        if (videoSender && videoTrack) {
          videoSender.replaceTrack(videoTrack);
        }
        
        // Show camera video in local video again
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
        }
      }
      
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
        `https://15fvg1d1mg.execute-api.us-east-1.amazonaws.com/prod/sessions/${sessionId}`,
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
        `https://15fvg1d1mg.execute-api.us-east-1.amazonaws.com/prod/sessions/${sessionId}`,
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
      // Update session status to ended
      await axios.put(
        `https://15fvg1d1mg.execute-api.us-east-1.amazonaws.com/prod/sessions/${sessionId}`,
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
      
      // Close connections and stop streams
      if (peerConnection) {
        peerConnection.close();
      }
      
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      
      if (screenShareStreamRef.current) {
        screenShareStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      
      // Call the parent component's callback
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