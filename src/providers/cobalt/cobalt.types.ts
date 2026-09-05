export interface CobaltSuccessRedirect {
  status: 'redirect';
  url: string;
  filename: string;
}

export interface CobaltSuccessTunnel {
  status: 'tunnel';
  url: string;
  filename: string;
}

export interface CobaltPickerItem {
  type: 'photo' | 'video' | 'gif';
  url: string;
  thumb?: string;
}

export interface CobaltSuccessPicker {
  status: 'picker';
  audio?: string;
  audioFilename?: string;
  picker: CobaltPickerItem[];
}

export interface CobaltLocalProcessing {
  status: 'local-processing';
  type: string;
  service: string;
  tunnel: string[];
  output: {
    type?: string;
    filename: string;
  };
}

export interface CobaltErrorResponse {
  status: 'error';
  error: {
    code: string;
    context?: Record<string, unknown>;
  };
}

export type CobaltApiResponse =
  | CobaltSuccessRedirect
  | CobaltSuccessTunnel
  | CobaltSuccessPicker
  | CobaltLocalProcessing
  | CobaltErrorResponse;

export interface CobaltInstanceInfo {
  cobalt?: {
    version?: string;
    url?: string;
    startTime?: number;
    durationLimit?: number;
    services?: string[];
  };
}
