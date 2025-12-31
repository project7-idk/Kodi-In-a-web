const video = document.getElementById('video');
const playBtn = document.getElementById('playBtn');
const m3uInput = document.getElementById('m3uInput');

playBtn.addEventListener('click', async () => {
    const lines = m3uInput.value.split('\n').map(l => l.trim()).filter(l => l);
    let url = '';
    let keyId = '';
    let key = '';

    // Parse the M3U snippet
    lines.forEach(line => {
        if(line.startsWith('https://') || line.startsWith('http://')) url = line;
        if(line.startsWith('#KODIPROP:inputstream.adaptive.license_key=')) {
            const parts = line.split('=')[1].split(':');
            keyId = parts[0];
            key = parts[1];
        }
    });

    if(!url || !key || !keyId) {
        alert('Invalid input! Make sure URL and KODIPROP are present.');
        return;
    }

    if(!window.MediaKeys) {
        alert('Your browser does not support DRM (EME). Use Chrome/Edge/Firefox.');
        return;
    }

    try {
        // Create MediaKeySession for ClearKey
        const mediaKeys = await navigator.requestMediaKeySystemAccess('org.w3.clearkey', [{
            initDataTypes: ['keyids'],
            videoCapabilities: [{ contentType: 'video/mp4; codecs="avc1.42E01E"' }]
        }]).then(keySystemAccess => keySystemAccess.createMediaKeys());

        await video.setMediaKeys(mediaKeys);

        const session = mediaKeys.createSession();
        session.addEventListener('message', async (event) => {
            // ClearKey expects a JSON license
            const jwk = {
                keys: [{
                    kty: "oct",
                    alg: "A128KW",
                    kid: btoa(keyId).replace(/=/g,''),
                    k: btoa(key).replace(/=/g,'')
                }]
            };
            await session.update(new TextEncoder().encode(JSON.stringify(jwk)));
        });

        // Fetch MPD initData for ClearKey
        const initResponse = await fetch(url);
        const initData = new Uint8Array(await initResponse.arrayBuffer());

        await session.generateRequest('keyids', initData);

        video.src = url;
        video.play();
    } catch (e) {
        console.error(e);
        alert('DRM setup failed. Check console for details.');
    }
});
