// linkedin-scraper.js — Content script injected on LinkedIn profile pages
// Scrapes the user's own LinkedIn profile data from the DOM

(function () {
    console.log("[AutoApply] LinkedIn scraper loaded on:", window.location.href);

    // Only run on profile pages
    if (!window.location.pathname.startsWith('/in/')) return;

    function scrapeProfile() {
        const data = {};

        // Name
        const nameEl = document.querySelector('.text-heading-xlarge')
            || document.querySelector('h1.text-heading-xlarge');
        data.fullName = nameEl?.innerText?.trim() || "";

        // Headline (title under name)
        const headlineEl = document.querySelector('.text-body-medium.break-words')
            || document.querySelector('.text-body-medium');
        data.linkedinHeadline = headlineEl?.innerText?.trim() || "";

        // Location
        const locationEl = document.querySelector('.text-body-small.inline.t-black--light.break-words');
        data.city = locationEl?.innerText?.trim() || "";

        // About section
        const aboutSection = document.querySelector('#about');
        if (aboutSection) {
            const aboutContainer = aboutSection.closest('section');
            const aboutSpan = aboutContainer?.querySelector('.full-width .visually-hidden ~ span')
                || aboutContainer?.querySelector('[class*="full-width"] span[aria-hidden="true"]')
                || aboutContainer?.querySelector('.inline-show-more-text');
            data.linkedinAbout = aboutSpan?.innerText?.trim() || "";
        }

        // Skills
        const skillEls = document.querySelectorAll('.pvs-list .t-bold span[aria-hidden="true"]');
        const skills = [...skillEls].map(el => el.innerText?.trim()).filter(Boolean);
        if (skills.length > 0) data.linkedinSkills = skills;

        // Experience
        const expSection = document.querySelector('#experience');
        if (expSection) {
            const expContainer = expSection.closest('section');
            const expItems = expContainer?.querySelectorAll('.pvs-list > li') || [];
            data.linkedinExperience = [...expItems].slice(0, 8).map(item => {
                const spans = item.querySelectorAll('span[aria-hidden="true"]');
                const texts = [...spans].map(s => s.innerText?.trim()).filter(Boolean);
                return texts.join(' | ').substring(0, 300);
            }).filter(t => t.length > 5);
        }

        // Education
        const eduSection = document.querySelector('#education');
        if (eduSection) {
            const eduContainer = eduSection.closest('section');
            const eduItems = eduContainer?.querySelectorAll('.pvs-list > li') || [];
            data.linkedinEducation = [...eduItems].slice(0, 5).map(item => {
                const spans = item.querySelectorAll('span[aria-hidden="true"]');
                const texts = [...spans].map(s => s.innerText?.trim()).filter(Boolean);
                return texts.join(' | ').substring(0, 300);
            }).filter(t => t.length > 5);
        }

        // Profile URL
        data.linkedinURL = window.location.href.split('?')[0];

        return data;
    }

    // Wait for the page to fully render (LinkedIn is an SPA)
    function waitAndScrape() {
        let attempts = 0;
        const maxAttempts = 15;

        const interval = setInterval(() => {
            attempts++;
            const nameEl = document.querySelector('.text-heading-xlarge');

            if (nameEl || attempts >= maxAttempts) {
                clearInterval(interval);
                const profileData = scrapeProfile();
                console.log("[AutoApply] Scraped LinkedIn data:", profileData);

                // Send to background.js
                chrome.runtime.sendMessage({
                    action: 'LINKEDIN_DATA_SCRAPED',
                    data: profileData
                });
            }
        }, 1000);
    }

    // Small delay to ensure page has loaded
    setTimeout(waitAndScrape, 2000);
})();
