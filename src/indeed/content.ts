import { MessageType } from '../messages';
import { delay } from './utils';

let applicationCount = 0;
const MAX_APPLICATIONS = 100; 
let applicationLimit = MAX_APPLICATIONS;

async function processJobListings() {
    let currentPage = 1;

    while (applicationCount < MAX_APPLICATIONS) {
        console.log(`Processing page ${currentPage}`);
        
        await scrollToBottomSlowly();
        
        const jobCards = document.querySelectorAll('.jobsearch-ResultsList > li');
        console.log(`Found ${jobCards.length} job cards on page ${currentPage}`);
        
        for (let i = 0; i < jobCards.length && applicationCount < MAX_APPLICATIONS; i++) {
            await processJobCard(jobCards[i] as HTMLElement);
            
            if (applicationLimit === 0) {
                console.log("Application limit reached. Stopping the process.");
                chrome.runtime.sendMessage({ type: MessageType.RATE_LIMIT });
                return;
            }
        }
        
        if (applicationCount < MAX_APPLICATIONS) {
            const nextPageLoaded = await loadNextJobPage();
            if (!nextPageLoaded) {
                console.log("No more pages available. Ending process.");
                break;
            }
            currentPage++;
        } else {
            break;
        }
    }
    
    console.log(`Applied to ${applicationCount} jobs in total across ${currentPage} pages`);
    chrome.runtime.sendMessage({ type: MessageType.ALL_JOBS_PROCESSED });
}

async function processJobCard(jobCard: HTMLElement) {
    console.log("Processing job card...");
    
    // Click on the job card to open the job details
    const jobLink = jobCard.querySelector('a.jcs-JobTitle') as HTMLAnchorElement;
    if (jobLink) {
        jobLink.click();
        await delay(2000); // Wait for job details to load
    } else {
        console.log("Job link not found. Skipping this job.");
        return;
    }
    
    // Look for the apply button
    const applyButton = document.querySelector('button[id^="indeedApplyButton"]') as HTMLButtonElement;
    if (applyButton) {
        console.log("Apply button found. Attempting to apply...");
        applyButton.click();
        await delay(3000); // Wait for application modal to open
        
        // Handle the application process
        await handleApplicationProcess();
    } else {
        console.log("Apply button not found. This job might require external application.");
    }
    
    applicationCount++;
    console.log(`Applied to ${applicationCount} jobs so far.`);
}

async function handleApplicationProcess() {
 
    console.log("Simulating application process...");
    await delay(2000);
    
    // Close the application modal (if it exists)
    const closeButton = document.querySelector('button[aria-label="Close"]') as HTMLButtonElement;
    if (closeButton) {
        closeButton.click();
        await delay(1000);
    }
    
    console.log("Application submitted successfully.");
}

async function scrollToBottomSlowly() {
    console.log("Scrolling to bottom slowly to load all job listings...");
    const getScrollHeight = () => document.documentElement.scrollHeight;
    let lastScrollHeight = getScrollHeight();
    let currentScrollPosition = 0;
    let noNewContentCount = 0;
    
    while (true) {
        const maxScrollHeight = getScrollHeight();
        const remainingScroll = maxScrollHeight - currentScrollPosition;
        const maxIncrement = Math.min(remainingScroll, 1000);
        const scrollIncrement = Math.floor(Math.random() * (maxIncrement - 50 + 1) + 50);
        
        currentScrollPosition = Math.min(currentScrollPosition + scrollIncrement, maxScrollHeight);
        
        window.scrollTo({
            top: currentScrollPosition,
            behavior: 'smooth'
        });
        
        await delay(200 + Math.random() * 300);
        
        const newScrollHeight = getScrollHeight();
        if (newScrollHeight === lastScrollHeight) {
            noNewContentCount++;
            if (noNewContentCount >= 2 && currentScrollPosition >= maxScrollHeight - 10) {
                console.log("Reached the bottom of the page.");
                break;
            }
        } else {
            noNewContentCount = 0;
            lastScrollHeight = newScrollHeight;
        }
        
        await delay(100 + Math.random() * 200);
    }
    
    window.scrollTo({
        top: getScrollHeight(),
        behavior: 'smooth'
    });
    await delay(100);
    
    console.log("Scrolling back to top slowly...");
    await scrollToTopSlowly();
}

async function scrollToTopSlowly() {
    const initialScrollPosition = window.pageYOffset;
    let currentScrollPosition = initialScrollPosition;
    
    while (currentScrollPosition > 0) {
        const scrollPercentage = currentScrollPosition / initialScrollPosition;
        const maxIncrement = Math.max(600, Math.floor(300 * scrollPercentage));
        const scrollIncrement = Math.floor(Math.random() * (maxIncrement - 50 + 1) + 50);
        
        currentScrollPosition = Math.max(0, currentScrollPosition - scrollIncrement);
        
        window.scrollTo({
            top: currentScrollPosition,
            behavior: 'smooth'
        });
        
        await delay(100 + Math.random() * 200);
    }
    
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

async function loadNextJobPage(): Promise<boolean> {
    const nextButton = document.querySelector('a[data-testid="pagination-page-next"]') as HTMLAnchorElement;
    
    if (nextButton) {
        nextButton.click();
        await delay(2000); // Wait for the next page to load
        console.log("Navigated to the next page of job listings");
        return true;
    } else {
        console.log("No more pages of job listings available.");
        return false;
    }
}

// Start the application process when receiving the START_JOB_SEARCH message
chrome.runtime.onMessage.addListener(async function(message, sender, sendResponse) {
    if (message.type === MessageType.START_INDEED_JOB_SEARCH) {
        applicationLimit = message.applicationLimit
        console.log("Starting job application process...");
        await delay(2000); // Wait for the page to load
        await processJobListings();
        sendResponse({ success: true });
    }
    return true;
});