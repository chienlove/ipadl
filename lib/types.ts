export interface AuthResponse {
  success: boolean;
  dsid?: string;
  error?: string;
  requires2FA?: boolean;
}

export interface VerifyResponse {
  success: boolean;
  dsid?: string;
  verified2FA?: boolean;
  error?: string;
}

export interface DownloadResponse {
  success: boolean;
  downloadUrl?: string;
  error?: string;
}