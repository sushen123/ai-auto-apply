import { MessageType } from '../messages';
import { chatSession } from '../../lib/GeminiAi';
import { delay } from './utils';
import extractTextFromPDF from "pdf-parser-client-side";
import { createPDFFromURL } from './pdfUtils';

import {selectors} from './selectors' 

interface JobDetail {
    fullName: string,
    name: string;
    email: string;
    resume: string;
    phone?: string;
    address?: string;
    workExperiences: string[];
    educations: string[];
    skills?: string[];
    desiredJobTitle?: string;
    workAddress?: string;
}

let jobDetails: JobDetail;

let aiResponse: string;
let allText: string = "";
let resumeText: string = "";
let userId: number;
let applicationLimit: number;

interface FormField {
    id: string;
    type: string;
    inputType: string | null;
    label: string;
    placeholder: string;
    required: boolean;
    options: string[] | null;
    element: HTMLElement;
  }



  async function processJobListings() {
    let processedCount = 0;
    const maxJobs = 100; // Adjust this number as needed
    let currentPage = 1;

    while (processedCount < maxJobs) {
        console.log(`Processing page ${currentPage}`);
        
        // Scroll down to load all job listings on the current page, then scroll back up
        await scrollToBottomSlowly();
        
        // Extract job cards after scrolling
        const jobCards = document.querySelectorAll('.job-card-container');
        console.log(`Found ${jobCards.length} job cards on page ${currentPage}`);
        
        for (let i = 0; i < jobCards.length && processedCount < maxJobs; i++) {
            await processJobCard(jobCards[i] as HTMLElement);
            processedCount++;
            
            await delay(500);
            
            if (applicationLimit === 0) {
                console.log("Application limit reached. Stopping the process.");
                chrome.runtime.sendMessage({ type: MessageType.RATE_LIMIT });
                return;
            }
        }
        
        // Check if we need to move to the next page
        if (processedCount < maxJobs) {
            console.log(`Processed all jobs on page ${currentPage}. Attempting to move to next page.`);
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
    
    console.log(`Processed ${processedCount} job listings in total across ${currentPage} pages`);
    chrome.runtime.sendMessage({ type: MessageType.ALL_JOBS_PROCESSED });
}

async function scrollToBottomSlowly() {
    console.log("Scrolling to bottom slowly to load all job listings...");
    const container = document.querySelector(".jobs-search-results-list") as HTMLElement;
    const getScrollHeight = () => container?.scrollHeight || document.documentElement.scrollHeight;
    let lastScrollHeight = getScrollHeight();
    let currentScrollPosition = 0;
    let noNewContentCount = 0;
    
    while (true) {
        const maxScrollHeight = getScrollHeight();
        
        // Calculate the remaining scroll distance
        const remainingScroll = maxScrollHeight - currentScrollPosition;
        
        // Adjust scroll increment based on remaining distance
        const maxIncrement = Math.min(remainingScroll, 1000);
        const scrollIncrement = Math.floor(Math.random() * (maxIncrement - 50 + 1) + 50);
        
        currentScrollPosition = Math.min(currentScrollPosition + scrollIncrement, maxScrollHeight);
        
        // Use smooth scrolling for a more natural look
        container?.scrollTo({
            top: currentScrollPosition,
            behavior: 'smooth'
        });
        
        // Add a random delay between scrolls
        await delay(200); // Random delay between 500-1500ms
        
        const newScrollHeight = getScrollHeight();
        if (newScrollHeight === lastScrollHeight) {
            noNewContentCount++;
            if (noNewContentCount >= 2 && currentScrollPosition >= maxScrollHeight - 10) {
                // If no new content loaded after 3 attempts and we're very close to the bottom, we've reached the end
                console.log("Reached the bottom of the page.");
                break;
            }
        } else {
            noNewContentCount = 0;
            lastScrollHeight = newScrollHeight;
        }
        
        // Occasional longer pause to simulate human behavior
        await delay(100)
    }
    
    // Ensure we're at the very bottom
    container?.scrollTo({
        top: getScrollHeight(),
        behavior: 'smooth'
    });
    await delay(100); // Wait for any final loading
    
    console.log("Scrolling back to top slowly...");
    await scrollToTopSlowly();
}

async function scrollToTopSlowly() {
    const container = document.querySelector(".jobs-search-results-list") as HTMLElement;
    const initialScrollPosition = container?.scrollTop || window.pageYOffset;
    let currentScrollPosition = initialScrollPosition;
    
    while (currentScrollPosition > 0) {
        // Calculate scroll increment (larger at the beginning, smaller near the top)
        const scrollPercentage = currentScrollPosition / initialScrollPosition;
        const maxIncrement = Math.max(600, Math.floor(300 * scrollPercentage));
        const scrollIncrement = Math.floor(Math.random() * (maxIncrement - 50 + 1) + 50);
        
        currentScrollPosition = Math.max(0, currentScrollPosition - scrollIncrement);
        
        container?.scrollTo({
            top: currentScrollPosition,
            behavior: 'smooth'
        });
        
       
    }
    
    // Ensure we're at the very top
    container?.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
     // Allow time for the page to settle
}
async function loadNextJobPage(): Promise<boolean> {
    const paginationList = document.querySelector('.artdeco-pagination__pages');

    if (!paginationList) {
        console.log("Pagination not found.");
        return false;
    }

    const activeButton = paginationList.querySelector('li.active button') as HTMLButtonElement;
    console.log(activeButton)
    if (!activeButton) {
        console.log("Active page button not found.");
        return false;
    }

    const currentPage = parseInt(activeButton.textContent?.trim() || "0", 10);
    const nextPage = currentPage + 1;

    // First, try to find the next numbered button
    let nextButton = paginationList.querySelector(`button[aria-label="Page ${nextPage}"]`) as HTMLButtonElement;

    // If the next numbered button doesn't exist, look for the "..." button
    if (!nextButton) {
        nextButton = paginationList.querySelector('li:not(.active) button span:not([data-test-pagination-page-btn])') as HTMLButtonElement;
    }

    if (nextButton && !nextButton.disabled) {
        nextButton.click();
        await delay(2000); // Wait for the next page to load
        console.log(`Navigated to page ${nextPage}`);
        return true;
    } else {
        console.log("No more pages of job listings available.");
        return false;
    }
}




async function clickDismissButton() {
    const button = document.querySelector('button[aria-label="Dismiss"]');
    if (button) {
        await delay(2000)
      button.click();
      console.log("Dismiss button clicked successfully");
    } else {
      console.log("Dismiss button not found");
    }
  }

async function processJobCard(jobCard: HTMLElement) {
    jobCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await delay(500);
   

    const jobLink = jobCard.querySelector('a.job-card-container__link') as HTMLAnchorElement;
    if (jobLink) {
        jobLink.click();
        await delay(1000); // Wait for job details to load

        const jobTitle = document.querySelector('.job-details-jobs-unified-top-card__job-title')?.textContent?.trim();
        const companyName = document.querySelector('.job-details-jobs-unified-top-card__company-name')?.textContent?.trim();
         const applyButton = document.querySelector('.jobs-apply-button') as HTMLButtonElement;
    if (!applyButton) {
        console.log("Apply button not found. Skipping this job.");
        return;
    }
        console.log(`Processing job: ${jobTitle} at ${companyName}`);

        await extractJobDetails();
         const resumeUrl = chrome.runtime.getURL(jobDetails.resume)
        const shouldApply = await checkJobDescriptionFit(resumeUrl);
        if (shouldApply) {
            await applyToJob();
        } else {
            console.log("AI recommends not to apply for this job.");
        }

     
    }
}

async function extractJobDetails() {
    allText = "";
    const selectors = [
        { class: '.jobs-description__container', label: 'Job Description' },
        { class: '.job-details-segment-attribute-card-job-details', label: 'Job Details' },
        { class: '.jobs-details__salary-main-rail-card', label: 'Salary Information' },
        { class: '.jobs-company__box', label: 'Company Information' },
        { class: '.job-details-company__commitments-container', label: 'Company Commitments' }
    ];

    selectors.forEach(selector => {
        const element = document.querySelector(selector.class);
        if (element) {
            allText += `${selector.label}:\n${element.textContent.trim()}\n\n`;
        }
    });

    console.log("Extracted Job Text:", allText);
}

async function applyToJob() {
    const applyButton = document.querySelector('.jobs-apply-button') as HTMLButtonElement;
    if (!applyButton) {
        console.log("Apply button not found. Skipping this job.");
        return;
    }else if(applyButton.textContent?.trim() === "Easy Apply") {
        applyButton.click();
    }

   


    await delay(1000);
    const headerElement = document.querySelector("h2#header");

    if (headerElement && headerElement.textContent.trim() === "Job search safety reminder") {
        // Find the button with text content "Continue applying"
        const button = Array.from(document.querySelectorAll("button")).find(
            btn => btn.textContent.trim() === "Continue applying"
        );
    
        // If the button is found, trigger a click
        if (button) {
            button.click();
            console.log("Button clicked!");
        } else {
            console.log("Button not found.");
        }
    }

    await delay(1000)

    const easyApplyModal = document.querySelector('.jobs-easy-apply-modal');
    if (easyApplyModal) {
       
        await handleEasyApply();
        clickDismissButton();
    } else {
        await handleExternalApply();
        await delay(1000)
        applyButton.click()
        if (headerElement && headerElement.textContent.trim() === "Job search safety reminder") {
            // Find the button with text content "Continue applying"
            const button = Array.from(document.querySelectorAll("button")).find(
                btn => btn.textContent.trim() === "Continue applying"
            );
        
            // If the button is found, trigger a click
            if (button) {
                button.click();
                console.log("Button clicked!");
            } else {
                console.log("Button not found.");
            }
        }
        await waitForCompletion();
    }
}

function waitForCompletion(duration: number = 10000): Promise<void> {
    return new Promise((resolve) => {
        console.log(`Waiting for ${duration / 1000} seconds...`);
        setTimeout(() => {
            console.log("Wait completed");
            resolve();
        }, duration);
    });
}

async function handleEasyApply() {
    await handleMultiPageForm();
    const submitButton = document.querySelector('button[aria-label="Submit application"]') as HTMLButtonElement;
    if (submitButton) {
        console.log("Submitting application...");
        submitButton.click();
        await delay(2000);
        console.log(userId)
       
      
    } else {
        console.log("Submit button not found. Application may require manual review.");
    }
}

async function handleExternalApply() {
    console.log("External Apply detected. Opening in new tab...");
    chrome.runtime.sendMessage({ 
        type: MessageType.NEW_APPLY_TAB_OPENED, 
        jobDetails: jobDetails,
        resumeText: resumeText,
    });
}

 function findResumeField() {
        const resumeSelectors = [
            'input[type="file"][id*="jobs-document-upload"]',
            'input[type="file"][name*="resume"]',
            'input[type="file"][aria-label*="Upload resume"]'
        ];
    
        for (const selector of resumeSelectors) {
            const resumeField = document.querySelector(selector);
            if (resumeField) return resumeField;
        }
    
        return null;
    }

    async function handleMultiPageForm() {
        let pageCount = 0;
        const maxPages = 15;
    
        while (pageCount < maxPages) {
            console.log(`Filling form page ${pageCount + 1}`);
    
            const resumeField = findResumeField();
            if (resumeField) {
                console.log("Resume upload field found on this page");
                const resumeUrl = chrome.runtime.getURL(jobDetails.resume)
                await uploadResume(resumeUrl);
                await delay(2000);
            }
    
           const sectionTitle = getSectionTitle();
            console.log("get section title", sectionTitle);
            const reviewSection = getReviewSection();

    
            if (sectionTitle === "Work experience") {
                await handleWorkExperienceSection();
            } 
            else if(sectionTitle === "Education") {
                console.log("Education")
                await handleEducationSection();
            }
            else if(reviewSection) {
                const checkbox = document.querySelector('#follow-company-checkbox') as HTMLInputElement
                if(checkbox) {
                    checkbox.checked = false;
                    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            console.log("review section skipping")
                }
                  
            }
            else {
                await fillFormWithAI();
            }
    
            await delay(2000);
    
            if (document.querySelector('button[aria-label="Submit application"]')) {
                console.log('Found submit application button. Stopping form fill process.');
                break;
            }
    
            if (clickNextOrSubmitButton()) {
                console.log('Moving to next page of the form');
                pageCount++;
            } else {
                console.log('Form completion process finished');
                break;
            }
    
            await delay(2000);
        }
    
        if (pageCount >= maxPages) {
            console.log('Reached maximum number of form pages. Process stopped.');
        }
    }


    function getSectionTitle(): string {
        const sectionTitleElement = document.querySelector('h3.t-16.mb2 span.t-bold') || document.querySelector('h3.t-16.t-bold');
        return sectionTitleElement?.textContent?.trim() || 'Unknown Section';
    }

function extractFormFields(): Record<string, FormField> {
    const formFields: Record<string, FormField> = {};
  
    // Extract select fields (multiple choice)
    document.querySelectorAll(selectors.select).forEach((select: HTMLSelectElement) => {
      const id = select.id;
      const label = document.querySelector(`label[for="${id}"]`)?.textContent?.trim() || '';
      
      formFields[id] = {
        id,
        type: 'select',
        inputType: null,
        label,
        placeholder: '',
        required: select.required,
        options: Array.from(select.options).map(opt => opt.value),
        element: select
      };
    });
  
    // Extract radio groups
    document.querySelectorAll(selectors.fieldset).forEach((fieldset: HTMLFieldSetElement) => {
      const legend = fieldset.querySelector('legend');
      const radioButtons = fieldset.querySelectorAll('input[type="radio"]');
  
      if (legend && radioButtons.length > 0) {
        const fieldName = fieldset.id || 'radioGroup' + Math.random().toString(36).substr(2, 9);
        const legendText = legend.textContent?.trim() || '';
        const isRequired = legend.querySelector('.fb-dash-form-element__label-title--is-required') !== null;
  
        formFields[fieldName] = {
          id: fieldName,
          type: 'radio',
          inputType: 'radio',
          label: legendText,
          placeholder: '',
          required: isRequired,
          options: Array.from(radioButtons).map((radio: HTMLInputElement) => radio.value),
          element: radioButtons[0] as HTMLElement
        };
      }
    });
  
    // Extract other input fields
    document.querySelectorAll(selectors.textInput).forEach((input: HTMLInputElement | HTMLTextAreaElement) => {
      const id = input.id;
      const label = document.querySelector(`label[for="${id}"]`)?.textContent?.trim() || '';
      
      formFields[id] = {
        id,
        type: input.tagName.toLowerCase(),
        inputType: input instanceof HTMLInputElement ? input.type : null,
        label,
        placeholder: input.placeholder,
        required: input.required,
        options: null,
        element: input
      };
    });
  
    // Extract checkboxes
    document.querySelectorAll(selectors.checkbox).forEach((checkbox: HTMLInputElement) => {
      const id = checkbox.id;
      const label = document.querySelector(`label[for="${id}"]`)?.textContent?.trim() || '';
      
      formFields[id] = {
        id,
        type: 'checkbox',
        inputType: 'checkbox',
        label,
        placeholder: '',
        required: checkbox.required,
        options: null,
        element: checkbox
      };
    });
  
    // Extract the resume upload field explicitly
    const resumeUploadField = document.querySelector(selectors.documentUploadInput) as HTMLInputElement;
    if (resumeUploadField) {
      formFields['resume'] = {
        id: 'resume',
        type: 'file',
        inputType: 'file',
        label: 'Upload resume',
        placeholder: '',
        required: resumeUploadField.hasAttribute('required'),
        options: null,
        element: resumeUploadField
      };
    }
  
    return formFields;
  }

  



  async function uploadResume(resumeUrl: string) {
    try {
        const fileInput = await findFileInputWithRetry();
        if (!fileInput) {
            console.error("File input not found after multiple attempts");
            return;
        }

        // Create PDF from URL
        
        const pdfData = await createPDFFromURL(resumeUrl);
        
        // Create a File object
        const resumeFile = new File([pdfData], "resume.pdf", { type: 'application/pdf' });
        console.log(resumeFile)
        // Set the file
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(resumeFile);
        fileInput.files = dataTransfer.files;

        // Dispatch events
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));

        console.log("Resume file attached successfully");

        // Find and click the upload button
        const uploadButton = await findUploadButtonWithRetry();
        if (uploadButton) {
            uploadButton.click();
            console.log("Upload button clicked");
            await delay(2000); // Wait for upload to complete
        } else {
            console.log("Upload button not found, but file has been attached to input");
        }

    } catch (error) {
        console.error("Error uploading resume:", error);
    }
}

async function findFileInputWithRetry(maxAttempts = 5, interval = 1000): Promise<HTMLInputElement | null> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const fileInput = document.querySelector('input[type="file"][id*="jobs-document-upload"]') as HTMLInputElement;
        if (fileInput) {
            return fileInput;
        }
        await new Promise(resolve => setTimeout(resolve, interval));
    }
    return null;
}

async function findUploadButtonWithRetry(maxAttempts = 5, interval = 1000): Promise<HTMLLabelElement | null> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const uploadButton = document.querySelector('label[for*="jobs-document-upload"]') as HTMLLabelElement;
        if (uploadButton) {
            return uploadButton;
        }
        await new Promise(resolve => setTimeout(resolve, interval));
    }
    return null;
}




async function fillFormWithAI() {

    let sectionTitle = 'Unknown Section';
    const sectionTitleElement = document.querySelector('h3.t-16.mb2 span.t-bold');
    const alternativeSectionTitleElement = document.querySelector('h3.t-16.t-bold');
    if (sectionTitleElement) {
        sectionTitle = sectionTitleElement.textContent?.trim() || "";
    } else if (alternativeSectionTitleElement) {
        sectionTitle = alternativeSectionTitleElement.textContent?.trim() || "";
    }
    console.log("SectionTitle", sectionTitle);

   

const reviewSection = document.querySelector('h3.t-18[textContent="Review your application"]')



const elements = document.querySelectorAll('.jobs-easy-apply-form-section__group-title.t-14');
const linkedInProfileElement = Array.from(elements).find(el => el.textContent.trim() === 'LinkedIn Profile*');
        
        const formFields = extractFormFields();

        console.log("Work experience section not found.")
        for (const [fieldName, fieldInfo] of Object.entries(formFields)) {
            if (fieldName.includes('resume')  && fieldInfo.type == "file") {
                console.log("Skipping resume field in fillFormWithAI");
                continue;
            }
            else if(fieldInfo.label.includes("First name") ) {
                console.log("Skipping name field in fillFormWithAI");
                
                fieldInfo.element.value = jobDetails.fullName.split(" ")[0]
                fieldInfo.element.dispatchEvent(new Event('input', { bubbles: true }));
                fieldInfo.element.dispatchEvent(new Event('change', { bubbles: true }));
                continue;
            }
            else if(fieldInfo.label.includes("Last name") ) {
                console.log("Skipping name field in fillFormWithAI");
                fieldInfo.element.value = jobDetails.fullName.split(" ")[1]
                fieldInfo.element.dispatchEvent(new Event('input', { bubbles: true }));
                fieldInfo.element.dispatchEvent(new Event('change', { bubbles: true }));
                continue;
            }
            else if(fieldInfo.label.toLocaleLowerCase().includes("email") && fieldInfo.type === "select") {
                console.log("Skipping email field")
                continue;
            }
            else if(fieldInfo.label.includes("Phone country code") && fieldInfo.type === "select") {
                await handleSelectField(fieldInfo.element as HTMLSelectElement, "Nepal (+977)")
                continue
            }
            else if(fieldInfo.label.toLocaleLowerCase().trim().includes("phone") && sectionTitle.includes("Contact info") ) {
                fieldInfo.element.value = jobDetails.phone
                fieldInfo.element.dispatchEvent(new Event('input', { bubbles: true }));
                fieldInfo.element.dispatchEvent(new Event('change', { bubbles: true }));
              continue;
            }
            else if (fieldInfo.element instanceof HTMLInputElement && fieldInfo.element.type === 'checkbox') {
                if (fieldInfo.required || 
                    fieldInfo.label.toLowerCase().includes('acknowledge') || 
                    fieldInfo.label.toLowerCase().includes('confirm') ||
                    fieldInfo.label.toLowerCase().includes('privacy policy') ||
                    fieldInfo.label.toLowerCase().includes('consent') ||
                    fieldInfo.label.toLowerCase().includes('conditions') ||
                    fieldInfo.label.toLowerCase().includes('conditions')
                ) {
                    fieldInfo.element.checked = true;
                    fieldInfo.element.dispatchEvent(new Event('change', { bubbles: true }));
                    continue;
                }         
            }     
             else if(fieldInfo.label == null && fieldInfo.element.value ==!null) {
                console.log("Skipping it has already value");
                continue;
            } else if(reviewSection) {
                const checkbox = document.querySelector('#follow-company-checkbox') as HTMLInputElement
                 checkbox.checked = false;
                 checkbox.dispatchEvent(new Event('change', { bubbles: true }));
                continue
            } else if(linkedInProfileElement) {
                continue;
            }

  
            await fillFormField(fieldName, fieldInfo, jobDetails, resumeText);
            await delay(500);
    
        }
    
 
    console.log('Form filled using AI');
}


async function removeAllWorkExperiences(section: Element) {
    const entries = section.querySelectorAll('.artdeco-card');
    for (let i = entries.length - 1; i >= 0; i--) {
        await removeEntry(entries[i]);
    }
    console.log("All work experience entries removed.");
}

async function removeEducation() {
  
        // Step 1: Click the initial Remove button
        const initialRemoveButton = document.querySelector('button[aria-label="Remove the following work experience"].artdeco-button');
        if (initialRemoveButton) {
            initialRemoveButton.click();
            console.log("Initial Remove button clicked successfully");
        }
       

        // Wait for the confirmation modal to appear
        await new Promise(resolve => setTimeout(resolve, 1000)); // Adjust timing as needed

        // Step 2: Click the confirmation Remove button
        // Using a more robust selector that doesn't rely on a specific ID
        const confirmRemoveButton = document.querySelector('button.artdeco-modal__confirm-dialog-btn.artdeco-button--primary[data-test-dialog-primary-btn]');
        if (confirmRemoveButton) {
            confirmRemoveButton.click();
            console.log("Confirm Remove button clicked successfully");
        }
 

        // Wait for any post-removal processes to complete
        await new Promise(resolve => setTimeout(resolve, 1000)); // Adjust timing as needed

   
   
}


async function removeEntry(entry: Element) {
    const removeButton = entry.nextElementSibling?.querySelector('button[aria-label="Remove the following work experience"]') as HTMLButtonElement | null;
    if (removeButton) {
        removeButton.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}



async function fillEducationFields(experience: WorkExperience) {
    const formFields = extractFormFields();
    
    for (const [fieldName, fieldInfo] of Object.entries(formFields)) {
        const label = fieldInfo.label
        const element = fieldInfo.element;

        if (!element) continue;

        console.log(`Processing work experience field: ${fieldName}`);

        if (label.toLowerCase().includes('school')) {
            console.log("I am in school")
            await fillField(element, experience.school);
        } else if (label.toLowerCase().includes('degree')) {
            console.log("I am degree")
            await fillField(element, experience.degree);
        } else if (label.toLowerCase().includes('location') || label.toLowerCase().includes('city')) {
            console.log("I am city")
            await handleCityField(element, experience.city);
        } else if (label.toLowerCase().includes('field of study')) {
            console.log("I am major")
            await fillField(element, experience.major);
        } else if (fieldInfo.label.toLowerCase().includes('dates of employment') || fieldName.includes('dateRange')) {
            console.log("date of range", fieldName)
            
            await fillEmploymentDates(fieldInfo.element.closest('.jobs-easy-apply-form-element'), `${experience.startDate} - ${experience.endDate}`);
            console.log(`${experience.startDate} - ${experience.endDate}`)
        }
        else {
          await fillFormWithAI()
        }

        await delay(1000);
    }
}


async function fillWorkExperienceFields(experience: WorkExperience) {
    const formFields = extractFormFields();
    
    for (const [fieldName, fieldInfo] of Object.entries(formFields)) {
        const label = fieldInfo.label
        const element = fieldInfo.element;

        if (!element) continue;

        console.log(`Processing work experience field: ${fieldName}`);

        if (label.toLowerCase().includes('title')) {
            console.log("I am in title")
            await fillField(element, experience.title);
        } else if (label.toLowerCase().includes('company')) {
            console.log("I am company")
            await fillField(element, experience.company);
        } else if (label.toLowerCase().includes('location') || label.toLowerCase().includes('city')) {
            console.log("I am city")
            await handleCityField(element, experience.city);
        } else if (label.toLowerCase().includes('description')) {
            console.log("I am description")
            await fillField(element, experience.description);
        } else if (fieldInfo.label.toLowerCase().includes('dates of employment') || fieldName.includes('dateRange')) {
            console.log("Hello i am sushen oli", fieldName)
            
            await fillEmploymentDates(fieldInfo.element.closest('.jobs-easy-apply-form-element'), `${experience.startDate} - ${experience.endDate}`);
            console.log(`${experience.startDate} - ${experience.endDate}`)
        }
        else {
          await fillFormWithAI()
        }

        await delay(1000);
    }
}

async function fillField(element: HTMLElement, value: string) {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        element.value = value;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (element instanceof HTMLSelectElement) {
        await handleSelectField(element, value);
    }
}
function getReviewSection() {
    // Method 1: Using querySelector with exact text match
    const reviewSection = document.querySelector('h3.t-18:not([id])');
    if (reviewSection && reviewSection.textContent.trim() === "Review your application") {
        return reviewSection;
    }

    // Method 2: Using evaluate for partial text match (more flexible)
    const xpathResult = document.evaluate(
        "//h3[contains(@class, 't-18') and contains(text(), 'Review your application')]",
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
    );

    return xpathResult.singleNodeValue;
}



async function handleWorkExperienceSection() {
    
    const workExperienceSection = document.querySelector('.jobs-easy-apply-form-section__grouping');

    if (workExperienceSection) {
        // Remove existing entries
        await removeAllWorkExperiences(workExperienceSection);
        await handleAddMore()
        // Add and fill new entries
        console.log(workExperiences)
        for (let i = 0; i < workExperiences.length; i++) {
            const experience = workExperiences[i];
            console.log(`Filling work experience ${i + 1}:`, experience);

            await fillWorkExperienceFields(experience);
            await clickSaveButton();
           
            if(workExperiences.length > i+1){
                console.log(workExperiences.length)
                console.log("Work experience not requireed i am sushen oli what 's your name")
                await handleAddMore();
            } else {
                console.log("What's up what are you doing")
            }
            await delay(1000);
        }
    } else {
        console.log("Work experience section not found");
    }
}

async function handleEducationSection() {
    
        // Remove existing entries
        await removeEducation()
        await handleAddMore()
        // Add and fill new entries
        for (let i = 0; i < educations.length; i++) {
            const experience = educations[i];
            console.log(`Filling work experience ${i + 1}:`, experience);
          
            await fillEducationFields(experience)
            await clickSaveButton();
            await delay(1500)
            if(educations.length > i+1){
                console.log(educations.length)
                console.log("Work experience not requireed i am sushen oli what 's your name")
                await handleAddMore();
            } else {
                console.log("What's up what are you doing")
            }
            await delay(2000);
        }
  
}





function handleAddMore() {
    const addMoreButton = document.querySelector('button.jobs-easy-apply-repeatable-groupings__add-button[type="button"]') as HTMLButtonElement
    
    if (addMoreButton) {
        console.log("'Add more' button found. Attempting to click...");
        addMoreButton.click();
        return new Promise(resolve => setTimeout(resolve, 1000));
    } else {
        console.log("'Add more' button not found.");
        return Promise.resolve();
    }
}


async function fillFormField(fieldName: string, fieldInfo: any, jobDetails: JobDetail, resumeText: string) {
 
 
    let sectionTitle = 'Unknown Section';
    const sectionTitleElement = document.querySelector('h3.t-16.mb2 span.t-bold');
    const alternativeSectionTitleElement = document.querySelector('h3.t-16.t-bold');
    if (sectionTitleElement) {
        sectionTitle = sectionTitleElement.textContent?.trim() || "";
    } else if (alternativeSectionTitleElement) {
        sectionTitle = alternativeSectionTitleElement.textContent?.trim() || "";
    }
    console.log("SectionTitle", sectionTitle);

    const prompt = `
    You are an AI assistant designed to accurately fill out job application forms based on my information provided earlier 
  
    Current section: "${sectionTitle}"

    Field details:
    - Name: ${fieldName}
    - Type: ${fieldInfo.type}
    - Label: ${fieldInfo.label}
    - Placeholder: ${fieldInfo.placeholder}
    - Required: ${fieldInfo.required}
    - Options: ${fieldInfo.options ? fieldInfo.options.join(', ') : 'N/A'}

    Please if any terms and condition area asked it should be true
    Give Answer Based on the formFields, types, label, placeholder and options, section Title, 
    If the field is required then fill the that field cumpulsory
    Rules:
    1. Provide ONLY the value to fill the field. No explanations.
    2. For location fields, provide a comma-separated list of relevant cities from the options.
    3. For numeric fields, provide a realistic number based on the context, Don't use any other arithmetical or logical symbol. You can also use 0 if needed
    4. For text fields, provide relevant information from the resume or job details. Avoid using 'N/A'.
    5. For multiple choice, select the most appropriate option from the provided list.
    6. For salary expectations, give a reasonable estimate based on the job details, job description and resume.
    7. For dates, use the format 'MM/YYYY - MM/YYYY' or 'MM/YYYY - present'. Always provide full dates.
    8. For work experience fields, extract relevant information from the resume.
    9. If the field is related to the current section title, ensure the answer is contextually appropriate.
    10. For employment dates, always provide a full date range (e.g., '01/2021 - present' or '03/2019 - 12/2020').
    11. Sometimes think deeply if the question is When will be your expected graduation date write only date(eg: 2020) not date range you should know where to use date and when to use date range. You can see the placeholder based on that give the value in date if there is a placeholder
    12. Generate the content without using placeholders or asking for additional user input.
    13. If there any question write the full answer. Sometimes there are thecnical questions.
    14. In cover letter write the full cover letter based on the user details , job description and user resume text.
    15. In select field please give the option which is available in the select field except "select an option". Check the select field , option value and name of the option and based on the question provide the value of option.
    16. For radio button which have option yes or no it should give one of them . Don't give null.
    17. Please don't give unnecessary answer. Don't give any explanation
    
    Respond with ONLY the value to be entered in the field. Don't write any explanation.
    `;

    try {
        const aiResponse = await queryLLM(prompt);
        console.log(`AI Response for field ${fieldName}: `, aiResponse);
        console.log("Label", fieldInfo.label);
        console.log("Required", fieldInfo.required)
        console.log("Placeholder", fieldInfo.placeholder)
        
        if (aiResponse && fieldInfo.element) {
            const value = aiResponse.trim();

            if (fieldInfo.type === 'checkbox' && fieldInfo.options) {
                await handleCheckboxGroup(fieldInfo, value);
            } else if (fieldInfo.element instanceof HTMLInputElement && fieldInfo.element.type === 'radio') {
                await handleRadioField(fieldInfo.element, value);
            }  else if (fieldInfo.element instanceof HTMLSelectElement) {
                await handleSelectField(fieldInfo.element, value);
            } else if (fieldInfo.element instanceof HTMLInputElement && fieldInfo.element.type === 'checkbox') {
                if (fieldInfo.required || 
                    fieldInfo.label.toLowerCase().includes('acknowledge') || 
                    fieldInfo.label.toLowerCase().includes('confirm') ||
                    fieldInfo.label.toLowerCase().includes('privacy policy') ||
                    fieldInfo.label.toLowerCase().includes('consent') ||
                    fieldInfo.label.toLowerCase().includes('conditions')
                ) {
                    fieldInfo.element.checked = true;
                } else {
                    fieldInfo.element.checked = value.toLowerCase() === 'yes' || value.toLowerCase() === 'true';
                }
                fieldInfo.element.dispatchEvent(new Event('change', { bubbles: true }));
            } else if (fieldInfo.label.toLowerCase().includes('city')) {
                await handleCityField(fieldInfo.element, value);
            } else {
                fieldInfo.element.value = value;
                fieldInfo.element.dispatchEvent(new Event('input', { bubbles: true }));
                fieldInfo.element.dispatchEvent(new Event('change', { bubbles: true }));
            }
        } else {
            console.error("Invalid AI response for field:", fieldName);
        }
    } catch (error) {
        console.error("Error filling form field:", fieldName, error);
    }
}

async function clickSaveButton() {
    // Find the button with the class 'artdeco-button--secondary'
    const saveButton = document.querySelector('button.artdeco-button--secondary');

    // Check if the button exists and if the text content is 'Save'
    if (saveButton && saveButton.textContent.trim().toLowerCase() === 'save') {
        console.log('Clicking Save button');
        
        // Wait for 1 second (1000 milliseconds)
        await delay(1000);
        
        // Click the save button
        saveButton.click();
        
        return true;  // Indicate that the button was clicked
    }

    // If the button was not found, log and return false
    console.log('Save button not found');
    return false;
}



async function handleCheckboxGroup(fieldInfo: any, value: string) {
    const selectedOptions = value.split(',').map(option => option.trim().toLowerCase());
    fieldInfo.options.forEach((option: any) => {
        const checkbox = option.element as HTMLInputElement;
        const shouldBeChecked = selectedOptions.includes(option.label.toLowerCase());
        checkbox.checked = shouldBeChecked;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    });
}


async function handleRadioField(radioElement: HTMLInputElement, value: string) {
    const fieldset = radioElement.closest('fieldset');
    if (!fieldset) {
        console.error("Radio button not within a fieldset");
        return;
    }

    const radioButtons = fieldset.querySelectorAll('input[type="radio"]');
    const normalizedValue = value.toLowerCase().trim();

    let selectedRadio: HTMLInputElement | null = null;

    radioButtons.forEach((radio: HTMLInputElement) => {
        const radioLabel = radio.nextElementSibling as HTMLLabelElement;
        const radioLabelText = radioLabel ? radioLabel.textContent?.trim().toLowerCase() : '';
        
        if (radio.value.toLowerCase() === normalizedValue || 
            radioLabelText === normalizedValue ||
            radioLabelText.includes(normalizedValue)) {
            selectedRadio = radio;
        }
    });

    if (selectedRadio) {
        selectedRadio.checked = true;
        selectedRadio.dispatchEvent(new Event('change', { bubbles: true }));
        console.log(`Selected radio option: ${selectedRadio.value}`);
    } else {
        console.warn(`No matching radio option found for value: ${value}`);
        // Fallback: select the first option if no match is found
        const firstRadio = radioButtons[0] as HTMLInputElement;
        if (firstRadio) {
            firstRadio.checked = true;
            firstRadio.dispatchEvent(new Event('change', { bubbles: true }));
            console.log(`Fallback: Selected first radio option: ${firstRadio.value}`);
        }
    }
}


async function handleSelectField(selectElement: HTMLSelectElement, value: string | number | undefined) {
    if (!selectElement) {
        console.error("Select element is undefined");
        return;
    }

    if (value === undefined) {
        console.warn("Value is undefined, selecting first non-empty option");
        selectElement.selectedIndex = Array.from(selectElement.options).findIndex(opt => opt.value !== "") || 0;
        selectElement.dispatchEvent(new Event('change', { bubbles: true }));
        return;
    }

    const normalizedValue = String(value).toLowerCase().trim();

    // First, try to match by value
    const optionByValue = Array.from(selectElement.options).find(opt => 
        opt.value.toLowerCase() === normalizedValue
    );

    if (optionByValue) {
        selectElement.value = optionByValue.value;
    } else {
        // If no match by value, try to match by text content
        const optionByText = Array.from(selectElement.options).find(opt => 
            opt.textContent?.toLowerCase().includes(normalizedValue)
        );

        if (optionByText) {
            selectElement.value = optionByText.value;
        } else {
            console.warn(`No matching option found for "${value}", selecting first non-empty option`);
            selectElement.selectedIndex = Array.from(selectElement.options).findIndex(opt => opt.value !== "") || 0;
        }
    }

    selectElement.dispatchEvent(new Event('change', { bubbles: true }));

    return new Promise(resolve => setTimeout(resolve, 300));

}




async function handleCityField(inputElement: HTMLInputElement, value: string) {
    inputElement.value = value;
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    console.log("I am in city")
    // Wait for autocomplete suggestions to appear
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Simulate selecting the first option
    inputElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 2000));
    inputElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
}

async function fillEmploymentDates(element: HTMLElement, value: string, retries = 3) {
 
    if (retries === 0) {
        console.error("Max retries reached for fillEmploymentDates");
        return;
    }

    const [startDate, endDate] = value.split(' - ').map(d => d.trim());
    
    const dateInputs = {
        start: {
            month: document.querySelector('.fb-date-range__date-select[data-test-date-dropdown="start"] select[name="month"]') as HTMLSelectElement,
            year: document.querySelector('.fb-date-range__date-select[data-test-date-dropdown="start"] select[name="year"]') as HTMLSelectElement,
            alternative: document.querySelector('input[name="dateRange.start"]') as HTMLInputElement
        },
        end: {
            month: document.querySelector('.fb-date-range__date-select[data-test-date-dropdown="end"] select[name="month"]') as HTMLSelectElement,
            year: document.querySelector('.fb-date-range__date-select[data-test-date-dropdown="end"] select[name="year"]') as HTMLSelectElement,
            alternative: document.querySelector('input[name="dateRange.end"]') as HTMLInputElement
        }
    };

    console.log('Date inputs found:', {
        startMonth: !!dateInputs.start.month,
        startYear: !!dateInputs.start.year,
        startAlternative: !!dateInputs.start.alternative,
        endMonth: !!dateInputs.end.month,
        endYear: !!dateInputs.end.year,
        endAlternative: !!dateInputs.end.alternative
    });

    const currentCheckboxes = [
        'I currently work here',
        'I currently attend this institution',
        'I currently volunteer here',
        'This position is currently active',
        'I am currently in this role'
      ].map(text => {
        const checkboxes = document.querySelectorAll(selectors.checkbox);
        return Array.from(checkboxes).find(checkbox => {
          const id = (checkbox as HTMLInputElement).id;
          const label = document.querySelector(`label[for="${id}"]`)?.textContent?.trim();
          return label === text;
        }) as HTMLInputElement | null;
      }).filter(Boolean);


    // If no date inputs are found, retry after a delay
    if (!dateInputs.start.month && !dateInputs.start.year && !dateInputs.start.alternative) {
    
        await new Promise(resolve => setTimeout(resolve, 1000));
        return fillEmploymentDates(element, value, retries - 1);
    }

    // Check if it's a current position
    const isCurrentPosition = endDate && ['present', 'current', 'ongoing', 'now'].some(term => endDate.toLowerCase().includes(term));
    const currentCheckbox = currentCheckboxes.find(checkbox => checkbox !== null);
    
    if (isCurrentPosition || (currentCheckbox && currentCheckbox.checked)) {
     
        if (currentCheckbox && !currentCheckbox.checked) {
            currentCheckbox.checked = true;
            currentCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
           
        }
    }else {
        console.log("Position is not current")
    }

    // Fill start date
    if (startDate) {
       
        const { month: startMonth, year: startYear } = parseDate(startDate);
        
        
        if (dateInputs.start.alternative) {
            dateInputs.start.alternative.value = startDate;
            dateInputs.start.alternative.dispatchEvent(new Event('input', { bubbles: true }));
            dateInputs.start.alternative.dispatchEvent(new Event('change', { bubbles: true }));
           
        } else {
            if (dateInputs.start.month && startMonth !== null) {
                try {
                    await handleSelectField(dateInputs.start.month, startMonth);
                    
                } catch (error) {
                    console.error('Error setting start month:', error);
                }
            } else {
                console.warn("Could not set start month. Element exists:", !!dateInputs.start.month, "Month value:", startMonth);
            }
            if (dateInputs.start.year && startYear !== null) {
                try {
                    await handleSelectField(dateInputs.start.year, startYear);
                   
                } catch (error) {
                    console.error('Error setting start year:', error);
                }
            } else {
                console.warn("Could not set start year. Element exists:", !!dateInputs.start.year, "Year value:", startYear);
            }
        }
    } else {
        console.warn("No start date provided");
    }

    // Fill end date only if it's not a current position
    if (!isCurrentPosition && !(currentCheckbox && currentCheckbox.checked) && endDate) {
        
        const { month: endMonth, year: endYear } = parseDate(endDate);
       
        
        if (dateInputs.end.alternative) {
            dateInputs.end.alternative.value = endDate;
            dateInputs.end.alternative.dispatchEvent(new Event('input', { bubbles: true }));
            dateInputs.end.alternative.dispatchEvent(new Event('change', { bubbles: true }));
          
        } else {
            if (dateInputs.end.month && endMonth !== null) {
                try {
                    await handleSelectField(dateInputs.end.month, endMonth);
                  
                } catch (error) {
                    console.error('Error setting end month:', error);
                }
            } else {
                console.warn("Could not set end month. Element exists:", !!dateInputs.end.month, "Month value:", endMonth);
            }
            if (dateInputs.end.year && endYear !== null) {
                try {
                    await handleSelectField(dateInputs.end.year, endYear);
              
                } catch (error) {
                    console.error('Error setting end year:', error);
                }
            } else {
                console.warn("Could not set end year. Element exists:", !!dateInputs.end.year, "Year value:", endYear);
            }
        }
    } else {
        console.log("Skipping end date as position is current");
    }

    // Dispatch change events for all filled select elements
    Object.values(dateInputs).forEach(dateInput => {
        Object.values(dateInput).forEach(input => {
            if (input && input.value) {
                input.dispatchEvent(new Event('change', { bubbles: true }));
              
            }
        });
    });
}

function parseDate(dateString: string): { month: number | null, year: number | null } {
    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    const monthAbbreviations = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

    // Remove any non-alphanumeric characters and convert to lowercase
    const cleanedDate = dateString.replace(/[^a-zA-Z0-9]/g, ' ').toLowerCase();
    const parts = cleanedDate.split(/\s+/);

    let month: number | null = null;
    let year: number | null = null;

    for (const part of parts) {
        if (month === null) {
            // Check if part is a month name or abbreviation
            const monthIndex = monthNames.indexOf(part);
            if (monthIndex !== -1) {
                month = monthIndex + 1;
                continue;
            }
            const abbrevIndex = monthAbbreviations.indexOf(part);
            if (abbrevIndex !== -1) {
                month = abbrevIndex + 1;
                continue;
            }
            // Check if part is a numeric month
            if (/^(0?[1-9]|1[0-2])$/.test(part)) {
                month = parseInt(part, 10);
                continue;
            }
        }

        if (year === null) {
            // Check if part is a year (assuming years between 1900 and 2100)
            if (/^(19|20)\d{2}$/.test(part)) {
                year = parseInt(part, 10);
                continue;
            }
        }
    }

    return { month, year };
}

function clickNextOrSubmitButton() {
    const buttonSelectors = [
        'button[aria-label="Submit application"]',
        'button[aria-label="Review your application"]',
        'button[aria-label="Continue to next step"]',
        'button[type="submit"]',
        'input[type="submit"]',
        'button',
        '.artdeco-button'
    ];

    for (const selector of buttonSelectors) {
        const buttons = document.querySelectorAll(selector);
        for (const button of buttons) {
            if (button instanceof HTMLElement && 
                button.offsetParent !== null &&
                (button.textContent?.toLowerCase().includes('review') ||
                 button.textContent?.toLowerCase().includes('submit') ||
                 button.textContent?.toLowerCase().includes('continue') ||
                 button.textContent?.toLowerCase().includes('next'))) {
                console.log(`Clicking button: ${button.textContent}`);
                button.click();
                return true;
            }
        }
    }

    console.log('No next, review, or submit button found');
    return false;
}
  
//Based on the job description, user details, and resume text, analyze how well the user's qualifications match the job requirements.
//  Return "Yes" if the user is a good match and should apply.
//  Return "No" if the user does not match the requirements or preferences for this job.
//  Job Description: ${allText}
//  User Details: ${JSON.stringify(jobDetails, null, 2)}

async function checkJobDescriptionFit(resumeUrl: string): Promise<boolean> {
    await processResume(resumeUrl);
    console.log("Resume Text:", resumeText);
    console.log("Job Details:", jobDetails);

    const inputPrompt = `
    Resumse text = ${resumeText}
    Job Details: ${jobDetails}
    Please respond with only "Yes" .`;

    try {
        const result = await chatSession.sendMessage(inputPrompt);
        console.log("API Response:", result);
        const response = result.response.text().trim();
        console.log("Parsed Response:", response);
        
        const normalizedResponse = response.toLowerCase();
        if (normalizedResponse === 'yes' || normalizedResponse === 'no') {
            aiResponse = normalizedResponse;
            return aiResponse === 'yes';
        } else {
            console.error("Unexpected AI response:", response);
            return false;
        }
    } catch (error) {
        console.error("Error sending message to Gemini API:", error);
        return false;
    }
}

async function processResume(resumeUrl: string): Promise<void> {
    try {
        const pdfData = await downloadPdf(resumeUrl);
        resumeText = await extractTextFromPdf(pdfData);
        console.log("Extracted Resume Text:", resumeText);
    } catch (error) {
        console.error("Error processing resume:", error);
        throw error;
    }
}

async function downloadPdf(pdfUrl: string): Promise<Blob> {
    const response = await fetch(pdfUrl);
    if (!response.ok) {
        throw new Error('Network response was not ok');
    }
    return await response.blob();
}

async function extractTextFromPdf(pdfData: Blob): Promise<string> {
    try {
        return await extractTextFromPDF(pdfData);
    } catch (error) {
        console.error('Error extracting text from PDF:', error);
        throw error;
    }
}
let totalToken =0
async function queryLLM(prompt: string) {
    try {
        const result = await chatSession.sendMessage(prompt);
        const response = result.response.text().trim();
        console.log( await chatSession.getHistory())
      
     
        const token = result.response.usageMetadata?.totalTokenCount
        totalToken = totalToken + token
        console.log(totalToken)
        
        return cleanResponse(response);
    } catch (error) {
        console.error('Error querying LLM:', error);
        return null;
    }
}

function cleanResponse(response: string): string {
    // Remove any explanatory text or additional context
    const lines = response.split('\n');
    return lines[lines.length - 1].trim();
}




 chrome.storage.local.get('applyId', (result) => {
    userId = result.applyId || "12134"
});

let workExperiences;
let educations

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.type === MessageType.START_JOB_SEARCH) {
        console.log("Starting job application process...");
        jobDetails = message.jobDetails; 
        
        workExperiences = jobDetails.workExperiences
        educations = jobDetails.educations
      
        console.log(userId)
        await delay(5000); // Wait for the page to load
        await processJobListings();
        sendResponse({ success: true });
        return true;
    }
});

// Initial setup


// Send a message to the background script when the content script is ready
// chrome.runtime.sendMessage({ action: 'contentScriptReady' });

// // Listen for data from the background script
// chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
//     if (message.action === 'sendData') {
//         jobDetails = message.jobDetails;
//         resumeText = message.resumeText;
//         console.log('Received data in content script:', { jobDetails, resumeText });
//         // Process the job application here
//         processJobListings();
//     }
// });
