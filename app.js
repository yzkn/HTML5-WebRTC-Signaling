// Copyright (c) 2025 YA-androidapp(https://github.com/YA-androidapp) All rights reserved.


let dataChannel;
let dataChannelOptions = { ordered: false };
let peerConnection;
let peerConnectionConfig = { 'iceServers': [{ "urls": "stun:stun.l.google.com:19302" }] };
let timestampStart;


window.addEventListener('DOMContentLoaded', function () {
    document.getElementById('send').addEventListener('click', () => {
        sendMessage();
    });

    document.getElementById('set').addEventListener('click', () => {
        setRemoteSdp();
    });

    document.getElementById('transfer').addEventListener('click', () => {
        sendData();
    });

    document.getElementById('name').value = generateName();

    var html5QrcodeScanner = new Html5QrcodeScanner("remoteSDPReader", { fps: 10, qrbox: 250 });
    html5QrcodeScanner.render(
        (decodedText, decodedResult) => {
            console.log(`Scan result: ${decodedText}`, decodedResult);
            document.getElementById('remoteSDP').value = decodedText;
            html5QrcodeScanner.clear();
        },
        (errorMessage) => {
            console.error(`Scan result: ${errorMessage}`);
        }
    );

    const params = new URLSearchParams(window.location.search);
    if (params.size == 0) {
        connect();
    } else {
        if (params.has('sdp')) {
            const remoteSDP = params.get('sdp');
            document.getElementById('remoteSDP').value = decodeURIComponent(remoteSDP);

            setRemoteSdp();
        }
    }
});


function createPeerConnection() {
    let pc = new RTCPeerConnection(peerConnectionConfig);
    pc.onicecandidate = function (evt) {
        if (!evt.candidate) {
            const localSDP = pc.localDescription.sdp;
            const localSDPUrl = location.href.split('?')[0] + '?sdp=' + encodeURIComponent(localSDP);
            console.log({ localSDP });
            console.log({ localSDPUrl });

            document.getElementById('localSDP').value = localSDP;

            new QRCode(document.getElementById("localSDPUrlQrcode"), {
                text: document.getElementById('remoteSDP').value === '' ? localSDPUrl : localSDP,
                width: 360,
                height: 360,
                correctLevel: QRCode.CorrectLevel.Q
            });
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

let receivedFileName = null;
let receivedFileSize = null;
let receiveBuffer = [];
let receivedSize = 0;

function receiveFile(event) {
    const downloadAnchor = document.querySelector('a#download');
    const receiveProgress = document.querySelector('progress#receiveProgress');

    console.log(`Received Message ${event.data.size ?? 0}`, receivedFileName, receivedFileSize);
    receiveBuffer.push(event.data);
    receivedSize += (event.data.size ?? 0);
    receiveProgress.value = receivedSize;

    if (receivedSize === receivedFileSize) {
        console.log(receivedSize, '===', receivedFileSize);
        const received = new Blob(receiveBuffer);

        downloadAnchor.href = URL.createObjectURL(received);
        downloadAnchor.download = receivedFileName;
        downloadAnchor.textContent =
            `Click to download '${receivedFileName}' (${receivedSize} bytes)`;
        downloadAnchor.style.display = 'block';

        receiveBuffer = [];
        receivedFileName = null;
        receivedFileSize = null;
        receivedSize = 0;
    }
}

function setupDataChannel(dc) {
    dc.onclose = function (evt) {
        console.log(evt);
    };
    dc.onerror = function (err) {
        console.error(err);
    };
    dc.onmessage = function (evt) {
        console.log({ evt });

        try {
            let obj = JSON.parse(evt.data);
            if ('filename' in obj) {
                receivedFileName = obj['filename'];
                receivedFileSize = obj['filesize'];
                document.getElementById('history').value = '> ' + `Receiving... '${receivedFileName}' (${receivedFileSize} bytes)` + '\n' + document.getElementById('history').value;
            } else if ('name' in obj && 'message' in obj) {
                document.getElementById('history').value = obj['name'] + '> ' + obj['message'] + '\n' + document.getElementById('history').value;
            }

            return;
        } catch (error) {
        }

        if (!timestampStart) {
            timestampStart = (new Date()).getTime();
        }
        receiveFile(evt, receivedFileName, receivedFileSize);
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

function generateName() {
    // const CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const LENGTH = 4;
    return Array.from(Array(LENGTH)).map(() => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
}

function sendData() {
    const chunkSize = 16384;
    const fileInput = document.querySelector('input#fileInput');
    const sendProgress = document.querySelector('progress#sendProgress');

    const file = fileInput.files[0];
    console.log(`File is ${[file.name, file.size, file.type, file.lastModified].join(' ')}`);

    // Handle 0 size files.
    if (file.size === 0) {
        document.getElementById('history').value = '> File is empty\n' + document.getElementById('history').value;
        return;
    }

    dataChannel.send(JSON.stringify({
        "filename": file.name,
        "filesize": file.size,
        "timestamp": new Date()
    }));

    sendProgress.max = file.size;
    fileReader = new FileReader();
    let offset = 0;
    fileReader.addEventListener('error', error => console.error('Error reading file:', error));
    fileReader.addEventListener('abort', event => console.log('File reading aborted:', event));
    fileReader.addEventListener('load', e => {
        console.log('FileRead.onload ', e);

        dataChannel.send(e.target.result);
        offset += e.target.result.byteLength;
        sendProgress.value = offset;
        if (offset < file.size) {
            readSlice(offset);
        }
    });
    const readSlice = o => {
        console.log('readSlice ', o);
        const slice = file.slice(offset, o + chunkSize);
        fileReader.readAsArrayBuffer(slice);
    };
    readSlice(0);
}