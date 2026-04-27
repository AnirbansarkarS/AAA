document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(["userProfile"], (result) => {
    if (!result.userProfile) {
      chrome.tabs.create({ url: chrome.runtime.getURL("onboarding/onboarding.html") });
      return;
    }

    const profile = result.userProfile;
    const inputs = document.querySelectorAll('input[type="text"]');
    if (inputs.length >= 4) {
      inputs[1].value = profile.name || "";
      inputs[3].value = profile.goal || "";
    }

    const userName = document.querySelector(".user-name");
    if (userName) {
      userName.innerText = `[${profile.name || "User"}]`;
    }

    const chipName = document.getElementById("chip-name");
    const chipSkills = document.getElementById("chip-skills");
    if (chipName) chipName.innerText = profile.name || "Unknown User";
    if (chipSkills) {
      let skillStr = typeof profile.skills === 'string' ? profile.skills :
        (Array.isArray(profile.skills) ? profile.skills.join(" � ") : "");
      chipSkills.innerText = skillStr.replace(/,/g, " � ") || "No skills listed";
    }
  });

  // --- Document Dropzone Logic ---
  const docDropzone = document.getElementById("doc-dropzone");
  const fileUpload = document.getElementById("file-upload");
  const docActivity = document.getElementById("doc-activity");
  const docPreviewZone = document.getElementById("doc-preview-zone");
  const docPreviewContent = document.getElementById("doc-preview-content");
  const btnSaveVault = document.getElementById("btn-save-vault");

  let latestExtractedData = null;

  if (docDropzone && fileUpload) {
    docDropzone.addEventListener("click", () => fileUpload.click());

    docDropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      docDropzone.style.borderColor = "#a1f0a1";
    });
    docDropzone.addEventListener("dragleave", (e) => {
      e.preventDefault();
      docDropzone.style.borderColor = "#404040";
    });
    docDropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      docDropzone.style.borderColor = "#404040";
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        fileUpload.files = e.dataTransfer.files;
        handleFileSelection();
      }
    });

    fileUpload.addEventListener("change", handleFileSelection);

    function handleFileSelection() {
      if (!fileUpload.files || fileUpload.files.length === 0) return;
      const file = fileUpload.files[0];

      docActivity.style.display = "flex";
      docActivity.innerHTML = "<div class='activity-step'>? Reading file: " + file.name + "...</div>";
      docPreviewZone.style.display = "none";
      if (btnSaveVault) {
        btnSaveVault.innerText = "SAVE TO VAULT ??";
        btnSaveVault.disabled = false;
        btnSaveVault.classList.remove("btn-orange");
        btnSaveVault.classList.add("btn-green");
      }

      const reader = new FileReader();
      reader.onload = function (e) {
        const fileDataUrl = e.target.result;

        setTimeout(() => {
          docActivity.innerHTML += "<div class='activity-step'>? Sending to Vision Agent for extraction...</div>";
          docActivity.scrollTop = docActivity.scrollHeight;
        }, 500);

        chrome.runtime.sendMessage({
          action: "EXTRACT_DOCUMENT",
          base64Data: fileDataUrl,
          mimeType: file.type,
          docType: 'unknown'
        }, (response) => {
          if (chrome.runtime.lastError || !response || !response.success) {
            docActivity.innerHTML += "<div class='activity-step' style='color:#ff6b6b;'>Error: " + (chrome.runtime.lastError ? chrome.runtime.lastError.message : (response ? response.error : 'Unknown')) + "</div>";
            return;
          }

          docActivity.innerHTML += "<div class='activity-step'><b>? Extraction Complete!</b></div>";
          if (response.vaultUpdated) {
            docActivity.innerHTML += "<div class='activity-step' style='color:#a1f0a1;'>? Auto-synced to Data Vault.</div>";
            if (btnSaveVault) {
              btnSaveVault.innerText = "SAVED TO VAULT ?";
              btnSaveVault.classList.remove("btn-green");
              btnSaveVault.classList.add("btn-orange");
              btnSaveVault.disabled = true;
            }
          } else if (response.warning) {
            docActivity.innerHTML += "<div class='activity-step' style='color:#ffd166;'>Warning: " + response.warning + "</div>";
          }
          docActivity.scrollTop = docActivity.scrollHeight;

          if (response.data && typeof response.data === "object") {
            latestExtractedData = response.data;
            if (docPreviewContent) docPreviewContent.innerText = JSON.stringify(latestExtractedData, null, 2);
          } else {
            try {
              latestExtractedData = JSON.parse(response.data);
              if (docPreviewContent) docPreviewContent.innerText = JSON.stringify(latestExtractedData, null, 2);
            } catch (err) {
              if (docPreviewContent) docPreviewContent.innerText = response.data;
              latestExtractedData = null;
            }
          }

          setTimeout(() => {
            docActivity.style.display = "none";
            if (docPreviewZone) docPreviewZone.style.display = "block";
          }, 1000);
        });
      };
      reader.readAsDataURL(file);
    }
  }

  if (btnSaveVault) {
    btnSaveVault.addEventListener("click", () => {
      if (latestExtractedData) {
        chrome.storage.local.get(["user_vault"], (res) => {
          let vault = res.user_vault || { schemaVersion: 1 };
          vault = Object.assign({}, vault, latestExtractedData);

          chrome.storage.local.set({ user_vault: vault }, () => {
            btnSaveVault.innerText = "SAVED TO VAULT ?";
            btnSaveVault.classList.remove("btn-green");
            btnSaveVault.classList.add("btn-orange");
            btnSaveVault.disabled = true;
          });
        });
      }
    });
  }
  // --- End Document Dropzone Logic ---

  const editProfileLink = document.getElementById("chip-edit");
  if (editProfileLink) {
    editProfileLink.addEventListener("click", (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: chrome.runtime.getURL("onboarding/onboarding.html") });
    });
  }

  // === Feature 1: LinkedIn Import ===
  const btnLinkedIn = document.getElementById("btn-import-linkedin");
  const btnGitHub = document.getElementById("btn-import-github");
  const importStatus = document.getElementById("import-status");

  function showImportStatus(msg, isError) {
    if (!importStatus) return;
    importStatus.style.display = "block";
    importStatus.className = "import-status" + (isError ? " error" : "");
    importStatus.innerText = msg;
    if (!isError) setTimeout(() => { importStatus.style.display = "none"; }, 4000);
  }

  if (btnLinkedIn) {
    btnLinkedIn.addEventListener("click", () => {
      btnLinkedIn.disabled = true;
      btnLinkedIn.innerText = "⏳ Opening LinkedIn...";
      showImportStatus("Opening your LinkedIn profile page...", false);

      chrome.runtime.sendMessage({ action: 'IMPORT_LINKEDIN' }, (res) => {
        if (chrome.runtime.lastError || !res?.success) {
          showImportStatus("❌ Failed to open LinkedIn: " + (chrome.runtime.lastError?.message || res?.error || "Unknown"), true);
          btnLinkedIn.disabled = false;
          btnLinkedIn.innerHTML = "<span>🔗</span> Import LinkedIn";
        }
      });
    });
  }

  // Listen for LinkedIn import completion from background
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'LINKEDIN_IMPORT_DONE') {
      showImportStatus("✅ LinkedIn imported successfully!", false);
      if (btnLinkedIn) {
        btnLinkedIn.innerHTML = "<span>✅</span> LinkedIn Imported";
        btnLinkedIn.disabled = false;
      }
      refreshProfileChip();
    }
  });

  // === Feature 1: GitHub Import ===
  if (btnGitHub) {
    btnGitHub.addEventListener("click", () => {
      const usernameInput = document.getElementById("github-username");
      const username = usernameInput?.value?.trim();
      if (!username) {
        showImportStatus("❌ Enter a GitHub username first", true);
        return;
      }

      btnGitHub.disabled = true;
      btnGitHub.innerHTML = "<span>⏳</span> Fetching...";
      showImportStatus("Fetching GitHub data for @" + username + "...", false);

      chrome.runtime.sendMessage({ action: 'FETCH_GITHUB', username }, (res) => {
        btnGitHub.disabled = false;
        if (chrome.runtime.lastError || !res?.success) {
          showImportStatus("❌ GitHub import failed: " + (chrome.runtime.lastError?.message || res?.error || "Unknown"), true);
          btnGitHub.innerHTML = "<span>🐙</span> Import";
          return;
        }

        const ghData = res.data;
        const repoNames = (ghData.projects || []).slice(0, 3).map(p => p.name).join(", ");
        showImportStatus(`✅ GitHub imported! ${ghData.publicRepos} repos. Top: ${repoNames}`, false);
        btnGitHub.innerHTML = "<span>✅</span> Done";
        refreshProfileChip();
      });
    });
  }

  // === Feature 2: Voice Input ===
  const voiceMicBtn = document.getElementById("voice-mic-btn");
  const voiceStatus = document.getElementById("voice-status");
  const voiceStatusText = document.getElementById("voice-status-text");
  const voiceStopBtn = document.getElementById("voice-stop-btn");
  const voicePreview = document.getElementById("voice-preview");
  const voiceTranscript = document.getElementById("voice-transcript");
  const voiceSaveBtn = document.getElementById("voice-save-btn");
  const voiceCancelBtn = document.getElementById("voice-cancel-btn");

  let mediaRecorder = null;
  let audioChunks = [];
  let speechRecognition = null;

  if (voiceMicBtn) {
    voiceMicBtn.addEventListener("click", async () => {
      if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        audioChunks = [];

        mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);

        mediaRecorder.onstop = async () => {
          stream.getTracks().forEach(t => t.stop());
          voiceMicBtn.classList.remove("recording");
          voiceStatusText.innerText = "🔄 Transcribing...";

          const blob = new Blob(audioChunks, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.onload = () => {
            const base64 = reader.result;
            chrome.runtime.sendMessage({
              action: 'TRANSCRIBE_AUDIO',
              audioBase64: base64,
              mimeType: 'audio/webm'
            }, (res) => {
              voiceStatus.style.display = "none";
              if (chrome.runtime.lastError || !res?.success) {
                // Fallback to browser STT if ElevenLabs fails
                const errMsg = res?.error || chrome.runtime.lastError?.message || '';
                if (errMsg === 'NO_ELEVENLABS_KEY' || errMsg.includes('ElevenLabs')) {
                  startBrowserSTT();
                  return;
                }
                showImportStatus("❌ Voice transcription failed: " + errMsg, true);
                return;
              }
              showVoicePreview(res.text);
            });
          };
          reader.readAsDataURL(blob);
        };

        mediaRecorder.start();
        voiceMicBtn.classList.add("recording");
        voiceStatus.style.display = "flex";
        voiceStatusText.innerText = "🎤 Recording... (click Stop or mic to end)";
        voicePreview.style.display = "none";

        // Auto-stop after 30 seconds
        setTimeout(() => {
          if (mediaRecorder && mediaRecorder.state === "recording") {
            mediaRecorder.stop();
          }
        }, 30000);

      } catch (err) {
        console.warn("Mic access denied, falling back to browser STT:", err);
        startBrowserSTT();
      }
    });
  }

  if (voiceStopBtn) {
    voiceStopBtn.addEventListener("click", () => {
      if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
      }
      if (speechRecognition) {
        speechRecognition.stop();
      }
    });
  }

  function startBrowserSTT() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showImportStatus("❌ Speech recognition not available in this browser", true);
      return;
    }

    speechRecognition = new SpeechRecognition();
    speechRecognition.continuous = false;
    speechRecognition.interimResults = false;
    speechRecognition.lang = 'en-US';

    voiceStatus.style.display = "flex";
    voiceStatusText.innerText = "🎤 Listening (browser STT)...";
    voiceMicBtn.classList.add("recording");

    speechRecognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      voiceStatus.style.display = "none";
      voiceMicBtn.classList.remove("recording");
      showVoicePreview(text);
    };

    speechRecognition.onerror = (event) => {
      voiceStatus.style.display = "none";
      voiceMicBtn.classList.remove("recording");
      showImportStatus("❌ Speech recognition error: " + event.error, true);
    };

    speechRecognition.onend = () => {
      voiceMicBtn.classList.remove("recording");
    };

    speechRecognition.start();
  }

  function showVoicePreview(text) {
    if (!voicePreview || !voiceTranscript) return;
    voiceTranscript.value = text;
    voicePreview.style.display = "block";
    voiceStatus.style.display = "none";
  }

  if (voiceSaveBtn) {
    voiceSaveBtn.addEventListener("click", () => {
      const text = voiceTranscript?.value?.trim();
      if (!text) return;

      voiceSaveBtn.innerText = "⏳ Parsing...";
      voiceSaveBtn.disabled = true;

      chrome.runtime.sendMessage({ action: 'PARSE_SKILLS_FROM_TEXT', text }, (res) => {
        voiceSaveBtn.disabled = false;
        if (res?.success) {
          voiceSaveBtn.innerText = "✅ Saved!";
          voicePreview.style.display = "none";
          showImportStatus("✅ Skills updated: " + (res.skills || []).slice(-5).join(", "), false);
          refreshProfileChip();
        } else {
          voiceSaveBtn.innerText = "Save to Skills";
          showImportStatus("❌ Failed to parse skills", true);
        }
      });
    });
  }

  if (voiceCancelBtn) {
    voiceCancelBtn.addEventListener("click", () => {
      voicePreview.style.display = "none";
    });
  }

  // === Helper: Refresh Profile Chip from vault ===
  function refreshProfileChip() {
    chrome.storage.local.get(["userProfile", "user_vault"], (res) => {
      const profile = res.userProfile || {};
      const vault = res.user_vault || {};

      const chipName = document.getElementById("chip-name");
      const chipSkills = document.getElementById("chip-skills");

      if (chipName) chipName.innerText = vault.fullName || profile.name || "Unknown User";
      if (chipSkills) {
        const skills = vault.skills || [];
        const profileSkills = typeof profile.skills === 'string'
          ? profile.skills.split(',').map(s => s.trim())
          : (Array.isArray(profile.skills) ? profile.skills : []);
        const merged = [...new Set([...skills, ...profileSkills])].filter(Boolean);
        chipSkills.innerText = merged.slice(0, 8).join(" · ") || "No skills listed";
      }
    });
  }


  const genBtn = document.getElementById("generate-btn");
  const draftPreview = document.getElementById("draft-preview");
  const answersContainer = document.getElementById("answers-container");
  const activityLog = document.getElementById("activity-log");

  if (!genBtn || !draftPreview) {
    console.error("Popup wiring failed: missing generate button or draft preview element");
    return;
  }

  function isUnsupportedUrl(url) {
    return (!url || url.startsWith("chrome://") || url.startsWith("edge://") || url.startsWith("about:") || url.startsWith("chrome-extension://"));
  }

  function ensureContentScript(tabId, callback) {
    chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] }, () => {
      if (chrome.runtime.lastError) {
        callback(new Error(chrome.runtime.lastError.message));
        return;
      }
      callback(null);
    });
  }

  genBtn.addEventListener("click", () => {
    draftPreview.style.display = "none";
    if (answersContainer) answersContainer.style.display = "none";
    if (activityLog) {
      activityLog.style.display = "flex";
      activityLog.innerHTML = "";
    }

    const startSimulatedActivity = () => {
      const steps = [
        "🔍 Reading page context...",
        "👤 Loading profile & vault data...",
        "📡 Researching job-specific ATS keywords...",
        "🧠 Generating tailored responses..."
      ];
      if (!activityLog) return;

      let delay = 0;
      steps.forEach((step, i) => {
        setTimeout(() => {
          const div = document.createElement("div");
          div.className = "activity-step";
          div.innerText = step;
          activityLog.appendChild(div);
          activityLog.scrollTop = activityLog.scrollHeight;
        }, delay);
        // Stagger the first few steps, but the last one should stay visible until background completes
        delay += (i < steps.length - 1) ? (Math.floor(Math.random() * 400) + 400) : 0;
      });
    };


    startSimulatedActivity();

    const showError = (msg) => {
      if (activityLog) activityLog.style.display = "none";
      if (draftPreview) {
        draftPreview.style.display = "block";
        draftPreview.value = "Error: " + msg;
      }
      if (answersContainer) answersContainer.style.display = "none";
    };

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs && tabs[0];
      if (!activeTab || !activeTab.id) {
        showError("No active tab found.");
        return;
      }

      if (isUnsupportedUrl(activeTab.url)) {
        showError("This page type is not supported. Open a normal website tab and try again.");
        return;
      }

      ensureContentScript(activeTab.id, (injectError) => {
        if (injectError) {
          showError(injectError.message);
          return;
        }

        chrome.tabs.sendMessage(activeTab.id, { action: "SCAN_FIELDS" }, (fields) => {
          if (chrome.runtime.lastError) {
            showError(chrome.runtime.lastError.message);
            return;
          }

          if (!fields || fields.length === 0) {
            if (activityLog) activityLog.style.display = "none";
            if (draftPreview) {
              draftPreview.style.display = "block";
              draftPreview.value = "No matching target inputs/textareas found on this page.";
            }
            return;
          }

          chrome.tabs.sendMessage(activeTab.id, { action: "GET_PAGE_CONTEXT" }, (contextRes) => {
            if (chrome.runtime.lastError) {
              showError(chrome.runtime.lastError.message);
              return;
            }

            const pageText = contextRes ? contextRes.text : "";

            chrome.storage.local.get(["userProfile", "user_vault"], (storeRes) => {
              const profile = storeRes.userProfile || {};
              const vault = storeRes.user_vault || {};

              const subjectiveFields = [];
              const autoFilledCount = [];

              fields.forEach(field => {
                let matchValue = null;
                const label = field.label.toLowerCase();

                if (!field.isSubjective) {
                  if (label.includes('first name') && vault.fullName) matchValue = vault.fullName.split(' ')[0];
                  else if (label.includes('last name') && vault.fullName) matchValue = vault.fullName.split(' ').slice(1).join(' ');
                  else if (label.includes('name') && vault.fullName) matchValue = vault.fullName;
                  else if (label.includes('name') && profile.name) matchValue = profile.name;
                  else if (label.includes('email') && vault.email) matchValue = vault.email;
                  else if ((label.includes('phone') || label.includes('mobile') || label.includes('contact')) && vault.phone) matchValue = vault.phone;
                  else if (label.includes('linkedin') && vault.linkedinURL) matchValue = vault.linkedinURL;
                  else if (label.includes('github') && vault.githubURL) matchValue = vault.githubURL;
                  else if (label.includes('portfolio') || label.includes('website')) matchValue = vault.portfolioURL || vault.githubURL;
                  else if (label.includes('address') && vault.addressLine1) matchValue = vault.addressLine1;
                  else if (label.includes('city') && vault.city) matchValue = vault.city;
                  else if (label.includes('state') && vault.state) matchValue = vault.state;
                  else if ((label.includes('pincode') || label.includes('zip')) && vault.pincode) matchValue = vault.pincode;
                  else if (label.includes('gender') && vault.gender) matchValue = vault.gender;
                  else if ((label.includes('dob') || label.includes('birth')) && vault.dob) matchValue = vault.dob;
                }


                if (matchValue) {
                  chrome.tabs.sendMessage(activeTab.id, { action: "FILL_FIELD", fieldId: field.id, text: matchValue });
                  autoFilledCount.push(field.label);
                } else {
                  subjectiveFields.push(field);
                }
              });

              if (autoFilledCount.length > 0 && activityLog) {
                const matchDiv = document.createElement("div");
                matchDiv.className = "activity-step";
                matchDiv.style.color = "#a1f0a1";
                matchDiv.innerText = "? Auto-filled " + autoFilledCount.length + " standard fields instantly from Vault!";
                activityLog.appendChild(matchDiv);
                activityLog.scrollTop = activityLog.scrollHeight;
              }

              if (subjectiveFields.length === 0) {
                if (activityLog) {
                  const completeDiv = document.createElement("div");
                  completeDiv.className = "activity-step";
                  completeDiv.innerHTML = "<b>? Done! All fields filled locally.</b>";
                  activityLog.appendChild(completeDiv);
                }
                setTimeout(() => { if (activityLog) activityLog.style.display = "none"; }, 1500);

                if (draftPreview && answersContainer) {
                  draftPreview.style.display = "block";
                  answersContainer.style.display = "none";
                  draftPreview.value = "All fields successfully filled via your Data Vault. No API call needed!";
                }
                return;
              }

              chrome.runtime.sendMessage(
                {
                  action: "CRAFT_ON_PAGE_ANSWERS",
                  data: {
                    text: pageText,
                    fields: subjectiveFields,
                    profileData: profile,
                  },
                },
                (response) => {
                  if (chrome.runtime.lastError) {
                    showError(chrome.runtime.lastError.message);
                    return;
                  }

                  if (response && response.success) {
                    // === Feature 3: Show ATS Keywords ===
                    const atsKeywords = response.atsKeywords || [];
                    if (atsKeywords.length > 0 && activityLog) {
                      const atsDiv = document.createElement("div");
                      atsDiv.className = "activity-step";
                      atsDiv.style.color = "#c4b5fd";
                      atsDiv.innerText = "✦ Found " + atsKeywords.length + " ATS keywords for this role...";
                      activityLog.appendChild(atsDiv);
                      activityLog.scrollTop = activityLog.scrollHeight;

                      // Display keyword chips
                      const atsBar = document.getElementById("ats-keyword-bar");
                      const atsChips = document.getElementById("ats-chips");
                      if (atsBar && atsChips) {
                        atsChips.innerHTML = "";
                        atsKeywords.forEach(kw => {
                          const chip = document.createElement("span");
                          chip.className = "ats-chip";
                          chip.innerText = kw;
                          atsChips.appendChild(chip);
                        });
                        atsBar.style.display = "flex";
                      }
                    }

                    if (activityLog) {
                      const completeDiv = document.createElement("div");
                      completeDiv.className = "activity-step";
                      completeDiv.innerHTML = "<b>✅ Done! Preparing results...</b>";
                      activityLog.appendChild(completeDiv);

                      setTimeout(() => {
                        activityLog.style.display = "none";
                        if (typeof response.answers === "string") {
                          if (draftPreview && answersContainer) {
                            draftPreview.style.display = "block";
                            answersContainer.style.display = "none";
                          }
                          draftPreview.value = response.answers;
                          return;
                        }

                        if (draftPreview && answersContainer) {
                          draftPreview.style.display = "none";
                          answersContainer.style.display = "flex";
                          answersContainer.innerHTML = "";

                          const answersObj = response.answers;
                          for (const [label, variations] of Object.entries(answersObj)) {
                            if (!Array.isArray(variations)) continue;

                            const searchLabel = label.toLowerCase().trim();
                            const matchedField = fields.find(f => {
                              const fLabel = f.label.toLowerCase().trim();
                              return fLabel === searchLabel || searchLabel.includes(fLabel) || fLabel.includes(searchLabel);
                            });

                            if (!matchedField) continue;

                            const groupDiv = document.createElement("div");
                            groupDiv.className = "answer-group";

                            const titleEl = document.createElement("div");
                            titleEl.className = "answer-question-title";
                            titleEl.innerText = label;
                            groupDiv.appendChild(titleEl);

                            variations.forEach((text) => {
                              const cardDiv = document.createElement("div");
                              cardDiv.className = "answer-card";
                              cardDiv.innerText = text;

                              cardDiv.addEventListener("click", () => {
                                groupDiv.querySelectorAll(".answer-card").forEach(c => c.classList.remove("selected"));
                                cardDiv.classList.add("selected");

                                chrome.tabs.sendMessage(activeTab.id, {
                                  action: "FILL_FIELD",
                                  fieldId: matchedField.id,
                                  text: text
                                }, (fillRes) => {
                                  if (chrome.runtime.lastError) console.error("Fill failed", chrome.runtime.lastError);
                                });
                              });
                              groupDiv.appendChild(cardDiv);
                            });
                            answersContainer.appendChild(groupDiv);
                          }

                          if (answersContainer.children.length === 0) {
                            draftPreview.style.display = "block";
                            answersContainer.style.display = "none";
                            draftPreview.value = "Results returned but the response format wasn't compatible.\n\n" + JSON.stringify(answersObj, null, 2);
                          }
                        } else {
                          draftPreview.value = JSON.stringify(response.answers, null, 2);
                        }
                      }, 500);
                    }
                  } else {
                    showError(response ? response.error : "Unknown");
                  }
                }
              );
            });
          });
        });
      });
    });
  });
});
