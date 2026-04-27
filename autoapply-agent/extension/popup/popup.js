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
                      draftPreview.value = response.answers;
                      return;
                    }

                    draftPreview.value = JSON.stringify(response.answers, null, 2);
                  } else {
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
