import { delay } from './indeed/utils';
import { MessageType } from './messages';

import externalJobs from './linkedin/externalJobs?script'

// Function to clear job IDs and active search state
function clearJobData() {
    chrome.storage.local.set({ jobIdsIndeed: [], isActiveSearch: false });
    console.log("Cleared job IDs and active search state.");
}

function removeJobData() {
    chrome.storage.local.remove('jobIds', () => {
        console.log("Removed job IDs from storage.");
    });
}

function openTabWithRetry(url, messageType, data, maxRetries = 3, retryDelay = 2000) {
    let retries = 0;

    function attemptOpen() {
        chrome.tabs.create({ url }, async (tab) => {
            try {
                await waitForTabLoad(tab.id);
                await sendMessageWithRetry(tab.id, { 
                    type: messageType, 
                    ...data
                }, maxRetries, retryDelay);
            } catch (error) {
                console.error(`Error opening tab or sending message: ${error}`);
                if (retries < maxRetries) {
                    retries++;
                    console.log(`Retrying... Attempt ${retries} of ${maxRetries}`);
                    setTimeout(attemptOpen, retryDelay);
                } else {
                    console.error(`Failed to open tab and send message after ${maxRetries} attempts`);
                }
            }
        });
    }

    attemptOpen();
}

function waitForTabLoad(tabId) {
    return new Promise((resolve, reject) => {
        const listener = (updatedTabId, changeInfo) => {
            if (updatedTabId === tabId && changeInfo.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                resolve();
            }
        };
        chrome.tabs.onUpdated.addListener(listener);

        // Set a timeout in case the tab doesn't load
        setTimeout(() => {
            chrome.tabs.onUpdated.removeListener(listener);
            reject(new Error('Tab load timeout'));
        }, 30000); // 30 seconds timeout
    });
}

async function sendMessageWithRetry(tabId, message, maxRetries = 3, retryDelay = 2000) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            await new Promise((resolve, reject) => {
                chrome.tabs.sendMessage(tabId, message, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve(response);
                    }
                });
            });
            return; // Message sent successfully
        } catch (error) {
            console.error(`Attempt ${i + 1} failed: ${error}`);
            if (i < maxRetries - 1) {
                await delay(retryDelay);
            } else {
                throw new Error(`Failed to send message after ${maxRetries} attempts`);
            }
        }
    }
}

export function openLinkedInJobsPage({ jobDetails, filters, tailorResume }) {
    const jobTitleModify = jobDetails.desiredJobTitle.replace(/\s+/g, '+');
    const jobTitle = jobTitleModify;
    const location = jobDetails.workAddress;
    
    // Construct the base URL
    let url = `https://www.linkedin.com/jobs/search/?keywords=${jobTitle}&location=${location}&f_AL=true`;

    if (filters.experienceLevel) {
        const experienceLevelMap = {
            'Entry Level': '2',
            'Associate': '3',
            'Mid-Senior Level': '4',
            'Director': '5',
            'Executive': '6'
        };
        url += `&f_E=${experienceLevelMap[filters.experienceLevel]}`;
    }

    if (filters.jobType && filters.jobType.length > 0) {
        const jobTypeMap = {
            'Full-time': 'F',
            'Part-time': 'P',
            'Contract': 'C',
            'Temporary': 'T',
            'Internship': 'I',
            'Volunteer': 'V',
            'Apprenticeship': 'A'
        };
        const jobTypes = filters.jobType.map(type => jobTypeMap[type]).join(',');
        url += `&f_JT=${jobTypes}`;
    }

    if (filters.datePosted) {
        const datePostedMap = {
            'Past 24 hours': 'r86400',
            'Past week': 'r604800',
            'Past month': 'r2592000',
            'Any time': ''
        };
        url += `&f_TPR=${datePostedMap[filters.datePosted]}`;
    }

    if (filters.remotePreference) {
        const remotePreferenceMap = {
            'On-site': '0',
            'Remote': '2',
            'Hybrid': '3'
        };
        url += `&f_WT=${remotePreferenceMap[filters.remotePreference]}`;
    }

    if (filters.industry && filters.industry.length > 0) {
        const industryMap = {
            'Technology': '4',
            'Healthcare': '14',
            'Finance': '43',
            'Education': '69',
            'Manufacturing': '53',
            'Retail': '96',
            'Hospitality': '37',
            'Media': '94',
            'Government': '75'
        };
        const industries = filters.industry.map(ind => industryMap[ind]).join(',');
        url += `&f_I=${industries}`;
    }

    chrome.tabs.create({ url }, (tab) => {
        chrome.tabs.onUpdated.addListener(async function listener(tabId, changeInfo) {
            if (tabId === tab.id && changeInfo.status === 'complete') {
                await delay(3000)
                chrome.tabs.sendMessage(tabId, { type: MessageType.START_JOB_SEARCH , jobDetails: jobDetails});
                chrome.tabs.onUpdated.removeListener(listener);
            }
        });
    });
}

export function openIndeedJobsPage({ jobDetails, filters, tailorResume }) {
    const jobTitleModify = jobDetails.desiredJobTitle.replace(/\s+/g, '+');
    const jobTitle = `${jobTitleModify}+indeedapply:1`;
    const location = jobDetails.workAddress;

    // Construct the base URL
    let url = `https://www.indeed.com/jobs?q=${jobTitle}&l=${location}&fromage=1&apply=1`;

    // Add filters to the URL
    if (filters.experienceLevel) {
        const experienceLevelMap = {
            'Entry Level': 'entry',
            'Associate': 'associate',
            'Mid-Senior Level': 'mid',
            'Director': 'director',
            'Executive': 'executive'
        };
        url += `&explvl=${experienceLevelMap[filters.experienceLevel]}`;
    }

    if (filters.jobType && filters.jobType.length > 0) {
        const jobTypeMap = {
            'Full-time': 'fulltime',
            'Part-time': 'parttime',
            'Contract': 'contract',
            'Temporary': 'temporary',
            'Internship': 'internship',
            'Volunteer': 'volunteer',
            'Apprenticeship': 'apprenticeship'
        };
        const jobTypes = filters.jobType.map(type => jobTypeMap[type]).join(',');
        url += `&jt=${jobTypes}`;
    }

    if (filters.datePosted) {
        const datePostedMap = {
            'Past 24 hours': '1',
            'Past week': '7',
            'Past month': '30',
            'Any time': '0'
        };
        url += `&fromage=${datePostedMap[filters.datePosted]}`;
    }

    if (filters.remotePreference) {
        const remotePreferenceMap = {
            'On-site': '0',
            'Remote': '2',
            'Hybrid': '1'
        };
        url += `&remote=${remotePreferenceMap[filters.remotePreference]}`;
    }

    if (filters.industry && filters.industry.length > 0) {
        const industries = filters.industry.map(ind => ind.toLowerCase()).join(',');
        url += `&ind=${industries}`;
    }

    chrome.tabs.create({ url }, (tab) => {
        chrome.tabs.onUpdated.addListener(async function listener(tabId, changeInfo) {
            if (tabId === tab.id && changeInfo.status === 'complete') {
                await delay(3000)
                chrome.tabs.sendMessage(tabId, { type: MessageType.START_INDEED_JOB_SEARCH , jobDetails: jobDetails, applictionLimit: 10});
                chrome.tabs.onUpdated.removeListener(listener);
            }
        });
    });
}

// Listener for messages from content scripts and jobViewer
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === MessageType.START_AUTO_APPLYING) {
        const { job: jobDetails, jobFilters: filters, tailorResume, updatedJobBoards } = message;
        clearJobData();
        removeJobData(); // Clear job IDs and active search state before starting a new search

        if (updatedJobBoards.linkedin.enabled) {
            openLinkedInJobsPage({ jobDetails, filters, tailorResume });
        }
        if (updatedJobBoards.indeed.enabled) {
            openIndeedJobsPage({ jobDetails, filters, tailorResume });
        }

        sendResponse({ success: true });
    } else if (message.type === MessageType.OPEN_INDEED_JOB_PAGE) {
        const jobId = message.jobId;
        const url = `https://www.indeed.com/viewjob?jk=${jobId}`; // Indeed job URL format
        chrome.tabs.create({ url: url, active: true }, (tab) => {
            if (tab.id) {
                chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                    if (tabId === tab.id && info.status === 'complete') {
                        chrome.tabs.onUpdated.removeListener(listener);
                        chrome.tabs.sendMessage(tab.id, { action: "applyForJob" });
                        // Close the tab after a delay or after the application is processed
                        setTimeout(() => {
                            chrome.tabs.remove(tabId);
                            chrome.runtime.sendMessage({ type: MessageType.PROCESS_NEXT_JOB }); // Notify to process the next job
                        }, 5000); // Adjust the delay as needed
                    }
                });
            }
        });
    } else if (message.type === MessageType.NEW_APPLY_TAB_OPENED) {
        const { jobDetails, resumeText, jobIds } = message;
        console.log("Listening for new tab creation...");
    
        // Listen for new tabs being created
        chrome.tabs.onCreated.addListener(function onNewTab(tab) {
            console.log("New tab created with ID:", tab.id);
            
            // Remove the listener to prevent multiple executions
            chrome.tabs.onCreated.removeListener(onNewTab);
    
            // Wait for the tab to finish loading
            chrome.tabs.onUpdated.addListener(function onTabReady(tabId, changeInfo, tabInfo) {
                if (tabId === tab.id && changeInfo.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(onTabReady);
                    
                    // Check if the URL contains experita.ai
    
                    // If not experita.ai, proceed with normal script injection
                    chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: [externalJobs]
                     
                    })
                    .then(() => {
                        console.log('Content script injected into tab:', tab.id);
                    
                        function messageListener(message, sender, sendResponse) {
                            if (message.action === 'contentScriptReady' && sender.tab.id === tab.id) {
                                chrome.runtime.onMessage.removeListener(messageListener);
                                console.log("Content script is ready in tab:", tab.id);
                                
                                chrome.tabs.sendMessage(tab.id, { 
                                    action: 'sendData', 
                                    jobDetails, 
                                    resumeText,
                                    tabId: tab.id 
                                }, (response) => {
                                    if (chrome.runtime.lastError) {
                                        console.error('Error sending message:', chrome.runtime.lastError);
                                    } else {
                                        console.log('Data sent to content script:', response);
                                    }
                                });
                            }
                        }
    
                        chrome.runtime.onMessage.addListener(messageListener);
                    })
                    .catch((error) => {
                        console.error('Failed to inject content script:', error);
                    });
                }
            });
        });
    } 
     else if (message.type === MessageType.COMPLETED) {
        console.log(`Job application completed with status: ${message.status}`);
        
      
        // Check if tabId exists in the message
        if (message.tabId) {
            // Close the tab
            chrome.tabs.remove(message.tabId, async () => {
                if (chrome.runtime.lastError) {
                    console.error(`Error closing tab: ${chrome.runtime.lastError.message}`);
                } else {
                    console.log(`Successfully closed tab ${message.tabId}`);
               
                }
            });
        } else {
            console.warn('No tabId provided in COMPLETED message');
        }
        
        // Optional: You can still send a response if needed
        sendResponse({ received: true });
    }

    return true; // Indicates that the response will be sent asynchronously
});


function injectExternalJobsScript(tabId, jobDetails, resumeText) {
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: [externalJobs]
    })
    .then(() => {
        console.log('Content script injected into tab:', tabId);
        
        function messageListener(message, sender, sendResponse) {
            if (message.action === 'contentScriptReady' && sender.tab.id === tabId) {
                chrome.runtime.onMessage.removeListener(messageListener);
                console.log("Content script is ready in tab:", tabId);
                
                chrome.tabs.sendMessage(tabId, { 
                    action: 'sendData', 
                    jobDetails, 
                    resumeText,
                    tabId: tabId 
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('Error sending message:', chrome.runtime.lastError);
                    } else {
                        console.log('Data sent to content script:', response);
                    }
                });
            }
        }

        chrome.runtime.onMessage.addListener(messageListener);
    })
    .catch((error) => {
        console.error('Failed to inject content script:', error);
    });
}

