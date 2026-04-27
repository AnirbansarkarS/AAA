const fs = require('fs');
let code = fs.readFileSync('autoapply-agent/extension/popup/popup.js', 'utf8');

// 1. ADD DROPZONE LOGIC
const dropzoneLogic = \
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
      docActivity.innerHTML = '<div class="activity-step">✦ Reading file: ' + file.name + '...</div>';
      docPreviewZone.style.display = "none";
      if (btnSaveVault) {
        btnSaveVault.innerText = "SAVE TO VAULT 🔒";
        btnSaveVault.disabled = false;
        btnSaveVault.classList.remove("btn-orange");
        btnSaveVault.classList.add("btn-green");
      }

      const reader = new FileReader();
      reader.onload = function(e) {
        const fileDataUrl = e.target.result;
        
        setTimeout(() => {
          docActivity.innerHTML += '<div class="activity-step">✦ Sending to Vision Agent for extraction...</div>';
          docActivity.scrollTop = docActivity.scrollHeight;
        }, 500);

        chrome.runtime.sendMessage({
          action: "EXTRACT_DOCUMENT",
          base64Data: fileDataUrl,
          mimeType: file.type,
          docType: 'unknown'
        }, (response) => {
          if (chrome.runtime.lastError || !response || !response.success) {
            docActivity.innerHTML += '<div class="activity-step" style="color:#ff6b6b;">Error: ' + (chrome.runtime.lastError ? chrome.runtime.lastError.message : (response ? response.error : 'Unknown')) + '</div>';
            return;
          }

          docActivity.innerHTML += '<div class="activity-step"><b>✦ Extraction Complete!</b></div>';
          docActivity.scrollTop = docActivity.scrollHeight;
          
          try {
            latestExtractedData = JSON.parse(response.data);
            if (docPreviewContent) docPreviewContent.innerText = JSON.stringify(latestExtractedData, null, 2);
            setTimeout(() => {
              docActivity.style.display = "none";
              if (docPreviewZone) docPreviewZone.style.display = "block";
            }, 1000);
          } catch(err) {
             if (docPreviewContent) docPreviewContent.innerText = response.data; // Raw text fallback
             latestExtractedData = null;
             setTimeout(() => {
               docActivity.style.display = "none";
               if (docPreviewZone) docPreviewZone.style.display = "block";
             }, 1000);
          }
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
            vault = { ...vault, ...latestExtractedData };
            
            chrome.storage.local.set({ user_vault: vault }, () => {
               btnSaveVault.innerText = "SAVED TO VAULT ✅";
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
\;
code = code.replace('  const editProfileLink = document.getElementById("chip-edit");', dropzoneLogic);

// 2. ADD TWO TIER ENGINE LOGIC (Step 6 and 7)
const oldEngineStr = \
            chrome.storage.local.get(["userProfile"], (profileRes) => {
              const profile = profileRes.userProfile || {};

              chrome.runtime.sendMessage(
                {
                  action: "CRAFT_ON_PAGE_ANSWERS",
                  data: {
                    text: pageText,
                    fields,
                    profileData: profile,
                  },
                },
\.trim();

const newEngineStr = \
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
                 matchDiv.innerText = "✦ Auto-filled " + autoFilledCount.length + " standard fields instantly from Vault!";
                 activityLog.appendChild(matchDiv);
                 activityLog.scrollTop = activityLog.scrollHeight;
              }

              if (subjectiveFields.length === 0) {
                 if (activityLog) {
                    const completeDiv = document.createElement("div");
                    completeDiv.className = "activity-step";
                    completeDiv.innerHTML = "<b>✦ Done! All fields filled locally.</b>";
                    activityLog.appendChild(completeDiv);
                 }
                 setTimeout(() => { if(activityLog) activityLog.style.display = "none"; }, 1500);
                 
                 // Clean up the draft preview
                 if (draftPreview && answersContainer) {
                   draftPreview.style.display = "block";
                   answersContainer.style.display = "none";
                   draftPreview.value = "All fields successfully filled via your Data Vault memory. No API call needed!";
                 }
                 return;
              }

              chrome.runtime.sendMessage(
                {
                  action: "CRAFT_ON_PAGE_ANSWERS",
                  data: {
                    text: pageText,
                    fields: subjectiveFields, // Only send subjective fields to LLM
                    profileData: profile,
                  },
                },
\.trim();

code = code.replace(oldEngineStr, newEngineStr);

fs.writeFileSync('autoapply-agent/extension/popup/popup.js', code, 'utf8');
console.log('Patch complete.');