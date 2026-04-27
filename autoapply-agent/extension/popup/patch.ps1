$content = Get-Content autoapply-agent/extension/popup/popup.js -Raw

$oldCode = @"
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