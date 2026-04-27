let mediaRecorder = null;
let mediaStream = null;
let audioChunks = [];

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read audio blob."));
    reader.readAsDataURL(blob);
  });
}

async function startRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') return;

  mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  audioChunks = [];
  mediaRecorder = new MediaRecorder(mediaStream, { mimeType: 'audio/webm' });
  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) audioChunks.push(event.data);
  };
  mediaRecorder.start(200);
}

async function stopRecording() {
  if (!mediaRecorder || mediaRecorder.state !== 'recording') {
    return new Blob([], { type: 'audio/webm' });
  }

  return new Promise((resolve, reject) => {
    mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      mediaStream?.getTracks()?.forEach(track => track.stop());
      mediaRecorder = null;
      mediaStream = null;
      audioChunks = [];
      resolve(blob);
    };
    mediaRecorder.onerror = () => {
      reject(new Error("MediaRecorder failed while stopping."));
    };
    mediaRecorder.stop();
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.target !== 'offscreen') return;

  if (message.action === 'OFFSCREEN_START_RECORDING') {
    startRecording()
      .then(() => sendResponse({ ok: true }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.action === 'OFFSCREEN_STOP_RECORDING') {
    stopRecording()
      .then(blobToDataUrl)
      .then((dataUrl) => {
        chrome.runtime.sendMessage({
          action: 'RECORDING_DONE',
          audioBase64: dataUrl,
          mimeType: 'audio/webm'
        });
        sendResponse({ ok: true });
      })
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
});
