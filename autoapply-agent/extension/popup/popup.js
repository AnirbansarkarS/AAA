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
  });

  const genBtn = document.getElementById("generate-btn");
  const draftPreview = document.getElementById("draft-preview");
  const answersContainer = document.getElementById("answers-container");

  if (!genBtn || !draftPreview) {
    console.error("Popup wiring failed: missing generate button or draft preview element");
    return;
  }

  function isUnsupportedUrl(url) {
    return (
      !url ||
      url.startsWith("chrome://") ||
      url.startsWith("edge://") ||
      url.startsWith("about:") ||
      url.startsWith("chrome-extension://")
    );
  }

  function ensureContentScript(tabId, callback) {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        files: ["content.js"],
      },
      () => {
        if (chrome.runtime.lastError) {
          callback(new Error(chrome.runtime.lastError.message));
          return;
        }
        callback(null);
      }
    );
  }

  genBtn.addEventListener("click", () => {
    draftPreview.value = "Scanning page for fields and generating...";

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs && tabs[0];
      if (!activeTab || !activeTab.id) {
        draftPreview.value = "Error: No active tab found.";
        return;
      }

      if (isUnsupportedUrl(activeTab.url)) {
        draftPreview.value = "Error: This page type is not supported. Open a normal website tab and try again.";
        return;
      }

      ensureContentScript(activeTab.id, (injectError) => {
        if (injectError) {
          const help = activeTab.url && activeTab.url.startsWith("file://")
            ? " Enable 'Allow access to file URLs' in extension settings."
            : "";
          draftPreview.value = `Error: ${injectError.message}.${help}`;
          return;
        }

        chrome.tabs.sendMessage(activeTab.id, { action: "SCAN_FIELDS" }, (fields) => {
          if (chrome.runtime.lastError) {
            draftPreview.value = `Error: ${chrome.runtime.lastError.message}`;
            return;
          }

          if (!fields || fields.length === 0) {
            draftPreview.value = "No matching target inputs/textareas found on this page.";
            return;
          }

          chrome.tabs.sendMessage(activeTab.id, { action: "GET_PAGE_CONTEXT" }, (contextRes) => {
            if (chrome.runtime.lastError) {
              draftPreview.value = `Error: ${chrome.runtime.lastError.message}`;
              return;
            }

            const pageText = contextRes ? contextRes.text : "";

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
                (response) => {
                  if (chrome.runtime.lastError) {
                    draftPreview.value = `Error: ${chrome.runtime.lastError.message}`;
                    return;
                  }

                  if (response && response.success) {
                    if (typeof response.answers === "string") {
                      if (draftPreview && answersContainer) {
                        draftPreview.style.display = "block";
                        answersContainer.style.display = "none";
                      }
                      draftPreview.value = response.answers;
                      return;
                    }

                    // Render interactive answer selection
                    if (draftPreview && answersContainer) {
                      draftPreview.style.display = "none";
                      answersContainer.style.display = "flex";
                      answersContainer.innerHTML = ""; // Clear old answers
                      
                      const answersObj = response.answers;
                      for (const [label, variations] of Object.entries(answersObj)) {
                        if (!Array.isArray(variations)) continue;
                        
                        // Find the matching field based on label (case-insensitive)
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

                        variations.forEach((text, idx) => {
                          const cardDiv = document.createElement("div");
                          cardDiv.className = "answer-card";
                          cardDiv.innerText = text;
                          
                          cardDiv.addEventListener("click", () => {
                            // Visually toggle selection state
                            groupDiv.querySelectorAll(".answer-card").forEach(c => c.classList.remove("selected"));
                            cardDiv.classList.add("selected");
                            
                            // Send fill request to content script
                            chrome.tabs.sendMessage(activeTab.id, {
                              action: "FILL_FIELD",
                              fieldId: matchedField.id,
                              text: text
                            }, (fillRes) => {
                               if (chrome.runtime.lastError) {
                                  console.error("Fill failed", chrome.runtime.lastError);
                               }
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
                  } else {
                    if (draftPreview && answersContainer) {
                       draftPreview.style.display = "block";
                       answersContainer.style.display = "none";
                    }
                    draftPreview.value = `Error: ${response ? response.error : "Unknown"}`;
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
