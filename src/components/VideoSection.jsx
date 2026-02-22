import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare, AlertOctagon, VideoOff, MicOff } from 'lucide-react';
import { io } from 'socket.io-client';
import SimplePeer from 'simple-peer';
import './VideoSection.css';

const SIGNALING_URL = import.meta.env.VITE_SIGNALING_SERVER_URL || 'http://localhost:3001';

const VideoSection = ({ currentUserName, opponentName, roomId }) => {
    const displayOpponentName = opponentName || 'Random Opponent';
    const displayUserName = currentUserName ? `${currentUserName} (You)` : 'You';

    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const peerRef = useRef(null);
    const socketRef = useRef(null);
    const localStreamRef = useRef(null);

    const [cameraReady, setCameraReady] = useState(false);
    const [remoteReady, setRemoteReady] = useState(false);
    const [cameraError, setCameraError] = useState(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);

    useEffect(() => {
        let didCancel = false;

        const startCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                if (didCancel) { stream.getTracks().forEach(t => t.stop()); return; }
                localStreamRef.current = stream;
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                    localVideoRef.current.play().catch(() => { });
                }
                setCameraReady(true);

                // Only connect to signaling server if we have a roomId
                if (roomId) {
                    connectToSignaling(stream);
                }
            } catch (err) {
                if (!didCancel) {
                    setCameraError(err.name === 'NotAllowedError'
                        ? 'Camera permission denied'
                        : 'Camera not available');
                }
            }
        };

        startCamera();

        return () => {
            didCancel = true;
            // Cleanup: stop camera, disconnect socket, destroy peer
            localStreamRef.current?.getTracks().forEach(t => t.stop());
            peerRef.current?.destroy();
            socketRef.current?.disconnect();
        };
    }, [roomId]);

    // Ensure video element receives the stream after it is rendered
    useEffect(() => {
        if (cameraReady && localStreamRef.current && localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
            // Attempt to play the video; ignore autoplay errors
            localVideoRef.current.play().catch(() => { });
        }
    }, [cameraReady]);

    const connectToSignaling = (stream) => {
        const socket = io(SIGNALING_URL, { transports: ['websocket'] });
        socketRef.current = socket;

        socket.on('connect', () => {
            socket.emit('join-room', roomId);
        });

        // Server tells us who initiates
        socket.on('initiate-call', ({ initiator }) => {
            const peer = new SimplePeer({
                initiator,
                stream,
                trickle: true,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' },
                    ],
                },
            });

            peer.on('signal', (signal) => {
                socket.emit('signal', { roomId, signal });
            });

            peer.on('stream', (remoteStream) => {
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = remoteStream;
                }
                setRemoteReady(true);
            });

            peer.on('error', (err) => console.error('Peer error:', err));
            peer.on('close', () => setRemoteReady(false));

            peerRef.current = peer;
        });

        // Relay incoming signal to our peer
        socket.on('signal', ({ signal }) => {
            peerRef.current?.signal(signal);
        });

        socket.on('peer-disconnected', () => setRemoteReady(false));
    };

    const toggleMute = () => {
        const audioTrack = localStreamRef.current?.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            setIsMuted(!audioTrack.enabled);
        }
    };

    const toggleCamera = () => {
        const videoTrack = localStreamRef.current?.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            setIsCameraOff(!videoTrack.enabled);
        }
    };

    return (
        <div className="video-section">
            {/* Local video */}
            <div className="video-container local-video">
                {cameraReady && !isCameraOff ? (
                    <video
                        ref={localVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className="live-video-feed"
                    />
                ) : (
                    <div className="video-placeholder user-a">
                        <div className="neon-mask mask-green">
                            <div className="eyes">
                                <div className="eye">{isCameraOff ? '—' : 'x'}</div>
                                <div className="eye">{isCameraOff ? '—' : 'x'}</div>
                            </div>
                            <div className="mouth"><div className="teeth">|||||</div></div>
                        </div>
                        {cameraError && <p className="camera-error">{cameraError}</p>}
                    </div>
                )}
                <div className="video-controls">
                    <span className="player-label" style={{ color: 'var(--text-primary)' }}>{displayUserName}</span>
                    <div className="action-buttons">
                        <button className={`action-btn ${isMuted ? 'danger' : ''}`} onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
                            <MicOff size={16} />
                        </button>
                        <button className={`action-btn ${isCameraOff ? 'danger' : ''}`} onClick={toggleCamera} title={isCameraOff ? 'Turn on camera' : 'Turn off camera'}>
                            <VideoOff size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Remote video */}
            <div className="video-container remote-video">
                {remoteReady ? (
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className="live-video-feed"
                    />
                ) : (
                    <div className="video-placeholder user-b">
                        <div className="neon-mask mask-purple">
                            <div className="eyes">
                                <div className="eye">*</div>
                                <div className="eye">*</div>
                            </div>
                            <div className="mouth"><div className="teeth">-----</div></div>
                        </div>
                        {roomId && !remoteReady && (
                            <p className="camera-error" style={{ color: 'var(--text-secondary)' }}>
                                Waiting for opponent...
                            </p>
                        )}
                    </div>
                )}
                <div className="video-controls">
                    <span className="player-label" style={{ color: 'var(--accent-red)' }}>{displayOpponentName}</span>
                    <div className="action-buttons">
                        <button className="action-btn" title="Send message">
                            <MessageSquare size={16} />
                        </button>
                        <button className="action-btn danger" title="Report player">
                            <AlertOctagon size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VideoSection;
