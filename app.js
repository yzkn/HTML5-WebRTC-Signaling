// Copyright (c) 2022 YA-androidapp(https://github.com/YA-androidapp) All rights reserved.


let dataChannel;
let dataChannelOptions = { ordered: false };
let peerConnection;
let peerConnectionConfig = { 'iceServers': [{ "urls": "stun:stun.l.google.com:19302" }] };


window.addEventListener('DOMContentLoaded', function () {
    document.getElementById('connect').addEventListener('click', () => {
        connect();
    });

    document.getElementById('send').addEventListener('click', () => {
        sendMessage();
    });

    document.getElementById('set').addEventListener('click', () => {
        setRemoteSdp();
    });
});


function createPeerConnection() {
    let pc = new RTCPeerConnection(peerConnectionConfig);
    pc.onicecandidate = function (evt) {
        if (!evt.candidate) {
            document.getElementById('localSDP').value = pc.localDescription.sdp;
        }
    };

    pc.onconnectionstatechange = function (evt) {
        switch (pc.connectionState) {
            case "connected":
                document.getElementById('name').disabled = true;
                document.getElementById('localSDP').disabled = true;
                document.getElementById('remoteSDP').disabled = true;

                document.getElementById('status').value = 'connected';
                break;
            case "disconnected":
            case "failed":
                document.getElementById('status').value = 'disconnected';
                break;
            case "closed":
                document.getElementById('status').value = 'closed';
                break;
        }
    };

    pc.ondatachannel = function (evt) {
        setupDataChannel(evt.channel);
        dataChannel = evt.channel;
    };

    return pc;
}

function connect() {
    peerConnection = createPeerConnection();
    dataChannel = peerConnection.createDataChannel('test-data-channel', dataChannelOptions);
    setupDataChannel(dataChannel);

    peerConnection.createOffer().then(function (sessionDescription) {
        return peerConnection.setLocalDescription(sessionDescription);
    }).then(function () {
    }).catch(function (err) {
        console.error(err);
    });

    document.getElementById('status').value = 'offer created';
}

function setupDataChannel(dc) {
    dc.onclose = function (evt) {
        console.log(evt);
    };
    dc.onerror = function (err) {
        console.error(err);
    };
    dc.onmessage = function (evt) {
        console.log(evt);
        let obj = JSON.parse(evt.data);
        document.getElementById('history').value = obj['name'] + '> ' + obj['message'] + '\n' + document.getElementById('history').value;
    };
    dc.onopen = function (evt) {
        console.log(evt);
    };
}

function setRemoteSdp() {
    let remoteSDP = document.getElementById('remoteSDP').value;

    if (peerConnection) {
        let answer = new RTCSessionDescription({
            type: 'answer',
            sdp: remoteSDP,
        });
        peerConnection.setRemoteDescription(answer).then(function () {
            console.log('setRemoteDescription() succeeded.');
        }).catch(function (err) {
            console.error('setRemoteDescription() failed.', err);
        });
    } else {
        let offer = new RTCSessionDescription({
            type: 'offer',
            sdp: remoteSDP,
        });
        peerConnection = createPeerConnection();
        peerConnection.setRemoteDescription(offer).then(function () {
        }).catch(function (err) {
            console.error(err);
        });
        peerConnection.createAnswer().then(function (sessionDescription) {
            return peerConnection.setLocalDescription(sessionDescription);
        }).then(function () {
        }).catch(function (err) {
            console.error(err);
        });
        document.getElementById('status').value = 'answer created';
    }
}

function sendMessage() {
    if (peerConnection && peerConnection.connectionState == 'connected') {
        let msg = document.getElementById('message').value;
        let name = document.getElementById('name').value;
        document.getElementById('history').value = 'me> ' + msg + '\n' + document.getElementById('history').value;
        document.getElementById('message').value = '';

        dataChannel.send(JSON.stringify({
            "name": name,
            "message": msg,
            "timestamp": new Date()
        }));
    }
}
