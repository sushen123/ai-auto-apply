// messages.ts
export enum MessageType {
    GENERAL_CLICK = 'GENERAL_CLICK',
    START_AUTO_APPLYING = 'START_AUTO_APPLYING',
    START_JOB_SEARCH = 'START_JOB_SEARCH',
    PROCESS_JOBS = 'PROCESS_JOBS',
    JOB_IDS_EXTRACTED = 'JOB_IDS_EXTRACTED',
    PROCESS_NEXT_JOB = 'PROCESS_NEXT_JOB',
    OPEN_JOB_PAGE = 'OPEN_JOB_PAGE',
    OPEN_INDEED_JOB_PAGE = 'OPEN_INDEED_JOB_PAGE',
    INDEED_JOB_IDS_EXTRACTED = 'INDEED_JOB_IDS_EXTRACTED',
    APPLY_FOR_JOB = 'APPLY_FOR_JOB',
    JOB_DATA_EXTRACTED = 'JOB_DATA_EXTRACTED',
    CLEAR_JOB_IDS = 'CLEAR_JOB_IDS',
    CLOSE_LINKEDIN_JOB_TAB = 'CLOSE_LINKEDIN_JOB_TAB',
    NEW_APPLY_TAB_OPENED = 'NEW_APPLY_TAB_OPENED',
    ALL_JOBS_PROCESSED = 'ALL_JOBS_PROCESSED',
    RATE_LIMIT = "RATE_LIMIT",
    START_INDEED_JOB_SEARCH = 'START_INDEED_JOB_SEARCH',
    COMPLETED = 'COMPLETED',
    CONTINUE = 'CONTINUE',
    RESUME_APPLICATION = 'RESUME_APPLICATION'
  }
  
  export interface GeneralClickMessage {
    type: MessageType.GENERAL_CLICK;
    elementType: string;
  }
  
  export interface StartAutoApplyingMessage {
    type: MessageType.START_AUTO_APPLYING;
    jobBoards: {
      linkedin: boolean;
      indeed: boolean;
      glassdoor: boolean;
    };
  }
  
  export type Message = GeneralClickMessage | StartAutoApplyingMessage;