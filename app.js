// Copyright (c) 2025 YA-androidapp(https://github.com/YA-androidapp) All rights reserved.


let dataChannel;
let dataChannelOptions = { ordered: false };
let peerConnection;
let peerConnectionConfig = { 'iceServers': [{ "urls": "stun:stun.l.google.com:19302" }] };
let timestampStart;


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
});


function createPeerConnection() {
    let pc = new RTCPeerConnection(peerConnectionConfig);
    pc.onicecandidate = function (evt) {
        if (!evt.candidate) {
            document.getElementById('localSDP').value = pc.localDescription.sdp;

            new QRCode(document.getElementById("localSDPQrcode"), {
                text: pc.localDescription.sdp,
                width: 128,
                height: 128,
                correctLevel: QRCode.CorrectLevel.H
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

function receiveFile(event) {
    const downloadAnchor = document.querySelector('a#download');
    const receiveProgress = document.querySelector('progress#receiveProgress');

    let receiveBuffer = [];
    let receivedSize = 0;

    console.log(`Received Message ${event.data.size}`);
    receiveBuffer.push(event.data);
    receivedSize += event.data.size;
    receiveProgress.value = receivedSize;

    if (receivedSize > 0) {
        const received = new Blob(receiveBuffer);
        receiveBuffer = [];

        const filename = 'received';

        downloadAnchor.href = URL.createObjectURL(received);
        downloadAnchor.download = filename;
        downloadAnchor.textContent =
            `Click to download '${filename}' (${receivedSize} bytes)`;
        downloadAnchor.style.display = 'block';

        const bitrate = Math.round(receivedSize * 8 /
            ((new Date()).getTime() - timestampStart));
        document.getElementById('history').value = '> ' + `<strong>Average Bitrate:</strong> ${bitrate} kbits/sec` + '\n' + document.getElementById('history').value;
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
        if ('name' in evt.data && 'message' in evt.data) {
            let obj = JSON.parse(evt.data);
            document.getElementById('history').value = obj['name'] + '> ' + obj['message'] + '\n' + document.getElementById('history').value;
        } else {
            if (!timestampStart) {
                timestampStart = (new Date()).getTime();
            }
            receiveFile(evt);
        }
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