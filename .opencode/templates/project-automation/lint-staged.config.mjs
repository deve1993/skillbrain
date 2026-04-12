export default {
  '*.{ts,tsx}': [
    'eslint --fix',
    () => 'tsc --noEmit',
  ],
  '*.{ts,tsx,js,jsx,json,css,md}': [
    'prettier --write',
  ],
};
