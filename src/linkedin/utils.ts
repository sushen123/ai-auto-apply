export async function getActiveTab(): Promise<chrome.tabs.Tab[]> {
  return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          resolve(tabs);
      });
  });
}

export async function openJobTab(jobUrl: string): Promise<void> {
  const currentTab = await getActiveTab();

  try {
      const jobTab = await chrome.tabs.create({ url: jobUrl });
      await chrome.tabs.update(jobTab.id, { active: true }); // Activate the newly created tab
      if (currentTab.length > 0) {
          await chrome.tabs.remove(currentTab[0].id); // Close the current tab if it exists
      }
      chrome.runtime.sendMessage({ type: 'tabLoaded' });
  } catch (err) {
      console.error("Error at openJobTab:", err);
  }
}

export async function executeScriptWithDelay(tabId: number, func: (...args: any[]) => void, ...args: any[]): Promise<void> {
  await chrome.scripting.executeScript({
      target: { tabId },
      func,
      args
  });
  console.log("Script done");
}

export async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function simulateMouseEvent(element: HTMLElement, eventName: string, coordX: number, coordY: number): void {
  element.dispatchEvent(new MouseEvent(eventName, {
      view: window,
      bubbles: true,
      cancelable: true,
      clientX: coordX,
      clientY: coordY,
      button: 0
  }));
}

export async function moveMouseTo(element: HTMLElement): Promise<void> {
  const rect = element.getBoundingClientRect();
  const coordX = rect.left + (rect.right - rect.left) / 2;
  const coordY = rect.top + (rect.bottom - rect.top) / 2;

  simulateMouseEvent(element, "mousedown", coordX, coordY);
  simulateMouseEvent(element, "mouseup", coordX, coordY);
  simulateMouseEvent(element, "click", coordX, coordY);
}