import { MessageType } from '../messages';
import { chatSession } from '../../lib/GeminiAi';
import { delay } from './utils';
import { createPDFFromURL } from './pdfUtils';

type JobDetail = {
    name: string;
    email: string;
    resume: string;
    phone?: string;
    address?: string;
    workExperience?: string[];
    education?: string[];
    skills?: string[];
}

let jobDetails: JobDetail;
let resumeText: string;
let tabId: number;
let filledFields: Set<string> = new Set();
let fileUploadAttempts: Map<string, number> = new Map();
let lastInteractionTime = 0;
let isProcessingForm = false;

const MAX_ATTEMPTS = 5;
let attemptCount = 0;
const MAX_EXECUTION_TIME = 300000;
let startTime: number;


async function handleJobApplication() {
    console.log("Starting job application process...");
    startTime = Date.now();

    const skippedDomains = ['expertia.ai', 'elevationhr-talentstack.tal', 'sparibis.applicantstack', 'oxbo.io', 'wellfound'];
    for (const domain of skippedDomains) {
        if (window.location.href.includes(domain)) {
            console.log(`${domain} detected. Skipping application process.`);
            sendCompletedMessage('DOMAIN_SKIPPED');
            return;
        }
    }

    while (attemptCount < MAX_ATTEMPTS) {
        if (Date.now() - startTime > MAX_EXECUTION_TIME) {
            console.log("Execution time exceeded 5 minutes. Stopping application process.");
            sendCompletedMessage('TIME_LIMIT_EXCEEDED');
            return;
        }

        console.log(`Attempt ${attemptCount + 1} of ${MAX_ATTEMPTS}`);

        const form = await findApplicationForm();
        if (form) {
            await handleFormApplication(form);
        } else {
            const implicitForm = await findImplicitForm();
            if (implicitForm) {
                await handleImplicitFormApplication(implicitForm);
            } else {
                await handleButtonApplication();
            }
        }

        // Check if the application was successful
        if (await checkApplicationSuccess()) {
            sendCompletedMessage('APPLICATION_SUBMITTED');
            return;
        }

        attemptCount++;
        await delay(2000); // Wait before next attempt
    }

    console.log("Maximum attempts reached. Stopping application process.");
    sendCompletedMessage('MAX_ATTEMPTS_REACHED');
}

async function findImplicitForm(): Promise<Element | null> {
    console.log("Searching for implicit form...");
    const commonFields = ['name', 'first', 'last', 'email', 'resume', 'phone', 'address'];
    let fieldsFound = 0;

    const inputs = document.querySelectorAll('input, textarea, select');
    for (const input of inputs) {
        const inputInfo = getElementInfo(input);
        for (const field of commonFields) {
            if (inputInfo.name.toLowerCase().includes(field) || 
                inputInfo.id.toLowerCase().includes(field) || 
                inputInfo.label?.toLowerCase().includes(field)) {
                fieldsFound++;
                break;
            }
        }
    }

    if (fieldsFound >= 3) { // If we find at least 3 common fields, consider it an implicit form
        console.log(`Implicit form detected with ${fieldsFound} common fields`);
        return document.body; // Return the body element as the container of our implicit form
    }

    console.log("No implicit form detected");
    return null;
}


async function handleImplicitFormApplication(container: Element) {
    console.log("Handling implicit form-based application...");
    await findAndFillImplicitFormFields(container);
    await attemptImplicitFormSubmission(container);
}

async function findAndFillImplicitFormFields(container: Element) {
    console.log("Starting to find and fill implicit form fields...");
    const elements = container.querySelectorAll('input, select, textarea');
    
    for (const element of elements) {
        if (isVisibleElement(element) && isInteractiveElement(element)) {
            await handleElement(element);
        }
    }
}

async function attemptImplicitFormSubmission(container: Element) {
    const submitButton = await findSubmitButtonInContainer(container);
    if (submitButton) {
        console.log("Submit button found for implicit form. Checking if all required fields are filled...");
        const allRequiredFieldsFilled = await verifyRequiredFieldsInContainer(container);
        if (allRequiredFieldsFilled) {
            console.log("All required fields filled. Clicking submit button...");
            submitButton.click();
            await delay(5000); // Wait for submission
        } else {
            console.log("Some required fields are still empty in the implicit form.");
        }
    } else {
        console.log("No submit button found for implicit form.");
    }
}

async function findSubmitButtonInContainer(container: Element): Promise<HTMLElement | null> {
    const buttonSelectors = [
        'input[type="submit"]',
        'button[type="submit"]',
        'button',
        'input[type="button"]',
        'a'
    ];

    const potentialButtons = [];

    for (const selector of buttonSelectors) {
        const elements = container.querySelectorAll(selector);
        for (const element of elements) {
            if (isVisibleElement(element)) {
                console.log("Potential submit button found:", element);
                potentialButtons.push(element);
            }
        }
    }

    for (const button of potentialButtons) {
        const buttonInfo = getElementInfo(button);
        const aiResponse = await queryLLM(`
            Analyze this element:
            ${JSON.stringify(buttonInfo)}

            Is this element likely to be the submit button for a job application?
            Respond with only YES or NO.
        `);

        if (aiResponse.trim().toUpperCase() === 'YES') {
            console.log("AI confirmed submit button:", button);
            return button as HTMLElement;
        }
    }

    console.log("No AI-confirmed submit button found in container.");
    return null;
}

async function findApplicationForm(): Promise<HTMLFormElement | null> {
    const forms = document.querySelectorAll('form');
    for (const form of forms) {
        const formInfo = getElementInfo(form);
        const aiResponse = await queryLLM(`
            Analyze this form:
            ${JSON.stringify(formInfo)}

            Is this likely to be a job application form?
            Respond with only YES or NO.
        `);

        if (aiResponse.trim().toUpperCase() === 'YES') {
            console.log("AI confirmed job application form:", form);
            return form;
        }
    }

    console.log("No AI-confirmed job application form found.");
    return null;
}

async function handleFormApplication(form: HTMLFormElement) {
    console.log("Handling form-based application...");
    await findAndFillFormFields(form);
    await attemptSubmission(form);
}

async function handleButtonApplication() {
    console.log("Handling button-based application...");
    const applyButtons = await findApplyButtons();
    for (const button of applyButtons) {
        console.log("Clicking apply button:", button);
        button.click();
        await delay(2000);

        const form = await findApplicationForm();
        if (form) {
            await handleFormApplication(form);
            return;
        }
    }
}

async function findApplyButtons(): Promise<HTMLElement[]> {
    const buttonSelectors = [
        'button', 'input[type="button"]', 'input[type="submit"]', 'a'
    ];

    const potentialButtons: HTMLElement[] = [];

    // First, gather all potential "Apply" buttons
    for (const selector of buttonSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
            if (isVisibleElement(element)) {
                const buttonText = element.textContent?.trim().toLowerCase() || '';
                if (buttonText.includes('apply')) {
                    potentialButtons.push(element as HTMLElement);
                }
            }
        }
    }

    // Now, analyze all potential buttons at once
    const buttonInfos = potentialButtons.map((button, index) => ({
        index,
        text: button.textContent?.trim() || '',
        id: button.id || '',
        className: button.className || '',
        tagName: button.tagName.toLowerCase(),
        surroundingText: getSurroundingText(button)
    }));

    const aiResponse = await queryLLM(`
        Analyze these potential "Apply" buttons and their details:
        ${JSON.stringify(buttonInfos, null, 2)}

        Which button is most likely to be the "Apply for roles" button for job applications?
        Consider the following:
        1. Button text: Look for phrases like "Apply for roles" or similar.
        2. ID and class: These might contain keywords like "role", "job", "career", etc.
        3. Surrounding text: It might mention job applications or roles.
        4. Context: Consider which button seems most appropriate for applying to job roles.
        5. Not for batch or anything 
        6. For roles, job application it likes that.

        If none of the buttons seem to be for applying to job roles, respond with "NONE".
        Otherwise, respond with the index of the most appropriate button and a brief explanation of why you chose it.
    `);

    const result = aiResponse.trim().split('\n')[0];  // Get the first line of the response
    if (result === 'NONE') {
        console.log("No suitable 'Apply for roles' button found");
        return [];
    }

    const buttonIndex = parseInt(result, 10);
    if (isNaN(buttonIndex) || buttonIndex < 0 || buttonIndex >= potentialButtons.length) {
        console.log("Invalid button index returned by AI");
        return [];
    }

    console.log("AI confirmed 'Apply for roles' button:", potentialButtons[buttonIndex]);
    console.log("AI explanation:", aiResponse.trim().split('\n').slice(1).join('\n'));
    return [potentialButtons[buttonIndex]];
}

function getSurroundingText(element: Element, range: number = 100): string {
    let text = '';
    let current = element.previousSibling;
    while (current && text.length < range) {
        if (current.nodeType === Node.TEXT_NODE) {
            text = current.textContent + text;
        }
        current = current.previousSibling;
    }
    text += element.textContent;
    current = element.nextSibling;
    while (current && text.length < range * 2) {
        if (current.nodeType === Node.TEXT_NODE) {
            text += current.textContent;
        }
        current = current.nextSibling;
    }
    return text.trim();
}

async function findAndFillFormFields(form: HTMLFormElement) {
    console.log("Starting to find and fill form fields...");
    const elements = form.querySelectorAll('input, select, textarea');
    
    for (const element of elements) {
        if (isVisibleElement(element) && isInteractiveElement(element)) {
            await handleElement(element);
        }
    }
}

async function handleElement(element: Element) {
    const elementInfo = getElementInfo(element);
    const identifier = elementInfo.id || elementInfo.name;
    
    console.log(`Processing element:`, elementInfo);

    if (filledFields.has(identifier) && isAlreadyFilled(element)) {
        console.log(`Element ${identifier} is already filled. Skipping.`);
        return;
    }

    let prompt = `
        Analyze this form element:
        ${JSON.stringify(elementInfo)}

        Job Details: ${JSON.stringify(jobDetails)}

        This field ${isRequiredField(element, elementInfo) ? 'is' : 'might be'} required.
        Current value: ${isAlreadyFilled(element) ? 'FILLED' : 'EMPTY'}

        Should this field be filled? If yes, with what value?
        Respond with:
        1. YES|value - for fields that need to be filled
        2. N/A - for fields that should be skipped
        Use exact options for selects/radios. For file inputs, use UPLOAD_RESUME.
    `;

    console.log(`Sending prompt to LLM for element ${identifier}`);
    const aiResponse = await queryLLM(prompt);
    console.log(`LLM response for element ${identifier}:`, aiResponse);

    if (aiResponse.startsWith('YES|')) {
        const value = aiResponse.split('|')[1];
        console.log(`Attempting to fill element ${identifier} with value:`, value);
        await fillElement(element, value);
        if (isAlreadyFilled(element)) {
            console.log(`Successfully filled element ${identifier}`);
            filledFields.add(identifier);
        } else {
            console.log(`Failed to fill element ${identifier}`);
        }
    } else {
        console.log(`Skipping element ${identifier} based on LLM response`);
    }
}

async function fillElement(element: Element, value: string) {
    console.log(`Filling element:`, element, `with value:`, value);

    if (element instanceof HTMLInputElement) {
        switch (element.type) {
            case 'checkbox':
                element.checked = value.toLowerCase() === 'true';
                break;
            case 'radio':
                if (element.value.toLowerCase() === value.toLowerCase()) {
                    element.checked = true;
                }
                break;
            case 'file':
                if (value === 'UPLOAD_RESUME') {
                    await handleResumeUpload(element);
                }
                break;
            default:
                element.value = value;
        }
    } else if (element instanceof HTMLSelectElement) {
        await handleSelectField(element, value);
    } else if (element instanceof HTMLTextAreaElement) {
        element.value = value;
    } else if (element.getAttribute('contenteditable') === 'true') {
        element.textContent = value;
    }

    // Trigger events
    ['input', 'change', 'blur'].forEach(eventType => {
        const event = new Event(eventType, { bubbles: true });
        element.dispatchEvent(event);
    });

    console.log(`After filling, element value is:`, (element as any).value);
}

async function handleResumeUpload(fileInput: HTMLInputElement) {
    const fieldIdentifier = fileInput.id || fileInput.name || 'unknown';
    const attempts = fileUploadAttempts.get(fieldIdentifier) || 0;
    
    if (attempts >= 3) {
        console.log(`Skipping file upload for ${fieldIdentifier} - max attempts reached`);
        return;
    }

    fileUploadAttempts.set(fieldIdentifier, attempts + 1);

    console.log(`Attempting resume upload for ${fieldIdentifier}, attempt ${attempts + 1}`);
    
    try {
        // Check if there's a button that needs to be clicked before the file input appears
        const uploadButton = await findUploadButton(fileInput);
        if (uploadButton) {
            console.log("Clicking upload button to reveal file input");
            uploadButton.click();
            await delay(1000); // Wait for file input to appear
        }

        const pdfData = await createPDFFromURL(jobDetails.resume);
        const resumeFile = new File([pdfData], "resume.pdf", { type: 'application/pdf' });

        // Create a new DataTransfer object
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(resumeFile);
        
        // Assign the files to the input
        fileInput.files = dataTransfer.files;

        // Trigger events
        ['change', 'input'].forEach(eventType => {
            const event = new Event(eventType, { bubbles: true });
            fileInput.dispatchEvent(event);
        });

        // Verify the file was actually attached
        if (fileInput.files && fileInput.files.length > 0) {
            console.log(`Resume file successfully attached to ${fieldIdentifier}`);
        } else {
            throw new Error('File input appears empty after attachment attempt');
        }
    } catch (error) {
        console.error(`Error uploading resume to ${fieldIdentifier}:`, error);
        
        // If direct method failed, try alternative approaches
        try {
            // Try drag and drop simulation
            const dropEvent = new DragEvent('drop', { bubbles: true });
            Object.defineProperty(dropEvent, 'dataTransfer', {
                value: {
                    files: [new File([await createPDFFromURL(jobDetails.resume)], 'resume.pdf', { type: 'application/pdf' })]
                }
            });
            fileInput.dispatchEvent(dropEvent);
        } catch (altError) {
            console.error('Alternative file upload method also failed:', altError);
        }
    }
}

async function findUploadButton(fileInput: HTMLInputElement): Promise<HTMLElement | null> {
    const parent = fileInput.parentElement;
    if (!parent) return null;

    const buttons = parent.querySelectorAll('button, input[type="button"], a');
    for (const button of buttons) {
        const buttonInfo = getElementInfo(button);
        const aiResponse = await queryLLM(`
            Analyze this element:
            ${JSON.stringify(buttonInfo)}

            Is this element likely to be a button that reveals a file input for resume upload?
            Respond with only YES or NO.
        `);

        if (aiResponse.trim().toUpperCase() === 'YES') {
            console.log("AI confirmed upload button:", button);
            return button as HTMLElement;
        }
    }

    return null;
}

async function attemptSubmission(form: HTMLFormElement) {
    const submitButton = await findSubmitButton(form);
    if (submitButton) {
        console.log("Submit button found. Checking if all required fields are filled...");
        const allRequiredFieldsFilled = await verifyRequiredFields(form);
        if (allRequiredFieldsFilled) {
            console.log("All required fields filled. Clicking submit button...");
            submitButton.click();
            await delay(5000); // Wait for submission
        } else {
            console.log("Some required fields are still empty.");
        }
    }
}

async function verifyRequiredFields(form: HTMLFormElement): Promise<boolean> {
    const elements = form.querySelectorAll('*');
    for (const element of elements) {
        if (isVisibleElement(element) && isInteractiveElement(element)) {
            const elementInfo = getElementInfo(element);
            if (isRequiredField(element, elementInfo) && !isAlreadyFilled(element)) {
                console.log("Required field not filled:", elementInfo);
                return false;
            }
        }
    }
    return true;
}

async function findSubmitButton(form: HTMLFormElement): Promise<HTMLElement | null> {
    const buttonSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button',
        'input[type="button"]',
        'a'
    ];

    const potentialButtons = [];

    for (const selector of buttonSelectors) {
        const elements = form.querySelectorAll(selector);
        for (const element of elements) {
            if (isVisibleElement(element)) {
                console.log("Potential submit button found:", element);
                potentialButtons.push(element);
            }
        }
    }

    for (const button of potentialButtons) {
        const buttonInfo = getElementInfo(button);
        const aiResponse = await queryLLM(`
            Analyze this element:
            ${JSON.stringify(buttonInfo)}

            Is this element likely to be the submit button for a job application form?
            Respond with only YES or NO.
        `);

        if (aiResponse.trim().toUpperCase() === 'YES') {
            console.log("AI confirmed submit button:", button);
            return button as HTMLElement;
        }
    }

    console.log("No AI-confirmed submit button found.");
    return null;
}

async function checkApplicationSuccess(): Promise<boolean> {
   
    return false;
}

function sendCompletedMessage(status: string) {
    chrome.runtime.sendMessage({ 
        type: MessageType.COMPLETED, 
        status: status, 
        tabId: tabId 
    });
}


async function verifyRequiredFieldsInContainer(container: Element): Promise<boolean> {
    const elements = container.querySelectorAll('*');
    for (const element of elements) {
        if (isVisibleElement(element) && isInteractiveElement(element)) {
            const elementInfo = getElementInfo(element);
            if (isRequiredField(element, elementInfo) && !isAlreadyFilled(element)) {
                console.log("Required field not filled in implicit form:", elementInfo);
                return false;
            }
        }
    }
    return true;
}

function isVisibleElement(element: Element): boolean {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }
  
  function isInteractiveElement(element: Element): boolean {
    const interactiveTypes = ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A'];
    return interactiveTypes.includes(element.tagName) || element.getAttribute('contenteditable') === 'true';
  }
  
  function isRequiredField(element: Element, elementInfo: any): boolean {
    // Check for HTML5 required attribute
    if (element.hasAttribute('required')) return true;
    
    // Check for aria-required attribute
    if (element.getAttribute('aria-required') === 'true') return true;
    
    // Check if the label contains an asterisk or "required" text
    const label = elementInfo.label?.toLowerCase() || '';
    if (label.includes('*') || label.includes('required')) return true;
    
    // Check if placeholder contains "required"
    const placeholder = (element as HTMLInputElement).placeholder?.toLowerCase() || '';
    if (placeholder.includes('required')) return true;
    
    return false;
  }
  
  function isAlreadyFilled(element: Element): boolean {
    if (element instanceof HTMLInputElement) {
      switch (element.type) {
        case 'checkbox':
        case 'radio':
          return element.checked;
        case 'file':
          return element.files && element.files.length > 0;
        default:
          return element.value.trim() !== '';
      }
    } else if (element instanceof HTMLSelectElement) {
      return element.value !== '' && element.selectedIndex !== 0;
    } else if (element instanceof HTMLTextAreaElement) {
      return element.value.trim() !== '';
    }
    return false;
  }
  
  function getElementInfo(element: Element) {
    return {
      tagName: element.tagName,
      type: (element as HTMLInputElement).type,
      name: (element as HTMLInputElement).name,
      id: element.id,
      className: element.className,
      placeholder: (element as HTMLInputElement).placeholder,
      value: (element as HTMLInputElement).value,
      textContent: element.textContent?.trim(),
      required: (element as HTMLInputElement).required,
      attributes: Array.from(element.attributes).map(attr => ({name: attr.name, value: attr.value})),
      label: findAssociatedLabel(element)
    };
  }
  
  function findAssociatedLabel(element: Element): string | null {
    // Try to find a label that references this element by ID
    if (element.id) {
      const label = document.querySelector(`label[for="${element.id}"]`);
      if (label) return label.textContent?.trim() || null;
    }
  
    // Check if the element is wrapped in a label
    const parentLabel = element.closest('label');
    if (parentLabel) return parentLabel.textContent?.trim() || null;
  
    // Look for a preceding label or text node
    let previousElement = element.previousElementSibling;
    while (previousElement) {
      if (previousElement.tagName === 'LABEL' || previousElement.nodeType === Node.TEXT_NODE) {
        return previousElement.textContent?.trim() || null;
      }
      previousElement = previousElement.previousElementSibling;
    }
  
    return null;
  }

 

  
  async function handleSelectField(selectElement: HTMLSelectElement, value: string) {
    const normalizedValue = value.toLowerCase().trim();
    
    // First try exact match
    const exactOption = Array.from(selectElement.options).find(opt => 
      opt.value.toLowerCase() === normalizedValue || 
      opt.textContent?.toLowerCase() === normalizedValue
    );
  
    if (exactOption) {
      selectElement.value = exactOption.value;
      return;
    }
  
    // Then try partial match
    const partialOption = Array.from(selectElement.options).find(opt => 
      opt.value.toLowerCase().includes(normalizedValue) || 
      opt.textContent?.toLowerCase().includes(normalizedValue)
    );
  
    if (partialOption) {
      selectElement.value = partialOption.value;
      return;
    }
  
    console.warn(`No matching option found for "${value}" in ${selectElement.name}`);
  }
  
  let totalToken = 0;
  async function queryLLM(prompt: string) {
    try {
      const result = await chatSession.sendMessage(prompt);
      const response = result.response.text().trim();
      totalToken = result.response.usageMetadata?.totalTokenCount || 0;
      console.log('Total tokens used:', totalToken);
      return cleanResponse(response);
    } catch (error) {
      console.error('Error querying LLM:', error);
      return null;
    }
  }
  
  function cleanResponse(response: string): string {
    const lines = response.split('\n');
    return lines[lines.length - 1].trim();
  }
 
  chrome.runtime.sendMessage({ action: 'contentScriptReady' });
  
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if(message.action === 'sendData') {
      jobDetails = message.jobDetails;
      resumeText = message.resumeText;
      tabId = message.tabId;

      console.log("Received data in new tab:", jobDetails);
  
      // Handle the job application asynchronously
      handleJobApplication().then(() => {
        sendResponse({ success: true });
      }).catch((error) => {
        console.error("Error in handleJobApplication:", error);
        sendResponse({ success: false, error: error.message });
      });
  
      // Return true to indicate that the response will be sent asynchronously
      return true;
    }

  else if (message.type === MessageType.RESUME_APPLICATION) {
        console.log('Resuming application process after URL change');
        handleJobApplication();
      }
  });

setTimeout(() => {
    chrome.runtime.sendMessage({ type: MessageType.COMPLETED, status: "TIME_EXCEEDED", tabId: tabId})
},120000)
 