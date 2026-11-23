export interface Environment {
  /** Prefix for asset URLs. Empty means relative to the base href. */
  assetBaseUrl: string;
  apiUrl: string;
  userPoolId: string;
  userPoolClientId: string;
  region: string;
}

export const environment: Environment = {
  assetBaseUrl: '',
  apiUrl: '',
  userPoolId: '',
  userPoolClientId: '',
  region: '',
};
